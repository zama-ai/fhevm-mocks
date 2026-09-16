import { expect } from 'chai';
import { ethers, fhevm } from 'hardhat';
import * as hre from 'hardhat';

import type {
  FHECounterUserDecrypt,
  SmartWalletWithDelegation,
  WildcardDelegationTarget,
} from '../../../typechain-types';
import type { Signers } from '../signers';
import { getSigners, initSigners } from '../signers';
import { waitNBlocks } from '../utils';
import { delegatedUserDecryptSingleHandle, timestampNowAdjusted } from './delegatedUserDecryptionERC20';

// Wildcard delegation: the delegator grants decryption rights for EVERY contract in one entry, keyed on
// the ACL's `WILDCARD_DELEGATION_ADDRESS()` sentinel instead of an app address.
//
// `ACL.isHandleDelegatedForUserDecryption` reads:
//
//   persistAllowed(handle, delegator) && persistAllowed(handle, contractAddress)
//     && (delegation(delegator, delegate, WILDCARD) || delegation(delegator, delegate, contractAddress))
//
// Both halves matter, and the negative tests below pin each one. Wildcard replaces the second line's
// per-contract entry; it never relaxes the first. So a wildcard holder still cannot read a handle the
// delegator does not own, nor claim it against a contract that was never allowed on it.
//
// The v3 twin of this file is `test/internal/delegatedUserDecryptionWildcard.ts`, itself ported from the
// fhevm test-suite. That suite drives a live relayer and separates failures by a `not_allowed_on_host_acl`
// label; the cleartext relayer reads the ACL directly, so every rejection here surfaces as the same SDK
// message and `NOT_DELEGATED` matches them all.

type Hex = `0x${string}`;

const NOT_DELEGATED = new RegExp(
  '^Delegate (.+) is not delegated by (.+) to user decrypt handle (.+) on contract (.+)!',
);

const ONE_DAY_SECONDS = 24 * 60 * 60;
// Long enough that nothing expires mid-test, short enough to step past with one `evm_increaseTime`.
const SHORT_EXPIRY_SECONDS = 75;
// Blocks to let a revocation settle, matching the sibling suite.
const PROPAGATION_BLOCKS = 15;

// Distinct values per fixture so an assertion names what it is reading rather than a bare numeral.
const COUNTER_VALUE = 7;
const TARGET_B_VALUE = 424242n;
const TARGET_C_VALUE = 777n;
const TARGET_D_VALUE = 314159n;
const ALICE_ONLY_VALUE = 123n;

// `address(type(uint160).max)`, checksummed the way the ACL returns it.
const EXPECTED_WILDCARD_ADDRESS = ethers.getAddress('0xffffffffffffffffffffffffffffffffffffffff');

const ACL_ABI = [
  'function WILDCARD_DELEGATION_ADDRESS() view returns (address)',
  'function delegateForUserDecryption(address delegate, address contractAddress, uint64 expirationDate)',
];

// The two ACL entry points this file touches directly. Typed by hand, because the ACL is not part of the
// suite's typechain output, and DERIVED from the hardhat `ethers` rather than imported from the `ethers`
// package, so the file adds no dependency for two type names.
type ContractRunnerLike = ConstructorParameters<typeof ethers.Contract>[2];
type SentTransaction = { wait(): Promise<unknown> };

type AclWildcardView = {
  WILDCARD_DELEGATION_ADDRESS(): Promise<string>;
  delegateForUserDecryption(
    delegate: string,
    contractAddress: string,
    expirationDate: bigint,
  ): Promise<SentTransaction>;
};

