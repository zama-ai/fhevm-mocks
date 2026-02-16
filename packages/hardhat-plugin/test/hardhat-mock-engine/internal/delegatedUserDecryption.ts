import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import type { ethers as EthersT } from "ethers";
import { ethers, fhevm } from "hardhat";
import * as hre from "hardhat";

import { SmartWalletWithDelegation, TestConfidentialERC20Mintable } from "../../../typechain-types";
import { deployConfidentialERC20Fixture } from "../confidentialERC20/ConfidentialERC20.fixture";
import { waitNBlocks } from "../utils";

export async function timestampNowAdjusted(): Promise<number> {
  const blockTimestamp: number | undefined = (await hre.ethers.provider.getBlock("latest"))?.timestamp;
  if (blockTimestamp === undefined) {
    return Math.floor(Date.now() / 1000);
  }
  return blockTimestamp + 100;
}

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

export const delegatedUserDecryptSingleHandle = async (
  handle: `0x${string}`,
  contractAddress: `0x${string}`,
  delegatorAddress: `0x${string}`,
  delegateAddress: `0x${string}`,
  signer: EthersT.Signer,
  delegatePrivateKey: string,
  delegatePublicKey: string,
): Promise<bigint | boolean | string> => {
  const handleContractPairs = [
    {
      handle,
      contractAddress,
    },
  ];
  const startTimeStamp = Math.floor(Date.now() / 1000);
  const durationDays = 10;
  const contractAddresses = [contractAddress];

  // The `delegate` creates a EIP712 with the `delegator` address
  const eip712 = fhevm.createDelegatedUserDecryptEIP712(
    delegatePublicKey,
    contractAddresses,
    delegatorAddress,
    startTimeStamp,
    durationDays,
  );

  // Update the signing to match the new primaryType
  const delegateSignature = await signer.signTypedData(
    eip712.domain,
    {
      DelegatedUserDecryptRequestVerification: eip712.types.DelegatedUserDecryptRequestVerification,
    } as unknown as Record<string, Array<EthersT.TypedDataField>>,
    eip712.message,
  );

  const result = await fhevm.delegatedUserDecrypt(
    handleContractPairs,
    delegatePrivateKey,
    delegatePublicKey,
    delegateSignature,
    contractAddresses,
    delegatorAddress,
    delegateAddress,
    startTimeStamp,
    durationDays,
  );

  return result[handle];
};

