import { utils as fhevm_utils } from "@fhevm/mock-utils";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { UserDecryptResults } from "@zama-fhe/relayer-sdk/node";
import { expect } from "chai";
import type { ethers as EthersT } from "ethers";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { HardhatFhevmRuntimeEnvironment } from "../../../src/types";
import { DecryptMultipleValues, DecryptMultipleValues__factory } from "../../../typechain-types";
import { Signers } from "../signers";

async function deployFixture() {
  // Contracts are deployed using the first signer/account by default
  const factory = (await ethers.getContractFactory("DecryptMultipleValues")) as DecryptMultipleValues__factory;
  const decryptMultipleValues = (await factory.deploy()) as DecryptMultipleValues;
  const decryptMultipleValues_address = await decryptMultipleValues.getAddress();

  return { decryptMultipleValues, decryptMultipleValues_address };
}

/**
 * This trivial example demonstrates the FHE decryption mechanism
 * and highlights a common pitfall developers may encounter.
 */
describe("DecryptMultipleValues", function () {
  let contract: DecryptMultipleValues;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    // Deploy a new contract each time we run a new test
    const deployment = await deployFixture();
    contractAddress = deployment.decryptMultipleValues_address;
    contract = deployment.decryptMultipleValues;
  });

  // ✅ Test should succeed
  it("decryption should succeed", async function () {
    const tx = await contract.connect(signers.alice).initialize(true, 123456, 78901234567);
    await tx.wait();

    const encryptedBool = (await contract.encryptedBool()) as `0x${string}`;
    const encryptedUint32 = (await contract.encryptedUint32()) as `0x${string}`;
    const encryptedUint64 = (await contract.encryptedUint64()) as `0x${string}`;

    // The FHEVM Hardhat plugin provides a set of convenient helper functions
    // that make it easy to perform FHEVM operations within your Hardhat environment.
    const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

    const aliceKeypair = fhevm.generateKeypair();

    const startTimestamp = fhevm_utils.timestampNow();
    const durationDays = 365;

    const aliceEip712 = fhevm.createEIP712(aliceKeypair.publicKey, [contractAddress], startTimestamp, durationDays);
    const aliceSignature = await signers.alice.signTypedData(
      aliceEip712.domain,
      { UserDecryptRequestVerification: aliceEip712.types.UserDecryptRequestVerification } as unknown as Record<
        string,
        Array<EthersT.TypedDataField>
      >,
      aliceEip712.message,
    );

    const decrytepResults: UserDecryptResults = await fhevm.userDecrypt(
      [
        { handle: encryptedBool, contractAddress: contractAddress },
        { handle: encryptedUint32, contractAddress: contractAddress },
        { handle: encryptedUint64, contractAddress: contractAddress },
      ],
      aliceKeypair.privateKey,
      aliceKeypair.publicKey,
      aliceSignature,
      [contractAddress],
      signers.alice.address,
      startTimestamp,
      durationDays,
    );

    expect(decrytepResults[encryptedBool]).to.equal(true);
    expect(decrytepResults[encryptedUint32]).to.equal(123456 + 1);
    expect(decrytepResults[encryptedUint64]).to.equal(78901234567 + 1);
  });
});
