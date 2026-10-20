import { expect } from 'chai';
import { network } from 'hardhat';

import type { FHEVMManualTestSuite } from '../../types/ethers-contracts/index.ts';
import { type Signers, getSigners } from '../utils/signers.ts';

// The v2 file, mechanically adapted: `hre.fhevm` → the connection's `fhevm`, handles narrowed with `at`,
// result handles typed as Hex.
const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;

// `handles` is `Hex[]`: the i-th handle, or a loud failure.
function at(handles: readonly Hex[], i: number): Hex {
  const handle = handles[i];
  if (handle === undefined) throw new Error(`encrypt() returned no handle #${String(i)}`);
  return handle;
}

/**
 * Manual-operation tests for the operators @fhevm/solidity 0.13.3 added: `FHE.isIn`, `FHE.sum`, and
 * the euint64 shift/rotate forms taking an encrypted or plain shift amount.
 *
 * Ported from the fhevm repository's e2e suite
 * (<fhevm>/test-suite/e2e/test/fhevmOperations/manual.ts), adapted to this plugin's API:
 * `instance.encryptTypedValues({ values })` becomes `fhevm.helpers.encryptUintNN(...)` for a single
 * value or `fhevm.client.encryptValues({ values })` for several, and `instance.publicDecrypt` becomes
 * `fhevm.helpers.decryptPublicXxx({ eXxx })`, which returns the cleartext itself rather than a
 * handle-keyed map — a number for euint8/16/32, a bigint above that.
 *
 * Upstream's `mulDiv` and `toExternalE*` tests are deliberately absent: those operators are not in
 * 0.13.3 and are expected in v14, so the contract does not declare them either.
 */

const UINT64_MASK = (1n << 64n) - 1n;
const OVERSIZED_SHIFT_64 = 70n;
const REDUCED_SHIFT_64 = 6n;
const SHIFT_ROTATE_VALUE_64 = 0x123456789abcdef0n;

function rotl64(value: bigint, shift: bigint): bigint {
  const normalized = shift % 64n;
  return ((value << normalized) | (value >> (64n - normalized))) & UINT64_MASK;
}

function rotr64(value: bigint, shift: bigint): bigint {
  const normalized = shift % 64n;
  return ((value >> normalized) | (value << (64n - normalized))) & UINT64_MASK;
}

/** Runs the transaction, then publicly decrypts the euint64 result the suite stored. */
async function decrypt64Result(
  contract: FHEVMManualTestSuite,
  txPromise: Promise<{ wait(): Promise<unknown> }>,
): Promise<bigint> {
  await (await txPromise).wait();
  const euint64 = (await contract.resEuint64()) as `0x${string}`;
  return fhevm.helpers.decryptPublicUint64({ euint64 });
}

async function deployFHEVMManualTestFixture(): Promise<FHEVMManualTestSuite> {
  const signers = await getSigners(connection);
  const contractFactory = await ethers.getContractFactory('FHEVMManualTestSuite');
  const contract = await contractFactory.connect(signers.alice).deploy();
  await contract.waitForDeployment();
  return contract;
}

