import { FhevmType } from '@fhevm/hardhat-plugin-v3';
import { expect } from 'chai';
import { network } from 'hardhat';

import type {
  FHECounterUserDecrypt,
  FHECounterUserDecrypt__factory,
  SmartWalletWithDelegation,
  SmartWalletWithDelegation__factory,
  WildcardDelegationTarget__factory,
} from '../../types/ethers-contracts/index.ts';
import { waitNBlocks } from '../utils/blocks.ts';
import { type Accounts, type Signers, getAccounts, getSigners } from '../utils/signers.ts';

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
// Ported from the fhevm test-suite's `delegatedUserDecryption.ts`. That file drives a live relayer and
// distinguishes failures by a `not_allowed_on_host_acl` label; here the cleartext relayer reads the ACL
// directly, so every rejection below surfaces as the same SDK message and `NOT_DELEGATED` matches them
// all. The per-contract scenarios it also covers live in `delegatedUserDecryption.ts` beside this file.

const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;

const NOT_DELEGATED = /^Delegate (.+) is not delegated by (.+) to user decrypt handle (.+) on contract (.+)!/;

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

// The two ACL entry points this file touches directly. Typed by hand: the ACL is not part of this
// package's typechain output, and only these two members are needed.
//
// Both helper types are DERIVED from the connection's own `ethers` rather than imported from the
// `ethers` package. The suite reaches ethers through the hardhat connection everywhere else, so a direct
// import — even a type-only one — would make `ethers` a dependency this package has to declare and pin
// (rule 4.2.1), for two names.
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

async function blockTimestamp(): Promise<number> {
  const timestamp: number | undefined = (await ethers.provider.getBlock('latest'))?.timestamp;
  if (timestamp === undefined) throw new Error('no latest block');
  return timestamp;
}