describe("xxx Delegated user decryption", function () {
  let signers: Signers;
  let token: TestConfidentialERC20Mintable;
  let tokenAddress: `0x${string}`;
  let smartWallet: SmartWalletWithDelegation;
  let smartWalletAddress: `0x${string}`;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2], carol: ethSigners[3] };
  });

  beforeEach(async function () {
    // Deploy token
    token = await deployConfidentialERC20Fixture(
      signers.alice,
      "Zama Confidential Token",
      "ZAMA",
      await signers.alice.getAddress(),
    );
    tokenAddress = (await token.getAddress()) as `0x${string}`;

    // Deploy SmartWalletWithDelegation with Bob as the owner.
    const smartWalletFactory = await ethers.getContractFactory("SmartWalletWithDelegation");
    smartWallet = await smartWalletFactory.connect(signers.bob).deploy(signers.bob.address);
    await smartWallet.waitForDeployment();
    smartWalletAddress = (await smartWallet.getAddress()) as `0x${string}`;

    // Alice mints tokens to herself.
    const mintAmount = 1000000n;
    const mintTx = await token.connect(signers.alice).mint(signers.alice, mintAmount);
    await mintTx.wait();

    // Alice transfers some tokens to the smartWallet contract.
    const transferAmount = 500000n;
    const encryptedTransferAmount = await fhevm
      .createEncryptedInput(tokenAddress, signers.alice.address)
      .add64(transferAmount)
      .encrypt();

    const transferTx = await token
      .connect(signers.alice)
      [
        "transfer(address,bytes32,bytes)"
      ](smartWalletAddress, encryptedTransferAmount.handles[0], encryptedTransferAmount.inputProof);
    await transferTx.wait();
  });

  it("test delegated user decryption - smartWallet owner delegates his own EOA to decrypt the smartWallet balance", async function () {
    // Bob (smartWallet owner) delegates decryption rights to his own EOA.
    const expirationTimestamp = (await timestampNowAdjusted()) + 86400; // 24 hours from now
    const delegateTx = await smartWallet
      .connect(signers.bob)
      .delegateUserDecryption(signers.bob.address, tokenAddress, expirationTimestamp);
    await delegateTx.wait();

    // Get the encrypted balance handle of the smartWallet.
    const balanceHandle = (await token.balanceOf(smartWalletAddress)) as `0x${string}`;

    // Bob's EOA can now decrypt the smartWallet's confidential balance.
    const { publicKey, privateKey } = fhevm.generateKeypair();

    const decryptedBalance = await delegatedUserDecryptSingleHandle(
      balanceHandle,
      tokenAddress,
      smartWalletAddress, // delegatorAddress
      signers.bob.address as `0x${string}`, //delegateAddress
      signers.bob,
      privateKey,
      publicKey,
    );

    // Verify the decrypted balance matches what was transferred.
    expect(decryptedBalance).to.equal(500000n);
  });

  it("test delegated user decryption - smartWallet owner delegates a third EOA to decrypt the smartWallet balance", async function () {
    // Bob (smartWallet owner) delegates decryption rights to Carol's EOA.
    const expirationTimestamp = (await timestampNowAdjusted()) + 86400; // 24 hours from now
    const delegateTx = await smartWallet
      .connect(signers.bob)
      .delegateUserDecryption(signers.carol.address, tokenAddress, expirationTimestamp);
    await delegateTx.wait();

    // Get the encrypted balance handle of the smartWallet.
    const balanceHandle = (await token.balanceOf(smartWalletAddress)) as `0x${string}`;

    // Carol's EOA can now decrypt the smartWallet's confidential balance.
    const { publicKey, privateKey } = fhevm.generateKeypair();

    const decryptedBalance = await delegatedUserDecryptSingleHandle(
      balanceHandle,
      tokenAddress,
      smartWalletAddress, //delegatorAddress
      signers.carol.address as `0x${string}`, //delegateAddress
      signers.carol,
      privateKey,
      publicKey,
    );

    // Verify the decrypted balance matches what was transferred.
    expect(decryptedBalance).to.equal(500000n);
  });

  it("test delegated user decryption - smartWallet can execute transference of funds to a third EOA", async function () {
    // First, Bob needs to delegate so the smartWallet can initiate transfers.
    const expirationTimestamp = (await timestampNowAdjusted()) + 86400; // 24 hours from now
    const delegateTx = await smartWallet
      .connect(signers.bob)
      .delegateUserDecryption(signers.bob.address, tokenAddress, expirationTimestamp);
    await delegateTx.wait();

    // Get the current smartWallet balance before transfer
    const smartWalletBalanceBefore = (await token.balanceOf(smartWalletAddress)) as `0x${string}`;

    const { publicKey: pkBefore, privateKey: skBefore } = fhevm.generateKeypair();
    const decryptedBalanceBefore = await delegatedUserDecryptSingleHandle(
      smartWalletBalanceBefore,
      tokenAddress,
      smartWalletAddress,
      signers.bob.address as `0x${string}`,
      signers.bob,
      skBefore,
      pkBefore,
    );

    // Bob proposes a transaction from the smartWallet to transfer tokens to Carol.
    // The encrypted input must be created for the smartWallet address since it will be the msg.sender.
    const transferAmount = 100000n;
    const input = fhevm.createEncryptedInput(tokenAddress, smartWalletAddress);
    input.add64(transferAmount);
    const encryptedTransferAmount = await input.encrypt();

    // Encode the transfer function call with full signature to avoid ambiguity.
    const transferData = token.interface.encodeFunctionData("transfer(address,bytes32,bytes)", [
      signers.carol.address,
      encryptedTransferAmount.handles[0],
      encryptedTransferAmount.inputProof,
    ]);

    // Propose the transaction.
    const proposeTx = await smartWallet.connect(signers.bob).proposeTx(tokenAddress, transferData);
    await proposeTx.wait();

    // Get the transaction ID.
    const txId = await smartWallet.txCounter();

    // Execute the transaction.
    const executeTx = await smartWallet.connect(signers.bob).executeTx(txId);
    await executeTx.wait();

    // Verify the smartWallet balance decreased.
    const smartWalletBalanceAfter = (await token.balanceOf(smartWalletAddress)) as `0x${string}`;
    const { publicKey: pkAfter, privateKey: skAfter } = fhevm.generateKeypair();
    const decryptedBalanceAfter = await delegatedUserDecryptSingleHandle(
      smartWalletBalanceAfter,
      tokenAddress,
      smartWalletAddress,
      signers.bob.address as `0x${string}`,
      signers.bob,
      skAfter,
      pkAfter,
    );

    // The smartWallet balance should have decreased by the transfer amount.
    expect(Number(decryptedBalanceBefore) - Number(decryptedBalanceAfter)).to.equal(Number(transferAmount));
  });

  it("test delegated user decryption - smartWallet revokes the delegation of user decryption to an EOA", async function () {
    // First, ensure Bob has delegation.
    const expirationTimestamp = (await timestampNowAdjusted()) + 86400; // 24 hours from now
    const delegateTx = await smartWallet
      .connect(signers.bob)
      .delegateUserDecryption(signers.bob.address, tokenAddress, expirationTimestamp);
    await delegateTx.wait();

    // Revoke the delegation for Bob's EOA.
    const revokeTx = await smartWallet
      .connect(signers.bob)
      .revokeUserDecryptionDelegation(signers.bob.address, tokenAddress);
    await revokeTx.wait();

    // Wait for 15 blocks to ensure revocation is propagated by the coprocessor.
    await waitNBlocks(hre, 15);

    // Try to decrypt the smartWallet balance with Bob's EOA, which should now fail.
    const balanceHandle = (await token.balanceOf(smartWalletAddress)) as `0x${string}`;
    const { publicKey, privateKey } = fhevm.generateKeypair();

    await expect(
      delegatedUserDecryptSingleHandle(
        balanceHandle,
        tokenAddress,
        smartWalletAddress,
        signers.bob.address as `0x${string}`,
        signers.bob,
        privateKey,
        publicKey,
      ),
    ).to.be.rejectedWith(new RegExp("^Delegate (.+) is not authorized to user decrypt handle (.+) on behalf of (.+)!"));
  });
});
