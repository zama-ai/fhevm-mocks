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

describe('FHEVM operations 1', function () {
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

  it('test operator "add" overload (euint8, euint8) => euint8 test 1 (80, 133)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 80n },
        { type: 'uint8', value: 133n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(213);
  });

  it('test operator "add" overload (euint8, euint8) => euint8 test 2 (76, 80)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 76n },
        { type: 'uint8', value: 80n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(156);
  });

  it('test operator "add" overload (euint8, euint8) => euint8 test 3 (80, 80)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 80n },
        { type: 'uint8', value: 80n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(160);
  });

  it('test operator "add" overload (euint8, euint8) => euint8 test 4 (80, 76)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 80n },
        { type: 'uint8', value: 76n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(156);
  });

  it('test operator "sub" overload (euint8, euint8) => euint8 test 1 (34, 34)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 34n },
        { type: 'uint8', value: 34n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint8, euint8) => euint8 test 2 (34, 30)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 34n },
        { type: 'uint8', value: 30n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint8, euint8) => euint8 test 1 (13, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 13n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(91);
  });

  it('test operator "mul" overload (euint8, euint8) => euint8 test 2 (11, 12)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 11n },
        { type: 'uint8', value: 12n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(132);
  });

  it('test operator "mul" overload (euint8, euint8) => euint8 test 3 (12, 12)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 12n },
        { type: 'uint8', value: 12n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(144);
  });

  it('test operator "mul" overload (euint8, euint8) => euint8 test 4 (12, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 12n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(132);
  });

  it('test operator "and" overload (euint8, euint8) => euint8 test 1 (200, 121)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 200n },
        { type: 'uint8', value: 121n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(72);
  });

  it('test operator "and" overload (euint8, euint8) => euint8 test 2 (117, 121)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 117n },
        { type: 'uint8', value: 121n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(113);
  });

  it('test operator "and" overload (euint8, euint8) => euint8 test 3 (121, 121)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 121n },
        { type: 'uint8', value: 121n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(121);
  });

  it('test operator "and" overload (euint8, euint8) => euint8 test 4 (121, 117)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 121n },
        { type: 'uint8', value: 117n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(113);
  });

  it('test operator "or" overload (euint8, euint8) => euint8 test 1 (119, 37)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 119n },
        { type: 'uint8', value: 37n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(119);
  });

  it('test operator "or" overload (euint8, euint8) => euint8 test 2 (33, 37)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 33n },
        { type: 'uint8', value: 37n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(37);
  });

  it('test operator "or" overload (euint8, euint8) => euint8 test 3 (37, 37)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 37n },
        { type: 'uint8', value: 37n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(37);
  });

  it('test operator "or" overload (euint8, euint8) => euint8 test 4 (37, 33)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 37n },
        { type: 'uint8', value: 33n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(37);
  });

  it('test operator "xor" overload (euint8, euint8) => euint8 test 1 (239, 14)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 239n },
        { type: 'uint8', value: 14n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(225);
  });

  it('test operator "xor" overload (euint8, euint8) => euint8 test 2 (10, 14)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 10n },
        { type: 'uint8', value: 14n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint8, euint8) => euint8 test 3 (14, 14)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 14n },
        { type: 'uint8', value: 14n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint8, euint8) => euint8 test 4 (14, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 14n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint8, euint8) => ebool test 1 (221, 223)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 221n },
        { type: 'uint8', value: 223n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint8) => ebool test 2 (217, 221)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 217n },
        { type: 'uint8', value: 221n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint8) => ebool test 3 (221, 221)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 221n },
        { type: 'uint8', value: 221n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint8, euint8) => ebool test 4 (221, 217)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 221n },
        { type: 'uint8', value: 217n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint8) => ebool test 1 (151, 233)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 151n },
        { type: 'uint8', value: 233n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint8) => ebool test 2 (147, 151)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 147n },
        { type: 'uint8', value: 151n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint8) => ebool test 3 (151, 151)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 151n },
        { type: 'uint8', value: 151n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint8) => ebool test 4 (151, 147)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 151n },
        { type: 'uint8', value: 147n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint8) => ebool test 1 (36, 38)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 36n },
        { type: 'uint8', value: 38n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint8) => ebool test 2 (32, 36)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 32n },
        { type: 'uint8', value: 36n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint8) => ebool test 3 (36, 36)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 36n },
        { type: 'uint8', value: 36n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint8) => ebool test 4 (36, 32)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 36n },
        { type: 'uint8', value: 32n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint8, euint8) => ebool test 1 (244, 204)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 244n },
        { type: 'uint8', value: 204n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint8, euint8) => ebool test 2 (200, 204)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 200n },
        { type: 'uint8', value: 204n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint8) => ebool test 3 (204, 204)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 204n },
        { type: 'uint8', value: 204n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint8) => ebool test 4 (204, 200)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 204n },
        { type: 'uint8', value: 200n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint8) => ebool test 1 (212, 34)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 212n },
        { type: 'uint8', value: 34n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint8, euint8) => ebool test 2 (30, 34)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 30n },
        { type: 'uint8', value: 34n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint8) => ebool test 3 (34, 34)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 34n },
        { type: 'uint8', value: 34n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint8) => ebool test 4 (34, 30)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 34n },
        { type: 'uint8', value: 30n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint8) => ebool test 1 (218, 198)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 218n },
        { type: 'uint8', value: 198n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint8) => ebool test 2 (194, 198)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 194n },
        { type: 'uint8', value: 198n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint8) => ebool test 3 (198, 198)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 198n },
        { type: 'uint8', value: 198n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint8) => ebool test 4 (198, 194)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 198n },
        { type: 'uint8', value: 194n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint8, euint8) => euint8 test 1 (137, 232)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 137n },
        { type: 'uint8', value: 232n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(137);
  });

  it('test operator "min" overload (euint8, euint8) => euint8 test 2 (133, 137)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 133n },
        { type: 'uint8', value: 137n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(133);
  });

  it('test operator "min" overload (euint8, euint8) => euint8 test 3 (137, 137)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 137n },
        { type: 'uint8', value: 137n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(137);
  });

  it('test operator "min" overload (euint8, euint8) => euint8 test 4 (137, 133)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 137n },
        { type: 'uint8', value: 133n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(133);
  });

  it('test operator "max" overload (euint8, euint8) => euint8 test 1 (125, 15)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 125n },
        { type: 'uint8', value: 15n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(125);
  });

  it('test operator "max" overload (euint8, euint8) => euint8 test 2 (11, 15)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 11n },
        { type: 'uint8', value: 15n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "max" overload (euint8, euint8) => euint8 test 3 (15, 15)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 15n },
        { type: 'uint8', value: 15n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "max" overload (euint8, euint8) => euint8 test 4 (15, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 15n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract1.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "add" overload (euint8, euint16) => euint16 test 1 (2, 159)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 2n },
        { type: 'uint16', value: 159n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(161);
  });

  it('test operator "add" overload (euint8, euint16) => euint16 test 2 (43, 47)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 43n },
        { type: 'uint16', value: 47n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(90);
  });

  it('test operator "add" overload (euint8, euint16) => euint16 test 3 (47, 47)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 47n },
        { type: 'uint16', value: 47n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(94);
  });

  it('test operator "add" overload (euint8, euint16) => euint16 test 4 (47, 43)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 47n },
        { type: 'uint16', value: 43n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(90);
  });

  it('test operator "sub" overload (euint8, euint16) => euint16 test 1 (49, 49)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 49n },
        { type: 'uint16', value: 49n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint8, euint16) => euint16 test 2 (49, 45)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 49n },
        { type: 'uint16', value: 45n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint8, euint16) => euint16 test 1 (2, 79)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 2n },
        { type: 'uint16', value: 79n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(158);
  });

  it('test operator "mul" overload (euint8, euint16) => euint16 test 2 (10, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 10n },
        { type: 'uint16', value: 11n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(110);
  });

  it('test operator "mul" overload (euint8, euint16) => euint16 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 11n },
        { type: 'uint16', value: 11n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(121);
  });

  it('test operator "mul" overload (euint8, euint16) => euint16 test 4 (11, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 11n },
        { type: 'uint16', value: 10n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(110);
  });

  it('test operator "and" overload (euint8, euint16) => euint16 test 1 (243, 47811)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 243n },
        { type: 'uint16', value: 47811n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(195);
  });

  it('test operator "and" overload (euint8, euint16) => euint16 test 2 (239, 243)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 239n },
        { type: 'uint16', value: 243n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(227);
  });

  it('test operator "and" overload (euint8, euint16) => euint16 test 3 (243, 243)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 243n },
        { type: 'uint16', value: 243n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(243);
  });

  it('test operator "and" overload (euint8, euint16) => euint16 test 4 (243, 239)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 243n },
        { type: 'uint16', value: 239n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(227);
  });

  it('test operator "or" overload (euint8, euint16) => euint16 test 1 (88, 40375)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 88n },
        { type: 'uint16', value: 40375n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(40447);
  });

  it('test operator "or" overload (euint8, euint16) => euint16 test 2 (84, 88)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 84n },
        { type: 'uint16', value: 88n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(92);
  });

  it('test operator "or" overload (euint8, euint16) => euint16 test 3 (88, 88)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 88n },
        { type: 'uint16', value: 88n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(88);
  });

  it('test operator "or" overload (euint8, euint16) => euint16 test 4 (88, 84)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 88n },
        { type: 'uint16', value: 84n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(92);
  });

  it('test operator "xor" overload (euint8, euint16) => euint16 test 1 (20, 36098)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 20n },
        { type: 'uint16', value: 36098n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(36118);
  });

  it('test operator "xor" overload (euint8, euint16) => euint16 test 2 (16, 20)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 16n },
        { type: 'uint16', value: 20n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint8, euint16) => euint16 test 3 (20, 20)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 20n },
        { type: 'uint16', value: 20n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint8, euint16) => euint16 test 4 (20, 16)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 20n },
        { type: 'uint16', value: 16n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint8, euint16) => ebool test 1 (225, 14088)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 225n },
        { type: 'uint16', value: 14088n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint16) => ebool test 2 (221, 225)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 221n },
        { type: 'uint16', value: 225n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint16) => ebool test 3 (225, 225)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 225n },
        { type: 'uint16', value: 225n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint8, euint16) => ebool test 4 (225, 221)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 225n },
        { type: 'uint16', value: 221n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint16) => ebool test 1 (138, 38804)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 138n },
        { type: 'uint16', value: 38804n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint16) => ebool test 2 (134, 138)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 134n },
        { type: 'uint16', value: 138n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint16) => ebool test 3 (138, 138)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 138n },
        { type: 'uint16', value: 138n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint16) => ebool test 4 (138, 134)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 138n },
        { type: 'uint16', value: 134n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint16) => ebool test 1 (250, 25860)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 250n },
        { type: 'uint16', value: 25860n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint16) => ebool test 2 (246, 250)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 246n },
        { type: 'uint16', value: 250n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint16) => ebool test 3 (250, 250)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 250n },
        { type: 'uint16', value: 250n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint16) => ebool test 4 (250, 246)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 250n },
        { type: 'uint16', value: 246n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint8, euint16) => ebool test 1 (197, 6725)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 197n },
        { type: 'uint16', value: 6725n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint16) => ebool test 2 (193, 197)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 193n },
        { type: 'uint16', value: 197n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint16) => ebool test 3 (197, 197)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 197n },
        { type: 'uint16', value: 197n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint16) => ebool test 4 (197, 193)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 197n },
        { type: 'uint16', value: 193n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint16) => ebool test 1 (91, 17968)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 91n },
        { type: 'uint16', value: 17968n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint16) => ebool test 2 (87, 91)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 87n },
        { type: 'uint16', value: 91n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint16) => ebool test 3 (91, 91)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 91n },
        { type: 'uint16', value: 91n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint16) => ebool test 4 (91, 87)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 91n },
        { type: 'uint16', value: 87n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint16) => ebool test 1 (157, 48773)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 157n },
        { type: 'uint16', value: 48773n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint16) => ebool test 2 (153, 157)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 153n },
        { type: 'uint16', value: 157n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint16) => ebool test 3 (157, 157)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 157n },
        { type: 'uint16', value: 157n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint16) => ebool test 4 (157, 153)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 157n },
        { type: 'uint16', value: 153n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint8, euint16) => euint16 test 1 (61, 47120)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 61n },
        { type: 'uint16', value: 47120n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(61);
  });

  it('test operator "min" overload (euint8, euint16) => euint16 test 2 (57, 61)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 57n },
        { type: 'uint16', value: 61n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(57);
  });

  it('test operator "min" overload (euint8, euint16) => euint16 test 3 (61, 61)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 61n },
        { type: 'uint16', value: 61n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(61);
  });

  it('test operator "min" overload (euint8, euint16) => euint16 test 4 (61, 57)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 61n },
        { type: 'uint16', value: 57n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(57);
  });

  it('test operator "max" overload (euint8, euint16) => euint16 test 1 (45, 40681)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 45n },
        { type: 'uint16', value: 40681n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(40681);
  });

  it('test operator "max" overload (euint8, euint16) => euint16 test 2 (41, 45)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 41n },
        { type: 'uint16', value: 45n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(45);
  });

  it('test operator "max" overload (euint8, euint16) => euint16 test 3 (45, 45)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 45n },
        { type: 'uint16', value: 45n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(45);
  });

  it('test operator "max" overload (euint8, euint16) => euint16 test 4 (45, 41)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 45n },
        { type: 'uint16', value: 41n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract1.resEuint16() });
    expect(res).to.equal(45);
  });

  it('test operator "add" overload (euint8, euint32) => euint32 test 1 (2, 183)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 2n },
        { type: 'uint32', value: 183n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(185);
  });

  it('test operator "add" overload (euint8, euint32) => euint32 test 2 (81, 83)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 81n },
        { type: 'uint32', value: 83n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(164);
  });

  it('test operator "add" overload (euint8, euint32) => euint32 test 3 (83, 83)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 83n },
        { type: 'uint32', value: 83n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(166);
  });

  it('test operator "add" overload (euint8, euint32) => euint32 test 4 (83, 81)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 83n },
        { type: 'uint32', value: 81n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(164);
  });

  it('test operator "sub" overload (euint8, euint32) => euint32 test 1 (92, 92)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 92n },
        { type: 'uint32', value: 92n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint8, euint32) => euint32 test 2 (92, 88)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 92n },
        { type: 'uint32', value: 88n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint8, euint32) => euint32 test 1 (2, 65)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 2n },
        { type: 'uint32', value: 65n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(130);
  });

  it('test operator "mul" overload (euint8, euint32) => euint32 test 2 (13, 14)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 13n },
        { type: 'uint32', value: 14n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(182);
  });

  it('test operator "mul" overload (euint8, euint32) => euint32 test 3 (14, 14)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 14n },
        { type: 'uint32', value: 14n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(196);
  });

  it('test operator "mul" overload (euint8, euint32) => euint32 test 4 (14, 13)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 14n },
        { type: 'uint32', value: 13n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(182);
  });

  it('test operator "and" overload (euint8, euint32) => euint32 test 1 (135, 173269101)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 135n },
        { type: 'uint32', value: 173269101n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(5);
  });

  it('test operator "and" overload (euint8, euint32) => euint32 test 2 (131, 135)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 131n },
        { type: 'uint32', value: 135n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(131);
  });

  it('test operator "and" overload (euint8, euint32) => euint32 test 3 (135, 135)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 135n },
        { type: 'uint32', value: 135n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(135);
  });

  it('test operator "and" overload (euint8, euint32) => euint32 test 4 (135, 131)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 135n },
        { type: 'uint32', value: 131n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(131);
  });

  it('test operator "or" overload (euint8, euint32) => euint32 test 1 (199, 3525720338)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 199n },
        { type: 'uint32', value: 3525720338n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(3525720535);
  });

  it('test operator "or" overload (euint8, euint32) => euint32 test 2 (195, 199)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 195n },
        { type: 'uint32', value: 199n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(199);
  });

  it('test operator "or" overload (euint8, euint32) => euint32 test 3 (199, 199)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 199n },
        { type: 'uint32', value: 199n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(199);
  });

  it('test operator "or" overload (euint8, euint32) => euint32 test 4 (199, 195)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 199n },
        { type: 'uint32', value: 195n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(199);
  });

  it('test operator "xor" overload (euint8, euint32) => euint32 test 1 (135, 1170050720)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 135n },
        { type: 'uint32', value: 1170050720n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(1170050599);
  });

  it('test operator "xor" overload (euint8, euint32) => euint32 test 2 (131, 135)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 131n },
        { type: 'uint32', value: 135n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint8, euint32) => euint32 test 3 (135, 135)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 135n },
        { type: 'uint32', value: 135n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint8, euint32) => euint32 test 4 (135, 131)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 135n },
        { type: 'uint32', value: 131n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint8, euint32) => ebool test 1 (188, 2380814349)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 188n },
        { type: 'uint32', value: 2380814349n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint32) => ebool test 2 (184, 188)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 184n },
        { type: 'uint32', value: 188n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint32) => ebool test 3 (188, 188)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 188n },
        { type: 'uint32', value: 188n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint8, euint32) => ebool test 4 (188, 184)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 188n },
        { type: 'uint32', value: 184n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint32) => ebool test 1 (137, 4250199492)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 137n },
        { type: 'uint32', value: 4250199492n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint32) => ebool test 2 (133, 137)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 133n },
        { type: 'uint32', value: 137n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint32) => ebool test 3 (137, 137)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 137n },
        { type: 'uint32', value: 137n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint32) => ebool test 4 (137, 133)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 137n },
        { type: 'uint32', value: 133n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint32) => ebool test 1 (120, 3166550340)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 120n },
        { type: 'uint32', value: 3166550340n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint32) => ebool test 2 (116, 120)', async function () {
    await fhevm.assertCoprocessorInitialized(this.contract1Address);
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 116n },
        { type: 'uint32', value: 120n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint32) => ebool test 3 (120, 120)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 120n },
        { type: 'uint32', value: 120n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint32) => ebool test 4 (120, 116)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 120n },
        { type: 'uint32', value: 116n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint8, euint32) => ebool test 1 (162, 1397295057)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 162n },
        { type: 'uint32', value: 1397295057n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint32) => ebool test 2 (158, 162)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 158n },
        { type: 'uint32', value: 162n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint32) => ebool test 3 (162, 162)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 162n },
        { type: 'uint32', value: 162n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint32) => ebool test 4 (162, 158)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 162n },
        { type: 'uint32', value: 158n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint32) => ebool test 1 (113, 3145214746)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 113n },
        { type: 'uint32', value: 3145214746n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint32) => ebool test 2 (109, 113)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 109n },
        { type: 'uint32', value: 113n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint32) => ebool test 3 (113, 113)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 113n },
        { type: 'uint32', value: 113n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, euint32) => ebool test 4 (113, 109)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 113n },
        { type: 'uint32', value: 109n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.le_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint32) => ebool test 1 (155, 2538428262)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 155n },
        { type: 'uint32', value: 2538428262n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint32) => ebool test 2 (151, 155)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 151n },
        { type: 'uint32', value: 155n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, euint32) => ebool test 3 (155, 155)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 155n },
        { type: 'uint32', value: 155n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, euint32) => ebool test 4 (155, 151)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 155n },
        { type: 'uint32', value: 151n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.lt_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint8, euint32) => euint32 test 1 (114, 2894219978)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 114n },
        { type: 'uint32', value: 2894219978n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(114);
  });

  it('test operator "min" overload (euint8, euint32) => euint32 test 2 (110, 114)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 110n },
        { type: 'uint32', value: 114n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(110);
  });

  it('test operator "min" overload (euint8, euint32) => euint32 test 3 (114, 114)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 114n },
        { type: 'uint32', value: 114n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(114);
  });

  it('test operator "min" overload (euint8, euint32) => euint32 test 4 (114, 110)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 114n },
        { type: 'uint32', value: 110n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.min_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(110);
  });

  it('test operator "max" overload (euint8, euint32) => euint32 test 1 (186, 312047724)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 186n },
        { type: 'uint32', value: 312047724n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(312047724);
  });

  it('test operator "max" overload (euint8, euint32) => euint32 test 2 (182, 186)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 182n },
        { type: 'uint32', value: 186n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(186);
  });

  it('test operator "max" overload (euint8, euint32) => euint32 test 3 (186, 186)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 186n },
        { type: 'uint32', value: 186n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(186);
  });

  it('test operator "max" overload (euint8, euint32) => euint32 test 4 (186, 182)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 186n },
        { type: 'uint32', value: 182n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.max_euint8_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract1.resEuint32() });
    expect(res).to.equal(186);
  });

  it('test operator "add" overload (euint8, euint64) => euint64 test 1 (2, 129)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 2n },
        { type: 'uint64', value: 129n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(131n);
  });

  it('test operator "add" overload (euint8, euint64) => euint64 test 2 (125, 129)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 125n },
        { type: 'uint64', value: 129n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(254n);
  });

  it('test operator "add" overload (euint8, euint64) => euint64 test 3 (65, 65)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 65n },
        { type: 'uint64', value: 65n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(130n);
  });

  it('test operator "add" overload (euint8, euint64) => euint64 test 4 (129, 125)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 129n },
        { type: 'uint64', value: 125n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.add_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(254n);
  });

  it('test operator "sub" overload (euint8, euint64) => euint64 test 1 (220, 220)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 220n },
        { type: 'uint64', value: 220n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint8, euint64) => euint64 test 2 (220, 216)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 220n },
        { type: 'uint64', value: 216n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.sub_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint8, euint64) => euint64 test 1 (2, 65)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 2n },
        { type: 'uint64', value: 65n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(130n);
  });

  it('test operator "mul" overload (euint8, euint64) => euint64 test 2 (15, 15)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 15n },
        { type: 'uint64', value: 15n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(225n);
  });

  it('test operator "mul" overload (euint8, euint64) => euint64 test 3 (15, 15)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 15n },
        { type: 'uint64', value: 15n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(225n);
  });

  it('test operator "mul" overload (euint8, euint64) => euint64 test 4 (15, 15)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 15n },
        { type: 'uint64', value: 15n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.mul_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(225n);
  });

  it('test operator "and" overload (euint8, euint64) => euint64 test 1 (178, 18445664465334909103)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 178n },
        { type: 'uint64', value: 18445664465334909103n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(162n);
  });

  it('test operator "and" overload (euint8, euint64) => euint64 test 2 (174, 178)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 174n },
        { type: 'uint64', value: 178n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(162n);
  });

  it('test operator "and" overload (euint8, euint64) => euint64 test 3 (178, 178)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 178n },
        { type: 'uint64', value: 178n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(178n);
  });

  it('test operator "and" overload (euint8, euint64) => euint64 test 4 (178, 174)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 178n },
        { type: 'uint64', value: 174n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.and_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(162n);
  });

  it('test operator "or" overload (euint8, euint64) => euint64 test 1 (29, 18438856880396735223)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 29n },
        { type: 'uint64', value: 18438856880396735223n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(18438856880396735231n);
  });

  it('test operator "or" overload (euint8, euint64) => euint64 test 2 (25, 29)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 25n },
        { type: 'uint64', value: 29n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(29n);
  });

  it('test operator "or" overload (euint8, euint64) => euint64 test 3 (29, 29)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 29n },
        { type: 'uint64', value: 29n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(29n);
  });

  it('test operator "or" overload (euint8, euint64) => euint64 test 4 (29, 25)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 29n },
        { type: 'uint64', value: 25n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.or_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(29n);
  });

  it('test operator "xor" overload (euint8, euint64) => euint64 test 1 (20, 18439440834440328623)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 20n },
        { type: 'uint64', value: 18439440834440328623n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(18439440834440328635n);
  });

  it('test operator "xor" overload (euint8, euint64) => euint64 test 2 (16, 20)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 16n },
        { type: 'uint64', value: 20n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint8, euint64) => euint64 test 3 (20, 20)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 20n },
        { type: 'uint64', value: 20n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint8, euint64) => euint64 test 4 (20, 16)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 20n },
        { type: 'uint64', value: 16n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.xor_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract1.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint8, euint64) => ebool test 1 (26, 18443686415883984161)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 26n },
        { type: 'uint64', value: 18443686415883984161n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint64) => ebool test 2 (22, 26)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 22n },
        { type: 'uint64', value: 26n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, euint64) => ebool test 3 (26, 26)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 26n },
        { type: 'uint64', value: 26n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint8, euint64) => ebool test 4 (26, 22)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 26n },
        { type: 'uint64', value: 22n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.eq_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint64) => ebool test 1 (248, 18443146105099135433)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 248n },
        { type: 'uint64', value: 18443146105099135433n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint64) => ebool test 2 (244, 248)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 244n },
        { type: 'uint64', value: 248n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, euint64) => ebool test 3 (248, 248)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 248n },
        { type: 'uint64', value: 248n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, euint64) => ebool test 4 (248, 244)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 248n },
        { type: 'uint64', value: 244n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ne_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint64) => ebool test 1 (233, 18439455908696976195)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 233n },
        { type: 'uint64', value: 18439455908696976195n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint64) => ebool test 2 (229, 233)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 229n },
        { type: 'uint64', value: 233n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, euint64) => ebool test 3 (233, 233)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 233n },
        { type: 'uint64', value: 233n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, euint64) => ebool test 4 (233, 229)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 233n },
        { type: 'uint64', value: 229n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.ge_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint8, euint64) => ebool test 1 (241, 18444839135906371855)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 241n },
        { type: 'uint64', value: 18444839135906371855n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint64) => ebool test 2 (237, 241)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 237n },
        { type: 'uint64', value: 241n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint64) => ebool test 3 (241, 241)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 241n },
        { type: 'uint64', value: 241n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, euint64) => ebool test 4 (241, 237)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint8', value: 241n },
        { type: 'uint64', value: 237n },
      ],
      contractAddress: this.contract1Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract1.gt_euint8_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract1.resEbool() });
    expect(res).to.equal(true);
  });
});
