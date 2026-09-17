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

describe('FHEVM operations 8', function () {
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

  it('test operator "ge" overload (euint128, euint128) => ebool test 1 (340282366920938463463368669803305650403, 340282366920938463463371973198023417895)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368669803305650403n },
        { type: 'uint128', value: 340282366920938463463371973198023417895n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint128, euint128) => ebool test 2 (340282366920938463463368669803305650399, 340282366920938463463368669803305650403)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368669803305650399n },
        { type: 'uint128', value: 340282366920938463463368669803305650403n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint128, euint128) => ebool test 3 (340282366920938463463368669803305650403, 340282366920938463463368669803305650403)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368669803305650403n },
        { type: 'uint128', value: 340282366920938463463368669803305650403n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint128, euint128) => ebool test 4 (340282366920938463463368669803305650403, 340282366920938463463368669803305650399)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368669803305650403n },
        { type: 'uint128', value: 340282366920938463463368669803305650399n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ge_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint128, euint128) => ebool test 1 (340282366920938463463365956072615144479, 340282366920938463463373949580301414449)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463365956072615144479n },
        { type: 'uint128', value: 340282366920938463463373949580301414449n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint128) => ebool test 2 (340282366920938463463365956072615144475, 340282366920938463463365956072615144479)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463365956072615144475n },
        { type: 'uint128', value: 340282366920938463463365956072615144479n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint128) => ebool test 3 (340282366920938463463365956072615144479, 340282366920938463463365956072615144479)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463365956072615144479n },
        { type: 'uint128', value: 340282366920938463463365956072615144479n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint128, euint128) => ebool test 4 (340282366920938463463365956072615144479, 340282366920938463463365956072615144475)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463365956072615144479n },
        { type: 'uint128', value: 340282366920938463463365956072615144475n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.gt_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint128) => ebool test 1 (340282366920938463463366569487674808983, 340282366920938463463373881697001024499)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366569487674808983n },
        { type: 'uint128', value: 340282366920938463463373881697001024499n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint128) => ebool test 2 (340282366920938463463366569487674808979, 340282366920938463463366569487674808983)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366569487674808979n },
        { type: 'uint128', value: 340282366920938463463366569487674808983n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint128) => ebool test 3 (340282366920938463463366569487674808983, 340282366920938463463366569487674808983)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366569487674808983n },
        { type: 'uint128', value: 340282366920938463463366569487674808983n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint128, euint128) => ebool test 4 (340282366920938463463366569487674808983, 340282366920938463463366569487674808979)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366569487674808983n },
        { type: 'uint128', value: 340282366920938463463366569487674808979n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.le_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint128) => ebool test 1 (340282366920938463463373727768301400539, 340282366920938463463366181206754403849)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463373727768301400539n },
        { type: 'uint128', value: 340282366920938463463366181206754403849n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint128) => ebool test 2 (340282366920938463463366181206754403845, 340282366920938463463366181206754403849)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366181206754403845n },
        { type: 'uint128', value: 340282366920938463463366181206754403849n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint128, euint128) => ebool test 3 (340282366920938463463366181206754403849, 340282366920938463463366181206754403849)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366181206754403849n },
        { type: 'uint128', value: 340282366920938463463366181206754403849n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint128, euint128) => ebool test 4 (340282366920938463463366181206754403849, 340282366920938463463366181206754403845)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366181206754403849n },
        { type: 'uint128', value: 340282366920938463463366181206754403845n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.lt_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint128, euint128) => euint128 test 1 (340282366920938463463372005690002957133, 340282366920938463463366530779050469393)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463372005690002957133n },
        { type: 'uint128', value: 340282366920938463463366530779050469393n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463366530779050469393n);
  });

  it('test operator "min" overload (euint128, euint128) => euint128 test 2 (340282366920938463463366530779050469389, 340282366920938463463366530779050469393)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366530779050469389n },
        { type: 'uint128', value: 340282366920938463463366530779050469393n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463366530779050469389n);
  });

  it('test operator "min" overload (euint128, euint128) => euint128 test 3 (340282366920938463463366530779050469393, 340282366920938463463366530779050469393)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366530779050469393n },
        { type: 'uint128', value: 340282366920938463463366530779050469393n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463366530779050469393n);
  });

  it('test operator "min" overload (euint128, euint128) => euint128 test 4 (340282366920938463463366530779050469393, 340282366920938463463366530779050469389)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463366530779050469393n },
        { type: 'uint128', value: 340282366920938463463366530779050469389n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.min_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463366530779050469389n);
  });

  it('test operator "max" overload (euint128, euint128) => euint128 test 1 (340282366920938463463369865492848935785, 340282366920938463463368446594301323721)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369865492848935785n },
        { type: 'uint128', value: 340282366920938463463368446594301323721n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463369865492848935785n);
  });

  it('test operator "max" overload (euint128, euint128) => euint128 test 2 (340282366920938463463368446594301323717, 340282366920938463463368446594301323721)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368446594301323717n },
        { type: 'uint128', value: 340282366920938463463368446594301323721n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463368446594301323721n);
  });

  it('test operator "max" overload (euint128, euint128) => euint128 test 3 (340282366920938463463368446594301323721, 340282366920938463463368446594301323721)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368446594301323721n },
        { type: 'uint128', value: 340282366920938463463368446594301323721n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463368446594301323721n);
  });

  it('test operator "max" overload (euint128, euint128) => euint128 test 4 (340282366920938463463368446594301323721, 340282366920938463463368446594301323717)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368446594301323721n },
        { type: 'uint128', value: 340282366920938463463368446594301323717n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.max_euint128_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract5.resEuint128() });
    expect(res).to.equal(340282366920938463463368446594301323721n);
  });

  it('test operator "and" overload (euint128, euint256) => euint256 test 1 (340282366920938463463373315514134608059, 115792089237316195423570985008687907853269984665640564039457579218022325905031)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463373315514134608059n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579218022325905031n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463368530433752965251n);
  });

  it('test operator "and" overload (euint128, euint256) => euint256 test 2 (340282366920938463463373315514134608055, 340282366920938463463373315514134608059)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463373315514134608055n },
        { type: 'uint256', value: 340282366920938463463373315514134608059n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463373315514134608051n);
  });

  it('test operator "and" overload (euint128, euint256) => euint256 test 3 (340282366920938463463373315514134608059, 340282366920938463463373315514134608059)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463373315514134608059n },
        { type: 'uint256', value: 340282366920938463463373315514134608059n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463373315514134608059n);
  });

  it('test operator "and" overload (euint128, euint256) => euint256 test 4 (340282366920938463463373315514134608059, 340282366920938463463373315514134608055)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463373315514134608059n },
        { type: 'uint256', value: 340282366920938463463373315514134608055n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463373315514134608051n);
  });

  it('test operator "or" overload (euint128, euint256) => euint256 test 1 (340282366920938463463368402794339194643, 115792089237316195423570985008687907853269984665640564039457577584058586233841)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368402794339194643n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457577584058586233841n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457577813177911869427n);
  });

  it('test operator "or" overload (euint128, euint256) => euint256 test 2 (340282366920938463463368402794339194639, 340282366920938463463368402794339194643)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368402794339194639n },
        { type: 'uint256', value: 340282366920938463463368402794339194643n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463368402794339194655n);
  });

  it('test operator "or" overload (euint128, euint256) => euint256 test 3 (340282366920938463463368402794339194643, 340282366920938463463368402794339194643)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368402794339194643n },
        { type: 'uint256', value: 340282366920938463463368402794339194643n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463368402794339194643n);
  });

  it('test operator "or" overload (euint128, euint256) => euint256 test 4 (340282366920938463463368402794339194643, 340282366920938463463368402794339194639)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463368402794339194643n },
        { type: 'uint256', value: 340282366920938463463368402794339194639n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463368402794339194655n);
  });

  it('test operator "xor" overload (euint128, euint256) => euint256 test 1 (340282366920938463463369167831715857957, 115792089237316195423570985008687907853269984665640564039457583417928285062619)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369167831715857957n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583417928285062619n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907852929702298719625575994214268977547461630n);
  });

  it('test operator "xor" overload (euint128, euint256) => euint256 test 2 (340282366920938463463369167831715857953, 340282366920938463463369167831715857957)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369167831715857953n },
        { type: 'uint256', value: 340282366920938463463369167831715857957n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint128, euint256) => euint256 test 3 (340282366920938463463369167831715857957, 340282366920938463463369167831715857957)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369167831715857957n },
        { type: 'uint256', value: 340282366920938463463369167831715857957n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint128, euint256) => euint256 test 4 (340282366920938463463369167831715857957, 340282366920938463463369167831715857953)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463369167831715857957n },
        { type: 'uint256', value: 340282366920938463463369167831715857953n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint128, euint256) => ebool test 1 (340282366920938463463367778796874389851, 115792089237316195423570985008687907853269984665640564039457576419738789559355)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367778796874389851n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457576419738789559355n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint256) => ebool test 2 (340282366920938463463367778796874389847, 340282366920938463463367778796874389851)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367778796874389847n },
        { type: 'uint256', value: 340282366920938463463367778796874389851n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint128, euint256) => ebool test 3 (340282366920938463463367778796874389851, 340282366920938463463367778796874389851)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367778796874389851n },
        { type: 'uint256', value: 340282366920938463463367778796874389851n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint128, euint256) => ebool test 4 (340282366920938463463367778796874389851, 340282366920938463463367778796874389847)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463367778796874389851n },
        { type: 'uint256', value: 340282366920938463463367778796874389847n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint256) => ebool test 1 (340282366920938463463371676711614135533, 115792089237316195423570985008687907853269984665640564039457579527651141372631)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463371676711614135533n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579527651141372631n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint256) => ebool test 2 (340282366920938463463371676711614135529, 340282366920938463463371676711614135533)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463371676711614135529n },
        { type: 'uint256', value: 340282366920938463463371676711614135533n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint128, euint256) => ebool test 3 (340282366920938463463371676711614135533, 340282366920938463463371676711614135533)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463371676711614135533n },
        { type: 'uint256', value: 340282366920938463463371676711614135533n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint128, euint256) => ebool test 4 (340282366920938463463371676711614135533, 340282366920938463463371676711614135529)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint128', value: 340282366920938463463371676711614135533n },
        { type: 'uint256', value: 340282366920938463463371676711614135529n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint128_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "and" overload (euint256, euint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457580855458719896369, 143)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580855458719896369n },
        { type: 'uint8', value: 143n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(1n);
  });

  it('test operator "and" overload (euint256, euint8) => euint256 test 2 (139, 143)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 139n },
        { type: 'uint8', value: 143n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(139n);
  });

  it('test operator "and" overload (euint256, euint8) => euint256 test 3 (143, 143)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 143n },
        { type: 'uint8', value: 143n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(143n);
  });

  it('test operator "and" overload (euint256, euint8) => euint256 test 4 (143, 139)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 143n },
        { type: 'uint8', value: 139n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(139n);
  });

  it('test operator "or" overload (euint256, euint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457577983021397708523, 191)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457577983021397708523n },
        { type: 'uint8', value: 191n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457577983021397708543n);
  });

  it('test operator "or" overload (euint256, euint8) => euint256 test 2 (187, 191)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 187n },
        { type: 'uint8', value: 191n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(191n);
  });

  it('test operator "or" overload (euint256, euint8) => euint256 test 3 (191, 191)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 191n },
        { type: 'uint8', value: 191n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(191n);
  });

  it('test operator "or" overload (euint256, euint8) => euint256 test 4 (191, 187)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 191n },
        { type: 'uint8', value: 187n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(191n);
  });

  it('test operator "xor" overload (euint256, euint8) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457580463827521566707, 166)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580463827521566707n },
        { type: 'uint8', value: 166n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457580463827521566549n);
  });

  it('test operator "xor" overload (euint256, euint8) => euint256 test 2 (162, 166)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 162n },
        { type: 'uint8', value: 166n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint256, euint8) => euint256 test 3 (166, 166)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 166n },
        { type: 'uint8', value: 166n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint256, euint8) => euint256 test 4 (166, 162)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 166n },
        { type: 'uint8', value: 162n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint256, euint8) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457576951243353621835, 213)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457576951243353621835n },
        { type: 'uint8', value: 213n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint8) => ebool test 2 (209, 213)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 209n },
        { type: 'uint8', value: 213n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint8) => ebool test 3 (213, 213)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 213n },
        { type: 'uint8', value: 213n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint256, euint8) => ebool test 4 (213, 209)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 213n },
        { type: 'uint8', value: 209n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint8) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457580889724508141501, 113)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580889724508141501n },
        { type: 'uint8', value: 113n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint8) => ebool test 2 (109, 113)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 109n },
        { type: 'uint8', value: 113n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint8) => ebool test 3 (113, 113)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 113n },
        { type: 'uint8', value: 113n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint8) => ebool test 4 (113, 109)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 113n },
        { type: 'uint8', value: 109n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "and" overload (euint256, euint16) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457581984576515845501, 21221)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457581984576515845501n },
        { type: 'uint16', value: 21221n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(101n);
  });

  it('test operator "and" overload (euint256, euint16) => euint256 test 2 (21217, 21221)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 21217n },
        { type: 'uint16', value: 21221n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(21217n);
  });

  it('test operator "and" overload (euint256, euint16) => euint256 test 3 (21221, 21221)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 21221n },
        { type: 'uint16', value: 21221n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(21221n);
  });

  it('test operator "and" overload (euint256, euint16) => euint256 test 4 (21221, 21217)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 21221n },
        { type: 'uint16', value: 21217n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(21217n);
  });

  it('test operator "or" overload (euint256, euint16) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457579666473680962743, 63343)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579666473680962743n },
        { type: 'uint16', value: 63343n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457579666473681025023n);
  });

  it('test operator "or" overload (euint256, euint16) => euint256 test 2 (63339, 63343)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 63339n },
        { type: 'uint16', value: 63343n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(63343n);
  });

  it('test operator "or" overload (euint256, euint16) => euint256 test 3 (63343, 63343)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 63343n },
        { type: 'uint16', value: 63343n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(63343n);
  });

  it('test operator "or" overload (euint256, euint16) => euint256 test 4 (63343, 63339)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 63343n },
        { type: 'uint16', value: 63339n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(63343n);
  });

  it('test operator "xor" overload (euint256, euint16) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457578986148567022953, 2702)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457578986148567022953n },
        { type: 'uint16', value: 2702n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457578986148567021543n);
  });

  it('test operator "xor" overload (euint256, euint16) => euint256 test 2 (2698, 2702)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2698n },
        { type: 'uint16', value: 2702n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint256, euint16) => euint256 test 3 (2702, 2702)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2702n },
        { type: 'uint16', value: 2702n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint256, euint16) => euint256 test 4 (2702, 2698)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2702n },
        { type: 'uint16', value: 2698n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint256, euint16) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457577942201349304929, 32650)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457577942201349304929n },
        { type: 'uint16', value: 32650n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint16) => ebool test 2 (32646, 32650)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 32646n },
        { type: 'uint16', value: 32650n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint16) => ebool test 3 (32650, 32650)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 32650n },
        { type: 'uint16', value: 32650n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint256, euint16) => ebool test 4 (32650, 32646)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 32650n },
        { type: 'uint16', value: 32646n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint16) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457577174695238465247, 28917)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457577174695238465247n },
        { type: 'uint16', value: 28917n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint16) => ebool test 2 (28913, 28917)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 28913n },
        { type: 'uint16', value: 28917n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint16) => ebool test 3 (28917, 28917)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 28917n },
        { type: 'uint16', value: 28917n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint16) => ebool test 4 (28917, 28913)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 28917n },
        { type: 'uint16', value: 28913n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "and" overload (euint256, euint32) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457580672452414207435, 3358259989)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580672452414207435n },
        { type: 'uint32', value: 3358259989n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(2283860225n);
  });

  it('test operator "and" overload (euint256, euint32) => euint256 test 2 (3358259985, 3358259989)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 3358259985n },
        { type: 'uint32', value: 3358259989n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(3358259985n);
  });

  it('test operator "and" overload (euint256, euint32) => euint256 test 3 (3358259989, 3358259989)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 3358259989n },
        { type: 'uint32', value: 3358259989n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(3358259989n);
  });

  it('test operator "and" overload (euint256, euint32) => euint256 test 4 (3358259989, 3358259985)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 3358259989n },
        { type: 'uint32', value: 3358259985n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(3358259985n);
  });

  it('test operator "or" overload (euint256, euint32) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457583519896941449969, 2432649515)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583519896941449969n },
        { type: 'uint32', value: 2432649515n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457583519897218931707n);
  });

  it('test operator "or" overload (euint256, euint32) => euint256 test 2 (2432649511, 2432649515)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2432649511n },
        { type: 'uint32', value: 2432649515n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(2432649519n);
  });

  it('test operator "or" overload (euint256, euint32) => euint256 test 3 (2432649515, 2432649515)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2432649515n },
        { type: 'uint32', value: 2432649515n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(2432649515n);
  });

  it('test operator "or" overload (euint256, euint32) => euint256 test 4 (2432649515, 2432649511)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2432649515n },
        { type: 'uint32', value: 2432649511n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(2432649519n);
  });

  it('test operator "xor" overload (euint256, euint32) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457583739103489631233, 2928001720)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583739103489631233n },
        { type: 'uint32', value: 2928001720n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457583739101031491257n);
  });

  it('test operator "xor" overload (euint256, euint32) => euint256 test 2 (2928001716, 2928001720)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2928001716n },
        { type: 'uint32', value: 2928001720n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(12n);
  });

  it('test operator "xor" overload (euint256, euint32) => euint256 test 3 (2928001720, 2928001720)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2928001720n },
        { type: 'uint32', value: 2928001720n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint256, euint32) => euint256 test 4 (2928001720, 2928001716)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 2928001720n },
        { type: 'uint32', value: 2928001716n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(12n);
  });

  it('test operator "eq" overload (euint256, euint32) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457580834117559712621, 3161480396)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580834117559712621n },
        { type: 'uint32', value: 3161480396n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint32) => ebool test 2 (3161480392, 3161480396)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 3161480392n },
        { type: 'uint32', value: 3161480396n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint32) => ebool test 3 (3161480396, 3161480396)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 3161480396n },
        { type: 'uint32', value: 3161480396n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint256, euint32) => ebool test 4 (3161480396, 3161480392)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 3161480396n },
        { type: 'uint32', value: 3161480392n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint32) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457575917539434492785, 288156408)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575917539434492785n },
        { type: 'uint32', value: 288156408n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint32) => ebool test 2 (288156404, 288156408)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 288156404n },
        { type: 'uint32', value: 288156408n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint32) => ebool test 3 (288156408, 288156408)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 288156408n },
        { type: 'uint32', value: 288156408n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint32) => ebool test 4 (288156408, 288156404)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 288156408n },
        { type: 'uint32', value: 288156404n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "and" overload (euint256, euint64) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457579888340369206407, 18444043004151788693)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579888340369206407n },
        { type: 'uint64', value: 18444043004151788693n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(18442316633389982853n);
  });

  it('test operator "and" overload (euint256, euint64) => euint256 test 2 (18444043004151788689, 18444043004151788693)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18444043004151788689n },
        { type: 'uint64', value: 18444043004151788693n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(18444043004151788689n);
  });

  it('test operator "and" overload (euint256, euint64) => euint256 test 3 (18444043004151788693, 18444043004151788693)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18444043004151788693n },
        { type: 'uint64', value: 18444043004151788693n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(18444043004151788693n);
  });

  it('test operator "and" overload (euint256, euint64) => euint256 test 4 (18444043004151788693, 18444043004151788689)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18444043004151788693n },
        { type: 'uint64', value: 18444043004151788689n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(18444043004151788689n);
  });

  it('test operator "or" overload (euint256, euint64) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457580047041599153315, 18439012031167961559)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580047041599153315n },
        { type: 'uint64', value: 18439012031167961559n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457581175295223774711n);
  });

  it('test operator "or" overload (euint256, euint64) => euint256 test 2 (18439012031167961555, 18439012031167961559)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18439012031167961555n },
        { type: 'uint64', value: 18439012031167961559n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(18439012031167961559n);
  });

  it('test operator "or" overload (euint256, euint64) => euint256 test 3 (18439012031167961559, 18439012031167961559)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18439012031167961559n },
        { type: 'uint64', value: 18439012031167961559n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(18439012031167961559n);
  });

  it('test operator "or" overload (euint256, euint64) => euint256 test 4 (18439012031167961559, 18439012031167961555)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18439012031167961559n },
        { type: 'uint64', value: 18439012031167961555n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(18439012031167961559n);
  });

  it('test operator "xor" overload (euint256, euint64) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457581259148988675397, 18438192470709095487)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457581259148988675397n },
        { type: 'uint64', value: 18438192470709095487n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039439143916295963785594n);
  });

  it('test operator "xor" overload (euint256, euint64) => euint256 test 2 (18438192470709095483, 18438192470709095487)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18438192470709095483n },
        { type: 'uint64', value: 18438192470709095487n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint256, euint64) => euint256 test 3 (18438192470709095487, 18438192470709095487)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18438192470709095487n },
        { type: 'uint64', value: 18438192470709095487n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint256, euint64) => euint256 test 4 (18438192470709095487, 18438192470709095483)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18438192470709095487n },
        { type: 'uint64', value: 18438192470709095483n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint256, euint64) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457578357386806506217, 18439568500667612821)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457578357386806506217n },
        { type: 'uint64', value: 18439568500667612821n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint64) => ebool test 2 (18439568500667612817, 18439568500667612821)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18439568500667612817n },
        { type: 'uint64', value: 18439568500667612821n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint64) => ebool test 3 (18439568500667612821, 18439568500667612821)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18439568500667612821n },
        { type: 'uint64', value: 18439568500667612821n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint256, euint64) => ebool test 4 (18439568500667612821, 18439568500667612817)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18439568500667612821n },
        { type: 'uint64', value: 18439568500667612817n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint64) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457578263130598196441, 18438306127665826051)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457578263130598196441n },
        { type: 'uint64', value: 18438306127665826051n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint64) => ebool test 2 (18438306127665826047, 18438306127665826051)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18438306127665826047n },
        { type: 'uint64', value: 18438306127665826051n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint64) => ebool test 3 (18438306127665826051, 18438306127665826051)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18438306127665826051n },
        { type: 'uint64', value: 18438306127665826051n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint64) => ebool test 4 (18438306127665826051, 18438306127665826047)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 18438306127665826051n },
        { type: 'uint64', value: 18438306127665826047n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint64(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "and" overload (euint256, euint128) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457580107210581404901, 340282366920938463463372677176741496607)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580107210581404901n },
        { type: 'uint128', value: 340282366920938463463372677176741496607n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463370143759936029701n);
  });

  it('test operator "and" overload (euint256, euint128) => euint256 test 2 (340282366920938463463372677176741496603, 340282366920938463463372677176741496607)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463372677176741496603n },
        { type: 'uint128', value: 340282366920938463463372677176741496607n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463372677176741496603n);
  });

  it('test operator "and" overload (euint256, euint128) => euint256 test 3 (340282366920938463463372677176741496607, 340282366920938463463372677176741496607)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463372677176741496607n },
        { type: 'uint128', value: 340282366920938463463372677176741496607n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463372677176741496607n);
  });

  it('test operator "and" overload (euint256, euint128) => euint256 test 4 (340282366920938463463372677176741496607, 340282366920938463463372677176741496603)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463372677176741496607n },
        { type: 'uint128', value: 340282366920938463463372677176741496603n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463372677176741496603n);
  });

  it('test operator "or" overload (euint256, euint128) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457582373928770703795, 340282366920938463463367730969854305523)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457582373928770703795n },
        { type: 'uint128', value: 340282366920938463463367730969854305523n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457583922043831711219n);
  });

  it('test operator "or" overload (euint256, euint128) => euint256 test 2 (340282366920938463463367730969854305519, 340282366920938463463367730969854305523)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463367730969854305519n },
        { type: 'uint128', value: 340282366920938463463367730969854305523n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463367730969854305535n);
  });

  it('test operator "or" overload (euint256, euint128) => euint256 test 3 (340282366920938463463367730969854305523, 340282366920938463463367730969854305523)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463367730969854305523n },
        { type: 'uint128', value: 340282366920938463463367730969854305523n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463367730969854305523n);
  });

  it('test operator "or" overload (euint256, euint128) => euint256 test 4 (340282366920938463463367730969854305523, 340282366920938463463367730969854305519)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463367730969854305523n },
        { type: 'uint128', value: 340282366920938463463367730969854305519n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(340282366920938463463367730969854305535n);
  });

  it('test operator "xor" overload (euint256, euint128) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457575705851577371525, 340282366920938463463368454549976768747)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575705851577371525n },
        { type: 'uint128', value: 340282366920938463463368454549976768747n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907852929702298719625575994211831146031868782n);
  });

  it('test operator "xor" overload (euint256, euint128) => euint256 test 2 (340282366920938463463368454549976768743, 340282366920938463463368454549976768747)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463368454549976768743n },
        { type: 'uint128', value: 340282366920938463463368454549976768747n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(12n);
  });

  it('test operator "xor" overload (euint256, euint128) => euint256 test 3 (340282366920938463463368454549976768747, 340282366920938463463368454549976768747)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463368454549976768747n },
        { type: 'uint128', value: 340282366920938463463368454549976768747n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint256, euint128) => euint256 test 4 (340282366920938463463368454549976768747, 340282366920938463463368454549976768743)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463368454549976768747n },
        { type: 'uint128', value: 340282366920938463463368454549976768743n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(12n);
  });

  it('test operator "eq" overload (euint256, euint128) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457577050117990883459, 340282366920938463463370869255022847815)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457577050117990883459n },
        { type: 'uint128', value: 340282366920938463463370869255022847815n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint128) => ebool test 2 (340282366920938463463370869255022847811, 340282366920938463463370869255022847815)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463370869255022847811n },
        { type: 'uint128', value: 340282366920938463463370869255022847815n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint128) => ebool test 3 (340282366920938463463370869255022847815, 340282366920938463463370869255022847815)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463370869255022847815n },
        { type: 'uint128', value: 340282366920938463463370869255022847815n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint256, euint128) => ebool test 4 (340282366920938463463370869255022847815, 340282366920938463463370869255022847811)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463370869255022847815n },
        { type: 'uint128', value: 340282366920938463463370869255022847811n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint128) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457580691388696786289, 340282366920938463463373058685227695969)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580691388696786289n },
        { type: 'uint128', value: 340282366920938463463373058685227695969n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint128) => ebool test 2 (340282366920938463463373058685227695965, 340282366920938463463373058685227695969)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463373058685227695965n },
        { type: 'uint128', value: 340282366920938463463373058685227695969n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint128) => ebool test 3 (340282366920938463463373058685227695969, 340282366920938463463373058685227695969)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463373058685227695969n },
        { type: 'uint128', value: 340282366920938463463373058685227695969n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint128) => ebool test 4 (340282366920938463463373058685227695969, 340282366920938463463373058685227695965)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 340282366920938463463373058685227695969n },
        { type: 'uint128', value: 340282366920938463463373058685227695965n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "and" overload (euint256, euint256) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457575356816400318221, 115792089237316195423570985008687907853269984665640564039457579240206011257579)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575356816400318221n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579240206011257579n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575286361487888905n);
  });

  it('test operator "and" overload (euint256, euint256) => euint256 test 2 (115792089237316195423570985008687907853269984665640564039457575356816400318217, 115792089237316195423570985008687907853269984665640564039457575356816400318221)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575356816400318217n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575356816400318221n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575356816400318217n);
  });

  it('test operator "and" overload (euint256, euint256) => euint256 test 3 (115792089237316195423570985008687907853269984665640564039457575356816400318221, 115792089237316195423570985008687907853269984665640564039457575356816400318221)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575356816400318221n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575356816400318221n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575356816400318221n);
  });

  it('test operator "and" overload (euint256, euint256) => euint256 test 4 (115792089237316195423570985008687907853269984665640564039457575356816400318221, 115792089237316195423570985008687907853269984665640564039457575356816400318217)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575356816400318221n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575356816400318217n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575356816400318217n);
  });

  it('test operator "or" overload (euint256, euint256) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457575852478858871057, 115792089237316195423570985008687907853269984665640564039457576783012652609295)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575852478858871057n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457576783012652609295n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457577066687596818207n);
  });

  it('test operator "or" overload (euint256, euint256) => euint256 test 2 (115792089237316195423570985008687907853269984665640564039457575852478858871053, 115792089237316195423570985008687907853269984665640564039457575852478858871057)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575852478858871053n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575852478858871057n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575852478858871069n);
  });

  it('test operator "or" overload (euint256, euint256) => euint256 test 3 (115792089237316195423570985008687907853269984665640564039457575852478858871057, 115792089237316195423570985008687907853269984665640564039457575852478858871057)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575852478858871057n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575852478858871057n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575852478858871057n);
  });

  it('test operator "or" overload (euint256, euint256) => euint256 test 4 (115792089237316195423570985008687907853269984665640564039457575852478858871057, 115792089237316195423570985008687907853269984665640564039457575852478858871053)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575852478858871057n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457575852478858871053n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457575852478858871069n);
  });

  it('test operator "xor" overload (euint256, euint256) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457579203735796060739, 115792089237316195423570985008687907853269984665640564039457580943663941326017)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579203735796060739n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580943663941326017n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(7867781730567810n);
  });

  it('test operator "xor" overload (euint256, euint256) => euint256 test 2 (115792089237316195423570985008687907853269984665640564039457579203735796060735, 115792089237316195423570985008687907853269984665640564039457579203735796060739)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579203735796060735n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579203735796060739n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(124n);
  });

  it('test operator "xor" overload (euint256, euint256) => euint256 test 3 (115792089237316195423570985008687907853269984665640564039457579203735796060739, 115792089237316195423570985008687907853269984665640564039457579203735796060739)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579203735796060739n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579203735796060739n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint256, euint256) => euint256 test 4 (115792089237316195423570985008687907853269984665640564039457579203735796060739, 115792089237316195423570985008687907853269984665640564039457579203735796060735)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579203735796060739n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579203735796060735n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.xor_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract5.resEuint256() });
    expect(res).to.equal(124n);
  });

  it('test operator "eq" overload (euint256, euint256) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457583724238425323955, 115792089237316195423570985008687907853269984665640564039457579495105216444461)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583724238425323955n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579495105216444461n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint256) => ebool test 2 (115792089237316195423570985008687907853269984665640564039457579495105216444457, 115792089237316195423570985008687907853269984665640564039457579495105216444461)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579495105216444457n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579495105216444461n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint256, euint256) => ebool test 3 (115792089237316195423570985008687907853269984665640564039457579495105216444461, 115792089237316195423570985008687907853269984665640564039457579495105216444461)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579495105216444461n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579495105216444461n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint256, euint256) => ebool test 4 (115792089237316195423570985008687907853269984665640564039457579495105216444461, 115792089237316195423570985008687907853269984665640564039457579495105216444457)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579495105216444461n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579495105216444457n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.eq_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint256) => ebool test 1 (115792089237316195423570985008687907853269984665640564039457583555262774063695, 115792089237316195423570985008687907853269984665640564039457579280144501982153)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583555262774063695n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579280144501982153n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint256) => ebool test 2 (115792089237316195423570985008687907853269984665640564039457579280144501982149, 115792089237316195423570985008687907853269984665640564039457579280144501982153)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579280144501982149n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579280144501982153n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint256, euint256) => ebool test 3 (115792089237316195423570985008687907853269984665640564039457579280144501982153, 115792089237316195423570985008687907853269984665640564039457579280144501982153)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579280144501982153n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579280144501982153n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint256, euint256) => ebool test 4 (115792089237316195423570985008687907853269984665640564039457579280144501982153, 115792089237316195423570985008687907853269984665640564039457579280144501982149)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579280144501982153n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579280144501982149n },
      ],
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.ne_euint256_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract5.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "add" overload (euint8, uint8) => euint8 test 1 (80, 76)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 80n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_euint8_uint8(encryptedAmount.externalEuint8, 76n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(156);
  });

  it('test operator "add" overload (euint8, uint8) => euint8 test 2 (76, 80)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 76n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_euint8_uint8(encryptedAmount.externalEuint8, 80n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(156);
  });

  it('test operator "add" overload (euint8, uint8) => euint8 test 3 (80, 80)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 80n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_euint8_uint8(encryptedAmount.externalEuint8, 80n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(160);
  });

  it('test operator "add" overload (euint8, uint8) => euint8 test 4 (80, 76)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 80n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_euint8_uint8(encryptedAmount.externalEuint8, 76n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(156);
  });

  it('test operator "add" overload (uint8, euint8) => euint8 test 1 (32, 76)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 76n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_uint8_euint8(32n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(108);
  });

  it('test operator "add" overload (uint8, euint8) => euint8 test 2 (76, 80)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 80n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_uint8_euint8(76n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(156);
  });

  it('test operator "add" overload (uint8, euint8) => euint8 test 3 (80, 80)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 80n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_uint8_euint8(80n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(160);
  });

  it('test operator "add" overload (uint8, euint8) => euint8 test 4 (80, 76)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 76n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.add_uint8_euint8(80n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(156);
  });

  it('test operator "sub" overload (euint8, uint8) => euint8 test 1 (34, 34)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 34n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.sub_euint8_uint8(encryptedAmount.externalEuint8, 34n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (euint8, uint8) => euint8 test 2 (34, 30)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 34n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.sub_euint8_uint8(encryptedAmount.externalEuint8, 30n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "sub" overload (uint8, euint8) => euint8 test 1 (34, 34)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 34n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.sub_uint8_euint8(34n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "sub" overload (uint8, euint8) => euint8 test 2 (34, 30)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 30n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.sub_uint8_euint8(34n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "mul" overload (euint8, uint8) => euint8 test 1 (13, 16)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 13n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_euint8_uint8(encryptedAmount.externalEuint8, 16n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(208);
  });

  it('test operator "mul" overload (euint8, uint8) => euint8 test 2 (11, 12)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 11n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_euint8_uint8(encryptedAmount.externalEuint8, 12n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(132);
  });

  it('test operator "mul" overload (euint8, uint8) => euint8 test 3 (12, 12)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 12n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_euint8_uint8(encryptedAmount.externalEuint8, 12n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(144);
  });

  it('test operator "mul" overload (euint8, uint8) => euint8 test 4 (12, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 12n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_euint8_uint8(encryptedAmount.externalEuint8, 11n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(132);
  });

  it('test operator "mul" overload (uint8, euint8) => euint8 test 1 (10, 16)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 16n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_uint8_euint8(10n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(160);
  });

  it('test operator "mul" overload (uint8, euint8) => euint8 test 2 (11, 12)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 12n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_uint8_euint8(11n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(132);
  });

  it('test operator "mul" overload (uint8, euint8) => euint8 test 3 (12, 12)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 12n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_uint8_euint8(12n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(144);
  });

  it('test operator "mul" overload (uint8, euint8) => euint8 test 4 (12, 11)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 11n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.mul_uint8_euint8(12n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(132);
  });

  it('test operator "div" overload (euint8, uint8) => euint8 test 1 (31, 173)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 31n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.div_euint8_uint8(encryptedAmount.externalEuint8, 173n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "div" overload (euint8, uint8) => euint8 test 2 (27, 31)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 27n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.div_euint8_uint8(encryptedAmount.externalEuint8, 31n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "div" overload (euint8, uint8) => euint8 test 3 (31, 31)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 31n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.div_euint8_uint8(encryptedAmount.externalEuint8, 31n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(1);
  });

  it('test operator "div" overload (euint8, uint8) => euint8 test 4 (31, 27)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 31n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.div_euint8_uint8(encryptedAmount.externalEuint8, 27n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(1);
  });

  it('test operator "rem" overload (euint8, uint8) => euint8 test 1 (44, 149)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 44n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.rem_euint8_uint8(encryptedAmount.externalEuint8, 149n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(44);
  });

  it('test operator "rem" overload (euint8, uint8) => euint8 test 2 (40, 44)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 40n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.rem_euint8_uint8(encryptedAmount.externalEuint8, 44n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(40);
  });

  it('test operator "rem" overload (euint8, uint8) => euint8 test 3 (44, 44)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 44n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.rem_euint8_uint8(encryptedAmount.externalEuint8, 44n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(0);
  });

  it('test operator "rem" overload (euint8, uint8) => euint8 test 4 (44, 40)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 44n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.rem_euint8_uint8(encryptedAmount.externalEuint8, 40n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(4);
  });

  it('test operator "and" overload (euint8, uint8) => euint8 test 1 (200, 220)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 200n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint8_uint8(encryptedAmount.externalEuint8, 220n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(200);
  });

  it('test operator "and" overload (euint8, uint8) => euint8 test 2 (117, 121)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 117n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint8_uint8(encryptedAmount.externalEuint8, 121n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(113);
  });

  it('test operator "and" overload (euint8, uint8) => euint8 test 3 (121, 121)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 121n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint8_uint8(encryptedAmount.externalEuint8, 121n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(121);
  });

  it('test operator "and" overload (euint8, uint8) => euint8 test 4 (121, 117)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 121n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_euint8_uint8(encryptedAmount.externalEuint8, 117n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(113);
  });

  it('test operator "and" overload (uint8, euint8) => euint8 test 1 (247, 220)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 220n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_uint8_euint8(247n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(212);
  });

  it('test operator "and" overload (uint8, euint8) => euint8 test 2 (117, 121)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 121n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_uint8_euint8(117n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(113);
  });

  it('test operator "and" overload (uint8, euint8) => euint8 test 3 (121, 121)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 121n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_uint8_euint8(121n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(121);
  });

  it('test operator "and" overload (uint8, euint8) => euint8 test 4 (121, 117)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 117n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.and_uint8_euint8(121n, encryptedAmount.externalEuint8, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(113);
  });

  it('test operator "or" overload (euint8, uint8) => euint8 test 1 (119, 140)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 119n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint8_uint8(encryptedAmount.externalEuint8, 140n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(255);
  });

  it('test operator "or" overload (euint8, uint8) => euint8 test 2 (33, 37)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 33n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint8_uint8(encryptedAmount.externalEuint8, 37n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(37);
  });

  it('test operator "or" overload (euint8, uint8) => euint8 test 3 (37, 37)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 37n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint8_uint8(encryptedAmount.externalEuint8, 37n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(37);
  });

  it('test operator "or" overload (euint8, uint8) => euint8 test 4 (37, 33)', async function () {
    const encryptedAmount = await fhevm.helpers.encryptUint8({
      value: 37n,
      contractAddress: this.contract5Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract5.or_euint8_uint8(encryptedAmount.externalEuint8, 33n, encryptedAmount.inputProof);
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint8({ euint8: await this.contract5.resEuint8() });
    expect(res).to.equal(37);
  });
});
