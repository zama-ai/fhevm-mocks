import { expect } from 'chai';
import { network } from 'hardhat';

import type {
  FHECounterUserDecrypt,
  FHECounterUserDecrypt__factory,
  SmartWalletWithDelegation,
  SmartWalletWithDelegation__factory,
} from '../../types/ethers-contracts/index.ts';
import { waitNBlocks } from '../utils/blocks.ts';
import { type Accounts, type Signers, getAccounts, getSigners } from '../utils/signers.ts';

// The v2 file runs this scenario on a ConfidentialERC20 balance; that corpus (and its OpenZeppelin
// dependency) lands with E2E-0b. Until then the counter plays the confidential asset: the smart
// wallet increments it through its own transaction, so the wallet — not an EOA — owns the handle.

const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;

const NOT_DELEGATED = /^Delegate (.+) is not delegated by (.+) to user decrypt handle (.+) on contract (.+)!/;

// chai-as-promised is not typed in this suite; the assertion is spelled out instead.
async function expectRejectedWith(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  let message: string | undefined;
  try {
    await promise;
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  if (message === undefined) throw new Error('expected the promise to reject');
  expect(message).to.match(pattern);
}

async function timestampNowAdjusted(): Promise<number> {
  const blockTimestamp: number | undefined = (await ethers.provider.getBlock('latest'))?.timestamp;
  if (blockTimestamp === undefined) {
    return Math.floor(Date.now() / 1000);
  }
  return blockTimestamp + 100;
}

describe('Delegated user decryption', function () {
  let signers: Signers;
  let accounts: Accounts;
  let counter: FHECounterUserDecrypt;
  let counterAddress: Hex;
  let smartWallet: SmartWalletWithDelegation;
  let smartWalletAddress: Hex;

  before(async function () {
    signers = await getSigners(connection);
    accounts = getAccounts();
  });

  beforeEach(async function () {
    if (!fhevm.isCleartext) {
      throw new Error(`This hardhat test suite can only run on a cleartext node`);
    }

    const counterFactory: FHECounterUserDecrypt__factory = await ethers.getContractFactory('FHECounterUserDecrypt');
    counter = await counterFactory.deploy();
    counterAddress = (await counter.getAddress()) as Hex;

    // Deploy SmartWalletWithDelegation with Bob as the owner.
    const smartWalletFactory: SmartWalletWithDelegation__factory =
      await ethers.getContractFactory('SmartWalletWithDelegation');
    smartWallet = await smartWalletFactory.connect(signers.bob).deploy(signers.bob.address);
    await smartWallet.waitForDeployment();
    smartWalletAddress = (await smartWallet.getAddress()) as Hex;

    // The smart wallet increments the counter by 7 through its own transaction, so `FHE.allow(_count,
    // msg.sender)` grants the WALLET. The input is encrypted for the wallet, the future msg.sender.
    await incrementThroughWallet(7);
  });

  async function incrementThroughWallet(value: number): Promise<void> {
    const encrypted = await fhevm.helpers.encryptUint32({
      value: value,
      contractAddress: counterAddress,
      userAddress: smartWalletAddress,
    });
    const handle = encrypted.externalEuint32;

    const data = counter.interface.encodeFunctionData('increment', [handle, encrypted.inputProof]);
    const proposeTx = await smartWallet.connect(signers.bob).proposeTx(counterAddress, data);
    await proposeTx.wait();
    const txId = await smartWallet.txCounter();
    const executeTx = await smartWallet.connect(signers.bob).executeTx(txId);
    await executeTx.wait();
  }

  async function delegate(delegateAddress: string): Promise<void> {
    const expirationTimestamp = (await timestampNowAdjusted()) + 86400; // 24 hours from now
    const tx = await smartWallet
      .connect(signers.bob)
      .delegateUserDecryption(delegateAddress, counterAddress, expirationTimestamp);
    await tx.wait();
  }

  it('smartWallet owner delegates his own EOA to decrypt the smartWallet count', async function () {
    await delegate(signers.bob.address);
    const countHandle = (await counter.getCount()) as Hex;

    const clearCount = await fhevm.helpers.decryptUint32({
      euint32: countHandle,
      contractAddress: counterAddress,
      userAddress: accounts.bob.address,
      options: {
        delegatorAddress: smartWalletAddress,
      },
    });
    expect(clearCount).to.equal(7);
  });

  it('smartWallet owner delegates a third EOA to decrypt the smartWallet count', async function () {
    await delegate(signers.carol.address);
    const countHandle = (await counter.getCount()) as Hex;

    const clearCount = await fhevm.helpers.decryptUint32({
      euint32: countHandle,
      contractAddress: counterAddress,
      userAddress: accounts.carol.address,
      options: {
        delegatorAddress: smartWalletAddress,
      },
    });
    expect(clearCount).to.equal(7);
  });

  it('smartWallet can execute another increment and the delegate reads the new count', async function () {
    await delegate(signers.bob.address);
    await incrementThroughWallet(5);
    const countHandle = (await counter.getCount()) as Hex;

    const clearCount = await fhevm.helpers.decryptUint32({
      euint32: countHandle,
      contractAddress: counterAddress,
      userAddress: accounts.bob.address,
      options: {
        delegatorAddress: smartWalletAddress,
      },
    });
    expect(clearCount).to.equal(12);
  });

  it('an EOA without delegation cannot decrypt the smartWallet count', async function () {
    const countHandle = (await counter.getCount()) as Hex;
    await expectRejectedWith(
      fhevm.helpers.decryptUint32({
        euint32: countHandle,
        contractAddress: counterAddress,
        userAddress: accounts.bob.address,
        options: {
          delegatorAddress: smartWalletAddress,
        },
      }),
      NOT_DELEGATED,
    );
  });

  it('smartWallet revokes the delegation of user decryption to an EOA', async function () {
    await delegate(signers.bob.address);
    const revokeTx = await smartWallet
      .connect(signers.bob)
      .revokeUserDecryptionDelegation(signers.bob.address, counterAddress);
    await revokeTx.wait();

    // Wait for 15 blocks to ensure revocation is propagated by the coprocessor.
    await waitNBlocks(connection, 15);

    const countHandle = (await counter.getCount()) as Hex;
    await expectRejectedWith(
      fhevm.helpers.decryptUint32({
        euint32: countHandle,
        contractAddress: counterAddress,
        userAddress: accounts.bob.address,
        options: {
          delegatorAddress: smartWalletAddress,
        },
      }),
      NOT_DELEGATED,
    );
  });
});
