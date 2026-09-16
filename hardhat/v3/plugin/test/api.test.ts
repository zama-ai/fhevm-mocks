// The public surface contract: every member of `HardhatFhevmRuntimeEnvironment` is live on
// `connection.fhevm` — nothing is stubbed any more — and the module exports are what v2 shipped.
//
// Tests import the BUILT payload (pkg/_esm); see connection.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';

import { createHardhatRuntimeEnvironment } from 'hardhat/hre';

import plugin, { getHCU, timestampNow } from '#esm/index.js';
import { FhevmType } from '#esm/types-p.js';
import type { FhevmCleartextDB, FhevmClientHelpers, HardhatFhevmRuntimeEnvironment } from '#esm/index.js';

const METHODS = [
  'computeTransactionHCU',
  'assertCoprocessorInitialized',
  'getCoprocessorConfig',
] as const satisfies ReadonlyArray<keyof HardhatFhevmRuntimeEnvironment>;

// The non-callable half of the interface. Listing it lets the guard below cover every member, not
// just the methods — `helpers` itself would otherwise be untested until someone wrote a call for it.
const PROPERTIES = [
  'isCleartext',
  'isDevelopment',
  'network',
  'cleartextDb',
  'client',
  'helpers',
] as const satisfies ReadonlyArray<keyof HardhatFhevmRuntimeEnvironment>;

const CLEARTEXT_DB_METHODS = [
  'readBool',
  'readUint8',
  'readUint16',
  'readUint32',
  'readUint64',
  'readUint128',
  'readUint256',
  'readAddress',
] as const satisfies ReadonlyArray<keyof FhevmCleartextDB>;

const HELPERS_METHODS = [
  'encryptBool',
  'encryptUint8',
  'encryptUint16',
  'encryptUint32',
  'encryptUint64',
  'encryptUint128',
  'encryptUint256',
  'encryptAddress',
  'decryptBool',
  'decryptUint8',
  'decryptUint16',
  'decryptUint32',
  'decryptUint64',
  'decryptUint128',
  'decryptUint256',
  'decryptAddress',
  'decryptPublicBool',
  'decryptPublicUint8',
  'decryptPublicUint16',
  'decryptPublicUint32',
  'decryptPublicUint64',
  'decryptPublicUint128',
  'decryptPublicUint256',
  'decryptPublicAddress',
  'decryptPublicBoolWithSignatures',
  'decryptPublicUint8WithSignatures',
  'decryptPublicUint16WithSignatures',
  'decryptPublicUint32WithSignatures',
  'decryptPublicUint64WithSignatures',
  'decryptPublicUint128WithSignatures',
  'decryptPublicUint256WithSignatures',
  'decryptPublicAddressWithSignatures',
] as const satisfies ReadonlyArray<keyof FhevmClientHelpers>;

// `satisfies` only proves every NAME LISTED exists; it says nothing about a member ADDED to an
// interface and forgotten here — which is how this file came to be asserting methods that had been
// moved to `helpers`. Each `Exclude` below is the missing direction: it stops compiling, naming the
// member, the day the interface grows something the lists do not cover.
type Unlisted<TInterface, TListed extends PropertyKey> = Exclude<keyof TInterface, TListed>;
type Assert<T> = [T] extends [never] ? true : T;

const everyMemberIsListed: Assert<
  Unlisted<HardhatFhevmRuntimeEnvironment, (typeof METHODS)[number] | (typeof PROPERTIES)[number]>
> = true;
const everyCleartextDbMemberIsListed: Assert<Unlisted<FhevmCleartextDB, (typeof CLEARTEXT_DB_METHODS)[number]>> = true;
const everyHelperIsListed: Assert<Unlisted<FhevmClientHelpers, (typeof HELPERS_METHODS)[number]>> = true;

// Two DIFFERENT addresses: the SDK forbids user === contract on the user-decryption path, and an
// encryption bound to that pairing could never be consumed on-chain anyway.
const CONTRACT = '0x1111111111111111111111111111111111111111';
const USER = '0x2222222222222222222222222222222222222222';
const HEX32 = /^0x[0-9a-f]{64}$/;

void test('connection.fhevm exposes the whole public surface, every member live', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const fhevm: HardhatFhevmRuntimeEnvironment = connection.fhevm;
    assert.equal(everyMemberIsListed, true, 'every HardhatFhevmRuntimeEnvironment member is listed above');
    assert.equal(everyCleartextDbMemberIsListed, true, 'every FhevmCleartextDB member is listed above');

    for (const member of METHODS) assert.equal(typeof fhevm[member], 'function', `${member} is a method`);
    for (const member of PROPERTIES) assert.notEqual(fhevm[member], undefined, `${member} is present`);
    for (const member of CLEARTEXT_DB_METHODS) {
      assert.equal(typeof fhevm.cleartextDb[member], 'function', `cleartextDb.${member} is a method`);
    }
    assert.equal(everyHelperIsListed, true, 'every FhevmClientHelpers member is listed above');
    for (const member of HELPERS_METHODS) {
      assert.equal(typeof fhevm.helpers[member], 'function', `helpers.${member} is a method`);
    }
    // `helpers` is built once in the constructor, unlike `debugger`, which each get() rebuilds.
    assert.equal(fhevm.helpers, fhevm.helpers, 'helpers is the same instance every read');
    // The factory hands out a frozen object: a test that assigns to `fhevm.client` must fail loudly
    // rather than shadow the real one for the rest of the run.
    assert.equal(Object.isFrozen(fhevm), true, 'the runtime environment is frozen');
    assert.equal(fhevm.network.chainId, 31337);
    assert.equal(fhevm.isDevelopment, true);
    assert.equal(fhevm.isCleartext, true);
    assert.equal(fhevm.client.chain.id, 31337);
  } finally {
    await connection.close();
  }
});

