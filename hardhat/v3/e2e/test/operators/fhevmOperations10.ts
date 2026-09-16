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

describe('FHEVM operations 10', function () {
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

  it('test operator "sub" overload (uint32, euint32) => euint32 test 1 (827505071, 827505071)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 827505071n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.sub_uint32_euint32(
      827505071n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (uint32, euint32) => euint32 test 2 (827505071, 827505067)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 827505067n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.sub_uint32_euint32(
      827505071n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint32, uint32) => euint32 test 1 (75078, 46779)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 75078n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_euint32_uint32(
      encryptedAmount.externalEuint32,
      46779n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(3512073762);
  });

  it('test operator "mul" overload (euint32, uint32) => euint32 test 2 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 37540n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_euint32_uint32(
      encryptedAmount.externalEuint32,
      37540n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "mul" overload (euint32, uint32) => euint32 test 3 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 37540n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_euint32_uint32(
      encryptedAmount.externalEuint32,
      37540n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "mul" overload (euint32, uint32) => euint32 test 4 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 37540n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_euint32_uint32(
      encryptedAmount.externalEuint32,
      37540n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "mul" overload (uint32, euint32) => euint32 test 1 (48985, 46779)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 46779n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_uint32_euint32(
      48985n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2291469315);
  });

  it('test operator "mul" overload (uint32, euint32) => euint32 test 2 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 37540n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_uint32_euint32(
      37540n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "mul" overload (uint32, euint32) => euint32 test 3 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 37540n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_uint32_euint32(
      37540n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "mul" overload (uint32, euint32) => euint32 test 4 (37540, 37540)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 37540n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_uint32_euint32(
      37540n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1409251600);
  });

  it('test operator "div" overload (euint32, uint32) => euint32 test 1 (2127574910, 2037032856)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2127574910n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.div_euint32_uint32(
      encryptedAmount.externalEuint32,
      2037032856n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1);
  });

  it('test operator "div" overload (euint32, uint32) => euint32 test 2 (2127574906, 2127574910)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2127574906n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.div_euint32_uint32(
      encryptedAmount.externalEuint32,
      2127574910n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "div" overload (euint32, uint32) => euint32 test 3 (2127574910, 2127574910)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2127574910n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.div_euint32_uint32(
      encryptedAmount.externalEuint32,
      2127574910n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1);
  });

  it('test operator "div" overload (euint32, uint32) => euint32 test 4 (2127574910, 2127574906)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2127574910n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.div_euint32_uint32(
      encryptedAmount.externalEuint32,
      2127574906n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1);
  });

  it('test operator "rem" overload (euint32, uint32) => euint32 test 1 (87025724, 1793383371)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 87025724n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.rem_euint32_uint32(
      encryptedAmount.externalEuint32,
      1793383371n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(87025724);
  });

  it('test operator "rem" overload (euint32, uint32) => euint32 test 2 (87025720, 87025724)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 87025720n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.rem_euint32_uint32(
      encryptedAmount.externalEuint32,
      87025724n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(87025720);
  });

  it('test operator "rem" overload (euint32, uint32) => euint32 test 3 (87025724, 87025724)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 87025724n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.rem_euint32_uint32(
      encryptedAmount.externalEuint32,
      87025724n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "rem" overload (euint32, uint32) => euint32 test 4 (87025724, 87025720)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 87025724n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.rem_euint32_uint32(
      encryptedAmount.externalEuint32,
      87025720n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "and" overload (euint32, uint32) => euint32 test 1 (3106281428, 2186118720)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3106281428n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_euint32_uint32(
      encryptedAmount.externalEuint32,
      2186118720n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2147747392);
  });

  it('test operator "and" overload (euint32, uint32) => euint32 test 2 (459255119, 459255123)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 459255119n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_euint32_uint32(
      encryptedAmount.externalEuint32,
      459255123n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(459255107);
  });

  it('test operator "and" overload (euint32, uint32) => euint32 test 3 (459255123, 459255123)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 459255123n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_euint32_uint32(
      encryptedAmount.externalEuint32,
      459255123n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(459255123);
  });

  it('test operator "and" overload (euint32, uint32) => euint32 test 4 (459255123, 459255119)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 459255123n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_euint32_uint32(
      encryptedAmount.externalEuint32,
      459255119n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(459255107);
  });

  it('test operator "and" overload (uint32, euint32) => euint32 test 1 (3871587071, 2186118720)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2186118720n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_uint32_euint32(
      3871587071n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2185331264);
  });

  it('test operator "and" overload (uint32, euint32) => euint32 test 2 (459255119, 459255123)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 459255123n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_uint32_euint32(
      459255119n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(459255107);
  });

  it('test operator "and" overload (uint32, euint32) => euint32 test 3 (459255123, 459255123)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 459255123n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_uint32_euint32(
      459255123n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(459255123);
  });

  it('test operator "and" overload (uint32, euint32) => euint32 test 4 (459255123, 459255119)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 459255119n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_uint32_euint32(
      459255123n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(459255107);
  });

  it('test operator "or" overload (euint32, uint32) => euint32 test 1 (2935699084, 344745489)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2935699084n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_euint32_uint32(
      encryptedAmount.externalEuint32,
      344745489n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(3204413085);
  });

  it('test operator "or" overload (euint32, uint32) => euint32 test 2 (2935699080, 2935699084)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2935699080n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_euint32_uint32(
      encryptedAmount.externalEuint32,
      2935699084n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "or" overload (euint32, uint32) => euint32 test 3 (2935699084, 2935699084)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2935699084n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_euint32_uint32(
      encryptedAmount.externalEuint32,
      2935699084n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "or" overload (euint32, uint32) => euint32 test 4 (2935699084, 2935699080)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2935699084n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_euint32_uint32(
      encryptedAmount.externalEuint32,
      2935699080n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "or" overload (uint32, euint32) => euint32 test 1 (367753063, 344745489)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 344745489n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_uint32_euint32(
      367753063n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(368015223);
  });

  it('test operator "or" overload (uint32, euint32) => euint32 test 2 (2935699080, 2935699084)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2935699084n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_uint32_euint32(
      2935699080n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "or" overload (uint32, euint32) => euint32 test 3 (2935699084, 2935699084)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2935699084n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_uint32_euint32(
      2935699084n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "or" overload (uint32, euint32) => euint32 test 4 (2935699084, 2935699080)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2935699080n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_uint32_euint32(
      2935699084n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2935699084);
  });

  it('test operator "xor" overload (euint32, uint32) => euint32 test 1 (1188690081, 1393500095)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1188690081n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_euint32_uint32(
      encryptedAmount.externalEuint32,
      1393500095n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(366405406);
  });

  it('test operator "xor" overload (euint32, uint32) => euint32 test 2 (1188690077, 1188690081)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1188690077n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_euint32_uint32(
      encryptedAmount.externalEuint32,
      1188690081n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(60);
  });

  it('test operator "xor" overload (euint32, uint32) => euint32 test 3 (1188690081, 1188690081)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1188690081n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_euint32_uint32(
      encryptedAmount.externalEuint32,
      1188690081n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint32, uint32) => euint32 test 4 (1188690081, 1188690077)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1188690081n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_euint32_uint32(
      encryptedAmount.externalEuint32,
      1188690077n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(60);
  });

  it('test operator "xor" overload (uint32, euint32) => euint32 test 1 (632454009, 1393500095)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1393500095n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_uint32_euint32(
      632454009n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1992123590);
  });

  it('test operator "xor" overload (uint32, euint32) => euint32 test 2 (1188690077, 1188690081)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1188690081n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_uint32_euint32(
      1188690077n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(60);
  });

  it('test operator "xor" overload (uint32, euint32) => euint32 test 3 (1188690081, 1188690081)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1188690081n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_uint32_euint32(
      1188690081n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (uint32, euint32) => euint32 test 4 (1188690081, 1188690077)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1188690077n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_uint32_euint32(
      1188690081n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(60);
  });

  it('test operator "eq" overload (euint32, uint32) => ebool test 1 (3295570634, 3873436239)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3295570634n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_euint32_uint32(
      encryptedAmount.externalEuint32,
      3873436239n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, uint32) => ebool test 2 (96781373, 96781377)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 96781373n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_euint32_uint32(
      encryptedAmount.externalEuint32,
      96781377n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, uint32) => ebool test 3 (96781377, 96781377)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 96781377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_euint32_uint32(
      encryptedAmount.externalEuint32,
      96781377n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint32, uint32) => ebool test 4 (96781377, 96781373)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 96781377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_euint32_uint32(
      encryptedAmount.externalEuint32,
      96781373n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint32, euint32) => ebool test 1 (2521524971, 3873436239)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3873436239n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint32_euint32(
      2521524971n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint32, euint32) => ebool test 2 (96781373, 96781377)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 96781377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint32_euint32(
      96781373n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint32, euint32) => ebool test 3 (96781377, 96781377)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 96781377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint32_euint32(
      96781377n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (uint32, euint32) => ebool test 4 (96781377, 96781373)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 96781373n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint32_euint32(
      96781377n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, uint32) => ebool test 1 (3427057056, 2468090519)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3427057056n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint32_uint32(
      encryptedAmount.externalEuint32,
      2468090519n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, uint32) => ebool test 2 (345973161, 345973165)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 345973161n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint32_uint32(
      encryptedAmount.externalEuint32,
      345973165n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, uint32) => ebool test 3 (345973165, 345973165)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 345973165n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint32_uint32(
      encryptedAmount.externalEuint32,
      345973165n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, uint32) => ebool test 4 (345973165, 345973161)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 345973165n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint32_uint32(
      encryptedAmount.externalEuint32,
      345973161n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint32, euint32) => ebool test 1 (3479146641, 2468090519)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2468090519n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint32_euint32(
      3479146641n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint32, euint32) => ebool test 2 (345973161, 345973165)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 345973165n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint32_euint32(
      345973161n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint32, euint32) => ebool test 3 (345973165, 345973165)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 345973165n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint32_euint32(
      345973165n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (uint32, euint32) => ebool test 4 (345973165, 345973161)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 345973161n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint32_euint32(
      345973165n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, uint32) => ebool test 1 (1065729491, 966161337)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1065729491n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint32_uint32(
      encryptedAmount.externalEuint32,
      966161337n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, uint32) => ebool test 2 (1065729487, 1065729491)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1065729487n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint32_uint32(
      encryptedAmount.externalEuint32,
      1065729491n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, uint32) => ebool test 3 (1065729491, 1065729491)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1065729491n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint32_uint32(
      encryptedAmount.externalEuint32,
      1065729491n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, uint32) => ebool test 4 (1065729491, 1065729487)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1065729491n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint32_uint32(
      encryptedAmount.externalEuint32,
      1065729487n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint32, euint32) => ebool test 1 (1098852166, 966161337)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 966161337n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint32_euint32(
      1098852166n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint32, euint32) => ebool test 2 (1065729487, 1065729491)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1065729491n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint32_euint32(
      1065729487n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (uint32, euint32) => ebool test 3 (1065729491, 1065729491)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1065729491n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint32_euint32(
      1065729491n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint32, euint32) => ebool test 4 (1065729491, 1065729487)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1065729487n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint32_euint32(
      1065729491n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, uint32) => ebool test 1 (1417495620, 1235892101)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1417495620n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint32_uint32(
      encryptedAmount.externalEuint32,
      1235892101n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, uint32) => ebool test 2 (1417495616, 1417495620)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1417495616n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint32_uint32(
      encryptedAmount.externalEuint32,
      1417495620n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, uint32) => ebool test 3 (1417495620, 1417495620)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1417495620n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint32_uint32(
      encryptedAmount.externalEuint32,
      1417495620n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, uint32) => ebool test 4 (1417495620, 1417495616)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1417495620n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint32_uint32(
      encryptedAmount.externalEuint32,
      1417495616n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (uint32, euint32) => ebool test 1 (3346274466, 1235892101)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1235892101n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint32_euint32(
      3346274466n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (uint32, euint32) => ebool test 2 (1417495616, 1417495620)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1417495620n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint32_euint32(
      1417495616n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint32, euint32) => ebool test 3 (1417495620, 1417495620)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1417495620n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint32_euint32(
      1417495620n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint32, euint32) => ebool test 4 (1417495620, 1417495616)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1417495616n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint32_euint32(
      1417495620n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, uint32) => ebool test 1 (2499693605, 2993548546)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2499693605n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint32_uint32(
      encryptedAmount.externalEuint32,
      2993548546n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, uint32) => ebool test 2 (2499693601, 2499693605)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2499693601n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint32_uint32(
      encryptedAmount.externalEuint32,
      2499693605n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, uint32) => ebool test 3 (2499693605, 2499693605)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2499693605n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint32_uint32(
      encryptedAmount.externalEuint32,
      2499693605n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, uint32) => ebool test 4 (2499693605, 2499693601)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2499693605n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint32_uint32(
      encryptedAmount.externalEuint32,
      2499693601n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (uint32, euint32) => ebool test 1 (2043778837, 2993548546)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2993548546n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint32_euint32(
      2043778837n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint32, euint32) => ebool test 2 (2499693601, 2499693605)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2499693605n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint32_euint32(
      2499693601n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint32, euint32) => ebool test 3 (2499693605, 2499693605)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2499693605n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint32_euint32(
      2499693605n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint32, euint32) => ebool test 4 (2499693605, 2499693601)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2499693601n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint32_euint32(
      2499693605n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, uint32) => ebool test 1 (3759916356, 2231047503)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3759916356n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint32_uint32(
      encryptedAmount.externalEuint32,
      2231047503n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, uint32) => ebool test 2 (3277524462, 3277524466)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3277524462n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint32_uint32(
      encryptedAmount.externalEuint32,
      3277524466n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint32, uint32) => ebool test 3 (3277524466, 3277524466)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3277524466n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint32_uint32(
      encryptedAmount.externalEuint32,
      3277524466n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, uint32) => ebool test 4 (3277524466, 3277524462)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3277524466n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint32_uint32(
      encryptedAmount.externalEuint32,
      3277524462n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (uint32, euint32) => ebool test 1 (955929855, 2231047503)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2231047503n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_uint32_euint32(
      955929855n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (uint32, euint32) => ebool test 2 (3277524462, 3277524466)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3277524466n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_uint32_euint32(
      3277524462n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (uint32, euint32) => ebool test 3 (3277524466, 3277524466)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3277524466n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_uint32_euint32(
      3277524466n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (uint32, euint32) => ebool test 4 (3277524466, 3277524462)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3277524462n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_uint32_euint32(
      3277524466n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint32, uint32) => euint32 test 1 (3856164871, 4163137319)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3856164871n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_euint32_uint32(
      encryptedAmount.externalEuint32,
      4163137319n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(3856164871);
  });

  it('test operator "min" overload (euint32, uint32) => euint32 test 2 (2385547105, 2385547109)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2385547105n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_euint32_uint32(
      encryptedAmount.externalEuint32,
      2385547109n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2385547105);
  });

  it('test operator "min" overload (euint32, uint32) => euint32 test 3 (2385547109, 2385547109)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2385547109n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_euint32_uint32(
      encryptedAmount.externalEuint32,
      2385547109n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2385547109);
  });

  it('test operator "min" overload (euint32, uint32) => euint32 test 4 (2385547109, 2385547105)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2385547109n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_euint32_uint32(
      encryptedAmount.externalEuint32,
      2385547105n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2385547105);
  });

  it('test operator "min" overload (uint32, euint32) => euint32 test 1 (1335778931, 4163137319)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 4163137319n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_uint32_euint32(
      1335778931n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(1335778931);
  });

  it('test operator "min" overload (uint32, euint32) => euint32 test 2 (2385547105, 2385547109)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2385547109n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_uint32_euint32(
      2385547105n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2385547105);
  });

  it('test operator "min" overload (uint32, euint32) => euint32 test 3 (2385547109, 2385547109)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2385547109n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_uint32_euint32(
      2385547109n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2385547109);
  });

  it('test operator "min" overload (uint32, euint32) => euint32 test 4 (2385547109, 2385547105)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2385547105n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_uint32_euint32(
      2385547109n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2385547105);
  });

  it('test operator "max" overload (euint32, uint32) => euint32 test 1 (713485747, 3375844749)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 713485747n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_euint32_uint32(
      encryptedAmount.externalEuint32,
      3375844749n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(3375844749);
  });

  it('test operator "max" overload (euint32, uint32) => euint32 test 2 (621451196, 621451200)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 621451196n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_euint32_uint32(
      encryptedAmount.externalEuint32,
      621451200n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "max" overload (euint32, uint32) => euint32 test 3 (621451200, 621451200)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 621451200n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_euint32_uint32(
      encryptedAmount.externalEuint32,
      621451200n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "max" overload (euint32, uint32) => euint32 test 4 (621451200, 621451196)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 621451200n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_euint32_uint32(
      encryptedAmount.externalEuint32,
      621451196n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "max" overload (uint32, euint32) => euint32 test 1 (2828277897, 3375844749)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 3375844749n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_uint32_euint32(
      2828277897n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(3375844749);
  });

  it('test operator "max" overload (uint32, euint32) => euint32 test 2 (621451196, 621451200)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 621451200n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_uint32_euint32(
      621451196n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "max" overload (uint32, euint32) => euint32 test 3 (621451200, 621451200)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 621451200n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_uint32_euint32(
      621451200n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "max" overload (uint32, euint32) => euint32 test 4 (621451200, 621451196)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 621451196n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_uint32_euint32(
      621451200n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(621451200);
  });

  it('test operator "add" overload (euint64, uint64) => euint64 test 1 (9220531194564270417, 9223299858555524240)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 9220531194564270417n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_euint64_uint64(
      encryptedAmount.externalEuint64,
      9223299858555524240n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18443831053119794657n);
  });

  it('test operator "add" overload (euint64, uint64) => euint64 test 2 (9220531194564270415, 9220531194564270417)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 9220531194564270415n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_euint64_uint64(
      encryptedAmount.externalEuint64,
      9220531194564270417n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18441062389128540832n);
  });

  it('test operator "add" overload (euint64, uint64) => euint64 test 3 (9220531194564270417, 9220531194564270417)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 9220531194564270417n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_euint64_uint64(
      encryptedAmount.externalEuint64,
      9220531194564270417n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18441062389128540834n);
  });

  it('test operator "add" overload (euint64, uint64) => euint64 test 4 (9220531194564270417, 9220531194564270415)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 9220531194564270417n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_euint64_uint64(
      encryptedAmount.externalEuint64,
      9220531194564270415n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18441062389128540832n);
  });

  it('test operator "add" overload (uint64, euint64) => euint64 test 1 (9222666323248547617, 9223299858555524240)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 9223299858555524240n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_uint64_euint64(
      9222666323248547617n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18445966181804071857n);
  });

  it('test operator "add" overload (uint64, euint64) => euint64 test 2 (9220531194564270415, 9220531194564270417)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 9220531194564270417n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_uint64_euint64(
      9220531194564270415n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18441062389128540832n);
  });

  it('test operator "add" overload (uint64, euint64) => euint64 test 3 (9220531194564270417, 9220531194564270417)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 9220531194564270417n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_uint64_euint64(
      9220531194564270417n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18441062389128540834n);
  });

  it('test operator "add" overload (uint64, euint64) => euint64 test 4 (9220531194564270417, 9220531194564270415)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 9220531194564270415n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_uint64_euint64(
      9220531194564270417n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18441062389128540832n);
  });

  it('test operator "sub" overload (euint64, uint64) => euint64 test 1 (18442343153520148641, 18442343153520148641)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442343153520148641n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.sub_euint64_uint64(
      encryptedAmount.externalEuint64,
      18442343153520148641n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint64, uint64) => euint64 test 2 (18442343153520148641, 18442343153520148637)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442343153520148641n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.sub_euint64_uint64(
      encryptedAmount.externalEuint64,
      18442343153520148637n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "sub" overload (uint64, euint64) => euint64 test 1 (18442343153520148641, 18442343153520148641)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442343153520148641n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.sub_uint64_euint64(
      18442343153520148641n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (uint64, euint64) => euint64 test 2 (18442343153520148641, 18442343153520148637)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442343153520148637n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.sub_uint64_euint64(
      18442343153520148641n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint64, uint64) => euint64 test 1 (4294070018, 4294092715)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4294070018n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_euint64_uint64(
      encryptedAmount.externalEuint64,
      4294092715n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18439134781993718870n);
  });

  it('test operator "mul" overload (euint64, uint64) => euint64 test 2 (4292952863, 4292952863)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4292952863n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_euint64_uint64(
      encryptedAmount.externalEuint64,
      4292952863n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18429444283939896769n);
  });

  it('test operator "mul" overload (euint64, uint64) => euint64 test 3 (4292952863, 4292952863)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4292952863n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_euint64_uint64(
      encryptedAmount.externalEuint64,
      4292952863n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18429444283939896769n);
  });

  it('test operator "mul" overload (euint64, uint64) => euint64 test 4 (4292952863, 4292952863)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4292952863n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_euint64_uint64(
      encryptedAmount.externalEuint64,
      4292952863n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18429444283939896769n);
  });

  it('test operator "mul" overload (uint64, euint64) => euint64 test 1 (4293593067, 4294092715)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4294092715n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_uint64_euint64(
      4293593067n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18437086710179206905n);
  });

  it('test operator "mul" overload (uint64, euint64) => euint64 test 2 (4292952863, 4292952863)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4292952863n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_uint64_euint64(
      4292952863n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18429444283939896769n);
  });

  it('test operator "mul" overload (uint64, euint64) => euint64 test 3 (4292952863, 4292952863)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4292952863n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_uint64_euint64(
      4292952863n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18429444283939896769n);
  });

  it('test operator "mul" overload (uint64, euint64) => euint64 test 4 (4292952863, 4292952863)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4292952863n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.mul_uint64_euint64(
      4292952863n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18429444283939896769n);
  });

  it('test operator "div" overload (euint64, uint64) => euint64 test 1 (18443435358707611281, 18440057922800161273)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18443435358707611281n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.div_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440057922800161273n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(1n);
  });

  it('test operator "div" overload (euint64, uint64) => euint64 test 2 (18440851247690481133, 18440851247690481137)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440851247690481133n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.div_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440851247690481137n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "div" overload (euint64, uint64) => euint64 test 3 (18440851247690481137, 18440851247690481137)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440851247690481137n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.div_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440851247690481137n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(1n);
  });

  it('test operator "div" overload (euint64, uint64) => euint64 test 4 (18440851247690481137, 18440851247690481133)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440851247690481137n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.div_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440851247690481133n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(1n);
  });

  it('test operator "rem" overload (euint64, uint64) => euint64 test 1 (18438213378435656509, 18442594263855343903)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438213378435656509n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.rem_euint64_uint64(
      encryptedAmount.externalEuint64,
      18442594263855343903n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18438213378435656509n);
  });

  it('test operator "rem" overload (euint64, uint64) => euint64 test 2 (18438213378435656505, 18438213378435656509)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438213378435656505n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.rem_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438213378435656509n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18438213378435656505n);
  });

  it('test operator "rem" overload (euint64, uint64) => euint64 test 3 (18438213378435656509, 18438213378435656509)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438213378435656509n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.rem_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438213378435656509n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "rem" overload (euint64, uint64) => euint64 test 4 (18438213378435656509, 18438213378435656505)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438213378435656509n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.rem_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438213378435656505n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "and" overload (euint64, uint64) => euint64 test 1 (18445513906165703221, 18440324962595306399)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18445513906165703221n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440324962595306399n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18440306476212871701n);
  });

  it('test operator "and" overload (euint64, uint64) => euint64 test 2 (18442154191212954233, 18442154191212954237)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442154191212954233n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_euint64_uint64(
      encryptedAmount.externalEuint64,
      18442154191212954237n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18442154191212954233n);
  });

  it('test operator "and" overload (euint64, uint64) => euint64 test 3 (18442154191212954237, 18442154191212954237)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442154191212954237n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_euint64_uint64(
      encryptedAmount.externalEuint64,
      18442154191212954237n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18442154191212954237n);
  });

  it('test operator "and" overload (euint64, uint64) => euint64 test 4 (18442154191212954237, 18442154191212954233)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442154191212954237n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_euint64_uint64(
      encryptedAmount.externalEuint64,
      18442154191212954233n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18442154191212954233n);
  });

  it('test operator "and" overload (uint64, euint64) => euint64 test 1 (18439324958045244061, 18440324962595306399)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440324962595306399n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_uint64_euint64(
      18439324958045244061n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18438053920388418205n);
  });

  it('test operator "and" overload (uint64, euint64) => euint64 test 2 (18442154191212954233, 18442154191212954237)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442154191212954237n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_uint64_euint64(
      18442154191212954233n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18442154191212954233n);
  });

  it('test operator "and" overload (uint64, euint64) => euint64 test 3 (18442154191212954237, 18442154191212954237)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442154191212954237n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_uint64_euint64(
      18442154191212954237n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18442154191212954237n);
  });

  it('test operator "and" overload (uint64, euint64) => euint64 test 4 (18442154191212954237, 18442154191212954233)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442154191212954233n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.and_uint64_euint64(
      18442154191212954237n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18442154191212954233n);
  });

  it('test operator "or" overload (euint64, uint64) => euint64 test 1 (18440259459868756377, 18442536412599300183)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440259459868756377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_euint64_uint64(
      encryptedAmount.externalEuint64,
      18442536412599300183n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18445054569667082719n);
  });

  it('test operator "or" overload (euint64, uint64) => euint64 test 2 (18440259459868756373, 18440259459868756377)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440259459868756373n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440259459868756377n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18440259459868756381n);
  });

  it('test operator "or" overload (euint64, uint64) => euint64 test 3 (18440259459868756377, 18440259459868756377)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440259459868756377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440259459868756377n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18440259459868756377n);
  });

  it('test operator "or" overload (euint64, uint64) => euint64 test 4 (18440259459868756377, 18440259459868756373)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440259459868756377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440259459868756373n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18440259459868756381n);
  });

  it('test operator "or" overload (uint64, euint64) => euint64 test 1 (18440236520961897325, 18442536412599300183)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442536412599300183n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_uint64_euint64(
      18440236520961897325n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18445034813329929087n);
  });

  it('test operator "or" overload (uint64, euint64) => euint64 test 2 (18440259459868756373, 18440259459868756377)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440259459868756377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_uint64_euint64(
      18440259459868756373n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18440259459868756381n);
  });

  it('test operator "or" overload (uint64, euint64) => euint64 test 3 (18440259459868756377, 18440259459868756377)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440259459868756377n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_uint64_euint64(
      18440259459868756377n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18440259459868756377n);
  });

  it('test operator "or" overload (uint64, euint64) => euint64 test 4 (18440259459868756377, 18440259459868756373)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440259459868756373n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.or_uint64_euint64(
      18440259459868756377n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(18440259459868756381n);
  });

  it('test operator "xor" overload (euint64, uint64) => euint64 test 1 (18443471195136889881, 18440199939094876781)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18443471195136889881n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440199939094876781n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(8056609169639028n);
  });

  it('test operator "xor" overload (euint64, uint64) => euint64 test 2 (18440807222368659241, 18440807222368659245)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440807222368659241n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440807222368659245n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint64, uint64) => euint64 test 3 (18440807222368659245, 18440807222368659245)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440807222368659245n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440807222368659245n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint64, uint64) => euint64 test 4 (18440807222368659245, 18440807222368659241)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440807222368659245n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440807222368659241n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (uint64, euint64) => euint64 test 1 (18446385764874098851, 18440199939094876781)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440199939094876781n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_uint64_euint64(
      18446385764874098851n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(6326840453663438n);
  });

  it('test operator "xor" overload (uint64, euint64) => euint64 test 2 (18440807222368659241, 18440807222368659245)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440807222368659245n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_uint64_euint64(
      18440807222368659241n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (uint64, euint64) => euint64 test 3 (18440807222368659245, 18440807222368659245)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440807222368659245n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_uint64_euint64(
      18440807222368659245n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (uint64, euint64) => euint64 test 4 (18440807222368659245, 18440807222368659241)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440807222368659241n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.xor_uint64_euint64(
      18440807222368659245n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract6.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint64, uint64) => ebool test 1 (18441678210113937609, 18437872832974228419)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18441678210113937609n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_euint64_uint64(
      encryptedAmount.externalEuint64,
      18437872832974228419n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint64, uint64) => ebool test 2 (18440511762363712327, 18440511762363712331)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440511762363712327n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440511762363712331n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint64, uint64) => ebool test 3 (18440511762363712331, 18440511762363712331)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440511762363712331n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440511762363712331n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint64, uint64) => ebool test 4 (18440511762363712331, 18440511762363712327)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440511762363712331n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_euint64_uint64(
      encryptedAmount.externalEuint64,
      18440511762363712327n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint64, euint64) => ebool test 1 (18446067598785332483, 18437872832974228419)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18437872832974228419n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint64_euint64(
      18446067598785332483n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint64, euint64) => ebool test 2 (18440511762363712327, 18440511762363712331)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440511762363712331n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint64_euint64(
      18440511762363712327n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint64, euint64) => ebool test 3 (18440511762363712331, 18440511762363712331)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440511762363712331n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint64_euint64(
      18440511762363712331n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (uint64, euint64) => ebool test 4 (18440511762363712331, 18440511762363712327)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440511762363712327n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint64_euint64(
      18440511762363712331n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint64, uint64) => ebool test 1 (18442567653990481325, 18442110841154415281)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442567653990481325n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint64_uint64(
      encryptedAmount.externalEuint64,
      18442110841154415281n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint64, uint64) => ebool test 2 (18438601454400463895, 18438601454400463899)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438601454400463895n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438601454400463899n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint64, uint64) => ebool test 3 (18438601454400463899, 18438601454400463899)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438601454400463899n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438601454400463899n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint64, uint64) => ebool test 4 (18438601454400463899, 18438601454400463895)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438601454400463899n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438601454400463895n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint64, euint64) => ebool test 1 (18441968164685232899, 18442110841154415281)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18442110841154415281n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint64_euint64(
      18441968164685232899n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint64, euint64) => ebool test 2 (18438601454400463895, 18438601454400463899)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438601454400463899n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint64_euint64(
      18438601454400463895n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint64, euint64) => ebool test 3 (18438601454400463899, 18438601454400463899)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438601454400463899n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint64_euint64(
      18438601454400463899n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (uint64, euint64) => ebool test 4 (18438601454400463899, 18438601454400463895)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438601454400463895n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint64_euint64(
      18438601454400463899n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint64, uint64) => ebool test 1 (18438909688745287627, 18445159640459418435)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438909688745287627n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint64_uint64(
      encryptedAmount.externalEuint64,
      18445159640459418435n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint64, uint64) => ebool test 2 (18438909688745287623, 18438909688745287627)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438909688745287623n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438909688745287627n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint64, uint64) => ebool test 3 (18438909688745287627, 18438909688745287627)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438909688745287627n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438909688745287627n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint64, uint64) => ebool test 4 (18438909688745287627, 18438909688745287623)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438909688745287627n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint64_uint64(
      encryptedAmount.externalEuint64,
      18438909688745287623n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint64, euint64) => ebool test 1 (18438810735145419861, 18445159640459418435)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18445159640459418435n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint64_euint64(
      18438810735145419861n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (uint64, euint64) => ebool test 2 (18438909688745287623, 18438909688745287627)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438909688745287627n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint64_euint64(
      18438909688745287623n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (uint64, euint64) => ebool test 3 (18438909688745287627, 18438909688745287627)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438909688745287627n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint64_euint64(
      18438909688745287627n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint64, euint64) => ebool test 4 (18438909688745287627, 18438909688745287623)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438909688745287623n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint64_euint64(
      18438909688745287627n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint64, uint64) => ebool test 1 (18441447067300773743, 18445274103455557823)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18441447067300773743n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint64_uint64(
      encryptedAmount.externalEuint64,
      18445274103455557823n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint64, uint64) => ebool test 2 (18439846175976014305, 18439846175976014309)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18439846175976014305n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint64_uint64(
      encryptedAmount.externalEuint64,
      18439846175976014309n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint64, uint64) => ebool test 3 (18439846175976014309, 18439846175976014309)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18439846175976014309n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint64_uint64(
      encryptedAmount.externalEuint64,
      18439846175976014309n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint64, uint64) => ebool test 4 (18439846175976014309, 18439846175976014305)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18439846175976014309n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint64_uint64(
      encryptedAmount.externalEuint64,
      18439846175976014305n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (uint64, euint64) => ebool test 1 (18441858949557317821, 18445274103455557823)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18445274103455557823n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint64_euint64(
      18441858949557317821n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint64, euint64) => ebool test 2 (18439846175976014305, 18439846175976014309)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18439846175976014309n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint64_euint64(
      18439846175976014305n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint64, euint64) => ebool test 3 (18439846175976014309, 18439846175976014309)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18439846175976014309n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint64_euint64(
      18439846175976014309n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint64, euint64) => ebool test 4 (18439846175976014309, 18439846175976014305)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18439846175976014305n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint64_euint64(
      18439846175976014309n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, uint64) => ebool test 1 (18437829734296327859, 18445557739787137343)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18437829734296327859n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint64_uint64(
      encryptedAmount.externalEuint64,
      18445557739787137343n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, uint64) => ebool test 2 (18437829734296327855, 18437829734296327859)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18437829734296327855n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint64_uint64(
      encryptedAmount.externalEuint64,
      18437829734296327859n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, uint64) => ebool test 3 (18437829734296327859, 18437829734296327859)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18437829734296327859n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint64_uint64(
      encryptedAmount.externalEuint64,
      18437829734296327859n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, uint64) => ebool test 4 (18437829734296327859, 18437829734296327855)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18437829734296327859n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint64_uint64(
      encryptedAmount.externalEuint64,
      18437829734296327855n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (uint64, euint64) => ebool test 1 (18440462892480223887, 18445557739787137343)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18445557739787137343n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint64_euint64(
      18440462892480223887n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint64, euint64) => ebool test 2 (18437829734296327855, 18437829734296327859)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18437829734296327859n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint64_euint64(
      18437829734296327855n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint64, euint64) => ebool test 3 (18437829734296327859, 18437829734296327859)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18437829734296327859n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint64_euint64(
      18437829734296327859n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint64, euint64) => ebool test 4 (18437829734296327859, 18437829734296327855)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18437829734296327855n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint64_euint64(
      18437829734296327859n,
      encryptedAmount.externalEuint64,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint64, uint64) => ebool test 1 (18445786402715338993, 18446191914714610405)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18445786402715338993n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint64_uint64(
      encryptedAmount.externalEuint64,
      18446191914714610405n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint64, uint64) => ebool test 2 (18444790581199458975, 18444790581199458979)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18444790581199458975n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint64_uint64(
      encryptedAmount.externalEuint64,
      18444790581199458979n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint64, uint64) => ebool test 3 (18444790581199458979, 18444790581199458979)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18444790581199458979n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint64_uint64(
      encryptedAmount.externalEuint64,
      18444790581199458979n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint64, uint64) => ebool test 4 (18444790581199458979, 18444790581199458975)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18444790581199458979n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint64_uint64(
      encryptedAmount.externalEuint64,
      18444790581199458975n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });
});
