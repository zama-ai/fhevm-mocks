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

describe('FHEVM operations 12', function () {
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

  it('test operator "rotr" overload (euint8, uint8) => euint8 test 1 (226, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 226n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint8_uint8(encryptedAmount.externalEuint8, 10n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract7.resEuint8() });
    expect(res).to.equal(184);
  });

  it('test operator "rotr" overload (euint8, uint8) => euint8 test 2 (6, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 6n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint8_uint8(encryptedAmount.externalEuint8, 10n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract7.resEuint8() });
    expect(res).to.equal(129);
  });

  it('test operator "rotr" overload (euint8, uint8) => euint8 test 3 (10, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 10n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint8_uint8(encryptedAmount.externalEuint8, 10n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract7.resEuint8() });
    expect(res).to.equal(130);
  });

  it('test operator "rotr" overload (euint8, uint8) => euint8 test 4 (10, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 10n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint8_uint8(encryptedAmount.externalEuint8, 6n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract7.resEuint8() });
    expect(res).to.equal(40);
  });

  it('test operator "shl" overload (euint16, euint8) => euint16 test 1 (29822, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 29822n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(16128);
  });

  it('test operator "shl" overload (euint16, euint8) => euint16 test 2 (3, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 3n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(384);
  });

  it('test operator "shl" overload (euint16, euint8) => euint16 test 3 (7, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 7n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(896);
  });

  it('test operator "shl" overload (euint16, euint8) => euint16 test 4 (7, 3)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 7n },
        { type: 'uint8', value: 3n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(56);
  });

  it('test operator "shl" overload (euint16, uint8) => euint16 test 1 (29822, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 29822n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint16_uint8(encryptedAmount.externalEuint16, 7n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(16128);
  });

  it('test operator "shl" overload (euint16, uint8) => euint16 test 2 (3, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 3n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint16_uint8(encryptedAmount.externalEuint16, 7n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(384);
  });

  it('test operator "shl" overload (euint16, uint8) => euint16 test 3 (7, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 7n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint16_uint8(encryptedAmount.externalEuint16, 7n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(896);
  });

  it('test operator "shl" overload (euint16, uint8) => euint16 test 4 (7, 3)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 7n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint16_uint8(encryptedAmount.externalEuint16, 3n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(56);
  });

  it('test operator "shr" overload (euint16, euint8) => euint16 test 1 (54968, 6)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 54968n },
        { type: 'uint8', value: 6n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(858);
  });

  it('test operator "shr" overload (euint16, euint8) => euint16 test 2 (2, 6)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 2n },
        { type: 'uint8', value: 6n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "shr" overload (euint16, euint8) => euint16 test 3 (6, 6)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 6n },
        { type: 'uint8', value: 6n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "shr" overload (euint16, euint8) => euint16 test 4 (6, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 6n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "shr" overload (euint16, uint8) => euint16 test 1 (54968, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 54968n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint16_uint8(encryptedAmount.externalEuint16, 6n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(858);
  });

  it('test operator "shr" overload (euint16, uint8) => euint16 test 2 (2, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 2n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint16_uint8(encryptedAmount.externalEuint16, 6n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "shr" overload (euint16, uint8) => euint16 test 3 (6, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 6n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint16_uint8(encryptedAmount.externalEuint16, 6n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(0);
  });

  it('test operator "shr" overload (euint16, uint8) => euint16 test 4 (6, 2)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 6n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint16_uint8(encryptedAmount.externalEuint16, 2n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(1);
  });

  it('test operator "rotl" overload (euint16, euint8) => euint16 test 1 (40525, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 40525n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(39740);
  });

  it('test operator "rotl" overload (euint16, euint8) => euint16 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 5n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(2560);
  });

  it('test operator "rotl" overload (euint16, euint8) => euint16 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(4608);
  });

  it('test operator "rotl" overload (euint16, euint8) => euint16 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 9n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(288);
  });

  it('test operator "rotl" overload (euint16, uint8) => euint16 test 1 (40525, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 40525n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint16_uint8(encryptedAmount.externalEuint16, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(39740);
  });

  it('test operator "rotl" overload (euint16, uint8) => euint16 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint16_uint8(encryptedAmount.externalEuint16, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(2560);
  });

  it('test operator "rotl" overload (euint16, uint8) => euint16 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint16_uint8(encryptedAmount.externalEuint16, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(4608);
  });

  it('test operator "rotl" overload (euint16, uint8) => euint16 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint16_uint8(encryptedAmount.externalEuint16, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(288);
  });

  it('test operator "rotr" overload (euint16, euint8) => euint16 test 1 (22963, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 22963n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(45913);
  });

  it('test operator "rotr" overload (euint16, euint8) => euint16 test 2 (4, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 4n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(1024);
  });

  it('test operator "rotr" overload (euint16, euint8) => euint16 test 3 (8, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 8n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(2048);
  });

  it('test operator "rotr" overload (euint16, euint8) => euint16 test 4 (8, 4)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint16', value: 8n },
        { type: 'uint8', value: 4n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint16_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(32768);
  });

  it('test operator "rotr" overload (euint16, uint8) => euint16 test 1 (22963, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 22963n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint16_uint8(encryptedAmount.externalEuint16, 8n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(45913);
  });

  it('test operator "rotr" overload (euint16, uint8) => euint16 test 2 (4, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 4n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint16_uint8(encryptedAmount.externalEuint16, 8n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(1024);
  });

  it('test operator "rotr" overload (euint16, uint8) => euint16 test 3 (8, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 8n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint16_uint8(encryptedAmount.externalEuint16, 8n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(2048);
  });

  it('test operator "rotr" overload (euint16, uint8) => euint16 test 4 (8, 4)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 8n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint16_uint8(encryptedAmount.externalEuint16, 4n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(32768);
  });

  it('test operator "shl" overload (euint32, euint8) => euint32 test 1 (4215468776, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4215468776n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(2246430720);
  });

  it('test operator "shl" overload (euint32, euint8) => euint32 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 5n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(2560);
  });

  it('test operator "shl" overload (euint32, euint8) => euint32 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(4608);
  });

  it('test operator "shl" overload (euint32, euint8) => euint32 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 9n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(288);
  });

  it('test operator "shl" overload (euint32, uint8) => euint32 test 1 (4215468776, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 4215468776n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint32_uint8(encryptedAmount.externalEuint32, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(2246430720);
  });

  it('test operator "shl" overload (euint32, uint8) => euint32 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint32_uint8(encryptedAmount.externalEuint32, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(2560);
  });

  it('test operator "shl" overload (euint32, uint8) => euint32 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint32_uint8(encryptedAmount.externalEuint32, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(4608);
  });

  it('test operator "shl" overload (euint32, uint8) => euint32 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint32_uint8(encryptedAmount.externalEuint32, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(288);
  });

  it('test operator "shr" overload (euint32, euint8) => euint32 test 1 (553385694, 6)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 553385694n },
        { type: 'uint8', value: 6n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(8646651);
  });

  it('test operator "shr" overload (euint32, euint8) => euint32 test 2 (2, 6)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2n },
        { type: 'uint8', value: 6n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "shr" overload (euint32, euint8) => euint32 test 3 (6, 6)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 6n },
        { type: 'uint8', value: 6n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "shr" overload (euint32, euint8) => euint32 test 4 (6, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 6n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(1);
  });

  it('test operator "shr" overload (euint32, uint8) => euint32 test 1 (553385694, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 553385694n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint32_uint8(encryptedAmount.externalEuint32, 6n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(8646651);
  });

  it('test operator "shr" overload (euint32, uint8) => euint32 test 2 (2, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 2n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint32_uint8(encryptedAmount.externalEuint32, 6n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "shr" overload (euint32, uint8) => euint32 test 3 (6, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 6n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint32_uint8(encryptedAmount.externalEuint32, 6n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(0);
  });

  it('test operator "shr" overload (euint32, uint8) => euint32 test 4 (6, 2)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 6n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint32_uint8(encryptedAmount.externalEuint32, 2n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(1);
  });

  it('test operator "rotl" overload (euint32, euint8) => euint32 test 1 (964043969, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 964043969n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(3964240498);
  });

  it('test operator "rotl" overload (euint32, euint8) => euint32 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 5n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(2560);
  });

  it('test operator "rotl" overload (euint32, euint8) => euint32 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(4608);
  });

  it('test operator "rotl" overload (euint32, euint8) => euint32 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 9n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(288);
  });

  it('test operator "rotl" overload (euint32, uint8) => euint32 test 1 (964043969, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 964043969n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint32_uint8(encryptedAmount.externalEuint32, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(3964240498);
  });

  it('test operator "rotl" overload (euint32, uint8) => euint32 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint32_uint8(encryptedAmount.externalEuint32, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(2560);
  });

  it('test operator "rotl" overload (euint32, uint8) => euint32 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint32_uint8(encryptedAmount.externalEuint32, 9n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(4608);
  });

  it('test operator "rotl" overload (euint32, uint8) => euint32 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint32_uint8(encryptedAmount.externalEuint32, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(288);
  });

  it('test operator "rotr" overload (euint32, euint8) => euint32 test 1 (1271260918, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1271260918n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(3737745596);
  });

  it('test operator "rotr" overload (euint32, euint8) => euint32 test 2 (7, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 7n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(14680064);
  });

  it('test operator "rotr" overload (euint32, euint8) => euint32 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 11n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(23068672);
  });

  it('test operator "rotr" overload (euint32, euint8) => euint32 test 4 (11, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 11n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint32_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(369098752);
  });

  it('test operator "rotr" overload (euint32, uint8) => euint32 test 1 (1271260918, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1271260918n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint32_uint8(
      encryptedAmount.externalEuint32,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(3737745596);
  });

  it('test operator "rotr" overload (euint32, uint8) => euint32 test 2 (7, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 7n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint32_uint8(
      encryptedAmount.externalEuint32,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(14680064);
  });

  it('test operator "rotr" overload (euint32, uint8) => euint32 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 11n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint32_uint8(
      encryptedAmount.externalEuint32,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(23068672);
  });

  it('test operator "rotr" overload (euint32, uint8) => euint32 test 4 (11, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 11n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint32_uint8(encryptedAmount.externalEuint32, 7n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(369098752);
  });

  it('test operator "shl" overload (euint64, euint8) => euint64 test 1 (18439553599879397381, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18439553599879397381n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(18216648911144616096n);
  });

  it('test operator "shl" overload (euint64, euint8) => euint64 test 2 (1, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(32n);
  });

  it('test operator "shl" overload (euint64, euint8) => euint64 test 3 (5, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 5n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(160n);
  });

  it('test operator "shl" overload (euint64, euint8) => euint64 test 4 (5, 1)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 5n },
        { type: 'uint8', value: 1n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(10n);
  });

  it('test operator "shl" overload (euint64, uint8) => euint64 test 1 (18439553599879397381, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18439553599879397381n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint64_uint8(encryptedAmount.externalEuint64, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(18216648911144616096n);
  });

  it('test operator "shl" overload (euint64, uint8) => euint64 test 2 (1, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 1n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint64_uint8(encryptedAmount.externalEuint64, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(32n);
  });

  it('test operator "shl" overload (euint64, uint8) => euint64 test 3 (5, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint64_uint8(encryptedAmount.externalEuint64, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(160n);
  });

  it('test operator "shl" overload (euint64, uint8) => euint64 test 4 (5, 1)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint64_uint8(encryptedAmount.externalEuint64, 1n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(10n);
  });

  it('test operator "shr" overload (euint64, euint8) => euint64 test 1 (18440734008878900693, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18440734008878900693n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(576272937777465646n);
  });

  it('test operator "shr" overload (euint64, euint8) => euint64 test 2 (1, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint64, euint8) => euint64 test 3 (5, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 5n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint64, euint8) => euint64 test 4 (5, 1)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 5n },
        { type: 'uint8', value: 1n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(2n);
  });

  it('test operator "shr" overload (euint64, uint8) => euint64 test 1 (18440734008878900693, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18440734008878900693n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint64_uint8(encryptedAmount.externalEuint64, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(576272937777465646n);
  });

  it('test operator "shr" overload (euint64, uint8) => euint64 test 2 (1, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 1n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint64_uint8(encryptedAmount.externalEuint64, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint64, uint8) => euint64 test 3 (5, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint64_uint8(encryptedAmount.externalEuint64, 5n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint64, uint8) => euint64 test 4 (5, 1)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint64_uint8(encryptedAmount.externalEuint64, 1n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(2n);
  });

  it('test operator "rotl" overload (euint64, euint8) => euint64 test 1 (18445824036689295007, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18445824036689295007n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(18211214596523859967n);
  });

  it('test operator "rotl" overload (euint64, euint8) => euint64 test 2 (4, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 4n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(1024n);
  });

  it('test operator "rotl" overload (euint64, euint8) => euint64 test 3 (8, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 8n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(2048n);
  });

  it('test operator "rotl" overload (euint64, euint8) => euint64 test 4 (8, 4)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 8n },
        { type: 'uint8', value: 4n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(128n);
  });

  it('test operator "rotl" overload (euint64, uint8) => euint64 test 1 (18445824036689295007, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18445824036689295007n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint64_uint8(encryptedAmount.externalEuint64, 8n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(18211214596523859967n);
  });

  it('test operator "rotl" overload (euint64, uint8) => euint64 test 2 (4, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 4n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint64_uint8(encryptedAmount.externalEuint64, 8n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(1024n);
  });

  it('test operator "rotl" overload (euint64, uint8) => euint64 test 3 (8, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 8n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint64_uint8(encryptedAmount.externalEuint64, 8n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(2048n);
  });

  it('test operator "rotl" overload (euint64, uint8) => euint64 test 4 (8, 4)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 8n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint64_uint8(encryptedAmount.externalEuint64, 4n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(128n);
  });

  it('test operator "rotr" overload (euint64, euint8) => euint64 test 1 (18443032178182195551, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18443032178182195551n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(6341064650439682434n);
  });

  it('test operator "rotr" overload (euint64, euint8) => euint64 test 2 (6, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 6n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(108086391056891904n);
  });

  it('test operator "rotr" overload (euint64, euint8) => euint64 test 3 (10, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 10n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(180143985094819840n);
  });

  it('test operator "rotr" overload (euint64, euint8) => euint64 test 4 (10, 6)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 10n },
        { type: 'uint8', value: 6n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(2882303761517117440n);
  });

  it('test operator "rotr" overload (euint64, uint8) => euint64 test 1 (18443032178182195551, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18443032178182195551n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint64_uint8(
      encryptedAmount.externalEuint64,
      10n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(6341064650439682434n);
  });

  it('test operator "rotr" overload (euint64, uint8) => euint64 test 2 (6, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 6n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint64_uint8(
      encryptedAmount.externalEuint64,
      10n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(108086391056891904n);
  });

  it('test operator "rotr" overload (euint64, uint8) => euint64 test 3 (10, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 10n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint64_uint8(
      encryptedAmount.externalEuint64,
      10n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(180143985094819840n);
  });

  it('test operator "rotr" overload (euint64, uint8) => euint64 test 4 (10, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 10n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint64_uint8(encryptedAmount.externalEuint64, 6n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(2882303761517117440n);
  });

  it('test operator "shl" overload (euint128, euint8) => euint128 test 1 (340282366920938463463374258789024564311, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463374258789024564311n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(340282366920938463462660587092778858496n);
  });

  it('test operator "shl" overload (euint128, euint8) => euint128 test 2 (7, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 7n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(14336n);
  });

  it('test operator "shl" overload (euint128, euint8) => euint128 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 11n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(22528n);
  });

  it('test operator "shl" overload (euint128, euint8) => euint128 test 4 (11, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 11n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(1408n);
  });

  it('test operator "shl" overload (euint128, uint8) => euint128 test 1 (340282366920938463463374258789024564311, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 340282366920938463463374258789024564311n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint128_uint8(
      encryptedAmount.externalEuint128,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(340282366920938463462660587092778858496n);
  });

  it('test operator "shl" overload (euint128, uint8) => euint128 test 2 (7, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 7n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint128_uint8(
      encryptedAmount.externalEuint128,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(14336n);
  });

  it('test operator "shl" overload (euint128, uint8) => euint128 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 11n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint128_uint8(
      encryptedAmount.externalEuint128,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(22528n);
  });

  it('test operator "shl" overload (euint128, uint8) => euint128 test 4 (11, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 11n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint128_uint8(
      encryptedAmount.externalEuint128,
      7n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(1408n);
  });

  it('test operator "shr" overload (euint128, euint8) => euint128 test 1 (340282366920938463463366167854780163447, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366167854780163447n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(2658455991569831745807548186365470026n);
  });

  it('test operator "shr" overload (euint128, euint8) => euint128 test 2 (3, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 3n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint128, euint8) => euint128 test 3 (7, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 7n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint128, euint8) => euint128 test 4 (7, 3)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 7n },
        { type: 'uint8', value: 3n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint128, uint8) => euint128 test 1 (340282366920938463463366167854780163447, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 340282366920938463463366167854780163447n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint128_uint8(
      encryptedAmount.externalEuint128,
      7n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(2658455991569831745807548186365470026n);
  });

  it('test operator "shr" overload (euint128, uint8) => euint128 test 2 (3, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 3n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint128_uint8(
      encryptedAmount.externalEuint128,
      7n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint128, uint8) => euint128 test 3 (7, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 7n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint128_uint8(
      encryptedAmount.externalEuint128,
      7n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint128, uint8) => euint128 test 4 (7, 3)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 7n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint128_uint8(
      encryptedAmount.externalEuint128,
      3n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "rotl" overload (euint128, euint8) => euint128 test 1 (340282366920938463463368416343967945667, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368416343967945667n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(340282366920938463457034933524296044543n);
  });

  it('test operator "rotl" overload (euint128, euint8) => euint128 test 2 (6, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 6n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(6144n);
  });

  it('test operator "rotl" overload (euint128, euint8) => euint128 test 3 (10, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 10n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(10240n);
  });

  it('test operator "rotl" overload (euint128, euint8) => euint128 test 4 (10, 6)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 10n },
        { type: 'uint8', value: 6n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(640n);
  });

  it('test operator "rotl" overload (euint128, uint8) => euint128 test 1 (340282366920938463463368416343967945667, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 340282366920938463463368416343967945667n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint128_uint8(
      encryptedAmount.externalEuint128,
      10n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(340282366920938463457034933524296044543n);
  });

  it('test operator "rotl" overload (euint128, uint8) => euint128 test 2 (6, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 6n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint128_uint8(
      encryptedAmount.externalEuint128,
      10n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(6144n);
  });

  it('test operator "rotl" overload (euint128, uint8) => euint128 test 3 (10, 10)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 10n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint128_uint8(
      encryptedAmount.externalEuint128,
      10n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(10240n);
  });

  it('test operator "rotl" overload (euint128, uint8) => euint128 test 4 (10, 6)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 10n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint128_uint8(
      encryptedAmount.externalEuint128,
      6n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(640n);
  });

  it('test operator "rotr" overload (euint128, euint8) => euint128 test 1 (340282366920938463463368300741336936539, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368300741336936539n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(122288975612212260307150224910282203824n);
  });

  it('test operator "rotr" overload (euint128, euint8) => euint128 test 2 (4, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 4n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(5316911983139663491615228241121378304n);
  });

  it('test operator "rotr" overload (euint128, euint8) => euint128 test 3 (8, 8)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 8n },
        { type: 'uint8', value: 8n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(10633823966279326983230456482242756608n);
  });

  it('test operator "rotr" overload (euint128, euint8) => euint128 test 4 (8, 4)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 8n },
        { type: 'uint8', value: 4n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint128_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(170141183460469231731687303715884105728n);
  });

  it('test operator "rotr" overload (euint128, uint8) => euint128 test 1 (340282366920938463463368300741336936539, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 340282366920938463463368300741336936539n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint128_uint8(
      encryptedAmount.externalEuint128,
      8n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(122288975612212260307150224910282203824n);
  });

  it('test operator "rotr" overload (euint128, uint8) => euint128 test 2 (4, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 4n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint128_uint8(
      encryptedAmount.externalEuint128,
      8n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(5316911983139663491615228241121378304n);
  });

  it('test operator "rotr" overload (euint128, uint8) => euint128 test 3 (8, 8)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 8n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint128_uint8(
      encryptedAmount.externalEuint128,
      8n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(10633823966279326983230456482242756608n);
  });

  it('test operator "rotr" overload (euint128, uint8) => euint128 test 4 (8, 4)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 8n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint128_uint8(
      encryptedAmount.externalEuint128,
      4n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(170141183460469231731687303715884105728n);
  });

  it('test operator "shl" overload (euint256, euint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457580500903050044891, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580500903050044891n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039455788418752376976896n);
  });

  it('test operator "shl" overload (euint256, euint8) => euint256 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 5n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(2560n);
  });

  it('test operator "shl" overload (euint256, euint8) => euint256 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(4608n);
  });

  it('test operator "shl" overload (euint256, euint8) => euint256 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 9n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(288n);
  });

  it('test operator "shl" overload (euint256, uint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457580500903050044891, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 115792089237316195423570985008687907853269984665640564039457580500903050044891n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint256_uint8(
      encryptedAmount.externalEuint256,
      9n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039455788418752376976896n);
  });

  it('test operator "shl" overload (euint256, uint8) => euint256 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint256_uint8(
      encryptedAmount.externalEuint256,
      9n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(2560n);
  });

  it('test operator "shl" overload (euint256, uint8) => euint256 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint256_uint8(
      encryptedAmount.externalEuint256,
      9n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(4608n);
  });

  it('test operator "shl" overload (euint256, uint8) => euint256 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shl_euint256_uint8(
      encryptedAmount.externalEuint256,
      5n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(288n);
  });

  it('test operator "shr" overload (euint256, euint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457583417412523292639, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583417412523292639n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(226156424291633194186662080095093570025917938800079226639565592612133834555n);
  });

  it('test operator "shr" overload (euint256, euint8) => euint256 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 5n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint256, euint8) => euint256 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 9n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint256, euint8) => euint256 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 9n },
        { type: 'uint8', value: 5n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint256, uint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457583417412523292639, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 115792089237316195423570985008687907853269984665640564039457583417412523292639n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint256_uint8(
      encryptedAmount.externalEuint256,
      9n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(226156424291633194186662080095093570025917938800079226639565592612133834555n);
  });

  it('test operator "shr" overload (euint256, uint8) => euint256 test 2 (5, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint256_uint8(
      encryptedAmount.externalEuint256,
      9n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint256, uint8) => euint256 test 3 (9, 9)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint256_uint8(
      encryptedAmount.externalEuint256,
      9n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "shr" overload (euint256, uint8) => euint256 test 4 (9, 5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 9n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.shr_euint256_uint8(
      encryptedAmount.externalEuint256,
      5n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "rotl" overload (euint256, euint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457579586918477272697, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579586918477272697n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039448529810865081536511n);
  });

  it('test operator "rotl" overload (euint256, euint8) => euint256 test 2 (7, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 7n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(14336n);
  });

  it('test operator "rotl" overload (euint256, euint8) => euint256 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 11n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(22528n);
  });

  it('test operator "rotl" overload (euint256, euint8) => euint256 test 4 (11, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 11n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(1408n);
  });

  it('test operator "rotl" overload (euint256, uint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457579586918477272697, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 115792089237316195423570985008687907853269984665640564039457579586918477272697n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint256_uint8(
      encryptedAmount.externalEuint256,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039448529810865081536511n);
  });

  it('test operator "rotl" overload (euint256, uint8) => euint256 test 2 (7, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 7n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint256_uint8(
      encryptedAmount.externalEuint256,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(14336n);
  });

  it('test operator "rotl" overload (euint256, uint8) => euint256 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 11n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint256_uint8(
      encryptedAmount.externalEuint256,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(22528n);
  });

  it('test operator "rotl" overload (euint256, uint8) => euint256 test 4 (11, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 11n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotl_euint256_uint8(
      encryptedAmount.externalEuint256,
      7n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(1408n);
  });

  it('test operator "rotr" overload (euint256, euint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457583160369374111971, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583160369374111971n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(12890916184623092068639738565420333491477322511604515918455238844217114161317n);
  });

  it('test operator "rotr" overload (euint256, euint8) => euint256 test 2 (7, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 7n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(395773742510358089826658640166413747545356392900138646619239789089546829824n);
  });

  it('test operator "rotr" overload (euint256, euint8) => euint256 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 11n },
        { type: 'uint8', value: 11n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(621930166801991284013320720261507317571274331700217873258805382855002161152n);
  });

  it('test operator "rotr" overload (euint256, euint8) => euint256 test 4 (11, 7)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 11n },
        { type: 'uint8', value: 7n },
      ],
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(9950882668831860544213131524184117081140389307203485972140886125680034578432n);
  });

  it('test operator "rotr" overload (euint256, uint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457583160369374111971, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 115792089237316195423570985008687907853269984665640564039457583160369374111971n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint256_uint8(
      encryptedAmount.externalEuint256,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(12890916184623092068639738565420333491477322511604515918455238844217114161317n);
  });

  it('test operator "rotr" overload (euint256, uint8) => euint256 test 2 (7, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 7n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint256_uint8(
      encryptedAmount.externalEuint256,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(395773742510358089826658640166413747545356392900138646619239789089546829824n);
  });

  it('test operator "rotr" overload (euint256, uint8) => euint256 test 3 (11, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 11n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint256_uint8(
      encryptedAmount.externalEuint256,
      11n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(621930166801991284013320720261507317571274331700217873258805382855002161152n);
  });

  it('test operator "rotr" overload (euint256, uint8) => euint256 test 4 (11, 7)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 11n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.rotr_euint256_uint8(
      encryptedAmount.externalEuint256,
      7n,
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(9950882668831860544213131524184117081140389307203485972140886125680034578432n);
  });

  it('test operator "neg" overload (euint8) => euint8 test 1 (209)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 209n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.neg_euint8(encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract7.resEuint8() });
    expect(res).to.equal(47);
  });

  it('test operator "not" overload (euint8) => euint8 test 1 (5)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 5n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.not_euint8(encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract7.resEuint8() });
    expect(res).to.equal(250);
  });

  it('test operator "neg" overload (euint16) => euint16 test 1 (9149)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 9149n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.neg_euint16(encryptedAmount.externalEuint16, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(56387);
  });

  it('test operator "not" overload (euint16) => euint16 test 1 (31189)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint16({
      value: 31189n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.not_euint16(encryptedAmount.externalEuint16, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint16({ euint16: await this.contract7.resEuint16() });
    expect(res).to.equal(34346);
  });

  it('test operator "neg" overload (euint32) => euint32 test 1 (76635629)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 76635629n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.neg_euint32(encryptedAmount.externalEuint32, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(4218331667);
  });

  it('test operator "not" overload (euint32) => euint32 test 1 (1666976830)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint32({
      value: 1666976830n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.not_euint32(encryptedAmount.externalEuint32, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint32({ euint32: await this.contract7.resEuint32() });
    expect(res).to.equal(2627990465);
  });

  it('test operator "neg" overload (euint64) => euint64 test 1 (18443817374059539241)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18443817374059539241n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.neg_euint64(encryptedAmount.externalEuint64, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(2926699650012375n);
  });

  it('test operator "not" overload (euint64) => euint64 test 1 (18438918812121678031)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint64({
      value: 18438918812121678031n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.not_euint64(encryptedAmount.externalEuint64, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract7.resEuint64() });
    expect(res).to.equal(7825261587873584n);
  });

  it('test operator "neg" overload (euint128) => euint128 test 1 (340282366920938463463373292485062704909)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 340282366920938463463373292485062704909n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.neg_euint128(encryptedAmount.externalEuint128, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(1314946705506547n);
  });

  it('test operator "not" overload (euint128) => euint128 test 1 (340282366920938463463370157040088526121)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint128({
      value: 340282366920938463463370157040088526121n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.not_euint128(encryptedAmount.externalEuint128, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract7.resEuint128() });
    expect(res).to.equal(4450391679685334n);
  });

  it('test operator "neg" overload (euint256) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457576813979567537173)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint256({
      value: 115792089237316195423570985008687907853269984665640564039457576813979567537173n,
      contractAddress: this.contract7Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract7.neg_euint256(encryptedAmount.externalEuint256, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract7.resEuint256() });
    expect(res).to.equal(7193933562102763n);
  });
});
