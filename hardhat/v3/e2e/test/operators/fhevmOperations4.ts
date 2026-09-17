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

describe('FHEVM operations 4', function () {
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

  it('test operator "eq" overload (euint32, euint8) => ebool test 1 (2532320727, 183)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2532320727n },
        { type: 'uint8', value: 183n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint8) => ebool test 2 (179, 183)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 179n },
        { type: 'uint8', value: 183n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint8) => ebool test 3 (183, 183)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 183n },
        { type: 'uint8', value: 183n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint32, euint8) => ebool test 4 (183, 179)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 183n },
        { type: 'uint8', value: 179n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint8) => ebool test 1 (2676084558, 237)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2676084558n },
        { type: 'uint8', value: 237n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint8) => ebool test 2 (233, 237)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 233n },
        { type: 'uint8', value: 237n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint8) => ebool test 3 (237, 237)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 237n },
        { type: 'uint8', value: 237n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint8) => ebool test 4 (237, 233)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 237n },
        { type: 'uint8', value: 233n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint8) => ebool test 1 (3548487647, 241)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3548487647n },
        { type: 'uint8', value: 241n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint8) => ebool test 2 (237, 241)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 237n },
        { type: 'uint8', value: 241n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, euint8) => ebool test 3 (241, 241)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 241n },
        { type: 'uint8', value: 241n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint8) => ebool test 4 (241, 237)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 241n },
        { type: 'uint8', value: 237n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, euint8) => ebool test 1 (521887715, 124)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 521887715n },
        { type: 'uint8', value: 124n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, euint8) => ebool test 2 (120, 124)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 120n },
        { type: 'uint8', value: 124n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint8) => ebool test 3 (124, 124)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 124n },
        { type: 'uint8', value: 124n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint8) => ebool test 4 (124, 120)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 124n },
        { type: 'uint8', value: 120n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint8) => ebool test 1 (3671403941, 34)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3671403941n },
        { type: 'uint8', value: 34n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint32, euint8) => ebool test 2 (30, 34)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 30n },
        { type: 'uint8', value: 34n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint8) => ebool test 3 (34, 34)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 34n },
        { type: 'uint8', value: 34n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint8) => ebool test 4 (34, 30)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 34n },
        { type: 'uint8', value: 30n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint8) => ebool test 1 (3935223711, 65)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3935223711n },
        { type: 'uint8', value: 65n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint8) => ebool test 2 (61, 65)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 61n },
        { type: 'uint8', value: 65n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint32, euint8) => ebool test 3 (65, 65)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 65n },
        { type: 'uint8', value: 65n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint8) => ebool test 4 (65, 61)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 65n },
        { type: 'uint8', value: 61n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint32, euint8) => euint32 test 1 (4070815488, 204)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4070815488n },
        { type: 'uint8', value: 204n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(204);
  });

  it('test operator "min" overload (euint32, euint8) => euint32 test 2 (200, 204)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 200n },
        { type: 'uint8', value: 204n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(200);
  });

  it('test operator "min" overload (euint32, euint8) => euint32 test 3 (204, 204)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 204n },
        { type: 'uint8', value: 204n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(204);
  });

  it('test operator "min" overload (euint32, euint8) => euint32 test 4 (204, 200)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 204n },
        { type: 'uint8', value: 200n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(200);
  });

  it('test operator "max" overload (euint32, euint8) => euint32 test 1 (2283898097, 228)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2283898097n },
        { type: 'uint8', value: 228n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(2283898097);
  });

  it('test operator "max" overload (euint32, euint8) => euint32 test 2 (224, 228)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 224n },
        { type: 'uint8', value: 228n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(228);
  });

  it('test operator "max" overload (euint32, euint8) => euint32 test 3 (228, 228)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 228n },
        { type: 'uint8', value: 228n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(228);
  });

  it('test operator "max" overload (euint32, euint8) => euint32 test 4 (228, 224)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 228n },
        { type: 'uint8', value: 224n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(228);
  });

  it('test operator "add" overload (euint32, euint16) => euint32 test 1 (45145, 3)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 45145n },
        { type: 'uint16', value: 3n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(45148);
  });

  it('test operator "add" overload (euint32, euint16) => euint32 test 2 (31851, 31853)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 31851n },
        { type: 'uint16', value: 31853n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(63704);
  });

  it('test operator "add" overload (euint32, euint16) => euint32 test 3 (31853, 31853)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 31853n },
        { type: 'uint16', value: 31853n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(63706);
  });

  it('test operator "add" overload (euint32, euint16) => euint32 test 4 (31853, 31851)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 31853n },
        { type: 'uint16', value: 31851n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(63704);
  });

  it('test operator "sub" overload (euint32, euint16) => euint32 test 1 (46156, 46156)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 46156n },
        { type: 'uint16', value: 46156n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint32, euint16) => euint32 test 2 (46156, 46152)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 46156n },
        { type: 'uint16', value: 46152n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint32, euint16) => euint32 test 1 (17102, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 17102n },
        { type: 'uint16', value: 2n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(34204);
  });

  it('test operator "mul" overload (euint32, euint16) => euint32 test 2 (156, 156)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 156n },
        { type: 'uint16', value: 156n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(24336);
  });

  it('test operator "mul" overload (euint32, euint16) => euint32 test 3 (156, 156)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 156n },
        { type: 'uint16', value: 156n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(24336);
  });

  it('test operator "mul" overload (euint32, euint16) => euint32 test 4 (156, 156)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 156n },
        { type: 'uint16', value: 156n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(24336);
  });

  it('test operator "and" overload (euint32, euint16) => euint32 test 1 (1484006749, 2919)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1484006749n },
        { type: 'uint16', value: 2919n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(325);
  });

  it('test operator "and" overload (euint32, euint16) => euint32 test 2 (2915, 2919)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2915n },
        { type: 'uint16', value: 2919n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(2915);
  });

  it('test operator "and" overload (euint32, euint16) => euint32 test 3 (2919, 2919)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2919n },
        { type: 'uint16', value: 2919n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(2919);
  });

  it('test operator "and" overload (euint32, euint16) => euint32 test 4 (2919, 2915)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2919n },
        { type: 'uint16', value: 2915n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(2915);
  });

  it('test operator "or" overload (euint32, euint16) => euint32 test 1 (3948604159, 128)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3948604159n },
        { type: 'uint16', value: 128n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(3948604159);
  });

  it('test operator "or" overload (euint32, euint16) => euint32 test 2 (124, 128)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 124n },
        { type: 'uint16', value: 128n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(252);
  });

  it('test operator "or" overload (euint32, euint16) => euint32 test 3 (128, 128)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 128n },
        { type: 'uint16', value: 128n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(128);
  });

  it('test operator "or" overload (euint32, euint16) => euint32 test 4 (128, 124)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 128n },
        { type: 'uint16', value: 124n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(252);
  });

  it('test operator "xor" overload (euint32, euint16) => euint32 test 1 (3244307804, 55182)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3244307804n },
        { type: 'uint16', value: 55182n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(3244352210);
  });

  it('test operator "xor" overload (euint32, euint16) => euint32 test 2 (55178, 55182)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55178n },
        { type: 'uint16', value: 55182n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint32, euint16) => euint32 test 3 (55182, 55182)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55182n },
        { type: 'uint16', value: 55182n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint32, euint16) => euint32 test 4 (55182, 55178)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55182n },
        { type: 'uint16', value: 55178n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint32, euint16) => ebool test 1 (1084275393, 57843)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1084275393n },
        { type: 'uint16', value: 57843n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint16) => ebool test 2 (57839, 57843)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 57839n },
        { type: 'uint16', value: 57843n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint16) => ebool test 3 (57843, 57843)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 57843n },
        { type: 'uint16', value: 57843n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint32, euint16) => ebool test 4 (57843, 57839)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 57843n },
        { type: 'uint16', value: 57839n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint16) => ebool test 1 (316088001, 3787)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 316088001n },
        { type: 'uint16', value: 3787n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint16) => ebool test 2 (3783, 3787)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3783n },
        { type: 'uint16', value: 3787n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint16) => ebool test 3 (3787, 3787)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3787n },
        { type: 'uint16', value: 3787n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint16) => ebool test 4 (3787, 3783)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3787n },
        { type: 'uint16', value: 3783n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint16) => ebool test 1 (140041814, 56977)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 140041814n },
        { type: 'uint16', value: 56977n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint16) => ebool test 2 (56973, 56977)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 56973n },
        { type: 'uint16', value: 56977n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, euint16) => ebool test 3 (56977, 56977)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 56977n },
        { type: 'uint16', value: 56977n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint16) => ebool test 4 (56977, 56973)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 56977n },
        { type: 'uint16', value: 56973n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, euint16) => ebool test 1 (3904113431, 40661)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3904113431n },
        { type: 'uint16', value: 40661n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, euint16) => ebool test 2 (40657, 40661)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 40657n },
        { type: 'uint16', value: 40661n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint16) => ebool test 3 (40661, 40661)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 40661n },
        { type: 'uint16', value: 40661n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint16) => ebool test 4 (40661, 40657)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 40661n },
        { type: 'uint16', value: 40657n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint16) => ebool test 1 (2187421426, 1257)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2187421426n },
        { type: 'uint16', value: 1257n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint32, euint16) => ebool test 2 (1253, 1257)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1253n },
        { type: 'uint16', value: 1257n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint16) => ebool test 3 (1257, 1257)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1257n },
        { type: 'uint16', value: 1257n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint16) => ebool test 4 (1257, 1253)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1257n },
        { type: 'uint16', value: 1253n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint16) => ebool test 1 (2551437926, 55821)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2551437926n },
        { type: 'uint16', value: 55821n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint16) => ebool test 2 (55817, 55821)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55817n },
        { type: 'uint16', value: 55821n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint32, euint16) => ebool test 3 (55821, 55821)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55821n },
        { type: 'uint16', value: 55821n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint16) => ebool test 4 (55821, 55817)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55821n },
        { type: 'uint16', value: 55817n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint32, euint16) => euint32 test 1 (1068231898, 55730)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1068231898n },
        { type: 'uint16', value: 55730n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(55730);
  });

  it('test operator "min" overload (euint32, euint16) => euint32 test 2 (55726, 55730)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55726n },
        { type: 'uint16', value: 55730n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(55726);
  });

  it('test operator "min" overload (euint32, euint16) => euint32 test 3 (55730, 55730)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55730n },
        { type: 'uint16', value: 55730n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(55730);
  });

  it('test operator "min" overload (euint32, euint16) => euint32 test 4 (55730, 55726)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 55730n },
        { type: 'uint16', value: 55726n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(55726);
  });

  it('test operator "max" overload (euint32, euint16) => euint32 test 1 (475287265, 61314)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 475287265n },
        { type: 'uint16', value: 61314n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(475287265);
  });

  it('test operator "max" overload (euint32, euint16) => euint32 test 2 (61310, 61314)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 61310n },
        { type: 'uint16', value: 61314n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(61314);
  });

  it('test operator "max" overload (euint32, euint16) => euint32 test 3 (61314, 61314)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 61314n },
        { type: 'uint16', value: 61314n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(61314);
  });

  it('test operator "max" overload (euint32, euint16) => euint32 test 4 (61314, 61310)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 61314n },
        { type: 'uint16', value: 61310n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint32_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(61314);
  });

  it('test operator "add" overload (euint32, euint32) => euint32 test 1 (308575078, 3037034175)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 308575078n },
        { type: 'uint32', value: 3037034175n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(3345609253);
  });

  it('test operator "add" overload (euint32, euint32) => euint32 test 2 (308575074, 308575078)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 308575074n },
        { type: 'uint32', value: 308575078n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(617150152);
  });

  it('test operator "add" overload (euint32, euint32) => euint32 test 3 (308575078, 308575078)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 308575078n },
        { type: 'uint32', value: 308575078n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(617150156);
  });

  it('test operator "add" overload (euint32, euint32) => euint32 test 4 (308575078, 308575074)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 308575078n },
        { type: 'uint32', value: 308575074n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(617150152);
  });

  it('test operator "sub" overload (euint32, euint32) => euint32 test 1 (827505071, 827505071)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 827505071n },
        { type: 'uint32', value: 827505071n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint32, euint32) => euint32 test 2 (827505071, 827505067)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 827505071n },
        { type: 'uint32', value: 827505067n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint32, euint32) => euint32 test 1 (37540, 54954)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 37540n },
        { type: 'uint32', value: 54954n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2062973160);
  });

  it('test operator "mul" overload (euint32, euint32) => euint32 test 2 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 37540n },
        { type: 'uint32', value: 37540n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "mul" overload (euint32, euint32) => euint32 test 3 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 37540n },
        { type: 'uint32', value: 37540n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "mul" overload (euint32, euint32) => euint32 test 4 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 37540n },
        { type: 'uint32', value: 37540n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "and" overload (euint32, euint32) => euint32 test 1 (3106281428, 459255123)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3106281428n },
        { type: 'uint32', value: 459255123n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(419824976);
  });

  it('test operator "and" overload (euint32, euint32) => euint32 test 2 (459255119, 459255123)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 459255119n },
        { type: 'uint32', value: 459255123n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(459255107);
  });

  it('test operator "and" overload (euint32, euint32) => euint32 test 3 (459255123, 459255123)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 459255123n },
        { type: 'uint32', value: 459255123n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(459255123);
  });

  it('test operator "and" overload (euint32, euint32) => euint32 test 4 (459255123, 459255119)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 459255123n },
        { type: 'uint32', value: 459255119n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(459255107);
  });

  it('test operator "or" overload (euint32, euint32) => euint32 test 1 (2935699084, 2988380217)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2935699084n },
        { type: 'uint32', value: 2988380217n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(3204396733);
  });

  it('test operator "or" overload (euint32, euint32) => euint32 test 2 (2935699080, 2935699084)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2935699080n },
        { type: 'uint32', value: 2935699084n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "or" overload (euint32, euint32) => euint32 test 3 (2935699084, 2935699084)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2935699084n },
        { type: 'uint32', value: 2935699084n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "or" overload (euint32, euint32) => euint32 test 4 (2935699084, 2935699080)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2935699084n },
        { type: 'uint32', value: 2935699080n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "xor" overload (euint32, euint32) => euint32 test 1 (1188690081, 3400202936)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1188690081n },
        { type: 'uint32', value: 3400202936n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2356347417);
  });

  it('test operator "xor" overload (euint32, euint32) => euint32 test 2 (1188690077, 1188690081)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1188690077n },
        { type: 'uint32', value: 1188690081n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(60);
  });

  it('test operator "xor" overload (euint32, euint32) => euint32 test 3 (1188690081, 1188690081)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1188690081n },
        { type: 'uint32', value: 1188690081n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint32, euint32) => euint32 test 4 (1188690081, 1188690077)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1188690081n },
        { type: 'uint32', value: 1188690077n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(60);
  });

  it('test operator "eq" overload (euint32, euint32) => ebool test 1 (3295570634, 96781377)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3295570634n },
        { type: 'uint32', value: 96781377n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint32) => ebool test 2 (96781373, 96781377)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 96781373n },
        { type: 'uint32', value: 96781377n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint32) => ebool test 3 (96781377, 96781377)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 96781377n },
        { type: 'uint32', value: 96781377n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint32, euint32) => ebool test 4 (96781377, 96781373)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 96781377n },
        { type: 'uint32', value: 96781373n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint32) => ebool test 1 (3427057056, 345973165)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3427057056n },
        { type: 'uint32', value: 345973165n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint32) => ebool test 2 (345973161, 345973165)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 345973161n },
        { type: 'uint32', value: 345973165n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint32) => ebool test 3 (345973165, 345973165)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 345973165n },
        { type: 'uint32', value: 345973165n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint32) => ebool test 4 (345973165, 345973161)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 345973165n },
        { type: 'uint32', value: 345973161n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint32) => ebool test 1 (1065729491, 3661441654)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1065729491n },
        { type: 'uint32', value: 3661441654n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, euint32) => ebool test 2 (1065729487, 1065729491)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1065729487n },
        { type: 'uint32', value: 1065729491n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, euint32) => ebool test 3 (1065729491, 1065729491)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1065729491n },
        { type: 'uint32', value: 1065729491n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint32) => ebool test 4 (1065729491, 1065729487)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1065729491n },
        { type: 'uint32', value: 1065729487n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, euint32) => ebool test 1 (1417495620, 3756148778)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1417495620n },
        { type: 'uint32', value: 3756148778n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint32) => ebool test 2 (1417495616, 1417495620)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1417495616n },
        { type: 'uint32', value: 1417495620n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint32) => ebool test 3 (1417495620, 1417495620)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1417495620n },
        { type: 'uint32', value: 1417495620n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint32) => ebool test 4 (1417495620, 1417495616)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1417495620n },
        { type: 'uint32', value: 1417495616n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint32) => ebool test 1 (2499693605, 3274381478)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2499693605n },
        { type: 'uint32', value: 3274381478n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint32) => ebool test 2 (2499693601, 2499693605)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2499693601n },
        { type: 'uint32', value: 2499693605n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint32) => ebool test 3 (2499693605, 2499693605)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2499693605n },
        { type: 'uint32', value: 2499693605n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint32) => ebool test 4 (2499693605, 2499693601)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2499693605n },
        { type: 'uint32', value: 2499693601n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint32) => ebool test 1 (3759916356, 3277524466)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3759916356n },
        { type: 'uint32', value: 3277524466n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint32) => ebool test 2 (3277524462, 3277524466)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3277524462n },
        { type: 'uint32', value: 3277524466n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint32, euint32) => ebool test 3 (3277524466, 3277524466)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3277524466n },
        { type: 'uint32', value: 3277524466n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint32) => ebool test 4 (3277524466, 3277524462)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3277524466n },
        { type: 'uint32', value: 3277524462n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint32, euint32) => euint32 test 1 (3856164871, 2385547109)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3856164871n },
        { type: 'uint32', value: 2385547109n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2385547109);
  });

  it('test operator "min" overload (euint32, euint32) => euint32 test 2 (2385547105, 2385547109)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2385547105n },
        { type: 'uint32', value: 2385547109n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2385547105);
  });

  it('test operator "min" overload (euint32, euint32) => euint32 test 3 (2385547109, 2385547109)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2385547109n },
        { type: 'uint32', value: 2385547109n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2385547109);
  });

  it('test operator "min" overload (euint32, euint32) => euint32 test 4 (2385547109, 2385547105)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2385547109n },
        { type: 'uint32', value: 2385547105n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(2385547105);
  });

  it('test operator "max" overload (euint32, euint32) => euint32 test 1 (713485747, 621451200)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 713485747n },
        { type: 'uint32', value: 621451200n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(713485747);
  });

  it('test operator "max" overload (euint32, euint32) => euint32 test 2 (621451196, 621451200)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 621451196n },
        { type: 'uint32', value: 621451200n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "max" overload (euint32, euint32) => euint32 test 3 (621451200, 621451200)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 621451200n },
        { type: 'uint32', value: 621451200n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "max" overload (euint32, euint32) => euint32 test 4 (621451200, 621451196)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 621451200n },
        { type: 'uint32', value: 621451196n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract3.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "add" overload (euint32, euint64) => euint64 test 1 (2, 4293537694)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2n },
        { type: 'uint64', value: 4293537694n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4293537696n);
  });

  it('test operator "add" overload (euint32, euint64) => euint64 test 2 (1235096539, 1235096541)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1235096539n },
        { type: 'uint64', value: 1235096541n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(2470193080n);
  });

  it('test operator "add" overload (euint32, euint64) => euint64 test 3 (1235096541, 1235096541)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1235096541n },
        { type: 'uint64', value: 1235096541n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(2470193082n);
  });

  it('test operator "add" overload (euint32, euint64) => euint64 test 4 (1235096541, 1235096539)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1235096541n },
        { type: 'uint64', value: 1235096539n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(2470193080n);
  });

  it('test operator "sub" overload (euint32, euint64) => euint64 test 1 (1159293805, 1159293805)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1159293805n },
        { type: 'uint64', value: 1159293805n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint32, euint64) => euint64 test 2 (1159293805, 1159293801)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1159293805n },
        { type: 'uint64', value: 1159293801n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint32, euint64) => euint64 test 1 (2, 2146763810)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2n },
        { type: 'uint64', value: 2146763810n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4293527620n);
  });

  it('test operator "mul" overload (euint32, euint64) => euint64 test 2 (56716, 56716)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 56716n },
        { type: 'uint64', value: 56716n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3216704656n);
  });

  it('test operator "mul" overload (euint32, euint64) => euint64 test 3 (56716, 56716)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 56716n },
        { type: 'uint64', value: 56716n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3216704656n);
  });

  it('test operator "mul" overload (euint32, euint64) => euint64 test 4 (56716, 56716)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 56716n },
        { type: 'uint64', value: 56716n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3216704656n);
  });

  it('test operator "and" overload (euint32, euint64) => euint64 test 1 (946992826, 18441461428987257875)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 946992826n },
        { type: 'uint64', value: 18441461428987257875n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(676357138n);
  });

  it('test operator "and" overload (euint32, euint64) => euint64 test 2 (946992822, 946992826)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 946992822n },
        { type: 'uint64', value: 946992826n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(946992818n);
  });

  it('test operator "and" overload (euint32, euint64) => euint64 test 3 (946992826, 946992826)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 946992826n },
        { type: 'uint64', value: 946992826n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(946992826n);
  });

  it('test operator "and" overload (euint32, euint64) => euint64 test 4 (946992826, 946992822)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 946992826n },
        { type: 'uint64', value: 946992822n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(946992818n);
  });

  it('test operator "or" overload (euint32, euint64) => euint64 test 1 (311778344, 18446699499439087951)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 311778344n },
        { type: 'uint64', value: 18446699499439087951n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18446699499447745903n);
  });

  it('test operator "or" overload (euint32, euint64) => euint64 test 2 (311778340, 311778344)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 311778340n },
        { type: 'uint64', value: 311778344n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(311778348n);
  });

  it('test operator "or" overload (euint32, euint64) => euint64 test 3 (311778344, 311778344)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 311778344n },
        { type: 'uint64', value: 311778344n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(311778344n);
  });

  it('test operator "or" overload (euint32, euint64) => euint64 test 4 (311778344, 311778340)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 311778344n },
        { type: 'uint64', value: 311778340n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(311778348n);
  });

  it('test operator "xor" overload (euint32, euint64) => euint64 test 1 (1100149359, 18440160241169480413)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1100149359n },
        { type: 'uint64', value: 18440160241169480413n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18440160242267506866n);
  });

  it('test operator "xor" overload (euint32, euint64) => euint64 test 2 (1100149355, 1100149359)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1100149355n },
        { type: 'uint64', value: 1100149359n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint32, euint64) => euint64 test 3 (1100149359, 1100149359)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1100149359n },
        { type: 'uint64', value: 1100149359n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint32, euint64) => euint64 test 4 (1100149359, 1100149355)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1100149359n },
        { type: 'uint64', value: 1100149355n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint32, euint64) => ebool test 1 (2324161012, 18439625567169454671)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2324161012n },
        { type: 'uint64', value: 18439625567169454671n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint64) => ebool test 2 (2324161008, 2324161012)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2324161008n },
        { type: 'uint64', value: 2324161012n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint64) => ebool test 3 (2324161012, 2324161012)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2324161012n },
        { type: 'uint64', value: 2324161012n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint32, euint64) => ebool test 4 (2324161012, 2324161008)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2324161012n },
        { type: 'uint64', value: 2324161008n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint64) => ebool test 1 (1743345271, 18445619894242149765)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1743345271n },
        { type: 'uint64', value: 18445619894242149765n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint64) => ebool test 2 (1743345267, 1743345271)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1743345267n },
        { type: 'uint64', value: 1743345271n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint64) => ebool test 3 (1743345271, 1743345271)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1743345271n },
        { type: 'uint64', value: 1743345271n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint64) => ebool test 4 (1743345271, 1743345267)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1743345271n },
        { type: 'uint64', value: 1743345267n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint64) => ebool test 1 (1358412880, 18443611153534772391)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1358412880n },
        { type: 'uint64', value: 18443611153534772391n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, euint64) => ebool test 2 (1358412876, 1358412880)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1358412876n },
        { type: 'uint64', value: 1358412880n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, euint64) => ebool test 3 (1358412880, 1358412880)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1358412880n },
        { type: 'uint64', value: 1358412880n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint64) => ebool test 4 (1358412880, 1358412876)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1358412880n },
        { type: 'uint64', value: 1358412876n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, euint64) => ebool test 1 (3552831674, 18445107069229183219)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3552831674n },
        { type: 'uint64', value: 18445107069229183219n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint64) => ebool test 2 (3552831670, 3552831674)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3552831670n },
        { type: 'uint64', value: 3552831674n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint64) => ebool test 3 (3552831674, 3552831674)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3552831674n },
        { type: 'uint64', value: 3552831674n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint64) => ebool test 4 (3552831674, 3552831670)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3552831674n },
        { type: 'uint64', value: 3552831670n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint64) => ebool test 1 (3076380922, 18443020918330004613)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3076380922n },
        { type: 'uint64', value: 18443020918330004613n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint64) => ebool test 2 (3076380918, 3076380922)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3076380918n },
        { type: 'uint64', value: 3076380922n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint64) => ebool test 3 (3076380922, 3076380922)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3076380922n },
        { type: 'uint64', value: 3076380922n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint64) => ebool test 4 (3076380922, 3076380918)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3076380922n },
        { type: 'uint64', value: 3076380918n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint64) => ebool test 1 (3481458407, 18437842109699544467)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3481458407n },
        { type: 'uint64', value: 18437842109699544467n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint32, euint64) => ebool test 2 (3481458403, 3481458407)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3481458403n },
        { type: 'uint64', value: 3481458407n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint32, euint64) => ebool test 3 (3481458407, 3481458407)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3481458407n },
        { type: 'uint64', value: 3481458407n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint64) => ebool test 4 (3481458407, 3481458403)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3481458407n },
        { type: 'uint64', value: 3481458403n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint32, euint64) => euint64 test 1 (4260966548, 18440167583242822417)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4260966548n },
        { type: 'uint64', value: 18440167583242822417n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4260966548n);
  });

  it('test operator "min" overload (euint32, euint64) => euint64 test 2 (4260966544, 4260966548)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4260966544n },
        { type: 'uint64', value: 4260966548n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4260966544n);
  });

  it('test operator "min" overload (euint32, euint64) => euint64 test 3 (4260966548, 4260966548)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4260966548n },
        { type: 'uint64', value: 4260966548n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4260966548n);
  });

  it('test operator "min" overload (euint32, euint64) => euint64 test 4 (4260966548, 4260966544)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4260966548n },
        { type: 'uint64', value: 4260966544n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4260966544n);
  });

  it('test operator "max" overload (euint32, euint64) => euint64 test 1 (1824035354, 18438154354738093649)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1824035354n },
        { type: 'uint64', value: 18438154354738093649n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18438154354738093649n);
  });

  it('test operator "max" overload (euint32, euint64) => euint64 test 2 (1824035350, 1824035354)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1824035350n },
        { type: 'uint64', value: 1824035354n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1824035354n);
  });

  it('test operator "max" overload (euint32, euint64) => euint64 test 3 (1824035354, 1824035354)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1824035354n },
        { type: 'uint64', value: 1824035354n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1824035354n);
  });

  it('test operator "max" overload (euint32, euint64) => euint64 test 4 (1824035354, 1824035350)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1824035354n },
        { type: 'uint64', value: 1824035350n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1824035354n);
  });

  it('test operator "add" overload (euint32, euint128) => euint128 test 1 (2, 2147483649)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2n },
        { type: 'uint128', value: 2147483649n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(2147483651n);
  });

  it('test operator "add" overload (euint32, euint128) => euint128 test 2 (1362611807, 1362611809)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1362611807n },
        { type: 'uint128', value: 1362611809n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(2725223616n);
  });

  it('test operator "add" overload (euint32, euint128) => euint128 test 3 (1362611809, 1362611809)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1362611809n },
        { type: 'uint128', value: 1362611809n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(2725223618n);
  });

  it('test operator "add" overload (euint32, euint128) => euint128 test 4 (1362611809, 1362611807)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1362611809n },
        { type: 'uint128', value: 1362611807n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(2725223616n);
  });

  it('test operator "sub" overload (euint32, euint128) => euint128 test 1 (3564881227, 3564881227)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3564881227n },
        { type: 'uint128', value: 3564881227n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint32, euint128) => euint128 test 2 (3564881227, 3564881223)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3564881227n },
        { type: 'uint128', value: 3564881223n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(4n);
  });
});