void test('fhevm.helpers encrypts, labels the result by Solidity type, and bounds the value', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const helpers = connection.fhevm.helpers;

    // Each helper must label its handle with ITS OWN type: a copy-paste slip that wires encryptUint16
    // to euint8, or returns `externalEuint8` from all of them, still passes a `typeof` check.
    const bool = await helpers.encryptBool({ value: true, contractAddress: CONTRACT, userAddress: USER });
    assert.match(bool.externalEbool, HEX32);
    assert.match(bool.inputProof, /^0x[0-9a-f]+$/);

    const u8 = await helpers.encryptUint8({ value: 255, contractAddress: CONTRACT, userAddress: USER });
    assert.match(u8.externalEuint8, HEX32);

    const u16 = await helpers.encryptUint16({ value: 65535, contractAddress: CONTRACT, userAddress: USER });
    assert.match(u16.externalEuint16, HEX32);

    // A bigint at the top of the range: the widths a `number` cannot carry must still round-trip.
    const u256 = await helpers.encryptUint256({ value: 2n ** 256n - 1n, contractAddress: CONTRACT, userAddress: USER });
    assert.match(u256.externalEuint256, HEX32);

    const addr = await helpers.encryptAddress({ value: USER, contractAddress: CONTRACT, userAddress: USER });
    assert.match(addr.externalEaddress, HEX32);

    // The handle's last byte is the FheType id, so euint8 and euint16 cannot both be right by luck.
    assert.notEqual(u8.externalEuint8.slice(-4), u16.externalEuint16.slice(-4), 'handles carry distinct types');

    // The plugin rejects an out-of-range value itself, naming the method and the bound, rather than
    // letting the SDK raise its typeless "expected uint8, got number" three layers down.
    await assert.rejects(
      helpers.encryptUint8({ value: 256, contractAddress: CONTRACT, userAddress: USER }),
      /encryptUint8: 256 does not fit in euint8: expected 0 to 255/,
    );
    await assert.rejects(
      helpers.encryptUint64({ value: 2 ** 53 + 1, contractAddress: CONTRACT, userAddress: USER }),
      /exceeds Number.MAX_SAFE_INTEGER/,
    );
    await assert.rejects(
      helpers.encryptUint32({ value: 7, contractAddress: '0xnope', userAddress: USER }),
      /is not a valid address/,
    );
  } finally {
    await connection.close();
  }
});

void test('fhevm.helpers.decryptPublic* checks the handle against the type the caller claims', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const helpers = connection.fhevm.helpers;
    const args = { contractAddress: CONTRACT, userAddress: USER };
    const u8 = await helpers.encryptUint8({ value: 255, ...args });
    const u32 = await helpers.encryptUint32({ value: 7, ...args });
    const b = await helpers.encryptBool({ value: true, ...args });

    // The type in the argument NAME is a claim by the caller; byte 30 of the handle is the fact. Get
    // them out of step and the euint64 behind a `{ euint8 }` would come back through a `number`.
    await assert.rejects(helpers.decryptPublicUint8({ euint8: u32.externalEuint32 }), /is a euint32, not a euint8/);
    await assert.rejects(helpers.decryptPublicBool({ ebool: u8.externalEuint8 }), /is a euint8, not a ebool/);
    await assert.rejects(helpers.decryptPublicAddress({ eaddress: b.externalEbool }), /is a ebool, not a eaddress/);
    await assert.rejects(helpers.decryptPublicUint256({ euint256: u8.externalEuint8 }), /is a euint8, not a euint256/);

    // A malformed handle is refused before the SDK is reached at all.
    await assert.rejects(helpers.decryptPublicUint8({ euint8: '0x1234' }), /expected a 32-byte 0x-prefixed hex string/);

    // A correctly-typed handle passes both guards and reaches the ACL, which refuses it because
    // nothing ever made it publicly decryptable. That is as far as this package can go: asserting a
    // decrypted VALUE needs a contract to mark a handle public, which lives in the e2e suite.
    await assert.rejects(
      helpers.decryptPublicUint8({ euint8: u8.externalEuint8 }),
      /not allowed for public decryption/,
    );
  } finally {
    await connection.close();
  }
});

void test('the module exports are the v2 ones', () => {
  assert.equal(typeof getHCU, 'function');
  assert.equal(typeof timestampNow, 'function');
});

// `FhevmType` is no longer published — it moved to `types-p.ts` when the enum stopped appearing in any
// public signature. The ids still have to match the on-chain `FheType`, so the check moves here rather
// than disappearing; it just reads the enum through the private module, as the plugin itself does.
void test('the FheType ids are the protocol ones', () => {
  assert.equal(FhevmType.ebool, 0);
  assert.equal(FhevmType.euint32, 4);
  assert.equal(FhevmType.eaddress, 7);
  assert.equal(FhevmType.euint256, 8);
  assert.equal(FhevmType[4], 'euint32');
});
