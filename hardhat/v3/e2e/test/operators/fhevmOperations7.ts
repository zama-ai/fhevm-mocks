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

describe('FHEVM operations 7', function () {
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

  it('test operator "min" overload (euint128, euint8) => euint128 test 1 (340282366920938463463374373941804259365, 20)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463374373941804259365n },
        { type: 'uint8', value: 20n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(20n);
  });

  it('test operator "min" overload (euint128, euint8) => euint128 test 2 (16, 20)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 16n },
        { type: 'uint8', value: 20n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(16n);
  });

  it('test operator "min" overload (euint128, euint8) => euint128 test 3 (20, 20)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 20n },
        { type: 'uint8', value: 20n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(20n);
  });

  it('test operator "min" overload (euint128, euint8) => euint128 test 4 (20, 16)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 20n },
        { type: 'uint8', value: 16n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(16n);
  });

  it('test operator "max" overload (euint128, euint8) => euint128 test 1 (340282366920938463463370472029042344271, 59)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370472029042344271n },
        { type: 'uint8', value: 59n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463370472029042344271n);
  });

  it('test operator "max" overload (euint128, euint8) => euint128 test 2 (55, 59)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 55n },
        { type: 'uint8', value: 59n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(59n);
  });

  it('test operator "max" overload (euint128, euint8) => euint128 test 3 (59, 59)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 59n },
        { type: 'uint8', value: 59n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(59n);
  });

  it('test operator "max" overload (euint128, euint8) => euint128 test 4 (59, 55)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 59n },
        { type: 'uint8', value: 55n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(59n);
  });

  it('test operator "add" overload (euint128, euint16) => euint128 test 1 (32769, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 32769n },
        { type: 'uint16', value: 2n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(32771n);
  });

  it('test operator "add" overload (euint128, euint16) => euint128 test 2 (27954, 27958)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 27954n },
        { type: 'uint16', value: 27958n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(55912n);
  });

  it('test operator "add" overload (euint128, euint16) => euint128 test 3 (27958, 27958)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 27958n },
        { type: 'uint16', value: 27958n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(55916n);
  });

  it('test operator "add" overload (euint128, euint16) => euint128 test 4 (27958, 27954)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 27958n },
        { type: 'uint16', value: 27954n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(55912n);
  });

  it('test operator "sub" overload (euint128, euint16) => euint128 test 1 (60117, 60117)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 60117n },
        { type: 'uint16', value: 60117n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.sub_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint128, euint16) => euint128 test 2 (60117, 60113)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 60117n },
        { type: 'uint16', value: 60113n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.sub_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint128, euint16) => euint128 test 1 (16385, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 16385n },
        { type: 'uint16', value: 2n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(32770n);
  });

  it('test operator "mul" overload (euint128, euint16) => euint128 test 2 (229, 229)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 229n },
        { type: 'uint16', value: 229n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(52441n);
  });

  it('test operator "mul" overload (euint128, euint16) => euint128 test 3 (229, 229)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 229n },
        { type: 'uint16', value: 229n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(52441n);
  });

  it('test operator "mul" overload (euint128, euint16) => euint128 test 4 (229, 229)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 229n },
        { type: 'uint16', value: 229n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(52441n);
  });

  it('test operator "and" overload (euint128, euint16) => euint128 test 1 (340282366920938463463371364911078032651, 59893)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463371364911078032651n },
        { type: 'uint16', value: 59893n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(49409n);
  });

  it('test operator "and" overload (euint128, euint16) => euint128 test 2 (59889, 59893)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 59889n },
        { type: 'uint16', value: 59893n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(59889n);
  });

  it('test operator "and" overload (euint128, euint16) => euint128 test 3 (59893, 59893)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 59893n },
        { type: 'uint16', value: 59893n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(59893n);
  });

  it('test operator "and" overload (euint128, euint16) => euint128 test 4 (59893, 59889)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 59893n },
        { type: 'uint16', value: 59889n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(59889n);
  });

  it('test operator "or" overload (euint128, euint16) => euint128 test 1 (340282366920938463463372837720621820295, 64239)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463372837720621820295n },
        { type: 'uint16', value: 64239n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463372837720621841391n);
  });

  it('test operator "or" overload (euint128, euint16) => euint128 test 2 (64235, 64239)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 64235n },
        { type: 'uint16', value: 64239n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(64239n);
  });

  it('test operator "or" overload (euint128, euint16) => euint128 test 3 (64239, 64239)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 64239n },
        { type: 'uint16', value: 64239n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(64239n);
  });

  it('test operator "or" overload (euint128, euint16) => euint128 test 4 (64239, 64235)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 64239n },
        { type: 'uint16', value: 64235n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(64239n);
  });

  it('test operator "xor" overload (euint128, euint16) => euint128 test 1 (340282366920938463463372571988245566461, 28379)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463372571988245566461n },
        { type: 'uint16', value: 28379n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463372571988245560614n);
  });

  it('test operator "xor" overload (euint128, euint16) => euint128 test 2 (28375, 28379)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 28375n },
        { type: 'uint16', value: 28379n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(12n);
  });

  it('test operator "xor" overload (euint128, euint16) => euint128 test 3 (28379, 28379)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 28379n },
        { type: 'uint16', value: 28379n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint128, euint16) => euint128 test 4 (28379, 28375)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 28379n },
        { type: 'uint16', value: 28375n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(12n);
  });

  it('test operator "eq" overload (euint128, euint16) => ebool test 1 (340282366920938463463367978003322074553, 65222)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367978003322074553n },
        { type: 'uint16', value: 65222n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint16) => ebool test 2 (65218, 65222)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 65218n },
        { type: 'uint16', value: 65222n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint16) => ebool test 3 (65222, 65222)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 65222n },
        { type: 'uint16', value: 65222n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint128, euint16) => ebool test 4 (65222, 65218)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 65222n },
        { type: 'uint16', value: 65218n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint16) => ebool test 1 (340282366920938463463372536440380135105, 33682)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463372536440380135105n },
        { type: 'uint16', value: 33682n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint16) => ebool test 2 (33678, 33682)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 33678n },
        { type: 'uint16', value: 33682n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint16) => ebool test 3 (33682, 33682)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 33682n },
        { type: 'uint16', value: 33682n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint16) => ebool test 4 (33682, 33678)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 33682n },
        { type: 'uint16', value: 33678n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint16) => ebool test 1 (340282366920938463463370573200526312211, 62578)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370573200526312211n },
        { type: 'uint16', value: 62578n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint16) => ebool test 2 (62574, 62578)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 62574n },
        { type: 'uint16', value: 62578n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint128, euint16) => ebool test 3 (62578, 62578)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 62578n },
        { type: 'uint16', value: 62578n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint16) => ebool test 4 (62578, 62574)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 62578n },
        { type: 'uint16', value: 62574n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint128, euint16) => ebool test 1 (340282366920938463463372705928695736385, 44945)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463372705928695736385n },
        { type: 'uint16', value: 44945n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint128, euint16) => ebool test 2 (44941, 44945)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 44941n },
        { type: 'uint16', value: 44945n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint16) => ebool test 3 (44945, 44945)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 44945n },
        { type: 'uint16', value: 44945n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint16) => ebool test 4 (44945, 44941)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 44945n },
        { type: 'uint16', value: 44941n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint16) => ebool test 1 (340282366920938463463368882639871317153, 16518)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368882639871317153n },
        { type: 'uint16', value: 16518n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint128, euint16) => ebool test 2 (16514, 16518)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 16514n },
        { type: 'uint16', value: 16518n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint16) => ebool test 3 (16518, 16518)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 16518n },
        { type: 'uint16', value: 16518n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint16) => ebool test 4 (16518, 16514)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 16518n },
        { type: 'uint16', value: 16514n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint16) => ebool test 1 (340282366920938463463367312573489800843, 38303)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367312573489800843n },
        { type: 'uint16', value: 38303n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint16) => ebool test 2 (38299, 38303)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 38299n },
        { type: 'uint16', value: 38303n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint128, euint16) => ebool test 3 (38303, 38303)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 38303n },
        { type: 'uint16', value: 38303n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint16) => ebool test 4 (38303, 38299)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 38303n },
        { type: 'uint16', value: 38299n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint128, euint16) => euint128 test 1 (340282366920938463463370244165272802687, 28746)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370244165272802687n },
        { type: 'uint16', value: 28746n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(28746n);
  });

  it('test operator "min" overload (euint128, euint16) => euint128 test 2 (28742, 28746)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 28742n },
        { type: 'uint16', value: 28746n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(28742n);
  });

  it('test operator "min" overload (euint128, euint16) => euint128 test 3 (28746, 28746)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 28746n },
        { type: 'uint16', value: 28746n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(28746n);
  });

  it('test operator "min" overload (euint128, euint16) => euint128 test 4 (28746, 28742)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 28746n },
        { type: 'uint16', value: 28742n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(28742n);
  });

  it('test operator "max" overload (euint128, euint16) => euint128 test 1 (340282366920938463463368887445785260461, 3915)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368887445785260461n },
        { type: 'uint16', value: 3915n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463368887445785260461n);
  });

  it('test operator "max" overload (euint128, euint16) => euint128 test 2 (3911, 3915)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3911n },
        { type: 'uint16', value: 3915n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(3915n);
  });

  it('test operator "max" overload (euint128, euint16) => euint128 test 3 (3915, 3915)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3915n },
        { type: 'uint16', value: 3915n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(3915n);
  });

  it('test operator "max" overload (euint128, euint16) => euint128 test 4 (3915, 3911)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3915n },
        { type: 'uint16', value: 3911n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(3915n);
  });

  it('test operator "add" overload (euint128, euint32) => euint128 test 1 (2147483649, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2147483649n },
        { type: 'uint32', value: 2n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(2147483651n);
  });

  it('test operator "add" overload (euint128, euint32) => euint128 test 2 (1640687698, 1640687702)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1640687698n },
        { type: 'uint32', value: 1640687702n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(3281375400n);
  });

  it('test operator "add" overload (euint128, euint32) => euint128 test 3 (1640687702, 1640687702)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1640687702n },
        { type: 'uint32', value: 1640687702n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(3281375404n);
  });

  it('test operator "add" overload (euint128, euint32) => euint128 test 4 (1640687702, 1640687698)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1640687702n },
        { type: 'uint32', value: 1640687698n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(3281375400n);
  });

  it('test operator "sub" overload (euint128, euint32) => euint128 test 1 (1246942894, 1246942894)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1246942894n },
        { type: 'uint32', value: 1246942894n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.sub_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint128, euint32) => euint128 test 2 (1246942894, 1246942890)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1246942894n },
        { type: 'uint32', value: 1246942890n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.sub_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint128, euint32) => euint128 test 1 (1073741825, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1073741825n },
        { type: 'uint32', value: 2n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(2147483650n);
  });

  it('test operator "mul" overload (euint128, euint32) => euint128 test 2 (64981, 64981)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 64981n },
        { type: 'uint32', value: 64981n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4222530361n);
  });

  it('test operator "mul" overload (euint128, euint32) => euint128 test 3 (64981, 64981)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 64981n },
        { type: 'uint32', value: 64981n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4222530361n);
  });

  it('test operator "mul" overload (euint128, euint32) => euint128 test 4 (64981, 64981)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 64981n },
        { type: 'uint32', value: 64981n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4222530361n);
  });

  it('test operator "and" overload (euint128, euint32) => euint128 test 1 (340282366920938463463366385249843627577, 4141348882)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366385249843627577n },
        { type: 'uint32', value: 4141348882n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(370360336n);
  });

  it('test operator "and" overload (euint128, euint32) => euint128 test 2 (4141348878, 4141348882)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 4141348878n },
        { type: 'uint32', value: 4141348882n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4141348866n);
  });

  it('test operator "and" overload (euint128, euint32) => euint128 test 3 (4141348882, 4141348882)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 4141348882n },
        { type: 'uint32', value: 4141348882n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4141348882n);
  });

  it('test operator "and" overload (euint128, euint32) => euint128 test 4 (4141348882, 4141348878)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 4141348882n },
        { type: 'uint32', value: 4141348878n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4141348866n);
  });

  it('test operator "or" overload (euint128, euint32) => euint128 test 1 (340282366920938463463367331600429373593, 2842824901)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367331600429373593n },
        { type: 'uint32', value: 2842824901n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463367331601106753757n);
  });

  it('test operator "or" overload (euint128, euint32) => euint128 test 2 (2842824897, 2842824901)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2842824897n },
        { type: 'uint32', value: 2842824901n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(2842824901n);
  });

  it('test operator "or" overload (euint128, euint32) => euint128 test 3 (2842824901, 2842824901)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2842824901n },
        { type: 'uint32', value: 2842824901n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(2842824901n);
  });

  it('test operator "or" overload (euint128, euint32) => euint128 test 4 (2842824901, 2842824897)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2842824901n },
        { type: 'uint32', value: 2842824897n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(2842824901n);
  });

  it('test operator "xor" overload (euint128, euint32) => euint128 test 1 (340282366920938463463366639372694525051, 1841057854)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366639372694525051n },
        { type: 'uint32', value: 1841057854n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463366639373021955141n);
  });

  it('test operator "xor" overload (euint128, euint32) => euint128 test 2 (1841057850, 1841057854)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1841057850n },
        { type: 'uint32', value: 1841057854n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint128, euint32) => euint128 test 3 (1841057854, 1841057854)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1841057854n },
        { type: 'uint32', value: 1841057854n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint128, euint32) => euint128 test 4 (1841057854, 1841057850)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1841057854n },
        { type: 'uint32', value: 1841057850n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint128, euint32) => ebool test 1 (340282366920938463463367269130716522379, 372945808)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367269130716522379n },
        { type: 'uint32', value: 372945808n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint32) => ebool test 2 (372945804, 372945808)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 372945804n },
        { type: 'uint32', value: 372945808n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint32) => ebool test 3 (372945808, 372945808)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 372945808n },
        { type: 'uint32', value: 372945808n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint128, euint32) => ebool test 4 (372945808, 372945804)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 372945808n },
        { type: 'uint32', value: 372945804n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint32) => ebool test 1 (340282366920938463463370820091836516821, 2340468025)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370820091836516821n },
        { type: 'uint32', value: 2340468025n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint32) => ebool test 2 (2340468021, 2340468025)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2340468021n },
        { type: 'uint32', value: 2340468025n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint32) => ebool test 3 (2340468025, 2340468025)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2340468025n },
        { type: 'uint32', value: 2340468025n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint32) => ebool test 4 (2340468025, 2340468021)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2340468025n },
        { type: 'uint32', value: 2340468021n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint32) => ebool test 1 (340282366920938463463369094660966137149, 2249851938)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369094660966137149n },
        { type: 'uint32', value: 2249851938n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint32) => ebool test 2 (2249851934, 2249851938)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2249851934n },
        { type: 'uint32', value: 2249851938n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint128, euint32) => ebool test 3 (2249851938, 2249851938)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2249851938n },
        { type: 'uint32', value: 2249851938n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint32) => ebool test 4 (2249851938, 2249851934)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 2249851938n },
        { type: 'uint32', value: 2249851934n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint128, euint32) => ebool test 1 (340282366920938463463370036970340162527, 263842749)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370036970340162527n },
        { type: 'uint32', value: 263842749n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint128, euint32) => ebool test 2 (263842745, 263842749)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 263842745n },
        { type: 'uint32', value: 263842749n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint32) => ebool test 3 (263842749, 263842749)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 263842749n },
        { type: 'uint32', value: 263842749n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint32) => ebool test 4 (263842749, 263842745)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 263842749n },
        { type: 'uint32', value: 263842745n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint32) => ebool test 1 (340282366920938463463368645948758020821, 3868041185)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368645948758020821n },
        { type: 'uint32', value: 3868041185n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint128, euint32) => ebool test 2 (3868041181, 3868041185)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3868041181n },
        { type: 'uint32', value: 3868041185n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint32) => ebool test 3 (3868041185, 3868041185)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3868041185n },
        { type: 'uint32', value: 3868041185n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint32) => ebool test 4 (3868041185, 3868041181)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3868041185n },
        { type: 'uint32', value: 3868041181n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint32) => ebool test 1 (340282366920938463463371106202586075549, 3870932958)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463371106202586075549n },
        { type: 'uint32', value: 3870932958n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint32) => ebool test 2 (3870932954, 3870932958)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3870932954n },
        { type: 'uint32', value: 3870932958n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint128, euint32) => ebool test 3 (3870932958, 3870932958)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3870932958n },
        { type: 'uint32', value: 3870932958n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint32) => ebool test 4 (3870932958, 3870932954)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3870932958n },
        { type: 'uint32', value: 3870932954n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint128, euint32) => euint128 test 1 (340282366920938463463367426817413069917, 161812629)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367426817413069917n },
        { type: 'uint32', value: 161812629n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(161812629n);
  });

  it('test operator "min" overload (euint128, euint32) => euint128 test 2 (161812625, 161812629)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 161812625n },
        { type: 'uint32', value: 161812629n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(161812625n);
  });

  it('test operator "min" overload (euint128, euint32) => euint128 test 3 (161812629, 161812629)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 161812629n },
        { type: 'uint32', value: 161812629n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(161812629n);
  });

  it('test operator "min" overload (euint128, euint32) => euint128 test 4 (161812629, 161812625)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 161812629n },
        { type: 'uint32', value: 161812625n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(161812625n);
  });

  it('test operator "max" overload (euint128, euint32) => euint128 test 1 (340282366920938463463368009494511989125, 1691838048)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368009494511989125n },
        { type: 'uint32', value: 1691838048n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463368009494511989125n);
  });

  it('test operator "max" overload (euint128, euint32) => euint128 test 2 (1691838044, 1691838048)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1691838044n },
        { type: 'uint32', value: 1691838048n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(1691838048n);
  });

  it('test operator "max" overload (euint128, euint32) => euint128 test 3 (1691838048, 1691838048)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1691838048n },
        { type: 'uint32', value: 1691838048n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(1691838048n);
  });

  it('test operator "max" overload (euint128, euint32) => euint128 test 4 (1691838048, 1691838044)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 1691838048n },
        { type: 'uint32', value: 1691838044n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(1691838048n);
  });

  it('test operator "add" overload (euint128, euint64) => euint128 test 1 (9223372036854775809, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 9223372036854775809n },
        { type: 'uint64', value: 2n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(9223372036854775811n);
  });

  it('test operator "add" overload (euint128, euint64) => euint128 test 2 (9223133733725592012, 9223133733725592014)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 9223133733725592012n },
        { type: 'uint64', value: 9223133733725592014n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18446267467451184026n);
  });

  it('test operator "add" overload (euint128, euint64) => euint128 test 3 (9223133733725592014, 9223133733725592014)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 9223133733725592014n },
        { type: 'uint64', value: 9223133733725592014n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18446267467451184028n);
  });

  it('test operator "add" overload (euint128, euint64) => euint128 test 4 (9223133733725592014, 9223133733725592012)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 9223133733725592014n },
        { type: 'uint64', value: 9223133733725592012n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18446267467451184026n);
  });

  it('test operator "sub" overload (euint128, euint64) => euint128 test 1 (18439741790219698213, 18439741790219698213)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18439741790219698213n },
        { type: 'uint64', value: 18439741790219698213n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.sub_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint128, euint64) => euint128 test 2 (18439741790219698213, 18439741790219698209)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18439741790219698213n },
        { type: 'uint64', value: 18439741790219698209n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.sub_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint128, euint64) => euint128 test 1 (4611686018427387905, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 4611686018427387905n },
        { type: 'uint64', value: 2n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(9223372036854775810n);
  });

  it('test operator "mul" overload (euint128, euint64) => euint128 test 2 (4294514001, 4294514001)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 4294514001n },
        { type: 'uint64', value: 4294514001n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18442850504785028001n);
  });

  it('test operator "mul" overload (euint128, euint64) => euint128 test 3 (4294514001, 4294514001)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 4294514001n },
        { type: 'uint64', value: 4294514001n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18442850504785028001n);
  });

  it('test operator "mul" overload (euint128, euint64) => euint128 test 4 (4294514001, 4294514001)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 4294514001n },
        { type: 'uint64', value: 4294514001n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18442850504785028001n);
  });

  it('test operator "and" overload (euint128, euint64) => euint128 test 1 (340282366920938463463371460613677378205, 18445585597076779761)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463371460613677378205n },
        { type: 'uint64', value: 18445585597076779761n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18442451975476912785n);
  });

  it('test operator "and" overload (euint128, euint64) => euint128 test 2 (18445585597076779757, 18445585597076779761)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18445585597076779757n },
        { type: 'uint64', value: 18445585597076779761n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18445585597076779745n);
  });

  it('test operator "and" overload (euint128, euint64) => euint128 test 3 (18445585597076779761, 18445585597076779761)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18445585597076779761n },
        { type: 'uint64', value: 18445585597076779761n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18445585597076779761n);
  });

  it('test operator "and" overload (euint128, euint64) => euint128 test 4 (18445585597076779761, 18445585597076779757)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18445585597076779761n },
        { type: 'uint64', value: 18445585597076779757n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18445585597076779745n);
  });

  it('test operator "or" overload (euint128, euint64) => euint128 test 1 (340282366920938463463368227616290696921, 18442643236153141279)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368227616290696921n },
        { type: 'uint64', value: 18442643236153141279n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463372777704811917023n);
  });

  it('test operator "or" overload (euint128, euint64) => euint128 test 2 (18442643236153141275, 18442643236153141279)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18442643236153141275n },
        { type: 'uint64', value: 18442643236153141279n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18442643236153141279n);
  });

  it('test operator "or" overload (euint128, euint64) => euint128 test 3 (18442643236153141279, 18442643236153141279)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18442643236153141279n },
        { type: 'uint64', value: 18442643236153141279n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18442643236153141279n);
  });

  it('test operator "or" overload (euint128, euint64) => euint128 test 4 (18442643236153141279, 18442643236153141275)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18442643236153141279n },
        { type: 'uint64', value: 18442643236153141275n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.or_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18442643236153141279n);
  });

  it('test operator "xor" overload (euint128, euint64) => euint128 test 1 (340282366920938463463369911388659828705, 18439443082590123897)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369911388659828705n },
        { type: 'uint64', value: 18439443082590123897n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463444930501296026136728n);
  });

  it('test operator "xor" overload (euint128, euint64) => euint128 test 2 (18439443082590123893, 18439443082590123897)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18439443082590123893n },
        { type: 'uint64', value: 18439443082590123897n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(12n);
  });

  it('test operator "xor" overload (euint128, euint64) => euint128 test 3 (18439443082590123897, 18439443082590123897)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18439443082590123897n },
        { type: 'uint64', value: 18439443082590123897n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint128, euint64) => euint128 test 4 (18439443082590123897, 18439443082590123893)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18439443082590123897n },
        { type: 'uint64', value: 18439443082590123893n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.xor_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(12n);
  });

  it('test operator "eq" overload (euint128, euint64) => ebool test 1 (340282366920938463463367729458279879823, 18446418476382821975)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367729458279879823n },
        { type: 'uint64', value: 18446418476382821975n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint64) => ebool test 2 (18446418476382821971, 18446418476382821975)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18446418476382821971n },
        { type: 'uint64', value: 18446418476382821975n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint64) => ebool test 3 (18446418476382821975, 18446418476382821975)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18446418476382821975n },
        { type: 'uint64', value: 18446418476382821975n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint128, euint64) => ebool test 4 (18446418476382821975, 18446418476382821971)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18446418476382821975n },
        { type: 'uint64', value: 18446418476382821971n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.eq_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint64) => ebool test 1 (340282366920938463463369925452909868907, 18441898098109877277)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369925452909868907n },
        { type: 'uint64', value: 18441898098109877277n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint64) => ebool test 2 (18441898098109877273, 18441898098109877277)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18441898098109877273n },
        { type: 'uint64', value: 18441898098109877277n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint64) => ebool test 3 (18441898098109877277, 18441898098109877277)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18441898098109877277n },
        { type: 'uint64', value: 18441898098109877277n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint64) => ebool test 4 (18441898098109877277, 18441898098109877273)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18441898098109877277n },
        { type: 'uint64', value: 18441898098109877273n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ne_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint64) => ebool test 1 (340282366920938463463370176900705427611, 18440255437118330271)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370176900705427611n },
        { type: 'uint64', value: 18440255437118330271n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint64) => ebool test 2 (18440255437118330267, 18440255437118330271)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18440255437118330267n },
        { type: 'uint64', value: 18440255437118330271n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint128, euint64) => ebool test 3 (18440255437118330271, 18440255437118330271)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18440255437118330271n },
        { type: 'uint64', value: 18440255437118330271n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint64) => ebool test 4 (18440255437118330271, 18440255437118330267)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18440255437118330271n },
        { type: 'uint64', value: 18440255437118330267n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.ge_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint128, euint64) => ebool test 1 (340282366920938463463366238909600213739, 18446298522319998359)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366238909600213739n },
        { type: 'uint64', value: 18446298522319998359n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint128, euint64) => ebool test 2 (18446298522319998355, 18446298522319998359)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18446298522319998355n },
        { type: 'uint64', value: 18446298522319998359n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint64) => ebool test 3 (18446298522319998359, 18446298522319998359)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18446298522319998359n },
        { type: 'uint64', value: 18446298522319998359n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint64) => ebool test 4 (18446298522319998359, 18446298522319998355)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18446298522319998359n },
        { type: 'uint64', value: 18446298522319998355n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.gt_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint64) => ebool test 1 (340282366920938463463365917627078018949, 18439032567082972609)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463365917627078018949n },
        { type: 'uint64', value: 18439032567082972609n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint128, euint64) => ebool test 2 (18439032567082972605, 18439032567082972609)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18439032567082972605n },
        { type: 'uint64', value: 18439032567082972609n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint64) => ebool test 3 (18439032567082972609, 18439032567082972609)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18439032567082972609n },
        { type: 'uint64', value: 18439032567082972609n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint64) => ebool test 4 (18439032567082972609, 18439032567082972605)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18439032567082972609n },
        { type: 'uint64', value: 18439032567082972605n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.le_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint64) => ebool test 1 (340282366920938463463374172085869425145, 18443206958285092697)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463374172085869425145n },
        { type: 'uint64', value: 18443206958285092697n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint64) => ebool test 2 (18443206958285092693, 18443206958285092697)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18443206958285092693n },
        { type: 'uint64', value: 18443206958285092697n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint128, euint64) => ebool test 3 (18443206958285092697, 18443206958285092697)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18443206958285092697n },
        { type: 'uint64', value: 18443206958285092697n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint64) => ebool test 4 (18443206958285092697, 18443206958285092693)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18443206958285092697n },
        { type: 'uint64', value: 18443206958285092693n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.lt_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract4.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint128, euint64) => euint128 test 1 (340282366920938463463372793588655024635, 18440669903957711279)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463372793588655024635n },
        { type: 'uint64', value: 18440669903957711279n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18440669903957711279n);
  });

  it('test operator "min" overload (euint128, euint64) => euint128 test 2 (18440669903957711275, 18440669903957711279)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18440669903957711275n },
        { type: 'uint64', value: 18440669903957711279n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18440669903957711275n);
  });

  it('test operator "min" overload (euint128, euint64) => euint128 test 3 (18440669903957711279, 18440669903957711279)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18440669903957711279n },
        { type: 'uint64', value: 18440669903957711279n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18440669903957711279n);
  });

  it('test operator "min" overload (euint128, euint64) => euint128 test 4 (18440669903957711279, 18440669903957711275)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18440669903957711279n },
        { type: 'uint64', value: 18440669903957711275n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.min_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18440669903957711275n);
  });

  it('test operator "max" overload (euint128, euint64) => euint128 test 1 (340282366920938463463370714318464992859, 18445224296450112107)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370714318464992859n },
        { type: 'uint64', value: 18445224296450112107n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463370714318464992859n);
  });

  it('test operator "max" overload (euint128, euint64) => euint128 test 2 (18445224296450112103, 18445224296450112107)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18445224296450112103n },
        { type: 'uint64', value: 18445224296450112107n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18445224296450112107n);
  });

  it('test operator "max" overload (euint128, euint64) => euint128 test 3 (18445224296450112107, 18445224296450112107)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18445224296450112107n },
        { type: 'uint64', value: 18445224296450112107n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18445224296450112107n);
  });

  it('test operator "max" overload (euint128, euint64) => euint128 test 4 (18445224296450112107, 18445224296450112103)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 18445224296450112107n },
        { type: 'uint64', value: 18445224296450112103n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.max_euint128_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(18445224296450112107n);
  });

  it('test operator "add" overload (euint128, euint128) => euint128 test 1 (170141183460469231731686721535437342948, 170141183460469231731685124726320525391)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 170141183460469231731686721535437342948n },
        { type: 'uint128', value: 170141183460469231731685124726320525391n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463371846261757868339n);
  });

  it('test operator "add" overload (euint128, euint128) => euint128 test 2 (170141183460469231731685124726320525389, 170141183460469231731685124726320525391)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 170141183460469231731685124726320525389n },
        { type: 'uint128', value: 170141183460469231731685124726320525391n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463370249452641050780n);
  });

  it('test operator "add" overload (euint128, euint128) => euint128 test 3 (170141183460469231731685124726320525391, 170141183460469231731685124726320525391)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 170141183460469231731685124726320525391n },
        { type: 'uint128', value: 170141183460469231731685124726320525391n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463370249452641050782n);
  });

  it('test operator "add" overload (euint128, euint128) => euint128 test 4 (170141183460469231731685124726320525391, 170141183460469231731685124726320525389)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 170141183460469231731685124726320525391n },
        { type: 'uint128', value: 170141183460469231731685124726320525389n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.add_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463370249452641050780n);
  });

  it('test operator "sub" overload (euint128, euint128) => euint128 test 1 (340282366920938463463370119270961786529, 340282366920938463463370119270961786529)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370119270961786529n },
        { type: 'uint128', value: 340282366920938463463370119270961786529n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.sub_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint128, euint128) => euint128 test 2 (340282366920938463463370119270961786529, 340282366920938463463370119270961786525)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463370119270961786529n },
        { type: 'uint128', value: 340282366920938463463370119270961786525n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.sub_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint128, euint128) => euint128 test 1 (9223372036854775809, 9223372036854775809)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 9223372036854775809n },
        { type: 'uint128', value: 9223372036854775809n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(85070591730234615884290395931651604481n);
  });

  it('test operator "mul" overload (euint128, euint128) => euint128 test 2 (9223372036854775809, 9223372036854775809)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 9223372036854775809n },
        { type: 'uint128', value: 9223372036854775809n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(85070591730234615884290395931651604481n);
  });

  it('test operator "mul" overload (euint128, euint128) => euint128 test 3 (9223372036854775809, 9223372036854775809)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 9223372036854775809n },
        { type: 'uint128', value: 9223372036854775809n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(85070591730234615884290395931651604481n);
  });

  it('test operator "mul" overload (euint128, euint128) => euint128 test 4 (9223372036854775809, 9223372036854775809)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 9223372036854775809n },
        { type: 'uint128', value: 9223372036854775809n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.mul_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(85070591730234615884290395931651604481n);
  });

  it('test operator "and" overload (euint128, euint128) => euint128 test 1 (340282366920938463463367044172939119359, 340282366920938463463370687886919745557)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367044172939119359n },
        { type: 'uint128', value: 340282366920938463463370687886919745557n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463365601338738098197n);
  });

  it('test operator "and" overload (euint128, euint128) => euint128 test 2 (340282366920938463463367044172939119355, 340282366920938463463367044172939119359)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367044172939119355n },
        { type: 'uint128', value: 340282366920938463463367044172939119359n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463367044172939119355n);
  });

  it('test operator "and" overload (euint128, euint128) => euint128 test 3 (340282366920938463463367044172939119359, 340282366920938463463367044172939119359)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367044172939119359n },
        { type: 'uint128', value: 340282366920938463463367044172939119359n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463367044172939119359n);
  });

  it('test operator "and" overload (euint128, euint128) => euint128 test 4 (340282366920938463463367044172939119359, 340282366920938463463367044172939119355)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367044172939119359n },
        { type: 'uint128', value: 340282366920938463463367044172939119355n },
      ],
      contractAddress: this.contract4Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract4.and_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract4.resEuint128() });
    expect(res).to.equal(340282366920938463463367044172939119355n);
  });

  it('test operator "or" overload (euint128, euint128) => euint128 test 1 (340282366920938463463373650833185201525, 340282366920938463463367653969196802045)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463373650833185201525n },
        { type: 'uint128', value: 340282366920938463463367653969196802045n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463374567844475625469n);
  });

  it('test operator "or" overload (euint128, euint128) => euint128 test 2 (340282366920938463463367653969196802041, 340282366920938463463367653969196802045)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367653969196802041n },
        { type: 'uint128', value: 340282366920938463463367653969196802045n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463367653969196802045n);
  });

  it('test operator "or" overload (euint128, euint128) => euint128 test 3 (340282366920938463463367653969196802045, 340282366920938463463367653969196802045)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367653969196802045n },
        { type: 'uint128', value: 340282366920938463463367653969196802045n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463367653969196802045n);
  });

  it('test operator "or" overload (euint128, euint128) => euint128 test 4 (340282366920938463463367653969196802045, 340282366920938463463367653969196802041)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367653969196802045n },
        { type: 'uint128', value: 340282366920938463463367653969196802041n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463367653969196802045n);
  });

  it('test operator "xor" overload (euint128, euint128) => euint128 test 1 (340282366920938463463372811472428286857, 340282366920938463463367127915705168171)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463372811472428286857n },
        { type: 'uint128', value: 340282366920938463463367127915705168171n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(8149575159984802n);
  });

  it('test operator "xor" overload (euint128, euint128) => euint128 test 2 (340282366920938463463367127915705168167, 340282366920938463463367127915705168171)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367127915705168167n },
        { type: 'uint128', value: 340282366920938463463367127915705168171n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(12n);
  });

  it('test operator "xor" overload (euint128, euint128) => euint128 test 3 (340282366920938463463367127915705168171, 340282366920938463463367127915705168171)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367127915705168171n },
        { type: 'uint128', value: 340282366920938463463367127915705168171n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint128, euint128) => euint128 test 4 (340282366920938463463367127915705168171, 340282366920938463463367127915705168167)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367127915705168171n },
        { type: 'uint128', value: 340282366920938463463367127915705168167n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(12n);
  });

  it('test operator "eq" overload (euint128, euint128) => ebool test 1 (340282366920938463463372481304885606321, 340282366920938463463368792243012180477)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463372481304885606321n },
        { type: 'uint128', value: 340282366920938463463368792243012180477n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint128) => ebool test 2 (340282366920938463463368792243012180473, 340282366920938463463368792243012180477)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368792243012180473n },
        { type: 'uint128', value: 340282366920938463463368792243012180477n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint128) => ebool test 3 (340282366920938463463368792243012180477, 340282366920938463463368792243012180477)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368792243012180477n },
        { type: 'uint128', value: 340282366920938463463368792243012180477n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint128, euint128) => ebool test 4 (340282366920938463463368792243012180477, 340282366920938463463368792243012180473)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368792243012180477n },
        { type: 'uint128', value: 340282366920938463463368792243012180473n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint128) => ebool test 1 (340282366920938463463369221426186835803, 340282366920938463463368143814524497097)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369221426186835803n },
        { type: 'uint128', value: 340282366920938463463368143814524497097n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint128) => ebool test 2 (340282366920938463463368143814524497093, 340282366920938463463368143814524497097)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368143814524497093n },
        { type: 'uint128', value: 340282366920938463463368143814524497097n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint128) => ebool test 3 (340282366920938463463368143814524497097, 340282366920938463463368143814524497097)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368143814524497097n },
        { type: 'uint128', value: 340282366920938463463368143814524497097n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint128) => ebool test 4 (340282366920938463463368143814524497097, 340282366920938463463368143814524497093)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368143814524497097n },
        { type: 'uint128', value: 340282366920938463463368143814524497093n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });
});
