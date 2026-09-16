import { expect } from 'chai';
import { ethers, fhevm } from 'hardhat';
import * as hre from 'hardhat';

import type { FHECounterUserDecrypt, SmartWalletWithDelegation } from '../../../typechain-types';
import type { Signers } from '../signers';
import { getSigners, initSigners } from '../signers';
import { waitNBlocks } from '../utils';
import { delegatedUserDecryptSingleHandle, timestampNowAdjusted } from './delegatedUserDecryptionERC20';

// Per-contract delegated user decryption, on a counter rather than a confidential token: the smart wallet
// increments it through its own transaction, so the WALLET — not an EOA — owns the handle, which is what a
// delegator has to be. The ConfidentialERC20 form of the same scenario is the sibling file, and the
// wildcard form is `delegatedUserDecryptionWildcard.ts`.
//
// The v3 twin is `test/internal/delegatedUserDecryption.ts`.

type Hex = `0x${string}`;

const NOT_DELEGATED = new RegExp(
  '^Delegate (.+) is not delegated by (.+) to user decrypt handle (.+) on contract (.+)!',
);

const ONE_DAY_SECONDS = 24 * 60 * 60;
// Blocks to let a revocation settle, matching the sibling suites.
const PROPAGATION_BLOCKS = 15;

describe('Delegated user decryption', function () {
  let signers: Signers;
  let counter: FHECounterUserDecrypt;
  let counterAddress: Hex;
  let smartWallet: SmartWalletWithDelegation;
  let smartWalletAddress: Hex;

  before(async function () {
    if (!hre.fhevm.isCleartext) {
      throw new Error(`This hardhat test suite can only run on a cleartext node`);
    }
    await initSigners();
    signers = await getSigners();
  });

  beforeEach(async function () {
    const counterFactory = await ethers.getContractFactory('FHECounterUserDecrypt');
    counter = await counterFactory.deploy();
    counterAddress = (await counter.getAddress()) as Hex;

    // Deploy SmartWalletWithDelegation with Bob as the owner.
    const smartWalletFactory = await ethers.getContractFactory('SmartWalletWithDelegation');
    smartWallet = await smartWalletFactory.connect(signers.bob).deploy(signers.bob.address);
    await smartWallet.waitForDeployment();
    smartWalletAddress = (await smartWallet.getAddress()) as Hex;

    // The smart wallet increments the counter by 7 through its own transaction, so `FHE.allow(_count,
    // msg.sender)` grants the WALLET. The input is encrypted for the wallet, the future msg.sender.
    await incrementThroughWallet(7);
  });

  async function incrementThroughWallet(value: number): Promise<void> {
    const input = fhevm.createEncryptedInput(counterAddress, smartWalletAddress);
    input.add32(value);
    const encrypted = await input.encrypt();

    const data = counter.interface.encodeFunctionData('increment', [encrypted.handles[0], encrypted.inputProof]);
    const proposeTx = await smartWallet.connect(signers.bob).proposeTx(counterAddress, data);
    await proposeTx.wait();
    const txId = await smartWallet.txCounter();
    const executeTx = await smartWallet.connect(signers.bob).executeTx(txId);
    await executeTx.wait();
  }

  async function delegate(
    delegateAddress: string,
    contractAddress: string = counterAddress,
    lifetimeSeconds = ONE_DAY_SECONDS,
  ): Promise<void> {
    const expirationTimestamp = (await timestampNowAdjusted()) + lifetimeSeconds;
    const tx = await smartWallet
      .connect(signers.bob)
      .delegateUserDecryption(delegateAddress, contractAddress, expirationTimestamp);
    await tx.wait();
  }

  // The counter handle, read back by `as` acting as a delegate of the smart wallet.
  function readCountAs(as: keyof Signers): Promise<unknown> {
    return counter
      .getCount()
      .then((handle) =>
        delegatedUserDecryptSingleHandle(
          handle as Hex,
          counterAddress,
          smartWalletAddress,
          signers[as].address as Hex,
          signers[as],
        ),
      );
  }

  it('smartWallet owner delegates his own EOA to decrypt the smartWallet count', async function () {
    await delegate(signers.bob.address);

    expect(await readCountAs('bob')).to.equal(7n);
  });

  it('smartWallet owner delegates a third EOA to decrypt the smartWallet count', async function () {
    await delegate(signers.carol.address);

    expect(await readCountAs('carol')).to.equal(7n);
  });

  it('smartWallet can execute another increment and the delegate reads the new count', async function () {
    await delegate(signers.bob.address);
    await incrementThroughWallet(5);

    expect(await readCountAs('bob')).to.equal(12n);
  });

  it('an EOA without delegation cannot decrypt the smartWallet count', async function () {
    await expect(readCountAs('bob')).to.be.rejectedWith(NOT_DELEGATED);
  });

  it('a delegation for another contract does not cover the counter handle', async function () {
    // Eve is delegated, but on a different app contract. The delegation table is keyed on the contract,
    // so the entry says nothing about handles the counter issued.
    const otherFactory = await ethers.getContractFactory('FHECounterUserDecrypt');
    const other = await otherFactory.deploy();
    const otherAddress = (await other.getAddress()) as Hex;

    await delegate(signers.eve.address, otherAddress);

    await expect(readCountAs('eve')).to.be.rejectedWith(NOT_DELEGATED);
  });

  it('an expired delegation no longer decrypts the smartWallet count', async function () {
    const lifetimeSeconds = 75;
    await delegate(signers.eve.address, counterAddress, lifetimeSeconds);

    // `timestampNowAdjusted` adds 100s of head-room on top of the lifetime, so step past both.
    await ethers.provider.send('evm_increaseTime', [lifetimeSeconds + 100 + 1]);
    await ethers.provider.send('evm_mine', []);

    await expect(readCountAs('eve')).to.be.rejectedWith(NOT_DELEGATED);
  });

  it('smartWallet revokes the delegation of user decryption to an EOA', async function () {
    await delegate(signers.bob.address);
    const revokeTx = await smartWallet
      .connect(signers.bob)
      .revokeUserDecryptionDelegation(signers.bob.address, counterAddress);
    await revokeTx.wait();

    // Wait for the coprocessor to absorb the revocation.
    await waitNBlocks(hre, PROPAGATION_BLOCKS);

    await expect(readCountAs('bob')).to.be.rejectedWith(NOT_DELEGATED);
  });
});