describe('Delegated user decryption — wildcard', function () {
  let signers: Signers;
  let wildcardAddress: Hex;

  // App A: the counter, incremented BY the wallet so the wallet owns the handle.
  let counter: FHECounterUserDecrypt;
  let counterAddress: Hex;
  // App B: a second app contract, so "covers two distinct contracts" is a real claim.
  let targetBAddress: Hex;
  let handleOnB: Hex;

  let smartWallet: SmartWalletWithDelegation;
  let smartWalletAddress: Hex;

  before(async function () {
    if (!hre.fhevm.isCleartext) {
      throw new Error(`This hardhat test suite can only run on a cleartext node`);
    }
    await initSigners();
    signers = await getSigners();
  });

  // Everything is rebuilt per test. The ACL rejects a second delegation for the same
  // (delegator, delegate, contract) triple carrying the same expiry, and rejects two writes to one
  // triple in a single block, so a shared wallet would make the tests order-dependent.
  beforeEach(async function () {
    const counterFactory = await ethers.getContractFactory('FHECounterUserDecrypt');
    counter = await counterFactory.deploy();
    counterAddress = (await counter.getAddress()) as Hex;

    const smartWalletFactory = await ethers.getContractFactory('SmartWalletWithDelegation');
    smartWallet = await smartWalletFactory.connect(signers.bob).deploy(signers.bob.address);
    await smartWallet.waitForDeployment();
    smartWalletAddress = (await smartWallet.getAddress()) as Hex;

    // Read the sentinel off the deployed ACL rather than hardcoding it; one test then checks the value.
    wildcardAddress = (await (await acl(ethers.provider)).WILDCARD_DELEGATION_ADDRESS()) as Hex;

    await incrementThroughWallet(COUNTER_VALUE);

    ({ address: targetBAddress, handle: handleOnB } = await deployTarget(smartWalletAddress, TARGET_B_VALUE));
  });

  // The stack's ACL, at the address the coprocessor config of any deployed contract reports.
  async function acl(runner: ContractRunnerLike): Promise<AclWildcardView> {
    const { ACLAddress } = await fhevm.getCoprocessorConfig(counterAddress);
    return new ethers.Contract(ACLAddress, ACL_ABI, runner) as unknown as AclWildcardView;
  }

  // The counter's `increment` runs FHE.allow(_count, msg.sender); routing it through the wallet makes
  // the WALLET the owner, which is what a delegator has to be.
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

  // A fresh app contract holding one handle owned by `owner`. Alice pays; the deposit grants the handle
  // to the contract and to `owner`.
  async function deployTarget(owner: string, value: bigint): Promise<{ address: Hex; handle: Hex }> {
    const factory = await ethers.getContractFactory('WildcardDelegationTarget');
    const target = (await factory.connect(signers.alice).deploy()) as WildcardDelegationTarget;
    await target.waitForDeployment();
    const address = (await target.getAddress()) as Hex;

    const input = fhevm.createEncryptedInput(address, signers.alice.address);
    input.add64(value);
    const encrypted = await input.encrypt();
    await (await target.connect(signers.alice).deposit(owner, encrypted.handles[0], encrypted.inputProof)).wait();

    return { address, handle: (await target.euint64Of(owner)) as Hex };
  }

  async function delegate(
    delegateAddress: string,
    contractAddress: string,
    lifetimeSeconds = ONE_DAY_SECONDS,
  ): Promise<number> {
    const expirationTimestamp = (await timestampNowAdjusted()) + lifetimeSeconds;
    const tx = await smartWallet
      .connect(signers.bob)
      .delegateUserDecryption(delegateAddress, contractAddress, expirationTimestamp);
    await tx.wait();
    return expirationTimestamp;
  }

  async function revoke(delegateAddress: string, contractAddress: string): Promise<void> {
    const tx = await smartWallet.connect(signers.bob).revokeUserDecryptionDelegation(delegateAddress, contractAddress);
    await tx.wait();
    await waitNBlocks(hre, PROPAGATION_BLOCKS);
  }

  function readCounterAs(as: keyof Signers, delegator: Hex = smartWalletAddress): Promise<unknown> {
    return counter
      .getCount()
      .then((handle) =>
        delegatedUserDecryptSingleHandle(
          handle as Hex,
          counterAddress,
          delegator,
          signers[as].address as Hex,
          signers[as],
        ),
      );
  }

  function readTargetAs(
    as: keyof Signers,
    handle: Hex,
    contractAddress: Hex,
    delegator: Hex = smartWalletAddress,
  ): Promise<unknown> {
    return delegatedUserDecryptSingleHandle(
      handle,
      contractAddress,
      delegator,
      signers[as].address as Hex,
      signers[as],
    );
  }

  it('exposes WILDCARD_DELEGATION_ADDRESS() at the expected sentinel value', function () {
    expect(wildcardAddress).to.equal(EXPECTED_WILDCARD_ADDRESS);
  });

  describe('happy paths', function () {
    it('one wildcard delegation covers handles on two distinct contracts', async function () {
      await delegate(signers.bob.address, wildcardAddress);

      expect(await readCounterAs('bob')).to.equal(BigInt(COUNTER_VALUE));
      expect(await readTargetAs('bob', handleOnB, targetBAddress)).to.equal(TARGET_B_VALUE);
    });

    it('wildcard covers contracts deployed after the delegation was set', async function () {
      await delegate(signers.bob.address, wildcardAddress);

      // C did not exist when the delegation was written, which is the whole point of a wildcard.
      const { address: targetCAddress, handle: handleOnC } = await deployTarget(smartWalletAddress, TARGET_C_VALUE);

      expect(await readTargetAs('bob', handleOnC, targetCAddress)).to.equal(TARGET_C_VALUE);
    });

    it('wildcard and per-contract delegation can coexist for the same delegate', async function () {
      await delegate(signers.bob.address, counterAddress);
      await delegate(signers.bob.address, wildcardAddress);

      expect(await readCounterAs('bob')).to.equal(BigInt(COUNTER_VALUE));
      expect(await readTargetAs('bob', handleOnB, targetBAddress)).to.equal(TARGET_B_VALUE);
    });
  });

  describe('negative paths', function () {
    it('rejects after the wildcard delegation expires', async function () {
      await delegate(signers.eve.address, wildcardAddress, SHORT_EXPIRY_SECONDS);

      // `timestampNowAdjusted` adds 100s of head-room on top of the lifetime, so step past both.
      await ethers.provider.send('evm_increaseTime', [SHORT_EXPIRY_SECONDS + 100 + 1]);
      await ethers.provider.send('evm_mine', []);

      await expect(readTargetAs('eve', handleOnB, targetBAddress)).to.be.rejectedWith(NOT_DELEGATED);
    });

    it('rejects when the requesting EOA is not the registered wildcard delegate', async function () {
      // Delegations are keyed on (delegator, delegate); a wildcard issued to Eve says nothing about Carol.
      await delegate(signers.eve.address, wildcardAddress);

      await expect(readTargetAs('carol', handleOnB, targetBAddress)).to.be.rejectedWith(NOT_DELEGATED);
    });

    it('does not bypass ownership: rejects when the delegator is not allowed on the handle', async function () {
      await delegate(signers.bob.address, wildcardAddress);

      // Alice deposits under HER OWN address, so the wallet never gains access to this handle.
      const { address: aliceTargetAddress, handle: aliceOnlyHandle } = await deployTarget(
        signers.alice.address,
        ALICE_ONLY_VALUE,
      );

      await expect(readTargetAs('bob', aliceOnlyHandle, aliceTargetAddress)).to.be.rejectedWith(NOT_DELEGATED);
    });

    it('does not bypass ownership: rejects when the app contract is not allowed on the handle', async function () {
      await delegate(signers.bob.address, wildcardAddress);

      // The counter issued this handle; targetB was never allowed on it. A wildcard authorizes the
      // delegate, not the app contract's access.
      const countHandle = (await counter.getCount()) as Hex;
      await expect(
        delegatedUserDecryptSingleHandle(
          countHandle,
          targetBAddress,
          smartWalletAddress,
          signers.bob.address as Hex,
          signers.bob,
        ),
      ).to.be.rejectedWith(NOT_DELEGATED);
    });

    it('does not allow transitive delegation: a wildcard recipient cannot re-grant onward', async function () {
      await delegate(signers.carol.address, wildcardAddress);

      // Carol wildcard-delegates onward to Dave from her own EOA. That entry is (Carol, Dave) and has no
      // bearing on handles the wallet owns.
      const expiration = BigInt((await timestampNowAdjusted()) + ONE_DAY_SECONDS);
      const carolAcl = await acl(signers.carol);
      await (await carolAcl.delegateForUserDecryption(signers.dave.address, wildcardAddress, expiration)).wait();

      await expect(readTargetAs('dave', handleOnB, targetBAddress)).to.be.rejectedWith(NOT_DELEGATED);
    });
  });

  describe('revocation matrix', function () {
    it('revoking the wildcard leaves the per-contract entry active', async function () {
      await delegate(signers.carol.address, wildcardAddress);
      await delegate(signers.carol.address, counterAddress);
      await revoke(signers.carol.address, wildcardAddress);

      // The counter still resolves through the surviving per-contract entry.
      expect(await readCounterAs('carol')).to.equal(BigInt(COUNTER_VALUE));
      // B has no entry of its own, so it goes with the wildcard.
      await expect(readTargetAs('carol', handleOnB, targetBAddress)).to.be.rejectedWith(NOT_DELEGATED);
    });

    it('revoking the per-contract entry leaves the wildcard active', async function () {
      await delegate(signers.carol.address, wildcardAddress);
      await delegate(signers.carol.address, counterAddress);
      await revoke(signers.carol.address, counterAddress);

      expect(await readCounterAs('carol')).to.equal(BigInt(COUNTER_VALUE));
      expect(await readTargetAs('carol', handleOnB, targetBAddress)).to.equal(TARGET_B_VALUE);
    });

    it('revoking both entries rejects on every contract', async function () {
      await delegate(signers.carol.address, wildcardAddress);
      await delegate(signers.carol.address, counterAddress);
      await revoke(signers.carol.address, wildcardAddress);
      await revoke(signers.carol.address, counterAddress);

      await expect(readCounterAs('carol')).to.be.rejectedWith(NOT_DELEGATED);
      await expect(readTargetAs('carol', handleOnB, targetBAddress)).to.be.rejectedWith(NOT_DELEGATED);
    });
  });

  describe('independence', function () {
    it("revoking one delegator's wildcard does not affect another delegator's", async function () {
      // A second wallet, owned by Dave, with its own handle on its own app contract.
      const walletYFactory = await ethers.getContractFactory('SmartWalletWithDelegation');
      const walletY = (await walletYFactory
        .connect(signers.dave)
        .deploy(signers.dave.address)) as SmartWalletWithDelegation;
      await walletY.waitForDeployment();
      const walletYAddress = (await walletY.getAddress()) as Hex;

      const { address: targetDAddress, handle: handleForY } = await deployTarget(walletYAddress, TARGET_D_VALUE);

      const expiration = (await timestampNowAdjusted()) + ONE_DAY_SECONDS;
      await (
        await smartWallet
          .connect(signers.bob)
          .delegateUserDecryption(signers.carol.address, wildcardAddress, expiration)
      ).wait();
      await (
        await walletY.connect(signers.dave).delegateUserDecryption(signers.carol.address, wildcardAddress, expiration)
      ).wait();

      await revoke(signers.carol.address, wildcardAddress);

      // Bob's wildcard is gone; Dave's is untouched.
      await expect(readTargetAs('carol', handleOnB, targetBAddress)).to.be.rejectedWith(NOT_DELEGATED);
      expect(await readTargetAs('carol', handleForY, targetDAddress, walletYAddress)).to.equal(TARGET_D_VALUE);
    });
  });
});