describe('FHEVM manual operations (isIn / sum / shift-rotate)', function () {
  let signers: Signers;
  let contractAddress: Hex;
  let contract: FHEVMManualTestSuite;

  beforeEach(async function () {
    signers = await getSigners(connection);
    contract = await deployFHEVMManualTestFixture();
    contractAddress = (await contract.getAddress()) as Hex;
  });

  it('shr(euint64, uint8) applies modulo semantics for indexes > bit width', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: SHIFT_ROTATE_VALUE_64,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const res = await decrypt64Result(
      contract,
      contract.test_shr_euint64_uint8(encrypted.externalEuint64, OVERSIZED_SHIFT_64, encrypted.inputProof),
    );
    expect(res).to.equal(SHIFT_ROTATE_VALUE_64 >> REDUCED_SHIFT_64);
  });

  it('shr(euint64, euint8) applies modulo semantics for indexes > bit width', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: SHIFT_ROTATE_VALUE_64 },
        { type: 'uint8', value: OVERSIZED_SHIFT_64 },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const res = await decrypt64Result(
      contract,
      contract.test_shr_euint64_euint8(
        at(encrypted.encryptedValues, 0),
        at(encrypted.encryptedValues, 1),
        encrypted.inputProof,
      ),
    );
    expect(res).to.equal(SHIFT_ROTATE_VALUE_64 >> REDUCED_SHIFT_64);
  });

  it('shl(euint64, uint8) applies modulo semantics for indexes > bit width', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: SHIFT_ROTATE_VALUE_64,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const res = await decrypt64Result(
      contract,
      contract.test_shl_euint64_uint8(encrypted.externalEuint64, OVERSIZED_SHIFT_64, encrypted.inputProof),
    );
    expect(res).to.equal((SHIFT_ROTATE_VALUE_64 << REDUCED_SHIFT_64) & UINT64_MASK);
  });

  it('shl(euint64, euint8) applies modulo semantics for indexes > bit width', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: SHIFT_ROTATE_VALUE_64 },
        { type: 'uint8', value: OVERSIZED_SHIFT_64 },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const res = await decrypt64Result(
      contract,
      contract.test_shl_euint64_euint8(
        at(encrypted.encryptedValues, 0),
        at(encrypted.encryptedValues, 1),
        encrypted.inputProof,
      ),
    );
    expect(res).to.equal((SHIFT_ROTATE_VALUE_64 << REDUCED_SHIFT_64) & UINT64_MASK);
  });

  it('rotl(euint64, uint8) applies modulo semantics for indexes > bit width', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: SHIFT_ROTATE_VALUE_64,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const res = await decrypt64Result(
      contract,
      contract.test_rotl_euint64_uint8(encrypted.externalEuint64, OVERSIZED_SHIFT_64, encrypted.inputProof),
    );
    expect(res).to.equal(rotl64(SHIFT_ROTATE_VALUE_64, REDUCED_SHIFT_64));
  });

  it('rotr(euint64, uint8) applies modulo semantics for indexes > bit width', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: SHIFT_ROTATE_VALUE_64,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const res = await decrypt64Result(
      contract,
      contract.test_rotr_euint64_uint8(encrypted.externalEuint64, OVERSIZED_SHIFT_64, encrypted.inputProof),
    );
    expect(res).to.equal(rotr64(SHIFT_ROTATE_VALUE_64, REDUCED_SHIFT_64));
  });

  it('rotr(euint64, euint8) applies modulo semantics for indexes > bit width', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: SHIFT_ROTATE_VALUE_64 },
        { type: 'uint8', value: OVERSIZED_SHIFT_64 },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const res = await decrypt64Result(
      contract,
      contract.test_rotr_euint64_euint8(
        at(encrypted.encryptedValues, 0),
        at(encrypted.encryptedValues, 1),
        encrypted.inputProof,
      ),
    );
    expect(res).to.equal(rotr64(SHIFT_ROTATE_VALUE_64, REDUCED_SHIFT_64));
  });

  it('rotl(euint64, euint8) applies modulo semantics for indexes > bit width', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: SHIFT_ROTATE_VALUE_64 },
        { type: 'uint8', value: OVERSIZED_SHIFT_64 },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const res = await decrypt64Result(
      contract,
      contract.test_rotl_euint64_euint8(
        at(encrypted.encryptedValues, 0),
        at(encrypted.encryptedValues, 1),
        encrypted.inputProof,
      ),
    );
    expect(res).to.equal(rotl64(SHIFT_ROTATE_VALUE_64, REDUCED_SHIFT_64));
  });

  it('test operator "sum" euint16 - two elements', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 1000n },
        { type: 'uint16', value: 2000n },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_sum_euint16(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint16 = (await contract.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    expect(res).to.equal(3000);
  });

  it('test operator "sum" euint32 - two elements', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 100000n },
        { type: 'uint32', value: 200000n },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_sum_euint32(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint32 = (await contract.resEuint32()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint32({ euint32 });
    expect(res).to.equal(300000);
  });

  it('test operator "sum" euint8 - three elements', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 10n },
        { type: 'uint8', value: 20n },
        { type: 'uint8', value: 30n },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_sum_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      at(encrypted.encryptedValues, 2),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint8 = (await contract.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    expect(res).to.equal(60);
  });

  it('test operator "sum" euint64 - two elements', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1000000n },
        { type: 'uint64', value: 2000000n },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_sum_euint64(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    expect(res).to.equal(3000000n);
  });

  it('test operator "sum" euint128 - two elements', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 100000000000000000000n },
        { type: 'uint128', value: 200000000000000000000n },
      ],
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_sum_euint128(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint128 = (await contract.resEuint128()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint128({ euint128 });
    expect(res).to.equal(300000000000000000000n);
  });

  it('test operator "sum" euint8 - duplicate handle counted twice', async function () {
    const value = 7;
    const encrypted = await fhevm.helpers.encryptUint8({
      value: value,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_sum_euint8_duplicate(encrypted.externalEuint8, encrypted.inputProof);
    await tx.wait();
    const euint8 = (await contract.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    expect(res).to.equal(value * 2);
  });

  it('test operator "sum" euint8 - uninitialized element treated as 0', async function () {
    const tx = await contract.test_sum_euint8_uninitialized();
    await tx.wait();
    const euint8 = (await contract.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    expect(res).to.equal(5);
  });

  it('test operator "sum" euint8 - empty array returns 0', async function () {
    const tx = await contract.test_sum_euint8_empty();
    await tx.wait();
    const euint8 = (await contract.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    expect(res).to.equal(0);
  });

  it('test operator "sum" euint8 - single element returns fresh handle', async function () {
    const value = 42;
    const encrypted = await fhevm.helpers.encryptUint8({
      value: value,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_sum_euint8_single(encrypted.externalEuint8, encrypted.inputProof);
    await tx.wait();
    const euint8 = (await contract.resEuint8()) as Hex;
    expect(euint8).to.not.equal(encrypted.externalEuint8);
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    expect(res).to.equal(value);
  });

  it('test operator "sum" euint8 - 100 elements at max array size', async function () {
    const tx = await contract.test_sum_euint8_max_array();
    await tx.wait();
    const euint8 = (await contract.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    expect(res).to.equal(100);
  });

  it('test operator "isIn" euint8 - value found in set', async function () {
    const encrypted = await fhevm.helpers.encryptUint8({
      value: 20n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint8_found(encrypted.externalEuint8, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint8 - value not found in set', async function () {
    const encrypted = await fhevm.helpers.encryptUint8({
      value: 99n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint8_not_found(encrypted.externalEuint8, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(false);
  });

  it('test operator "isIn" euint16 - value found in set', async function () {
    const encrypted = await fhevm.helpers.encryptUint16({
      value: 1000n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint16(encrypted.externalEuint16, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint32 - value found in set', async function () {
    const encrypted = await fhevm.helpers.encryptUint32({
      value: 100000n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint32(encrypted.externalEuint32, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint64 - value found in set', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: 1000000000n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint64(encrypted.externalEuint64, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint128 - value found in set', async function () {
    const encrypted = await fhevm.helpers.encryptUint128({
      value: 10000000000000000000n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint128(encrypted.externalEuint128, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint8 - uninitialized value treated as 0 (found)', async function () {
    const tx = await contract.test_isIn_euint8_uninitialized();
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint8 - single element set, found', async function () {
    const encrypted = await fhevm.helpers.encryptUint8({
      value: 42n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint8_single_element(encrypted.externalEuint8, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint8 - 100 elements at max array size', async function () {
    const tx = await contract.test_isIn_euint8_max_array();
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint8 - empty set returns false', async function () {
    const tx = await contract.test_isIn_euint8_empty_set();
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(false);
  });

  it('test operator "isIn" euint8 - zero-initialized set, enc(0) found', async function () {
    const tx = await contract.test_isIn_euint8_zero_initialized_set();
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint8 - max type value (255) found in set', async function () {
    const tx = await contract.test_isIn_euint8_max_value_found();
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint8 - single element set, not found', async function () {
    const tx = await contract.test_isIn_euint8_single_element_not_found();
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(false);
  });

  it('test operator "isIn" eaddress - value found in set', async function () {
    const encrypted = await fhevm.helpers.encryptAddress({
      value: '0x2222222222222222222222222222222222222222',
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_eaddress_found(encrypted.externalEaddress, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" eaddress - value not found in set', async function () {
    const encrypted = await fhevm.helpers.encryptAddress({
      value: '0x4444444444444444444444444444444444444444',
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_eaddress_not_found(encrypted.externalEaddress, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(false);
  });

  it('test operator "isIn" euint256 - value found in set', async function () {
    const encrypted = await fhevm.helpers.encryptUint256({
      value: 42n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint256_found(encrypted.externalEuint256, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(true);
  });

  it('test operator "isIn" euint256 - value not found in set', async function () {
    const encrypted = await fhevm.helpers.encryptUint256({
      value: 99n,
      contractAddress,
      userAddress: signers.alice.address,
    });
    const tx = await contract.test_isIn_euint256_not_found(encrypted.externalEuint256, encrypted.inputProof);
    await tx.wait();
    const ebool = (await contract.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    expect(res).to.equal(false);
  });
});
