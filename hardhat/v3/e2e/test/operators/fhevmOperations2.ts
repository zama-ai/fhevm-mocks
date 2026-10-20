import { expect } from 'chai';
import { network } from 'hardhat';

import type {
  FHEVMTestSuite1,
  FHEVMTestSuite2,
  FHEVMTestSuite3,
  FHEVMTestSuite4,
  FHEVMTestSuite5,
  FHEVMTestSuite6,
  FHEVMTestSuite7,
} from '../../types/ethers-contracts/index.ts';
import { getSigners } from '../utils/signers.ts';

// Generated upstream (library-solidity/test/fhevmOperations), mechanically adapted: `hre.fhevm` → the
// connection's `fhevm`, handles narrowed with `at`. Suite state stays on mocha's `this`, as upstream.
const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;

// `handles` is `Hex[]`: the i-th handle, or a loud failure.
function at(handles: readonly Hex[], i: number): Hex {
  const handle = handles[i];
  if (handle === undefined) throw new Error(`encrypt() returned no handle #${String(i)}`);
  return handle;
}

async function deployFHEVMTestFixture1(): Promise<FHEVMTestSuite1> {
  const signers = await getSigners(connection);
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory('FHEVMTestSuite1');
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture2(): Promise<FHEVMTestSuite2> {
  const signers = await getSigners(connection);
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory('FHEVMTestSuite2');
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture3(): Promise<FHEVMTestSuite3> {
  const signers = await getSigners(connection);
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory('FHEVMTestSuite3');
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture4(): Promise<FHEVMTestSuite4> {
  const signers = await getSigners(connection);
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory('FHEVMTestSuite4');
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture5(): Promise<FHEVMTestSuite5> {
  const signers = await getSigners(connection);
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory('FHEVMTestSuite5');
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture6(): Promise<FHEVMTestSuite6> {
  const signers = await getSigners(connection);
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory('FHEVMTestSuite6');
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture7(): Promise<FHEVMTestSuite7> {
  const signers = await getSigners(connection);
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory('FHEVMTestSuite7');
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

describe('FHEVM operations 2', function () {
  before(async function () {
    this.signers = await getSigners(connection);

    const contract1 = await deployFHEVMTestFixture1();
    this.contract1Address = await contract1.getAddress();
    this.contract1 = contract1;

    const contract2 = await deployFHEVMTestFixture2();
    this.contract2Address = await contract2.getAddress();
    this.contract2 = contract2;

    const contract3 = await deployFHEVMTestFixture3();
    this.contract3Address = await contract3.getAddress();
    this.contract3 = contract3;

    const contract4 = await deployFHEVMTestFixture4();
    this.contract4Address = await contract4.getAddress();
    this.contract4 = contract4;

    const contract5 = await deployFHEVMTestFixture5();
    this.contract5Address = await contract5.getAddress();
    this.contract5 = contract5;

    const contract6 = await deployFHEVMTestFixture6();
    this.contract6Address = await contract6.getAddress();
    this.contract6 = contract6;

    const contract7 = await deployFHEVMTestFixture7();
    this.contract7Address = await contract7.getAddress();
    this.contract7 = contract7;
  });

  it('test operator "le" overload (euint8, euint64) => ebool test 1 (82, 18442538173712758245)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 82n },
        { type: 'uint64', value: 18442538173712758245n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint64) => ebool test 2 (78, 82)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 78n },
        { type: 'uint64', value: 82n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint64) => ebool test 3 (82, 82)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 82n },
        { type: 'uint64', value: 82n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint64) => ebool test 4 (82, 78)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 82n },
        { type: 'uint64', value: 78n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint64) => ebool test 1 (158, 18446654203617240269)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 158n },
        { type: 'uint64', value: 18446654203617240269n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint64) => ebool test 2 (154, 158)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 154n },
        { type: 'uint64', value: 158n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint64) => ebool test 3 (158, 158)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 158n },
        { type: 'uint64', value: 158n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint64) => ebool test 4 (158, 154)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 158n },
        { type: 'uint64', value: 154n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint8, euint64) => euint64 test 1 (73, 18440064211635517333)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 73n },
        { type: 'uint64', value: 18440064211635517333n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(73n);
  });

  it('test operator "min" overload (euint8, euint64) => euint64 test 2 (69, 73)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 69n },
        { type: 'uint64', value: 73n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(69n);
  });

  it('test operator "min" overload (euint8, euint64) => euint64 test 3 (73, 73)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 73n },
        { type: 'uint64', value: 73n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(73n);
  });

  it('test operator "min" overload (euint8, euint64) => euint64 test 4 (73, 69)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 73n },
        { type: 'uint64', value: 69n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(69n);
  });

  it('test operator "max" overload (euint8, euint64) => euint64 test 1 (152, 18440285318812855091)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 152n },
        { type: 'uint64', value: 18440285318812855091n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(18440285318812855091n);
  });

  it('test operator "max" overload (euint8, euint64) => euint64 test 2 (148, 152)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 148n },
        { type: 'uint64', value: 152n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(152n);
  });

  it('test operator "max" overload (euint8, euint64) => euint64 test 3 (152, 152)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 152n },
        { type: 'uint64', value: 152n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(152n);
  });

  it('test operator "max" overload (euint8, euint64) => euint64 test 4 (152, 148)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 152n },
        { type: 'uint64', value: 148n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(152n);
  });

  it('test operator "add" overload (euint8, euint128) => euint128 test 1 (2, 129)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 2n },
        { type: 'uint128', value: 129n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(131n);
  });

  it('test operator "add" overload (euint8, euint128) => euint128 test 2 (114, 116)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 114n },
        { type: 'uint128', value: 116n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(230n);
  });

  it('test operator "add" overload (euint8, euint128) => euint128 test 3 (116, 116)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 116n },
        { type: 'uint128', value: 116n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(232n);
  });

  it('test operator "add" overload (euint8, euint128) => euint128 test 4 (116, 114)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 116n },
        { type: 'uint128', value: 114n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(230n);
  });

  it('test operator "sub" overload (euint8, euint128) => euint128 test 1 (218, 218)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 218n },
        { type: 'uint128', value: 218n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint8, euint128) => euint128 test 2 (218, 214)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 218n },
        { type: 'uint128', value: 214n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint8, euint128) => euint128 test 1 (2, 65)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 2n },
        { type: 'uint128', value: 65n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(130n);
  });

  it('test operator "mul" overload (euint8, euint128) => euint128 test 2 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 9n },
        { type: 'uint128', value: 9n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(81n);
  });

  it('test operator "mul" overload (euint8, euint128) => euint128 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 9n },
        { type: 'uint128', value: 9n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(81n);
  });

  it('test operator "mul" overload (euint8, euint128) => euint128 test 4 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 9n },
        { type: 'uint128', value: 9n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(81n);
  });

  it('test operator "and" overload (euint8, euint128) => euint128 test 1 (160, 340282366920938463463369765673248528819)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 160n },
        { type: 'uint128', value: 340282366920938463463369765673248528819n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(160n);
  });

  it('test operator "and" overload (euint8, euint128) => euint128 test 2 (156, 160)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 156n },
        { type: 'uint128', value: 160n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(128n);
  });

  it('test operator "and" overload (euint8, euint128) => euint128 test 3 (160, 160)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 160n },
        { type: 'uint128', value: 160n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(160n);
  });

  it('test operator "and" overload (euint8, euint128) => euint128 test 4 (160, 156)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 160n },
        { type: 'uint128', value: 156n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(128n);
  });

  it('test operator "or" overload (euint8, euint128) => euint128 test 1 (152, 340282366920938463463367166500429742599)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 152n },
        { type: 'uint128', value: 340282366920938463463367166500429742599n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(340282366920938463463367166500429742751n);
  });

  it('test operator "or" overload (euint8, euint128) => euint128 test 2 (148, 152)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 148n },
        { type: 'uint128', value: 152n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(156n);
  });

  it('test operator "or" overload (euint8, euint128) => euint128 test 3 (152, 152)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 152n },
        { type: 'uint128', value: 152n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(152n);
  });

  it('test operator "or" overload (euint8, euint128) => euint128 test 4 (152, 148)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 152n },
        { type: 'uint128', value: 148n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(156n);
  });

  it('test operator "xor" overload (euint8, euint128) => euint128 test 1 (47, 340282366920938463463372634439594458629)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 47n },
        { type: 'uint128', value: 340282366920938463463372634439594458629n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(340282366920938463463372634439594458666n);
  });

  it('test operator "xor" overload (euint8, euint128) => euint128 test 2 (43, 47)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 43n },
        { type: 'uint128', value: 47n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint8, euint128) => euint128 test 3 (47, 47)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 47n },
        { type: 'uint128', value: 47n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint8, euint128) => euint128 test 4 (47, 43)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 47n },
        { type: 'uint128', value: 43n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint8, euint128) => ebool test 1 (136, 340282366920938463463373309899574889569)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 136n },
        { type: 'uint128', value: 340282366920938463463373309899574889569n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint128) => ebool test 2 (132, 136)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 132n },
        { type: 'uint128', value: 136n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint128) => ebool test 3 (136, 136)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 136n },
        { type: 'uint128', value: 136n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint8, euint128) => ebool test 4 (136, 132)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 136n },
        { type: 'uint128', value: 132n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint128) => ebool test 1 (81, 340282366920938463463365606732718999303)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 81n },
        { type: 'uint128', value: 340282366920938463463365606732718999303n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint128) => ebool test 2 (77, 81)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 77n },
        { type: 'uint128', value: 81n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint128) => ebool test 3 (81, 81)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 81n },
        { type: 'uint128', value: 81n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint128) => ebool test 4 (81, 77)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 81n },
        { type: 'uint128', value: 77n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint128) => ebool test 1 (87, 340282366920938463463373094541029016309)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 87n },
        { type: 'uint128', value: 340282366920938463463373094541029016309n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint128) => ebool test 2 (83, 87)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 83n },
        { type: 'uint128', value: 87n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint128) => ebool test 3 (87, 87)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 87n },
        { type: 'uint128', value: 87n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint128) => ebool test 4 (87, 83)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 87n },
        { type: 'uint128', value: 83n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint8, euint128) => ebool test 1 (122, 340282366920938463463367910411609424995)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 122n },
        { type: 'uint128', value: 340282366920938463463367910411609424995n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint128) => ebool test 2 (118, 122)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 118n },
        { type: 'uint128', value: 122n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint128) => ebool test 3 (122, 122)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 122n },
        { type: 'uint128', value: 122n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint128) => ebool test 4 (122, 118)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 122n },
        { type: 'uint128', value: 118n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint128) => ebool test 1 (115, 340282366920938463463373601023326867235)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 115n },
        { type: 'uint128', value: 340282366920938463463373601023326867235n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint128) => ebool test 2 (111, 115)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 111n },
        { type: 'uint128', value: 115n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint128) => ebool test 3 (115, 115)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 115n },
        { type: 'uint128', value: 115n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint128) => ebool test 4 (115, 111)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 115n },
        { type: 'uint128', value: 111n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint128) => ebool test 1 (173, 340282366920938463463369530904172568335)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 173n },
        { type: 'uint128', value: 340282366920938463463369530904172568335n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint128) => ebool test 2 (169, 173)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 169n },
        { type: 'uint128', value: 173n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint128) => ebool test 3 (173, 173)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 173n },
        { type: 'uint128', value: 173n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint128) => ebool test 4 (173, 169)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 173n },
        { type: 'uint128', value: 169n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint8, euint128) => euint128 test 1 (118, 340282366920938463463369096355574974773)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 118n },
        { type: 'uint128', value: 340282366920938463463369096355574974773n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(118n);
  });

  it('test operator "min" overload (euint8, euint128) => euint128 test 2 (114, 118)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 114n },
        { type: 'uint128', value: 118n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(114n);
  });

  it('test operator "min" overload (euint8, euint128) => euint128 test 3 (118, 118)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 118n },
        { type: 'uint128', value: 118n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(118n);
  });

  it('test operator "min" overload (euint8, euint128) => euint128 test 4 (118, 114)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 118n },
        { type: 'uint128', value: 114n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(114n);
  });

  it('test operator "max" overload (euint8, euint128) => euint128 test 1 (5, 340282366920938463463366673524785465781)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 5n },
        { type: 'uint128', value: 340282366920938463463366673524785465781n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(340282366920938463463366673524785465781n);
  });

  it('test operator "max" overload (euint8, euint128) => euint128 test 2 (1, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 1n },
        { type: 'uint128', value: 5n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(5n);
  });

  it('test operator "max" overload (euint8, euint128) => euint128 test 3 (5, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 5n },
        { type: 'uint128', value: 5n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(5n);
  });

  it('test operator "max" overload (euint8, euint128) => euint128 test 4 (5, 1)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 5n },
        { type: 'uint128', value: 1n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract1.resEuint128() });
    expect(res).to.equal(5n);
  });

  it('test operator "and" overload (euint8, euint256) => euint256 test 1 (9, 115792089237316195423570985008687907853269984665640564039457575680225403883879)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 9n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575680225403883879n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(1n);
  });

  it('test operator "and" overload (euint8, euint256) => euint256 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 5n },
        { type: 'uint256', value: 9n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(1n);
  });

  it('test operator "and" overload (euint8, euint256) => euint256 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 9n },
        { type: 'uint256', value: 9n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(9n);
  });

  it('test operator "and" overload (euint8, euint256) => euint256 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 9n },
        { type: 'uint256', value: 5n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(1n);
  });

  it('test operator "or" overload (euint8, euint256) => euint256 test 1 (5, 115792089237316195423570985008687907853269984665640564039457583017965900168219)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 5n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583017965900168219n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457583017965900168223n);
  });

  it('test operator "or" overload (euint8, euint256) => euint256 test 2 (1, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 1n },
        { type: 'uint256', value: 5n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(5n);
  });

  it('test operator "or" overload (euint8, euint256) => euint256 test 3 (5, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 5n },
        { type: 'uint256', value: 5n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(5n);
  });

  it('test operator "or" overload (euint8, euint256) => euint256 test 4 (5, 1)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 5n },
        { type: 'uint256', value: 1n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(5n);
  });

  it('test operator "xor" overload (euint8, euint256) => euint256 test 1 (250, 115792089237316195423570985008687907853269984665640564039457575385389601432361)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 250n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575385389601432361n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575385389601432531n);
  });

  it('test operator "xor" overload (euint8, euint256) => euint256 test 2 (246, 250)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 246n },
        { type: 'uint256', value: 250n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(12n);
  });

  it('test operator "xor" overload (euint8, euint256) => euint256 test 3 (250, 250)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 250n },
        { type: 'uint256', value: 250n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint8, euint256) => euint256 test 4 (250, 246)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 250n },
        { type: 'uint256', value: 246n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract1.resEuint256() });
    expect(res).to.equal(12n);
  });

  it('test operator "eq" overload (euint8, euint256) => ebool test 1 (162, 115792089237316195423570985008687907853269984665640564039457580375233959522263)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 162n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580375233959522263n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint256) => ebool test 2 (158, 162)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 158n },
        { type: 'uint256', value: 162n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint256) => ebool test 3 (162, 162)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 162n },
        { type: 'uint256', value: 162n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint8, euint256) => ebool test 4 (162, 158)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 162n },
        { type: 'uint256', value: 158n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint256) => ebool test 1 (62, 115792089237316195423570985008687907853269984665640564039457581331145154314037)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 62n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457581331145154314037n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint256) => ebool test 2 (58, 62)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 58n },
        { type: 'uint256', value: 62n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint256) => ebool test 3 (62, 62)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 62n },
        { type: 'uint256', value: 62n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint256) => ebool test 4 (62, 58)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 62n },
        { type: 'uint256', value: 58n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "add" overload (euint16, euint8) => euint16 test 1 (154, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 154n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(156);
  });

  it('test operator "add" overload (euint16, euint8) => euint16 test 2 (109, 113)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 109n },
        { type: 'uint8', value: 113n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(222);
  });

  it('test operator "add" overload (euint16, euint8) => euint16 test 3 (113, 113)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 113n },
        { type: 'uint8', value: 113n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(226);
  });

  it('test operator "add" overload (euint16, euint8) => euint16 test 4 (113, 109)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 113n },
        { type: 'uint8', value: 109n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(222);
  });

  it('test operator "sub" overload (euint16, euint8) => euint16 test 1 (103, 103)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 103n },
        { type: 'uint8', value: 103n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint16, euint8) => euint16 test 2 (103, 99)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 103n },
        { type: 'uint8', value: 99n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint16, euint8) => euint16 test 1 (101, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 101n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(202);
  });

  it('test operator "mul" overload (euint16, euint8) => euint16 test 2 (11, 13)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 11n },
        { type: 'uint8', value: 13n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(143);
  });

  it('test operator "mul" overload (euint16, euint8) => euint16 test 3 (13, 13)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 13n },
        { type: 'uint8', value: 13n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(169);
  });

  it('test operator "mul" overload (euint16, euint8) => euint16 test 4 (13, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 13n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(143);
  });

  it('test operator "and" overload (euint16, euint8) => euint16 test 1 (16857, 136)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16857n },
        { type: 'uint8', value: 136n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(136);
  });

  it('test operator "and" overload (euint16, euint8) => euint16 test 2 (132, 136)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 132n },
        { type: 'uint8', value: 136n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(128);
  });

  it('test operator "and" overload (euint16, euint8) => euint16 test 3 (136, 136)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 136n },
        { type: 'uint8', value: 136n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(136);
  });

  it('test operator "and" overload (euint16, euint8) => euint16 test 4 (136, 132)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 136n },
        { type: 'uint8', value: 132n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(128);
  });

  it('test operator "or" overload (euint16, euint8) => euint16 test 1 (2595, 41)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2595n },
        { type: 'uint8', value: 41n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(2603);
  });

  it('test operator "or" overload (euint16, euint8) => euint16 test 2 (37, 41)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37n },
        { type: 'uint8', value: 41n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(45);
  });

  it('test operator "or" overload (euint16, euint8) => euint16 test 3 (41, 41)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 41n },
        { type: 'uint8', value: 41n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(41);
  });

  it('test operator "or" overload (euint16, euint8) => euint16 test 4 (41, 37)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 41n },
        { type: 'uint8', value: 37n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(45);
  });

  it('test operator "xor" overload (euint16, euint8) => euint16 test 1 (40601, 238)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 40601n },
        { type: 'uint8', value: 238n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(40567);
  });

  it('test operator "xor" overload (euint16, euint8) => euint16 test 2 (234, 238)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 234n },
        { type: 'uint8', value: 238n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint16, euint8) => euint16 test 3 (238, 238)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 238n },
        { type: 'uint8', value: 238n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint16, euint8) => euint16 test 4 (238, 234)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 238n },
        { type: 'uint8', value: 234n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint16, euint8) => ebool test 1 (40796, 50)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 40796n },
        { type: 'uint8', value: 50n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint8) => ebool test 2 (46, 50)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 46n },
        { type: 'uint8', value: 50n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint8) => ebool test 3 (50, 50)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 50n },
        { type: 'uint8', value: 50n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint16, euint8) => ebool test 4 (50, 46)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 50n },
        { type: 'uint8', value: 46n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint8) => ebool test 1 (45943, 178)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 45943n },
        { type: 'uint8', value: 178n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint8) => ebool test 2 (174, 178)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 174n },
        { type: 'uint8', value: 178n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint8) => ebool test 3 (178, 178)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 178n },
        { type: 'uint8', value: 178n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint8) => ebool test 4 (178, 174)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 178n },
        { type: 'uint8', value: 174n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint8) => ebool test 1 (38746, 51)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 38746n },
        { type: 'uint8', value: 51n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint8) => ebool test 2 (47, 51)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 47n },
        { type: 'uint8', value: 51n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint8) => ebool test 3 (51, 51)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51n },
        { type: 'uint8', value: 51n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint8) => ebool test 4 (51, 47)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51n },
        { type: 'uint8', value: 47n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, euint8) => ebool test 1 (32390, 103)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 32390n },
        { type: 'uint8', value: 103n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, euint8) => ebool test 2 (99, 103)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 99n },
        { type: 'uint8', value: 103n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint8) => ebool test 3 (103, 103)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 103n },
        { type: 'uint8', value: 103n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint8) => ebool test 4 (103, 99)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 103n },
        { type: 'uint8', value: 99n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint8) => ebool test 1 (11122, 142)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 11122n },
        { type: 'uint8', value: 142n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint16, euint8) => ebool test 2 (138, 142)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 138n },
        { type: 'uint8', value: 142n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint8) => ebool test 3 (142, 142)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 142n },
        { type: 'uint8', value: 142n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint8) => ebool test 4 (142, 138)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 142n },
        { type: 'uint8', value: 138n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint8) => ebool test 1 (16422, 110)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16422n },
        { type: 'uint8', value: 110n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint8) => ebool test 2 (106, 110)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 106n },
        { type: 'uint8', value: 110n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, euint8) => ebool test 3 (110, 110)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 110n },
        { type: 'uint8', value: 110n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint8) => ebool test 4 (110, 106)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 110n },
        { type: 'uint8', value: 106n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint16, euint8) => euint16 test 1 (7218, 86)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 7218n },
        { type: 'uint8', value: 86n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(86);
  });

  it('test operator "min" overload (euint16, euint8) => euint16 test 2 (82, 86)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 82n },
        { type: 'uint8', value: 86n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(82);
  });

  it('test operator "min" overload (euint16, euint8) => euint16 test 3 (86, 86)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 86n },
        { type: 'uint8', value: 86n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(86);
  });

  it('test operator "min" overload (euint16, euint8) => euint16 test 4 (86, 82)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 86n },
        { type: 'uint8', value: 82n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(82);
  });

  it('test operator "max" overload (euint16, euint8) => euint16 test 1 (40114, 33)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 40114n },
        { type: 'uint8', value: 33n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(40114);
  });

  it('test operator "max" overload (euint16, euint8) => euint16 test 2 (29, 33)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 29n },
        { type: 'uint8', value: 33n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(33);
  });

  it('test operator "max" overload (euint16, euint8) => euint16 test 3 (33, 33)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 33n },
        { type: 'uint8', value: 33n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(33);
  });

  it('test operator "max" overload (euint16, euint8) => euint16 test 4 (33, 29)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 33n },
        { type: 'uint8', value: 29n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(33);
  });

  it('test operator "add" overload (euint16, euint16) => euint16 test 1 (13756, 43006)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 13756n },
        { type: 'uint16', value: 43006n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(56762);
  });

  it('test operator "add" overload (euint16, euint16) => euint16 test 2 (13752, 13756)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 13752n },
        { type: 'uint16', value: 13756n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(27508);
  });

  it('test operator "add" overload (euint16, euint16) => euint16 test 3 (13756, 13756)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 13756n },
        { type: 'uint16', value: 13756n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(27512);
  });

  it('test operator "add" overload (euint16, euint16) => euint16 test 4 (13756, 13752)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 13756n },
        { type: 'uint16', value: 13752n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(27508);
  });

  it('test operator "sub" overload (euint16, euint16) => euint16 test 1 (48348, 48348)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 48348n },
        { type: 'uint16', value: 48348n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint16, euint16) => euint16 test 2 (48348, 48344)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 48348n },
        { type: 'uint16', value: 48344n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint16, euint16) => euint16 test 1 (163, 317)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 163n },
        { type: 'uint16', value: 317n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(51671);
  });

  it('test operator "mul" overload (euint16, euint16) => euint16 test 2 (163, 163)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 163n },
        { type: 'uint16', value: 163n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "mul" overload (euint16, euint16) => euint16 test 3 (163, 163)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 163n },
        { type: 'uint16', value: 163n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "mul" overload (euint16, euint16) => euint16 test 4 (163, 163)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 163n },
        { type: 'uint16', value: 163n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "and" overload (euint16, euint16) => euint16 test 1 (129, 21640)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 129n },
        { type: 'uint16', value: 21640n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(128);
  });

  it('test operator "and" overload (euint16, euint16) => euint16 test 2 (125, 129)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 125n },
        { type: 'uint16', value: 129n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "and" overload (euint16, euint16) => euint16 test 3 (129, 129)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 129n },
        { type: 'uint16', value: 129n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(129);
  });

  it('test operator "and" overload (euint16, euint16) => euint16 test 4 (129, 125)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 129n },
        { type: 'uint16', value: 125n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "or" overload (euint16, euint16) => euint16 test 1 (34917, 27588)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 34917n },
        { type: 'uint16', value: 27588n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(60389);
  });

  it('test operator "or" overload (euint16, euint16) => euint16 test 2 (27584, 27588)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 27584n },
        { type: 'uint16', value: 27588n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "or" overload (euint16, euint16) => euint16 test 3 (27588, 27588)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 27588n },
        { type: 'uint16', value: 27588n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "or" overload (euint16, euint16) => euint16 test 4 (27588, 27584)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 27588n },
        { type: 'uint16', value: 27584n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "xor" overload (euint16, euint16) => euint16 test 1 (16637, 56674)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16637n },
        { type: 'uint16', value: 56674n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(40351);
  });

  it('test operator "xor" overload (euint16, euint16) => euint16 test 2 (16633, 16637)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16633n },
        { type: 'uint16', value: 16637n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint16, euint16) => euint16 test 3 (16637, 16637)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16637n },
        { type: 'uint16', value: 16637n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint16, euint16) => euint16 test 4 (16637, 16633)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16637n },
        { type: 'uint16', value: 16633n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint16, euint16) => ebool test 1 (56747, 20695)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 56747n },
        { type: 'uint16', value: 20695n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint16) => ebool test 2 (20691, 20695)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 20691n },
        { type: 'uint16', value: 20695n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint16) => ebool test 3 (20695, 20695)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 20695n },
        { type: 'uint16', value: 20695n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint16, euint16) => ebool test 4 (20695, 20691)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 20695n },
        { type: 'uint16', value: 20691n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint16) => ebool test 1 (24928, 4057)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 24928n },
        { type: 'uint16', value: 4057n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint16) => ebool test 2 (4053, 4057)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 4053n },
        { type: 'uint16', value: 4057n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint16) => ebool test 3 (4057, 4057)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 4057n },
        { type: 'uint16', value: 4057n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint16) => ebool test 4 (4057, 4053)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 4057n },
        { type: 'uint16', value: 4053n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint16) => ebool test 1 (22657, 38840)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22657n },
        { type: 'uint16', value: 38840n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint16) => ebool test 2 (22653, 22657)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22653n },
        { type: 'uint16', value: 22657n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint16) => ebool test 3 (22657, 22657)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22657n },
        { type: 'uint16', value: 22657n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint16) => ebool test 4 (22657, 22653)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22657n },
        { type: 'uint16', value: 22653n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, euint16) => ebool test 1 (59175, 12672)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 59175n },
        { type: 'uint16', value: 12672n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, euint16) => ebool test 2 (12668, 12672)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 12668n },
        { type: 'uint16', value: 12672n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint16) => ebool test 3 (12672, 12672)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 12672n },
        { type: 'uint16', value: 12672n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint16) => ebool test 4 (12672, 12668)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 12672n },
        { type: 'uint16', value: 12668n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint16) => ebool test 1 (25325, 18196)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 25325n },
        { type: 'uint16', value: 18196n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint16, euint16) => ebool test 2 (18192, 18196)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18192n },
        { type: 'uint16', value: 18196n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint16) => ebool test 3 (18196, 18196)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18196n },
        { type: 'uint16', value: 18196n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint16) => ebool test 4 (18196, 18192)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18196n },
        { type: 'uint16', value: 18192n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint16) => ebool test 1 (64205, 56305)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 64205n },
        { type: 'uint16', value: 56305n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint16) => ebool test 2 (56301, 56305)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 56301n },
        { type: 'uint16', value: 56305n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, euint16) => ebool test 3 (56305, 56305)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 56305n },
        { type: 'uint16', value: 56305n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint16) => ebool test 4 (56305, 56301)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 56305n },
        { type: 'uint16', value: 56301n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint16, euint16) => euint16 test 1 (58529, 18203)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 58529n },
        { type: 'uint16', value: 18203n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(18203);
  });

  it('test operator "min" overload (euint16, euint16) => euint16 test 2 (18199, 18203)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18199n },
        { type: 'uint16', value: 18203n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(18199);
  });

  it('test operator "min" overload (euint16, euint16) => euint16 test 3 (18203, 18203)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18203n },
        { type: 'uint16', value: 18203n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(18203);
  });

  it('test operator "min" overload (euint16, euint16) => euint16 test 4 (18203, 18199)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18203n },
        { type: 'uint16', value: 18199n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(18199);
  });

  it('test operator "max" overload (euint16, euint16) => euint16 test 1 (64651, 60629)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 64651n },
        { type: 'uint16', value: 60629n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(64651);
  });

  it('test operator "max" overload (euint16, euint16) => euint16 test 2 (60625, 60629)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 60625n },
        { type: 'uint16', value: 60629n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "max" overload (euint16, euint16) => euint16 test 3 (60629, 60629)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 60629n },
        { type: 'uint16', value: 60629n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "max" overload (euint16, euint16) => euint16 test 4 (60629, 60625)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 60629n },
        { type: 'uint16', value: 60625n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract2.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "add" overload (euint16, euint32) => euint32 test 1 (2, 54917)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2n },
        { type: 'uint32', value: 54917n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(54919);
  });

  it('test operator "add" overload (euint16, euint32) => euint32 test 2 (2808, 2812)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2808n },
        { type: 'uint32', value: 2812n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(5620);
  });

  it('test operator "add" overload (euint16, euint32) => euint32 test 3 (2812, 2812)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2812n },
        { type: 'uint32', value: 2812n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(5624);
  });

  it('test operator "add" overload (euint16, euint32) => euint32 test 4 (2812, 2808)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2812n },
        { type: 'uint32', value: 2808n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(5620);
  });
});
