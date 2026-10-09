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

describe('FHEVM operations 3', function () {
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

  it('test operator "sub" overload (euint16, euint32) => euint32 test 1 (17823, 17823)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17823n },
        { type: 'uint32', value: 17823n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint16, euint32) => euint32 test 2 (17823, 17819)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17823n },
        { type: 'uint32', value: 17819n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint16, euint32) => euint32 test 1 (2, 27583)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2n },
        { type: 'uint32', value: 27583n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(55166);
  });

  it('test operator "mul" overload (euint16, euint32) => euint32 test 2 (248, 249)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 248n },
        { type: 'uint32', value: 249n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(61752);
  });

  it('test operator "mul" overload (euint16, euint32) => euint32 test 3 (249, 249)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 249n },
        { type: 'uint32', value: 249n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(62001);
  });

  it('test operator "mul" overload (euint16, euint32) => euint32 test 4 (249, 248)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 249n },
        { type: 'uint32', value: 248n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(61752);
  });

  it('test operator "and" overload (euint16, euint32) => euint32 test 1 (38355, 3514412921)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 38355n },
        { type: 'uint32', value: 3514412921n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(34129);
  });

  it('test operator "and" overload (euint16, euint32) => euint32 test 2 (38351, 38355)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 38351n },
        { type: 'uint32', value: 38355n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(38339);
  });

  it('test operator "and" overload (euint16, euint32) => euint32 test 3 (38355, 38355)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 38355n },
        { type: 'uint32', value: 38355n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(38355);
  });

  it('test operator "and" overload (euint16, euint32) => euint32 test 4 (38355, 38351)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 38355n },
        { type: 'uint32', value: 38351n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(38339);
  });

  it('test operator "or" overload (euint16, euint32) => euint32 test 1 (50707, 3046530735)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 50707n },
        { type: 'uint32', value: 3046530735n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(3046563519);
  });

  it('test operator "or" overload (euint16, euint32) => euint32 test 2 (50703, 50707)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 50703n },
        { type: 'uint32', value: 50707n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(50719);
  });

  it('test operator "or" overload (euint16, euint32) => euint32 test 3 (50707, 50707)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 50707n },
        { type: 'uint32', value: 50707n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(50707);
  });

  it('test operator "or" overload (euint16, euint32) => euint32 test 4 (50707, 50703)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 50707n },
        { type: 'uint32', value: 50703n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(50719);
  });

  it('test operator "xor" overload (euint16, euint32) => euint32 test 1 (17678, 4281320766)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17678n },
        { type: 'uint32', value: 4281320766n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4281303088);
  });

  it('test operator "xor" overload (euint16, euint32) => euint32 test 2 (17674, 17678)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17674n },
        { type: 'uint32', value: 17678n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint16, euint32) => euint32 test 3 (17678, 17678)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17678n },
        { type: 'uint32', value: 17678n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint16, euint32) => euint32 test 4 (17678, 17674)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17678n },
        { type: 'uint32', value: 17674n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "eq" overload (euint16, euint32) => ebool test 1 (37283, 146078640)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37283n },
        { type: 'uint32', value: 146078640n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint32) => ebool test 2 (37279, 37283)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37279n },
        { type: 'uint32', value: 37283n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint32) => ebool test 3 (37283, 37283)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37283n },
        { type: 'uint32', value: 37283n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint16, euint32) => ebool test 4 (37283, 37279)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37283n },
        { type: 'uint32', value: 37279n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint32) => ebool test 1 (51533, 2161321973)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51533n },
        { type: 'uint32', value: 2161321973n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint32) => ebool test 2 (51529, 51533)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51529n },
        { type: 'uint32', value: 51533n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint32) => ebool test 3 (51533, 51533)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51533n },
        { type: 'uint32', value: 51533n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint32) => ebool test 4 (51533, 51529)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51533n },
        { type: 'uint32', value: 51529n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint32) => ebool test 1 (43120, 3918934362)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 43120n },
        { type: 'uint32', value: 3918934362n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint32) => ebool test 2 (43116, 43120)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 43116n },
        { type: 'uint32', value: 43120n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint32) => ebool test 3 (43120, 43120)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 43120n },
        { type: 'uint32', value: 43120n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint32) => ebool test 4 (43120, 43116)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 43120n },
        { type: 'uint32', value: 43116n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, euint32) => ebool test 1 (53350, 2040212002)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 53350n },
        { type: 'uint32', value: 2040212002n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint32) => ebool test 2 (53346, 53350)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 53346n },
        { type: 'uint32', value: 53350n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint32) => ebool test 3 (53350, 53350)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 53350n },
        { type: 'uint32', value: 53350n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint32) => ebool test 4 (53350, 53346)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 53350n },
        { type: 'uint32', value: 53346n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint32) => ebool test 1 (39114, 2957921879)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 39114n },
        { type: 'uint32', value: 2957921879n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint32) => ebool test 2 (39110, 39114)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 39110n },
        { type: 'uint32', value: 39114n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint32) => ebool test 3 (39114, 39114)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 39114n },
        { type: 'uint32', value: 39114n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint32) => ebool test 4 (39114, 39110)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 39114n },
        { type: 'uint32', value: 39110n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint32) => ebool test 1 (14807, 2824712233)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 14807n },
        { type: 'uint32', value: 2824712233n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, euint32) => ebool test 2 (14803, 14807)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 14803n },
        { type: 'uint32', value: 14807n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, euint32) => ebool test 3 (14807, 14807)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 14807n },
        { type: 'uint32', value: 14807n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint32) => ebool test 4 (14807, 14803)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 14807n },
        { type: 'uint32', value: 14803n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint16, euint32) => euint32 test 1 (21351, 328331938)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 21351n },
        { type: 'uint32', value: 328331938n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(21351);
  });

  it('test operator "min" overload (euint16, euint32) => euint32 test 2 (21347, 21351)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 21347n },
        { type: 'uint32', value: 21351n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(21347);
  });

  it('test operator "min" overload (euint16, euint32) => euint32 test 3 (21351, 21351)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 21351n },
        { type: 'uint32', value: 21351n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(21351);
  });

  it('test operator "min" overload (euint16, euint32) => euint32 test 4 (21351, 21347)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 21351n },
        { type: 'uint32', value: 21347n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(21347);
  });

  it('test operator "max" overload (euint16, euint32) => euint32 test 1 (16090, 2930327358)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16090n },
        { type: 'uint32', value: 2930327358n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(2930327358);
  });

  it('test operator "max" overload (euint16, euint32) => euint32 test 2 (16086, 16090)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16086n },
        { type: 'uint32', value: 16090n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(16090);
  });

  it('test operator "max" overload (euint16, euint32) => euint32 test 3 (16090, 16090)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16090n },
        { type: 'uint32', value: 16090n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(16090);
  });

  it('test operator "max" overload (euint16, euint32) => euint32 test 4 (16090, 16086)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 16090n },
        { type: 'uint32', value: 16086n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(16090);
  });

  it('test operator "add" overload (euint16, euint64) => euint64 test 1 (2, 65516)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2n },
        { type: 'uint64', value: 65516n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(65518n);
  });

  it('test operator "add" overload (euint16, euint64) => euint64 test 2 (12418, 12422)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 12418n },
        { type: 'uint64', value: 12422n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(24840n);
  });

  it('test operator "add" overload (euint16, euint64) => euint64 test 3 (12422, 12422)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 12422n },
        { type: 'uint64', value: 12422n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(24844n);
  });

  it('test operator "add" overload (euint16, euint64) => euint64 test 4 (12422, 12418)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 12422n },
        { type: 'uint64', value: 12418n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(24840n);
  });

  it('test operator "sub" overload (euint16, euint64) => euint64 test 1 (39196, 39196)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 39196n },
        { type: 'uint64', value: 39196n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint16, euint64) => euint64 test 2 (39196, 39192)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 39196n },
        { type: 'uint64', value: 39192n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint16, euint64) => euint64 test 1 (2, 32757)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2n },
        { type: 'uint64', value: 32757n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(65514n);
  });

  it('test operator "mul" overload (euint16, euint64) => euint64 test 2 (254, 254)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 254n },
        { type: 'uint64', value: 254n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(64516n);
  });

  it('test operator "mul" overload (euint16, euint64) => euint64 test 3 (254, 254)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 254n },
        { type: 'uint64', value: 254n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(64516n);
  });

  it('test operator "mul" overload (euint16, euint64) => euint64 test 4 (254, 254)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 254n },
        { type: 'uint64', value: 254n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(64516n);
  });

  it('test operator "and" overload (euint16, euint64) => euint64 test 1 (24454, 18442097008169977087)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 24454n },
        { type: 'uint64', value: 18442097008169977087n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(1158n);
  });

  it('test operator "and" overload (euint16, euint64) => euint64 test 2 (24450, 24454)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 24450n },
        { type: 'uint64', value: 24454n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(24450n);
  });

  it('test operator "and" overload (euint16, euint64) => euint64 test 3 (24454, 24454)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 24454n },
        { type: 'uint64', value: 24454n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(24454n);
  });

  it('test operator "and" overload (euint16, euint64) => euint64 test 4 (24454, 24450)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 24454n },
        { type: 'uint64', value: 24450n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(24450n);
  });

  it('test operator "or" overload (euint16, euint64) => euint64 test 1 (36052, 18439235578679962485)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 36052n },
        { type: 'uint64', value: 18439235578679962485n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(18439235578679963637n);
  });

  it('test operator "or" overload (euint16, euint64) => euint64 test 2 (36048, 36052)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 36048n },
        { type: 'uint64', value: 36052n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(36052n);
  });

  it('test operator "or" overload (euint16, euint64) => euint64 test 3 (36052, 36052)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 36052n },
        { type: 'uint64', value: 36052n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(36052n);
  });

  it('test operator "or" overload (euint16, euint64) => euint64 test 4 (36052, 36048)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 36052n },
        { type: 'uint64', value: 36048n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(36052n);
  });

  it('test operator "xor" overload (euint16, euint64) => euint64 test 1 (15806, 18440069628500100245)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 15806n },
        { type: 'uint64', value: 18440069628500100245n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(18440069628500113707n);
  });

  it('test operator "xor" overload (euint16, euint64) => euint64 test 2 (15802, 15806)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 15802n },
        { type: 'uint64', value: 15806n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint16, euint64) => euint64 test 3 (15806, 15806)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 15806n },
        { type: 'uint64', value: 15806n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint16, euint64) => euint64 test 4 (15806, 15802)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 15806n },
        { type: 'uint64', value: 15802n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint16, euint64) => ebool test 1 (43112, 18438145067791250747)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 43112n },
        { type: 'uint64', value: 18438145067791250747n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint64) => ebool test 2 (43108, 43112)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 43108n },
        { type: 'uint64', value: 43112n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint64) => ebool test 3 (43112, 43112)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 43112n },
        { type: 'uint64', value: 43112n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint16, euint64) => ebool test 4 (43112, 43108)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 43112n },
        { type: 'uint64', value: 43108n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint64) => ebool test 1 (9302, 18444273334839440731)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 9302n },
        { type: 'uint64', value: 18444273334839440731n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint64) => ebool test 2 (9298, 9302)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 9298n },
        { type: 'uint64', value: 9302n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint64) => ebool test 3 (9302, 9302)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 9302n },
        { type: 'uint64', value: 9302n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint64) => ebool test 4 (9302, 9298)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 9302n },
        { type: 'uint64', value: 9298n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint64) => ebool test 1 (63664, 18444928696114503107)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 63664n },
        { type: 'uint64', value: 18444928696114503107n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint64) => ebool test 2 (63660, 63664)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 63660n },
        { type: 'uint64', value: 63664n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint64) => ebool test 3 (63664, 63664)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 63664n },
        { type: 'uint64', value: 63664n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint64) => ebool test 4 (63664, 63660)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 63664n },
        { type: 'uint64', value: 63660n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, euint64) => ebool test 1 (17460, 18444655219557170751)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17460n },
        { type: 'uint64', value: 18444655219557170751n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint64) => ebool test 2 (17456, 17460)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17456n },
        { type: 'uint64', value: 17460n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint64) => ebool test 3 (17460, 17460)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17460n },
        { type: 'uint64', value: 17460n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint64) => ebool test 4 (17460, 17456)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 17460n },
        { type: 'uint64', value: 17456n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint64) => ebool test 1 (28401, 18443005890184320847)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 28401n },
        { type: 'uint64', value: 18443005890184320847n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint64) => ebool test 2 (28397, 28401)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 28397n },
        { type: 'uint64', value: 28401n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint64) => ebool test 3 (28401, 28401)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 28401n },
        { type: 'uint64', value: 28401n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint64) => ebool test 4 (28401, 28397)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 28401n },
        { type: 'uint64', value: 28397n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint64) => ebool test 1 (1001, 18440471599208664139)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 1001n },
        { type: 'uint64', value: 18440471599208664139n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, euint64) => ebool test 2 (997, 1001)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 997n },
        { type: 'uint64', value: 1001n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, euint64) => ebool test 3 (1001, 1001)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 1001n },
        { type: 'uint64', value: 1001n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint64) => ebool test 4 (1001, 997)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 1001n },
        { type: 'uint64', value: 997n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint16, euint64) => euint64 test 1 (37593, 18442484881376073199)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37593n },
        { type: 'uint64', value: 18442484881376073199n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(37593n);
  });

  it('test operator "min" overload (euint16, euint64) => euint64 test 2 (37589, 37593)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37589n },
        { type: 'uint64', value: 37593n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(37589n);
  });

  it('test operator "min" overload (euint16, euint64) => euint64 test 3 (37593, 37593)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37593n },
        { type: 'uint64', value: 37593n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(37593n);
  });

  it('test operator "min" overload (euint16, euint64) => euint64 test 4 (37593, 37589)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37593n },
        { type: 'uint64', value: 37589n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(37589n);
  });

  it('test operator "max" overload (euint16, euint64) => euint64 test 1 (51474, 18442485804632668521)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51474n },
        { type: 'uint64', value: 18442485804632668521n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(18442485804632668521n);
  });

  it('test operator "max" overload (euint16, euint64) => euint64 test 2 (51470, 51474)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51470n },
        { type: 'uint64', value: 51474n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(51474n);
  });

  it('test operator "max" overload (euint16, euint64) => euint64 test 3 (51474, 51474)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51474n },
        { type: 'uint64', value: 51474n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(51474n);
  });

  it('test operator "max" overload (euint16, euint64) => euint64 test 4 (51474, 51470)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51474n },
        { type: 'uint64', value: 51470n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract2.resEuint64() });
    expect(res).to.equal(51474n);
  });

  it('test operator "add" overload (euint16, euint128) => euint128 test 1 (2, 32769)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2n },
        { type: 'uint128', value: 32769n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(32771n);
  });

  it('test operator "add" overload (euint16, euint128) => euint128 test 2 (22240, 22244)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22240n },
        { type: 'uint128', value: 22244n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(44484n);
  });

  it('test operator "add" overload (euint16, euint128) => euint128 test 3 (22244, 22244)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22244n },
        { type: 'uint128', value: 22244n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(44488n);
  });

  it('test operator "add" overload (euint16, euint128) => euint128 test 4 (22244, 22240)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22244n },
        { type: 'uint128', value: 22240n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(44484n);
  });

  it('test operator "sub" overload (euint16, euint128) => euint128 test 1 (61789, 61789)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 61789n },
        { type: 'uint128', value: 61789n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint16, euint128) => euint128 test 2 (61789, 61785)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 61789n },
        { type: 'uint128', value: 61785n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint16, euint128) => euint128 test 1 (2, 16385)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2n },
        { type: 'uint128', value: 16385n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(32770n);
  });

  it('test operator "mul" overload (euint16, euint128) => euint128 test 2 (181, 181)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 181n },
        { type: 'uint128', value: 181n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(32761n);
  });

  it('test operator "mul" overload (euint16, euint128) => euint128 test 3 (181, 181)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 181n },
        { type: 'uint128', value: 181n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(32761n);
  });

  it('test operator "mul" overload (euint16, euint128) => euint128 test 4 (181, 181)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 181n },
        { type: 'uint128', value: 181n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(32761n);
  });

  it('test operator "and" overload (euint16, euint128) => euint128 test 1 (26934, 340282366920938463463368136312298369445)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 26934n },
        { type: 'uint128', value: 340282366920938463463368136312298369445n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(24868n);
  });

  it('test operator "and" overload (euint16, euint128) => euint128 test 2 (26930, 26934)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 26930n },
        { type: 'uint128', value: 26934n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(26930n);
  });

  it('test operator "and" overload (euint16, euint128) => euint128 test 3 (26934, 26934)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 26934n },
        { type: 'uint128', value: 26934n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(26934n);
  });

  it('test operator "and" overload (euint16, euint128) => euint128 test 4 (26934, 26930)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 26934n },
        { type: 'uint128', value: 26930n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(26930n);
  });

  it('test operator "or" overload (euint16, euint128) => euint128 test 1 (35626, 340282366920938463463367367548823798633)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 35626n },
        { type: 'uint128', value: 340282366920938463463367367548823798633n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(340282366920938463463367367548823833451n);
  });

  it('test operator "or" overload (euint16, euint128) => euint128 test 2 (35622, 35626)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 35622n },
        { type: 'uint128', value: 35626n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(35630n);
  });

  it('test operator "or" overload (euint16, euint128) => euint128 test 3 (35626, 35626)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 35626n },
        { type: 'uint128', value: 35626n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(35626n);
  });

  it('test operator "or" overload (euint16, euint128) => euint128 test 4 (35626, 35622)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 35626n },
        { type: 'uint128', value: 35622n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(35630n);
  });

  it('test operator "xor" overload (euint16, euint128) => euint128 test 1 (51696, 340282366920938463463365858706383788715)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51696n },
        { type: 'uint128', value: 340282366920938463463365858706383788715n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(340282366920938463463365858706383803227n);
  });

  it('test operator "xor" overload (euint16, euint128) => euint128 test 2 (51692, 51696)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51692n },
        { type: 'uint128', value: 51696n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(28n);
  });

  it('test operator "xor" overload (euint16, euint128) => euint128 test 3 (51696, 51696)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51696n },
        { type: 'uint128', value: 51696n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint16, euint128) => euint128 test 4 (51696, 51692)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 51696n },
        { type: 'uint128', value: 51692n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(28n);
  });

  it('test operator "eq" overload (euint16, euint128) => ebool test 1 (201, 340282366920938463463371348786025383095)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 201n },
        { type: 'uint128', value: 340282366920938463463371348786025383095n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint128) => ebool test 2 (197, 201)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 197n },
        { type: 'uint128', value: 201n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint128) => ebool test 3 (201, 201)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 201n },
        { type: 'uint128', value: 201n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint16, euint128) => ebool test 4 (201, 197)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 201n },
        { type: 'uint128', value: 197n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint128) => ebool test 1 (32481, 340282366920938463463368312324551912537)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 32481n },
        { type: 'uint128', value: 340282366920938463463368312324551912537n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint128) => ebool test 2 (32477, 32481)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 32477n },
        { type: 'uint128', value: 32481n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint128) => ebool test 3 (32481, 32481)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 32481n },
        { type: 'uint128', value: 32481n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint128) => ebool test 4 (32481, 32477)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 32481n },
        { type: 'uint128', value: 32477n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint128) => ebool test 1 (37196, 340282366920938463463371691844692065385)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37196n },
        { type: 'uint128', value: 340282366920938463463371691844692065385n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint128) => ebool test 2 (37192, 37196)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37192n },
        { type: 'uint128', value: 37196n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint16, euint128) => ebool test 3 (37196, 37196)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37196n },
        { type: 'uint128', value: 37196n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint16, euint128) => ebool test 4 (37196, 37192)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 37196n },
        { type: 'uint128', value: 37192n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ge_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint16, euint128) => ebool test 1 (3789, 340282366920938463463373501551957981423)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 3789n },
        { type: 'uint128', value: 340282366920938463463373501551957981423n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint128) => ebool test 2 (3785, 3789)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 3785n },
        { type: 'uint128', value: 3789n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint128) => ebool test 3 (3789, 3789)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 3789n },
        { type: 'uint128', value: 3789n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint16, euint128) => ebool test 4 (3789, 3785)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 3789n },
        { type: 'uint128', value: 3785n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.gt_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint128) => ebool test 1 (60496, 340282366920938463463373629795867414229)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 60496n },
        { type: 'uint128', value: 340282366920938463463373629795867414229n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint128) => ebool test 2 (60492, 60496)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 60492n },
        { type: 'uint128', value: 60496n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint128) => ebool test 3 (60496, 60496)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 60496n },
        { type: 'uint128', value: 60496n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint16, euint128) => ebool test 4 (60496, 60492)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 60496n },
        { type: 'uint128', value: 60492n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.le_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint128) => ebool test 1 (47407, 340282366920938463463371089031505239981)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 47407n },
        { type: 'uint128', value: 340282366920938463463371089031505239981n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, euint128) => ebool test 2 (47403, 47407)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 47403n },
        { type: 'uint128', value: 47407n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint16, euint128) => ebool test 3 (47407, 47407)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 47407n },
        { type: 'uint128', value: 47407n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint16, euint128) => ebool test 4 (47407, 47403)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 47407n },
        { type: 'uint128', value: 47403n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.lt_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint16, euint128) => euint128 test 1 (23312, 340282366920938463463367062133032109037)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 23312n },
        { type: 'uint128', value: 340282366920938463463367062133032109037n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(23312n);
  });

  it('test operator "min" overload (euint16, euint128) => euint128 test 2 (23308, 23312)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 23308n },
        { type: 'uint128', value: 23312n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(23308n);
  });

  it('test operator "min" overload (euint16, euint128) => euint128 test 3 (23312, 23312)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 23312n },
        { type: 'uint128', value: 23312n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(23312n);
  });

  it('test operator "min" overload (euint16, euint128) => euint128 test 4 (23312, 23308)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 23312n },
        { type: 'uint128', value: 23308n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.min_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(23308n);
  });

  it('test operator "max" overload (euint16, euint128) => euint128 test 1 (22856, 340282366920938463463371547066021869219)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22856n },
        { type: 'uint128', value: 340282366920938463463371547066021869219n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(340282366920938463463371547066021869219n);
  });

  it('test operator "max" overload (euint16, euint128) => euint128 test 2 (22852, 22856)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22852n },
        { type: 'uint128', value: 22856n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(22856n);
  });

  it('test operator "max" overload (euint16, euint128) => euint128 test 3 (22856, 22856)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22856n },
        { type: 'uint128', value: 22856n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(22856n);
  });

  it('test operator "max" overload (euint16, euint128) => euint128 test 4 (22856, 22852)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22856n },
        { type: 'uint128', value: 22852n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.max_euint16_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract2.resEuint128() });
    expect(res).to.equal(22856n);
  });

  it('test operator "and" overload (euint16, euint256) => euint256 test 1 (18525, 115792089237316195423570985008687907853269984665640564039457578381450541511597)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18525n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457578381450541511597n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(13n);
  });

  it('test operator "and" overload (euint16, euint256) => euint256 test 2 (18521, 18525)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18521n },
        { type: 'uint256', value: 18525n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(18521n);
  });

  it('test operator "and" overload (euint16, euint256) => euint256 test 3 (18525, 18525)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18525n },
        { type: 'uint256', value: 18525n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(18525n);
  });

  it('test operator "and" overload (euint16, euint256) => euint256 test 4 (18525, 18521)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 18525n },
        { type: 'uint256', value: 18521n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(18521n);
  });

  it('test operator "or" overload (euint16, euint256) => euint256 test 1 (45787, 115792089237316195423570985008687907853269984665640564039457582122953227843443)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 45787n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457582122953227843443n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457582122953227876347n);
  });

  it('test operator "or" overload (euint16, euint256) => euint256 test 2 (45783, 45787)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 45783n },
        { type: 'uint256', value: 45787n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(45791n);
  });

  it('test operator "or" overload (euint16, euint256) => euint256 test 3 (45787, 45787)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 45787n },
        { type: 'uint256', value: 45787n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(45787n);
  });

  it('test operator "or" overload (euint16, euint256) => euint256 test 4 (45787, 45783)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 45787n },
        { type: 'uint256', value: 45783n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(45791n);
  });

  it('test operator "xor" overload (euint16, euint256) => euint256 test 1 (57659, 115792089237316195423570985008687907853269984665640564039457575065063120537073)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 57659n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575065063120537073n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575065063120528586n);
  });

  it('test operator "xor" overload (euint16, euint256) => euint256 test 2 (57655, 57659)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 57655n },
        { type: 'uint256', value: 57659n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(12n);
  });

  it('test operator "xor" overload (euint16, euint256) => euint256 test 3 (57659, 57659)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 57659n },
        { type: 'uint256', value: 57659n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint16, euint256) => euint256 test 4 (57659, 57655)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 57659n },
        { type: 'uint256', value: 57655n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract2.resEuint256() });
    expect(res).to.equal(12n);
  });

  it('test operator "eq" overload (euint16, euint256) => ebool test 1 (49525, 115792089237316195423570985008687907853269984665640564039457581621960944525773)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 49525n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457581621960944525773n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint256) => ebool test 2 (49521, 49525)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 49521n },
        { type: 'uint256', value: 49525n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint16, euint256) => ebool test 3 (49525, 49525)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 49525n },
        { type: 'uint256', value: 49525n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint16, euint256) => ebool test 4 (49525, 49521)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 49525n },
        { type: 'uint256', value: 49521n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.eq_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint256) => ebool test 1 (53899, 115792089237316195423570985008687907853269984665640564039457583238318790175429)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 53899n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583238318790175429n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint256) => ebool test 2 (53895, 53899)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 53895n },
        { type: 'uint256', value: 53899n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint16, euint256) => ebool test 3 (53899, 53899)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 53899n },
        { type: 'uint256', value: 53899n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint16, euint256) => ebool test 4 (53899, 53895)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 53899n },
        { type: 'uint256', value: 53895n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.ne_euint16_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract2.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "add" overload (euint32, euint8) => euint32 test 1 (154, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 154n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(156);
  });

  it('test operator "add" overload (euint32, euint8) => euint32 test 2 (72, 74)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 72n },
        { type: 'uint8', value: 74n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(146);
  });

  it('test operator "add" overload (euint32, euint8) => euint32 test 3 (74, 74)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 74n },
        { type: 'uint8', value: 74n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(148);
  });

  it('test operator "add" overload (euint32, euint8) => euint32 test 4 (74, 72)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 74n },
        { type: 'uint8', value: 72n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.add_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(146);
  });

  it('test operator "sub" overload (euint32, euint8) => euint32 test 1 (175, 175)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 175n },
        { type: 'uint8', value: 175n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint32, euint8) => euint32 test 2 (175, 171)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 175n },
        { type: 'uint8', value: 171n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.sub_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint32, euint8) => euint32 test 1 (93, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 93n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(186);
  });

  it('test operator "mul" overload (euint32, euint8) => euint32 test 2 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(81);
  });

  it('test operator "mul" overload (euint32, euint8) => euint32 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(81);
  });

  it('test operator "mul" overload (euint32, euint8) => euint32 test 4 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.mul_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(81);
  });

  it('test operator "and" overload (euint32, euint8) => euint32 test 1 (3355410399, 50)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3355410399n },
        { type: 'uint8', value: 50n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(18);
  });

  it('test operator "and" overload (euint32, euint8) => euint32 test 2 (46, 50)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 46n },
        { type: 'uint8', value: 50n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(34);
  });

  it('test operator "and" overload (euint32, euint8) => euint32 test 3 (50, 50)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 50n },
        { type: 'uint8', value: 50n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(50);
  });

  it('test operator "and" overload (euint32, euint8) => euint32 test 4 (50, 46)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 50n },
        { type: 'uint8', value: 46n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.and_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(34);
  });

  it('test operator "or" overload (euint32, euint8) => euint32 test 1 (1238476899, 187)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1238476899n },
        { type: 'uint8', value: 187n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(1238477051);
  });

  it('test operator "or" overload (euint32, euint8) => euint32 test 2 (183, 187)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 183n },
        { type: 'uint8', value: 187n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(191);
  });

  it('test operator "or" overload (euint32, euint8) => euint32 test 3 (187, 187)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 187n },
        { type: 'uint8', value: 187n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(187);
  });

  it('test operator "or" overload (euint32, euint8) => euint32 test 4 (187, 183)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 187n },
        { type: 'uint8', value: 183n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.or_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(191);
  });

  it('test operator "xor" overload (euint32, euint8) => euint32 test 1 (1557932409, 52)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1557932409n },
        { type: 'uint8', value: 52n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(1557932365);
  });

  it('test operator "xor" overload (euint32, euint8) => euint32 test 2 (48, 52)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 48n },
        { type: 'uint8', value: 52n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });

  it('test operator "xor" overload (euint32, euint8) => euint32 test 3 (52, 52)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 52n },
        { type: 'uint8', value: 52n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "xor" overload (euint32, euint8) => euint32 test 4 (52, 48)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 52n },
        { type: 'uint8', value: 48n },
      ],
      contractAddress: this.contract2Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract2.xor_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract2.resEuint32() });
    expect(res).to.equal(4);
  });
});
