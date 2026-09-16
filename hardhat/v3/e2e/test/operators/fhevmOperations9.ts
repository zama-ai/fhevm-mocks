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

describe('FHEVM operations 9', function () {
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

  it('test operator "or" overload (uint8, euint8) => euint8 test 1 (99, 140)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 140n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_uint8_euint8(99n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(239);
  });

  it('test operator "or" overload (uint8, euint8) => euint8 test 2 (33, 37)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 37n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_uint8_euint8(33n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(37);
  });

  it('test operator "or" overload (uint8, euint8) => euint8 test 3 (37, 37)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 37n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_uint8_euint8(37n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(37);
  });

  it('test operator "or" overload (uint8, euint8) => euint8 test 4 (37, 33)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 33n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_uint8_euint8(37n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(37);
  });

  it('test operator "xor" overload (euint8, uint8) => euint8 test 1 (239, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 239n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint8_uint8(encryptedAmount.externalEuint8, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(234);
  });

  it('test operator "xor" overload (euint8, uint8) => euint8 test 2 (10, 14)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 10n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint8_uint8(encryptedAmount.externalEuint8, 14n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint8, uint8) => euint8 test 3 (14, 14)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 14n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint8_uint8(encryptedAmount.externalEuint8, 14n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint8, uint8) => euint8 test 4 (14, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 14n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint8_uint8(encryptedAmount.externalEuint8, 10n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (uint8, euint8) => euint8 test 1 (80, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 5n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_uint8_euint8(80n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(85);
  });

  it('test operator "xor" overload (uint8, euint8) => euint8 test 2 (10, 14)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 14n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_uint8_euint8(10n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (uint8, euint8) => euint8 test 3 (14, 14)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 14n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_uint8_euint8(14n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (uint8, euint8) => euint8 test 4 (14, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 10n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_uint8_euint8(14n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint8, uint8) => ebool test 1 (221, 162)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 221n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint8_uint8(encryptedAmount.externalEuint8, 162n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, uint8) => ebool test 2 (217, 221)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 217n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint8_uint8(encryptedAmount.externalEuint8, 221n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint8, uint8) => ebool test 3 (221, 221)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 221n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint8_uint8(encryptedAmount.externalEuint8, 221n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint8, uint8) => ebool test 4 (221, 217)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 221n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint8_uint8(encryptedAmount.externalEuint8, 217n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint8, euint8) => ebool test 1 (123, 162)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 162n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_uint8_euint8(123n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint8, euint8) => ebool test 2 (217, 221)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 221n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_uint8_euint8(217n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint8, euint8) => ebool test 3 (221, 221)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 221n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_uint8_euint8(221n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (uint8, euint8) => ebool test 4 (221, 217)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 217n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_uint8_euint8(221n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, uint8) => ebool test 1 (151, 81)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 151n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint8_uint8(encryptedAmount.externalEuint8, 81n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, uint8) => ebool test 2 (147, 151)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 147n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint8_uint8(encryptedAmount.externalEuint8, 151n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint8, uint8) => ebool test 3 (151, 151)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 151n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint8_uint8(encryptedAmount.externalEuint8, 151n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint8, uint8) => ebool test 4 (151, 147)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 151n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint8_uint8(encryptedAmount.externalEuint8, 147n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint8, euint8) => ebool test 1 (218, 81)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 81n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_uint8_euint8(218n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint8, euint8) => ebool test 2 (147, 151)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 151n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_uint8_euint8(147n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint8, euint8) => ebool test 3 (151, 151)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 151n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_uint8_euint8(151n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (uint8, euint8) => ebool test 4 (151, 147)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 147n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_uint8_euint8(151n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, uint8) => ebool test 1 (36, 47)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 36n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_euint8_uint8(encryptedAmount.externalEuint8, 47n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, uint8) => ebool test 2 (32, 36)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 32n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_euint8_uint8(encryptedAmount.externalEuint8, 36n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint8, uint8) => ebool test 3 (36, 36)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 36n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_euint8_uint8(encryptedAmount.externalEuint8, 36n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint8, uint8) => ebool test 4 (36, 32)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 36n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_euint8_uint8(encryptedAmount.externalEuint8, 32n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint8, euint8) => ebool test 1 (87, 47)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 47n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_uint8_euint8(87n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint8, euint8) => ebool test 2 (32, 36)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 36n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_uint8_euint8(32n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (uint8, euint8) => ebool test 3 (36, 36)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 36n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_uint8_euint8(36n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint8, euint8) => ebool test 4 (36, 32)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 32n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_uint8_euint8(36n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint8, uint8) => ebool test 1 (244, 24)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 244n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_euint8_uint8(encryptedAmount.externalEuint8, 24n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint8, uint8) => ebool test 2 (200, 204)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 200n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_euint8_uint8(encryptedAmount.externalEuint8, 204n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, uint8) => ebool test 3 (204, 204)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 204n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_euint8_uint8(encryptedAmount.externalEuint8, 204n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint8, uint8) => ebool test 4 (204, 200)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 204n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_euint8_uint8(encryptedAmount.externalEuint8, 200n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (uint8, euint8) => ebool test 1 (175, 24)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 24n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_uint8_euint8(175n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (uint8, euint8) => ebool test 2 (200, 204)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 204n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_uint8_euint8(200n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint8, euint8) => ebool test 3 (204, 204)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 204n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_uint8_euint8(204n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint8, euint8) => ebool test 4 (204, 200)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 200n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_uint8_euint8(204n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, uint8) => ebool test 1 (212, 111)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 212n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_euint8_uint8(encryptedAmount.externalEuint8, 111n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint8, uint8) => ebool test 2 (30, 34)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 30n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_euint8_uint8(encryptedAmount.externalEuint8, 34n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, uint8) => ebool test 3 (34, 34)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 34n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_euint8_uint8(encryptedAmount.externalEuint8, 34n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint8, uint8) => ebool test 4 (34, 30)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 34n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_euint8_uint8(encryptedAmount.externalEuint8, 30n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (uint8, euint8) => ebool test 1 (5, 111)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 111n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_uint8_euint8(5n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint8, euint8) => ebool test 2 (30, 34)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 34n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_uint8_euint8(30n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint8, euint8) => ebool test 3 (34, 34)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 34n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_uint8_euint8(34n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint8, euint8) => ebool test 4 (34, 30)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 30n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_uint8_euint8(34n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, uint8) => ebool test 1 (218, 86)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 218n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_euint8_uint8(encryptedAmount.externalEuint8, 86n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, uint8) => ebool test 2 (194, 198)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 194n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_euint8_uint8(encryptedAmount.externalEuint8, 198n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint8, uint8) => ebool test 3 (198, 198)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 198n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_euint8_uint8(encryptedAmount.externalEuint8, 198n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint8, uint8) => ebool test 4 (198, 194)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 198n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_euint8_uint8(encryptedAmount.externalEuint8, 194n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (uint8, euint8) => ebool test 1 (112, 86)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 86n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_uint8_euint8(112n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (uint8, euint8) => ebool test 2 (194, 198)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 198n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_uint8_euint8(194n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (uint8, euint8) => ebool test 3 (198, 198)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 198n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_uint8_euint8(198n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (uint8, euint8) => ebool test 4 (198, 194)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 194n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_uint8_euint8(198n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint8, uint8) => euint8 test 1 (137, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 137n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_euint8_uint8(encryptedAmount.externalEuint8, 8n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(8);
  });

  it('test operator "min" overload (euint8, uint8) => euint8 test 2 (133, 137)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 133n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_euint8_uint8(encryptedAmount.externalEuint8, 137n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(133);
  });

  it('test operator "min" overload (euint8, uint8) => euint8 test 3 (137, 137)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 137n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_euint8_uint8(encryptedAmount.externalEuint8, 137n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(137);
  });

  it('test operator "min" overload (euint8, uint8) => euint8 test 4 (137, 133)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 137n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_euint8_uint8(encryptedAmount.externalEuint8, 133n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(133);
  });

  it('test operator "min" overload (uint8, euint8) => euint8 test 1 (27, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 8n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_uint8_euint8(27n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(8);
  });

  it('test operator "min" overload (uint8, euint8) => euint8 test 2 (133, 137)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 137n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_uint8_euint8(133n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(133);
  });

  it('test operator "min" overload (uint8, euint8) => euint8 test 3 (137, 137)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 137n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_uint8_euint8(137n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(137);
  });

  it('test operator "min" overload (uint8, euint8) => euint8 test 4 (137, 133)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 133n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_uint8_euint8(137n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(133);
  });

  it('test operator "max" overload (euint8, uint8) => euint8 test 1 (125, 250)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 125n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_euint8_uint8(encryptedAmount.externalEuint8, 250n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(250);
  });

  it('test operator "max" overload (euint8, uint8) => euint8 test 2 (11, 15)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 11n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_euint8_uint8(encryptedAmount.externalEuint8, 15n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "max" overload (euint8, uint8) => euint8 test 3 (15, 15)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 15n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_euint8_uint8(encryptedAmount.externalEuint8, 15n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "max" overload (euint8, uint8) => euint8 test 4 (15, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 15n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_euint8_uint8(encryptedAmount.externalEuint8, 11n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "max" overload (uint8, euint8) => euint8 test 1 (91, 250)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 250n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_uint8_euint8(91n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(250);
  });

  it('test operator "max" overload (uint8, euint8) => euint8 test 2 (11, 15)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 15n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_uint8_euint8(11n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "max" overload (uint8, euint8) => euint8 test 3 (15, 15)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 15n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_uint8_euint8(15n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "max" overload (uint8, euint8) => euint8 test 4 (15, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 11n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_uint8_euint8(15n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(15);
  });

  it('test operator "add" overload (euint16, uint16) => euint16 test 1 (13756, 11971)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 13756n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_euint16_uint16(
      encryptedAmount.externalEuint16,
      11971n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(25727);
  });

  it('test operator "add" overload (euint16, uint16) => euint16 test 2 (13752, 13756)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 13752n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_euint16_uint16(
      encryptedAmount.externalEuint16,
      13756n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27508);
  });

  it('test operator "add" overload (euint16, uint16) => euint16 test 3 (13756, 13756)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 13756n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_euint16_uint16(
      encryptedAmount.externalEuint16,
      13756n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27512);
  });

  it('test operator "add" overload (euint16, uint16) => euint16 test 4 (13756, 13752)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 13756n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_euint16_uint16(
      encryptedAmount.externalEuint16,
      13752n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27508);
  });

  it('test operator "add" overload (uint16, euint16) => euint16 test 1 (10760, 11971)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 11971n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_uint16_euint16(
      10760n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(22731);
  });

  it('test operator "add" overload (uint16, euint16) => euint16 test 2 (13752, 13756)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 13756n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_uint16_euint16(
      13752n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27508);
  });

  it('test operator "add" overload (uint16, euint16) => euint16 test 3 (13756, 13756)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 13756n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_uint16_euint16(
      13756n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27512);
  });

  it('test operator "add" overload (uint16, euint16) => euint16 test 4 (13756, 13752)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 13752n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_uint16_euint16(
      13756n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27508);
  });

  it('test operator "sub" overload (euint16, uint16) => euint16 test 1 (48348, 48348)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 48348n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.sub_euint16_uint16(
      encryptedAmount.externalEuint16,
      48348n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint16, uint16) => euint16 test 2 (48348, 48344)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 48348n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.sub_euint16_uint16(
      encryptedAmount.externalEuint16,
      48344n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "sub" overload (uint16, euint16) => euint16 test 1 (48348, 48348)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 48348n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.sub_uint16_euint16(
      48348n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (uint16, euint16) => euint16 test 2 (48348, 48344)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 48344n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.sub_uint16_euint16(
      48348n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint16, uint16) => euint16 test 1 (163, 138)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 163n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_euint16_uint16(
      encryptedAmount.externalEuint16,
      138n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(22494);
  });

  it('test operator "mul" overload (euint16, uint16) => euint16 test 2 (163, 163)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 163n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_euint16_uint16(
      encryptedAmount.externalEuint16,
      163n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "mul" overload (euint16, uint16) => euint16 test 3 (163, 163)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 163n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_euint16_uint16(
      encryptedAmount.externalEuint16,
      163n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "mul" overload (euint16, uint16) => euint16 test 4 (163, 163)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 163n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_euint16_uint16(
      encryptedAmount.externalEuint16,
      163n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "mul" overload (uint16, euint16) => euint16 test 1 (169, 138)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 138n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_uint16_euint16(
      169n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(23322);
  });

  it('test operator "mul" overload (uint16, euint16) => euint16 test 2 (163, 163)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 163n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_uint16_euint16(
      163n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "mul" overload (uint16, euint16) => euint16 test 3 (163, 163)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 163n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_uint16_euint16(
      163n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "mul" overload (uint16, euint16) => euint16 test 4 (163, 163)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 163n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_uint16_euint16(
      163n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(26569);
  });

  it('test operator "div" overload (euint16, uint16) => euint16 test 1 (27898, 26874)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27898n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.div_euint16_uint16(
      encryptedAmount.externalEuint16,
      26874n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "div" overload (euint16, uint16) => euint16 test 2 (27894, 27898)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27894n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.div_euint16_uint16(
      encryptedAmount.externalEuint16,
      27898n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "div" overload (euint16, uint16) => euint16 test 3 (27898, 27898)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27898n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.div_euint16_uint16(
      encryptedAmount.externalEuint16,
      27898n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "div" overload (euint16, uint16) => euint16 test 4 (27898, 27894)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27898n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.div_euint16_uint16(
      encryptedAmount.externalEuint16,
      27894n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "rem" overload (euint16, uint16) => euint16 test 1 (41027, 40539)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 41027n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.rem_euint16_uint16(
      encryptedAmount.externalEuint16,
      40539n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(488);
  });

  it('test operator "rem" overload (euint16, uint16) => euint16 test 2 (41023, 41027)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 41023n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.rem_euint16_uint16(
      encryptedAmount.externalEuint16,
      41027n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(41023);
  });

  it('test operator "rem" overload (euint16, uint16) => euint16 test 3 (41027, 41027)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 41027n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.rem_euint16_uint16(
      encryptedAmount.externalEuint16,
      41027n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "rem" overload (euint16, uint16) => euint16 test 4 (41027, 41023)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 41027n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.rem_euint16_uint16(
      encryptedAmount.externalEuint16,
      41023n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "and" overload (euint16, uint16) => euint16 test 1 (129, 55907)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 129n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint16_uint16(
      encryptedAmount.externalEuint16,
      55907n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "and" overload (euint16, uint16) => euint16 test 2 (125, 129)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 125n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint16_uint16(
      encryptedAmount.externalEuint16,
      129n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "and" overload (euint16, uint16) => euint16 test 3 (129, 129)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 129n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint16_uint16(
      encryptedAmount.externalEuint16,
      129n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(129);
  });

  it('test operator "and" overload (euint16, uint16) => euint16 test 4 (129, 125)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 129n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint16_uint16(
      encryptedAmount.externalEuint16,
      125n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "and" overload (uint16, euint16) => euint16 test 1 (63546, 55907)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 55907n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_uint16_euint16(
      63546n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(55330);
  });

  it('test operator "and" overload (uint16, euint16) => euint16 test 2 (125, 129)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 129n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_uint16_euint16(
      125n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "and" overload (uint16, euint16) => euint16 test 3 (129, 129)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 129n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_uint16_euint16(
      129n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(129);
  });

  it('test operator "and" overload (uint16, euint16) => euint16 test 4 (129, 125)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 125n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_uint16_euint16(
      129n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "or" overload (euint16, uint16) => euint16 test 1 (34917, 28609)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 34917n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint16_uint16(
      encryptedAmount.externalEuint16,
      28609n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(61413);
  });

  it('test operator "or" overload (euint16, uint16) => euint16 test 2 (27584, 27588)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27584n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint16_uint16(
      encryptedAmount.externalEuint16,
      27588n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "or" overload (euint16, uint16) => euint16 test 3 (27588, 27588)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27588n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint16_uint16(
      encryptedAmount.externalEuint16,
      27588n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "or" overload (euint16, uint16) => euint16 test 4 (27588, 27584)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27588n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint16_uint16(
      encryptedAmount.externalEuint16,
      27584n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "or" overload (uint16, euint16) => euint16 test 1 (9466, 28609)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 28609n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_uint16_euint16(
      9466n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(28667);
  });

  it('test operator "or" overload (uint16, euint16) => euint16 test 2 (27584, 27588)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27588n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_uint16_euint16(
      27584n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "or" overload (uint16, euint16) => euint16 test 3 (27588, 27588)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27588n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_uint16_euint16(
      27588n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "or" overload (uint16, euint16) => euint16 test 4 (27588, 27584)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 27584n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_uint16_euint16(
      27588n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(27588);
  });

  it('test operator "xor" overload (euint16, uint16) => euint16 test 1 (16637, 60190)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 16637n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint16_uint16(
      encryptedAmount.externalEuint16,
      60190n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(44003);
  });

  it('test operator "xor" overload (euint16, uint16) => euint16 test 2 (16633, 16637)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 16633n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint16_uint16(
      encryptedAmount.externalEuint16,
      16637n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint16, uint16) => euint16 test 3 (16637, 16637)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 16637n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint16_uint16(
      encryptedAmount.externalEuint16,
      16637n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint16, uint16) => euint16 test 4 (16637, 16633)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 16637n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint16_uint16(
      encryptedAmount.externalEuint16,
      16633n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (uint16, euint16) => euint16 test 1 (9591, 60190)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 60190n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_uint16_euint16(
      9591n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(52841);
  });

  it('test operator "xor" overload (uint16, euint16) => euint16 test 2 (16633, 16637)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 16637n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_uint16_euint16(
      16633n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (uint16, euint16) => euint16 test 3 (16637, 16637)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 16637n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_uint16_euint16(
      16637n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (uint16, euint16) => euint16 test 4 (16637, 16633)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 16633n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_uint16_euint16(
      16637n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract5.resEuint16() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint16, uint16) => ebool test 1 (56747, 879)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 56747n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint16_uint16(
      encryptedAmount.externalEuint16,
      879n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, uint16) => ebool test 2 (20691, 20695)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 20691n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint16_uint16(
      encryptedAmount.externalEuint16,
      20695n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, uint16) => ebool test 3 (20695, 20695)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 20695n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint16_uint16(
      encryptedAmount.externalEuint16,
      20695n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint16, uint16) => ebool test 4 (20695, 20691)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 20695n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint16_uint16(
      encryptedAmount.externalEuint16,
      20691n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint16, euint16) => ebool test 1 (20159, 879)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 879n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint16_euint16(
      20159n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint16, euint16) => ebool test 2 (20691, 20695)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 20695n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint16_euint16(
      20691n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (uint16, euint16) => ebool test 3 (20695, 20695)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 20695n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint16_euint16(
      20695n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (uint16, euint16) => ebool test 4 (20695, 20691)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 20691n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.eq_uint16_euint16(
      20695n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, uint16) => ebool test 1 (24928, 54474)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 24928n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint16_uint16(
      encryptedAmount.externalEuint16,
      54474n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, uint16) => ebool test 2 (4053, 4057)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 4053n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint16_uint16(
      encryptedAmount.externalEuint16,
      4057n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, uint16) => ebool test 3 (4057, 4057)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 4057n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint16_uint16(
      encryptedAmount.externalEuint16,
      4057n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, uint16) => ebool test 4 (4057, 4053)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 4057n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_euint16_uint16(
      encryptedAmount.externalEuint16,
      4053n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint16, euint16) => ebool test 1 (46070, 54474)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 54474n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint16_euint16(
      46070n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint16, euint16) => ebool test 2 (4053, 4057)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 4057n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint16_euint16(
      4053n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (uint16, euint16) => ebool test 3 (4057, 4057)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 4057n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint16_euint16(
      4057n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (uint16, euint16) => ebool test 4 (4057, 4053)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 4053n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ne_uint16_euint16(
      4057n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, uint16) => ebool test 1 (22657, 36808)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 22657n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint16_uint16(
      encryptedAmount.externalEuint16,
      36808n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, uint16) => ebool test 2 (22653, 22657)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 22653n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint16_uint16(
      encryptedAmount.externalEuint16,
      22657n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, uint16) => ebool test 3 (22657, 22657)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 22657n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint16_uint16(
      encryptedAmount.externalEuint16,
      22657n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, uint16) => ebool test 4 (22657, 22653)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 22657n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_euint16_uint16(
      encryptedAmount.externalEuint16,
      22653n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint16, euint16) => ebool test 1 (60677, 36808)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 36808n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint16_euint16(
      60677n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint16, euint16) => ebool test 2 (22653, 22657)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 22657n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint16_euint16(
      22653n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (uint16, euint16) => ebool test 3 (22657, 22657)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 22657n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint16_euint16(
      22657n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (uint16, euint16) => ebool test 4 (22657, 22653)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 22653n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.ge_uint16_euint16(
      22657n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, uint16) => ebool test 1 (59175, 42694)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 59175n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint16_uint16(
      encryptedAmount.externalEuint16,
      42694n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, uint16) => ebool test 2 (12668, 12672)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 12668n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint16_uint16(
      encryptedAmount.externalEuint16,
      12672n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, uint16) => ebool test 3 (12672, 12672)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 12672n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint16_uint16(
      encryptedAmount.externalEuint16,
      12672n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, uint16) => ebool test 4 (12672, 12668)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 12672n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_euint16_uint16(
      encryptedAmount.externalEuint16,
      12668n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (uint16, euint16) => ebool test 1 (47338, 42694)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 42694n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint16_euint16(
      47338n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (uint16, euint16) => ebool test 2 (12668, 12672)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 12672n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint16_euint16(
      12668n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint16, euint16) => ebool test 3 (12672, 12672)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 12672n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint16_euint16(
      12672n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (uint16, euint16) => ebool test 4 (12672, 12668)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 12668n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.gt_uint16_euint16(
      12672n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, uint16) => ebool test 1 (25325, 42114)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 25325n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint16_uint16(
      encryptedAmount.externalEuint16,
      42114n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, uint16) => ebool test 2 (18192, 18196)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18192n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint16_uint16(
      encryptedAmount.externalEuint16,
      18196n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, uint16) => ebool test 3 (18196, 18196)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18196n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint16_uint16(
      encryptedAmount.externalEuint16,
      18196n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, uint16) => ebool test 4 (18196, 18192)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18196n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_euint16_uint16(
      encryptedAmount.externalEuint16,
      18192n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (uint16, euint16) => ebool test 1 (850, 42114)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 42114n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint16_euint16(
      850n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint16, euint16) => ebool test 2 (18192, 18196)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18196n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint16_euint16(
      18192n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint16, euint16) => ebool test 3 (18196, 18196)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18196n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint16_euint16(
      18196n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (uint16, euint16) => ebool test 4 (18196, 18192)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18192n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.le_uint16_euint16(
      18196n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, uint16) => ebool test 1 (64205, 35823)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 64205n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint16_uint16(
      encryptedAmount.externalEuint16,
      35823n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, uint16) => ebool test 2 (56301, 56305)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 56301n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint16_uint16(
      encryptedAmount.externalEuint16,
      56305n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, uint16) => ebool test 3 (56305, 56305)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 56305n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint16_uint16(
      encryptedAmount.externalEuint16,
      56305n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, uint16) => ebool test 4 (56305, 56301)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 56305n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_euint16_uint16(
      encryptedAmount.externalEuint16,
      56301n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (uint16, euint16) => ebool test 1 (34271, 35823)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 35823n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_uint16_euint16(
      34271n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (uint16, euint16) => ebool test 2 (56301, 56305)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 56305n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_uint16_euint16(
      56301n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (uint16, euint16) => ebool test 3 (56305, 56305)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 56305n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_uint16_euint16(
      56305n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (uint16, euint16) => ebool test 4 (56305, 56301)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 56301n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.lt_uint16_euint16(
      56305n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract6.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint16, uint16) => euint16 test 1 (58529, 26425)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 58529n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_euint16_uint16(
      encryptedAmount.externalEuint16,
      26425n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(26425);
  });

  it('test operator "min" overload (euint16, uint16) => euint16 test 2 (18199, 18203)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18199n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_euint16_uint16(
      encryptedAmount.externalEuint16,
      18203n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(18199);
  });

  it('test operator "min" overload (euint16, uint16) => euint16 test 3 (18203, 18203)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18203n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_euint16_uint16(
      encryptedAmount.externalEuint16,
      18203n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(18203);
  });

  it('test operator "min" overload (euint16, uint16) => euint16 test 4 (18203, 18199)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18203n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_euint16_uint16(
      encryptedAmount.externalEuint16,
      18199n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(18199);
  });

  it('test operator "min" overload (uint16, euint16) => euint16 test 1 (4160, 26425)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 26425n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_uint16_euint16(
      4160n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(4160);
  });

  it('test operator "min" overload (uint16, euint16) => euint16 test 2 (18199, 18203)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18203n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_uint16_euint16(
      18199n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(18199);
  });

  it('test operator "min" overload (uint16, euint16) => euint16 test 3 (18203, 18203)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18203n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_uint16_euint16(
      18203n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(18203);
  });

  it('test operator "min" overload (uint16, euint16) => euint16 test 4 (18203, 18199)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 18199n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.min_uint16_euint16(
      18203n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(18199);
  });

  it('test operator "max" overload (euint16, uint16) => euint16 test 1 (64651, 6915)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 64651n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_euint16_uint16(
      encryptedAmount.externalEuint16,
      6915n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(64651);
  });

  it('test operator "max" overload (euint16, uint16) => euint16 test 2 (60625, 60629)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 60625n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_euint16_uint16(
      encryptedAmount.externalEuint16,
      60629n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "max" overload (euint16, uint16) => euint16 test 3 (60629, 60629)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 60629n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_euint16_uint16(
      encryptedAmount.externalEuint16,
      60629n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "max" overload (euint16, uint16) => euint16 test 4 (60629, 60625)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 60629n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_euint16_uint16(
      encryptedAmount.externalEuint16,
      60625n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "max" overload (uint16, euint16) => euint16 test 1 (3722, 6915)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 6915n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_uint16_euint16(
      3722n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(6915);
  });

  it('test operator "max" overload (uint16, euint16) => euint16 test 2 (60625, 60629)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 60629n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_uint16_euint16(
      60625n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "max" overload (uint16, euint16) => euint16 test 3 (60629, 60629)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 60629n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_uint16_euint16(
      60629n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "max" overload (uint16, euint16) => euint16 test 4 (60629, 60625)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 60625n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.max_uint16_euint16(
      60629n,
      encryptedAmount.externalEuint16,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract6.resEuint16() });
    expect(res).to.equal(60629);
  });

  it('test operator "add" overload (euint32, uint32) => euint32 test 1 (308575078, 2056988092)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 308575078n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_euint32_uint32(
      encryptedAmount.externalEuint32,
      2056988092n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2365563170);
  });

  it('test operator "add" overload (euint32, uint32) => euint32 test 2 (308575074, 308575078)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 308575074n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_euint32_uint32(
      encryptedAmount.externalEuint32,
      308575078n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(617150152);
  });

  it('test operator "add" overload (euint32, uint32) => euint32 test 3 (308575078, 308575078)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 308575078n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_euint32_uint32(
      encryptedAmount.externalEuint32,
      308575078n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(617150156);
  });

  it('test operator "add" overload (euint32, uint32) => euint32 test 4 (308575078, 308575074)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 308575078n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_euint32_uint32(
      encryptedAmount.externalEuint32,
      308575074n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(617150152);
  });

  it('test operator "add" overload (uint32, euint32) => euint32 test 1 (905498101, 2056988092)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2056988092n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_uint32_euint32(
      905498101n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(2962486193);
  });

  it('test operator "add" overload (uint32, euint32) => euint32 test 2 (308575074, 308575078)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 308575078n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_uint32_euint32(
      308575074n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(617150152);
  });

  it('test operator "add" overload (uint32, euint32) => euint32 test 3 (308575078, 308575078)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 308575078n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_uint32_euint32(
      308575078n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(617150156);
  });

  it('test operator "add" overload (uint32, euint32) => euint32 test 4 (308575078, 308575074)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 308575074n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.add_uint32_euint32(
      308575078n,
      encryptedAmount.externalEuint32,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(617150152);
  });

  it('test operator "sub" overload (euint32, uint32) => euint32 test 1 (827505071, 827505071)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 827505071n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.sub_euint32_uint32(
      encryptedAmount.externalEuint32,
      827505071n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint32, uint32) => euint32 test 2 (827505071, 827505067)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 827505071n,
      contractAddress: this.contract6Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract6.sub_euint32_uint32(
      encryptedAmount.externalEuint32,
      827505067n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract6.resEuint32() });
    expect(res).to.equal(4);
  });
});
