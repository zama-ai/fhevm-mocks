import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { assert } from 'chai';
import { network } from 'hardhat';

import type { FHEVMPublicDecryptTestSuite4 } from '../../types/ethers-contracts/index.ts';
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

async function deployFHEVMTestFixture4(signer: HardhatEthersSigner): Promise<FHEVMPublicDecryptTestSuite4> {
  const admin = signer;

  const contractFactory = await ethers.getContractFactory('FHEVMPublicDecryptTestSuite4');
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

describe('FHEVM operations 54', function () {
  let signers: Signers;
  let signer: HardhatEthersSigner;
  let contract4: FHEVMPublicDecryptTestSuite4;
  let contract4Address: Hex;

  before(async function () {
    signers = await getSigners(connection);
    signer = signers.alice;

    contract4 = await deployFHEVMTestFixture4(signer);
    contract4Address = (await contract4.getAddress()) as Hex;
  });

  it('test operator "max" overload (euint64, euint16) => euint64 test 1 (18446307955039574325, 45271)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18446307955039574325n },
        { type: 'uint16', value: 45271n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.max_euint64_euint16(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract4.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    assert.strictEqual(res, 18446307955039574325n);
  });

  it('test operator "max" overload (euint64, euint16) => euint64 test 2 (45267, 45271)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 45267n },
        { type: 'uint16', value: 45271n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.max_euint64_euint16(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract4.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    assert.strictEqual(res, 45271n);
  });

  it('test operator "max" overload (euint64, euint16) => euint64 test 3 (45271, 45271)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 45271n },
        { type: 'uint16', value: 45271n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.max_euint64_euint16(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract4.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    assert.strictEqual(res, 45271n);
  });

  it('test operator "max" overload (euint64, euint16) => euint64 test 4 (45271, 45267)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 45271n },
        { type: 'uint16', value: 45267n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.max_euint64_euint16(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract4.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    assert.strictEqual(res, 45271n);
  });

  it('test operator "or" overload (euint8, euint8) => euint8 test 1 (213, 26)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 213n },
        { type: 'uint8', value: 26n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.or_euint8_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint8 = (await contract4.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    assert.strictEqual(res, 223);
  });

  it('test operator "or" overload (euint8, euint8) => euint8 test 2 (22, 26)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 22n },
        { type: 'uint8', value: 26n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.or_euint8_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint8 = (await contract4.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    assert.strictEqual(res, 30);
  });

  it('test operator "or" overload (euint8, euint8) => euint8 test 3 (26, 26)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 26n },
        { type: 'uint8', value: 26n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.or_euint8_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint8 = (await contract4.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    assert.strictEqual(res, 26);
  });

  it('test operator "or" overload (euint8, euint8) => euint8 test 4 (26, 22)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 26n },
        { type: 'uint8', value: 22n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.or_euint8_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint8 = (await contract4.resEuint8()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint8({ euint8 });
    assert.strictEqual(res, 30);
  });

  it('test operator "shr" overload (euint16, uint8) => euint16 test 1 (41810, 8)', async function () {
    const encrypted = await fhevm.helpers.encryptUint16({
      value: 41810n,
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.shr_euint16_uint8(encrypted.externalEuint16, 8n, encrypted.inputProof);
    await tx.wait();
    const euint16 = (await contract4.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    assert.strictEqual(res, 163);
  });

  it('test operator "shr" overload (euint16, uint8) => euint16 test 2 (4, 8)', async function () {
    const encrypted = await fhevm.helpers.encryptUint16({
      value: 4n,
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.shr_euint16_uint8(encrypted.externalEuint16, 8n, encrypted.inputProof);
    await tx.wait();
    const euint16 = (await contract4.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    assert.strictEqual(res, 0);
  });

  it('test operator "shr" overload (euint16, uint8) => euint16 test 3 (8, 8)', async function () {
    const encrypted = await fhevm.helpers.encryptUint16({
      value: 8n,
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.shr_euint16_uint8(encrypted.externalEuint16, 8n, encrypted.inputProof);
    await tx.wait();
    const euint16 = (await contract4.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    assert.strictEqual(res, 0);
  });

  it('test operator "shr" overload (euint16, uint8) => euint16 test 4 (8, 4)', async function () {
    const encrypted = await fhevm.helpers.encryptUint16({
      value: 8n,
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.shr_euint16_uint8(encrypted.externalEuint16, 4n, encrypted.inputProof);
    await tx.wait();
    const euint16 = (await contract4.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    assert.strictEqual(res, 0);
  });

  it('test operator "max" overload (uint64, euint64) => euint64 test 1 (18445863906332305427, 18443180247415512627)', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: 18443180247415512627n,
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.max_uint64_euint64(
      18445863906332305427n,
      encrypted.externalEuint64,
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract4.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    assert.strictEqual(res, 18445863906332305427n);
  });

  it('test operator "max" overload (uint64, euint64) => euint64 test 2 (18439875117400843375, 18439875117400843379)', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: 18439875117400843379n,
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.max_uint64_euint64(
      18439875117400843375n,
      encrypted.externalEuint64,
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract4.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    assert.strictEqual(res, 18439875117400843379n);
  });

  it('test operator "max" overload (uint64, euint64) => euint64 test 3 (18439875117400843379, 18439875117400843379)', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: 18439875117400843379n,
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.max_uint64_euint64(
      18439875117400843379n,
      encrypted.externalEuint64,
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract4.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    assert.strictEqual(res, 18439875117400843379n);
  });

  it('test operator "max" overload (uint64, euint64) => euint64 test 4 (18439875117400843379, 18439875117400843375)', async function () {
    const encrypted = await fhevm.helpers.encryptUint64({
      value: 18439875117400843375n,
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.max_uint64_euint64(
      18439875117400843379n,
      encrypted.externalEuint64,
      encrypted.inputProof,
    );
    await tx.wait();
    const euint64 = (await contract4.resEuint64()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint64({ euint64 });
    assert.strictEqual(res, 18439875117400843379n);
  });

  it('test operator "eq" overload (euint8, euint256) => ebool test 1 (34, 115792089237316195423570985008687907853269984665640564039457577752723022763875)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 34n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457577752723022763875n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.eq_euint8_euint256(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const ebool = (await contract4.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    assert.strictEqual(res, false);
  });

  it('test operator "eq" overload (euint8, euint256) => ebool test 2 (30, 34)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 30n },
        { type: 'uint256', value: 34n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.eq_euint8_euint256(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const ebool = (await contract4.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    assert.strictEqual(res, false);
  });

  it('test operator "eq" overload (euint8, euint256) => ebool test 3 (34, 34)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 34n },
        { type: 'uint256', value: 34n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.eq_euint8_euint256(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const ebool = (await contract4.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    assert.strictEqual(res, true);
  });

  it('test operator "eq" overload (euint8, euint256) => ebool test 4 (34, 30)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 34n },
        { type: 'uint256', value: 30n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.eq_euint8_euint256(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const ebool = (await contract4.resEbool()) as Hex;
    const res = await fhevm.helpers.decryptPublicBool({ ebool });
    assert.strictEqual(res, false);
  });

  it('test operator "mul" overload (euint16, euint8) => euint16 test 1 (91, 2)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 91n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.mul_euint16_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint16 = (await contract4.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    assert.strictEqual(res, 182);
  });

  it('test operator "mul" overload (euint16, euint8) => euint16 test 2 (14, 16)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 14n },
        { type: 'uint8', value: 16n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.mul_euint16_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint16 = (await contract4.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    assert.strictEqual(res, 224);
  });

  it('test operator "mul" overload (euint16, euint8) => euint16 test 3 (9, 9)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.mul_euint16_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint16 = (await contract4.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    assert.strictEqual(res, 81);
  });

  it('test operator "mul" overload (euint16, euint8) => euint16 test 4 (16, 14)', async function () {
    const encrypted = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16n },
        { type: 'uint8', value: 14n },
      ],
      contractAddress: contract4Address,
      userAddress: signer.address,
    });
    const tx = await contract4.mul_euint16_euint8(
      at(encrypted.encryptedValues, 0),
      at(encrypted.encryptedValues, 1),
      encrypted.inputProof,
    );
    await tx.wait();
    const euint16 = (await contract4.resEuint16()) as Hex;
    const res = await fhevm.helpers.decryptPublicUint16({ euint16 });
    assert.strictEqual(res, 224);
  });
});