describe('Delegated user decryption — wildcard', function () {
  let signers: Signers;
  let accounts: Accounts;
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
    signers = await getSigners(connection);
    accounts = getAccounts();
  });

  // Everything is rebuilt per test. The ACL rejects a second delegation for the same
  // (delegator, delegate, contract) triple carrying the same expiry, and rejects two writes to one
  // triple in a single block, so a shared wallet would make the tests order-dependent.
  beforeEach(async function () {
    if (!fhevm.isCleartext) {
      throw new Error(`This hardhat test suite can only run on a cleartext node`);
    }

    const counterFactory: FHECounterUserDecrypt__factory = await ethers.getContractFactory('FHECounterUserDecrypt');
    counter = await counterFactory.deploy();
    counterAddress = (await counter.getAddress()) as Hex;

    const smartWalletFactory: SmartWalletWithDelegation__factory =
      await ethers.getContractFactory('SmartWalletWithDelegation');
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
    const encrypted = await fhevm.createEncryptedInput(counterAddress, smartWalletAddress).add32(value).encrypt();
    const [handle] = encrypted.handles;
    if (handle === undefined) throw new Error('encrypt() returned no handle');

    const data = counter.interface.encodeFunctionData('increment', [handle, encrypted.inputProof]);
    const proposeTx = await smartWallet.connect(signers.bob).proposeTx(counterAddress, data);
    await proposeTx.wait();
    const txId = await smartWallet.txCounter();
    const executeTx = await smartWallet.connect(signers.bob).executeTx(txId);
    await executeTx.wait();
  }

  // A fresh app contract holding one handle owned by `owner`. Alice pays; the deposit grants the handle
  // to the contract and to `owner`.
  async function deployTarget(owner: string, value: bigint): Promise<{ readonly address: Hex; readonly handle: Hex }> {
    const factory: WildcardDelegationTarget__factory = await ethers.getContractFactory('WildcardDelegationTarget');
    const target = await factory.connect(signers.alice).deploy();
    await target.waitForDeployment();
    const address = (await target.getAddress()) as Hex;

    const encrypted = await fhevm
      .createEncryptedInput(address, signers.alice.address as Hex)
      .add64(value)
      .encrypt();
    const [handle] = encrypted.handles;
    if (handle === undefined) throw new Error('encrypt() returned no handle');
    await (await target.connect(signers.alice).deposit(owner, handle, encrypted.inputProof)).wait();

    return { address, handle: (await target.euint64Of(owner)) as Hex };
  }

  async function delegate(
    delegateAddress: string,
    contractAddress: string,
    lifetimeSeconds = ONE_DAY_SECONDS,
  ): Promise<number> {
    const expirationTimestamp = (await blockTimestamp()) + lifetimeSeconds;
    const tx = await smartWallet
      .connect(signers.bob)
      .delegateUserDecryption(delegateAddress, contractAddress, expirationTimestamp);
    await tx.wait();
    return expirationTimestamp;
  }

  async function revoke(delegateAddress: string, contractAddress: string): Promise<void> {
    const tx = await smartWallet.connect(signers.bob).revokeUserDecryptionDelegation(delegateAddress, contractAddress);
    await tx.wait();
    await waitNBlocks(connection, PROPAGATION_BLOCKS);
  }

  async function readCounter(as: keyof Accounts, delegator: Hex = smartWalletAddress): Promise<unknown> {
    const handle = (await counter.getCount()) as Hex;
    return fhevm.userDecryptEuint(FhevmType.euint32, handle, counterAddress, accounts[as], {
      delegatorAddress: delegator,
    });
  }

  function readTarget(
    as: keyof Accounts,
    handle: Hex,
    contractAddress: Hex,
    delegator: Hex = smartWalletAddress,
  ): Promise<unknown> {
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, contractAddress, accounts[as], {
      delegatorAddress: delegator,
    });
  }

  it('exposes WILDCARD_DELEGATION_ADDRESS() at the expected sentinel value', function () {
    expect(wildcardAddress).to.equal(EXPECTED_WILDCARD_ADDRESS);
  });

  describe('happy paths', function () {
    it('one wildcard delegation covers handles on two distinct contracts', async function () {
      await delegate(signers.bob.address, wildcardAddress);

      expect(await readCounter('bob')).to.equal(BigInt(COUNTER_VALUE));
      expect(await readTarget('bob', handleOnB, targetBAddress)).to.equal(TARGET_B_VALUE);
    });

    it('wildcard covers contracts deployed after the delegation was set', async function () {
      await delegate(signers.bob.address, wildcardAddress);

      // C did not exist when the delegation was written, which is the whole point of a wildcard.
      const { address: targetCAddress, handle: handleOnC } = await deployTarget(smartWalletAddress, TARGET_C_VALUE);

      expect(await readTarget('bob', handleOnC, targetCAddress)).to.equal(TARGET_C_VALUE);
    });

    it('wildcard and per-contract delegation can coexist for the same delegate', async function () {
      await delegate(signers.bob.address, counterAddress);
      await delegate(signers.bob.address, wildcardAddress);

      expect(await readCounter('bob')).to.equal(BigInt(COUNTER_VALUE));
      expect(await readTarget('bob', handleOnB, targetBAddress)).to.equal(TARGET_B_VALUE);
    });
  });

  describe('negative paths', function () {
    it('rejects after the wildcard delegation expires', async function () {
      await delegate(signers.eve.address, wildcardAddress, SHORT_EXPIRY_SECONDS);

      await ethers.provider.send('evm_increaseTime', [SHORT_EXPIRY_SECONDS + 1]);
      await ethers.provider.send('evm_mine', []);

      await expectRejectedWith(readTarget('eve', handleOnB, targetBAddress), NOT_DELEGATED);
    });

    it('rejects when the requesting EOA is not the registered wildcard delegate', async function () {
      // Delegations are keyed on (delegator, delegate); a wildcard issued to Eve says nothing about Carol.
      await delegate(signers.eve.address, wildcardAddress);

      await expectRejectedWith(readTarget('carol', handleOnB, targetBAddress), NOT_DELEGATED);
    });

    it('does not bypass ownership: rejects when the delegator is not allowed on the handle', async function () {
      await delegate(signers.bob.address, wildcardAddress);

      // Alice deposits under HER OWN address, so the wallet never gains access to this handle.
      const { address: aliceTargetAddress, handle: aliceOnlyHandle } = await deployTarget(
        signers.alice.address,
        ALICE_ONLY_VALUE,
      );

      await expectRejectedWith(readTarget('bob', aliceOnlyHandle, aliceTargetAddress), NOT_DELEGATED);
    });

    it('does not bypass ownership: rejects when the app contract is not allowed on the handle', async function () {
      await delegate(signers.bob.address, wildcardAddress);

      // The counter issued this handle; targetB was never allowed on it. A wildcard authorizes the
      // delegate, not the app contract's access.
      const countHandle = (await counter.getCount()) as Hex;
      await expectRejectedWith(
        fhevm.userDecryptEuint(FhevmType.euint32, countHandle, targetBAddress, accounts.bob, {
          delegatorAddress: smartWalletAddress,
        }),
        NOT_DELEGATED,
      );
    });

    it('does not allow transitive delegation: a wildcard recipient cannot re-grant onward', async function () {
      await delegate(signers.carol.address, wildcardAddress);

      // Carol wildcard-delegates onward to Dave from her own EOA. That entry is (Carol, Dave) and has no
      // bearing on handles the wallet owns.
      const expiration = BigInt((await blockTimestamp()) + ONE_DAY_SECONDS);
      const carolAcl = await acl(signers.carol);
      await (await carolAcl.delegateForUserDecryption(signers.dave.address, wildcardAddress, expiration)).wait();

      await expectRejectedWith(readTarget('dave', handleOnB, targetBAddress), NOT_DELEGATED);
    });
  });

  describe('revocation matrix', function () {
    it('revoking the wildcard leaves the per-contract entry active', async function () {
      await delegate(signers.carol.address, wildcardAddress);
      await delegate(signers.carol.address, counterAddress);
      await revoke(signers.carol.address, wildcardAddress);

      // The counter still resolves through the surviving per-contract entry.
      expect(await readCounter('carol')).to.equal(BigInt(COUNTER_VALUE));
      // B has no entry of its own, so it goes with the wildcard.
      await expectRejectedWith(readTarget('carol', handleOnB, targetBAddress), NOT_DELEGATED);
    });

    it('revoking the per-contract entry leaves the wildcard active', async function () {
      await delegate(signers.carol.address, wildcardAddress);
      await delegate(signers.carol.address, counterAddress);
      await revoke(signers.carol.address, counterAddress);

      expect(await readCounter('carol')).to.equal(BigInt(COUNTER_VALUE));
      expect(await readTarget('carol', handleOnB, targetBAddress)).to.equal(TARGET_B_VALUE);
    });

    it('revoking both entries rejects on every contract', async function () {
      await delegate(signers.carol.address, wildcardAddress);
      await delegate(signers.carol.address, counterAddress);
      await revoke(signers.carol.address, wildcardAddress);
      await revoke(signers.carol.address, counterAddress);

      await expectRejectedWith(readCounter('carol'), NOT_DELEGATED);
      await expectRejectedWith(readTarget('carol', handleOnB, targetBAddress), NOT_DELEGATED);
    });
  });

  describe('independence', function () {
    it("revoking one delegator's wildcard does not affect another delegator's", async function () {
      // A second wallet, owned by Dave, with its own handle on its own app contract.
      const walletYFactory: SmartWalletWithDelegation__factory =
        await ethers.getContractFactory('SmartWalletWithDelegation');
      const walletY = await walletYFactory.connect(signers.dave).deploy(signers.dave.address);
      await walletY.waitForDeployment();
      const walletYAddress = (await walletY.getAddress()) as Hex;

      const { address: targetDAddress, handle: handleForY } = await deployTarget(walletYAddress, TARGET_D_VALUE);

      const expiration = (await blockTimestamp()) + ONE_DAY_SECONDS;
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
      await expectRejectedWith(readTarget('carol', handleOnB, targetBAddress), NOT_DELEGATED);
      expect(await readTarget('carol', handleForY, targetDAddress, walletYAddress)).to.equal(TARGET_D_VALUE);
    });
  });
});
