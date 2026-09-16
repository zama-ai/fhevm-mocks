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

describe('FHEVM operations 5', function () {
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

  it('test operator "mul" overload (euint32, euint128) => euint128 test 1 (2, 1073741825)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2n },
        { type: 'uint128', value: 1073741825n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(2147483650n);
  });

  it('test operator "mul" overload (euint32, euint128) => euint128 test 2 (37269, 37269)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 37269n },
        { type: 'uint128', value: 37269n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(1388978361n);
  });

  it('test operator "mul" overload (euint32, euint128) => euint128 test 3 (37269, 37269)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 37269n },
        { type: 'uint128', value: 37269n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(1388978361n);
  });

  it('test operator "mul" overload (euint32, euint128) => euint128 test 4 (37269, 37269)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 37269n },
        { type: 'uint128', value: 37269n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(1388978361n);
  });

  it('test operator "and" overload (euint32, euint128) => euint128 test 1 (90454698, 340282366920938463463367458659864648263)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 90454698n },
        { type: 'uint128', value: 340282366920938463463367458659864648263n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(67115522n);
  });

  it('test operator "and" overload (euint32, euint128) => euint128 test 2 (90454694, 90454698)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 90454694n },
        { type: 'uint128', value: 90454698n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(90454690n);
  });

  it('test operator "and" overload (euint32, euint128) => euint128 test 3 (90454698, 90454698)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 90454698n },
        { type: 'uint128', value: 90454698n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(90454698n);
  });

  it('test operator "and" overload (euint32, euint128) => euint128 test 4 (90454698, 90454694)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 90454698n },
        { type: 'uint128', value: 90454694n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(90454690n);
  });

  it('test operator "or" overload (euint32, euint128) => euint128 test 1 (3389540940, 340282366920938463463368470545623019211)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3389540940n },
        { type: 'uint128', value: 340282366920938463463368470545623019211n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(340282366920938463463368470545656573647n);
  });

  it('test operator "or" overload (euint32, euint128) => euint128 test 2 (3389540936, 3389540940)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3389540936n },
        { type: 'uint128', value: 3389540940n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(3389540940n);
  });

  it('test operator "or" overload (euint32, euint128) => euint128 test 3 (3389540940, 3389540940)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3389540940n },
        { type: 'uint128', value: 3389540940n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(3389540940n);
  });

  it('test operator "or" overload (euint32, euint128) => euint128 test 4 (3389540940, 3389540936)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3389540940n },
        { type: 'uint128', value: 3389540936n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(3389540940n);
  });

  it('test operator "xor" overload (euint32, euint128) => euint128 test 1 (2671115, 340282366920938463463370748166182151537)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2671115n },
        { type: 'uint128', value: 340282366920938463463370748166182151537n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(340282366920938463463370748166180628346n);
  });

  it('test operator "xor" overload (euint32, euint128) => euint128 test 2 (2671111, 2671115)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2671111n },
        { type: 'uint128', value: 2671115n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(12n);
  });

  it('test operator "xor" overload (euint32, euint128) => euint128 test 3 (2671115, 2671115)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2671115n },
        { type: 'uint128', value: 2671115n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint32, euint128) => euint128 test 4 (2671115, 2671111)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 2671115n },
        { type: 'uint128', value: 2671111n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(12n);
  });

  it('test operator "eq" overload (euint32, euint128) => ebool test 1 (1946712982, 340282366920938463463370971942578454691)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1946712982n },
        { type: 'uint128', value: 340282366920938463463370971942578454691n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint128) => ebool test 2 (1946712978, 1946712982)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1946712978n },
        { type: 'uint128', value: 1946712982n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint128) => ebool test 3 (1946712982, 1946712982)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1946712982n },
        { type: 'uint128', value: 1946712982n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint32, euint128) => ebool test 4 (1946712982, 1946712978)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1946712982n },
        { type: 'uint128', value: 1946712978n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint128) => ebool test 1 (250439955, 340282366920938463463373494336294431799)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 250439955n },
        { type: 'uint128', value: 340282366920938463463373494336294431799n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint128) => ebool test 2 (250439951, 250439955)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 250439951n },
        { type: 'uint128', value: 250439955n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint128) => ebool test 3 (250439955, 250439955)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 250439955n },
        { type: 'uint128', value: 250439955n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint128) => ebool test 4 (250439955, 250439951)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 250439955n },
        { type: 'uint128', value: 250439951n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint128) => ebool test 1 (4192659999, 340282366920938463463374388814337714031)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4192659999n },
        { type: 'uint128', value: 340282366920938463463374388814337714031n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, euint128) => ebool test 2 (4192659995, 4192659999)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4192659995n },
        { type: 'uint128', value: 4192659999n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint32, euint128) => ebool test 3 (4192659999, 4192659999)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4192659999n },
        { type: 'uint128', value: 4192659999n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint32, euint128) => ebool test 4 (4192659999, 4192659995)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4192659999n },
        { type: 'uint128', value: 4192659995n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint32, euint128) => ebool test 1 (3680366003, 340282366920938463463367048578310845147)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3680366003n },
        { type: 'uint128', value: 340282366920938463463367048578310845147n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint128) => ebool test 2 (3680365999, 3680366003)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3680365999n },
        { type: 'uint128', value: 3680366003n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint128) => ebool test 3 (3680366003, 3680366003)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3680366003n },
        { type: 'uint128', value: 3680366003n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint32, euint128) => ebool test 4 (3680366003, 3680365999)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3680366003n },
        { type: 'uint128', value: 3680365999n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint128) => ebool test 1 (382063216, 340282366920938463463371037697728072491)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 382063216n },
        { type: 'uint128', value: 340282366920938463463371037697728072491n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint128) => ebool test 2 (382063212, 382063216)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 382063212n },
        { type: 'uint128', value: 382063216n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint128) => ebool test 3 (382063216, 382063216)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 382063216n },
        { type: 'uint128', value: 382063216n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint32, euint128) => ebool test 4 (382063216, 382063212)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 382063216n },
        { type: 'uint128', value: 382063212n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint128) => ebool test 1 (69153027, 340282366920938463463366247780707353277)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 69153027n },
        { type: 'uint128', value: 340282366920938463463366247780707353277n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint32, euint128) => ebool test 2 (69153023, 69153027)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 69153023n },
        { type: 'uint128', value: 69153027n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint32, euint128) => ebool test 3 (69153027, 69153027)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 69153027n },
        { type: 'uint128', value: 69153027n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint32, euint128) => ebool test 4 (69153027, 69153023)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 69153027n },
        { type: 'uint128', value: 69153023n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint32, euint128) => euint128 test 1 (3299606264, 340282366920938463463370467451638311671)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3299606264n },
        { type: 'uint128', value: 340282366920938463463370467451638311671n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(3299606264n);
  });

  it('test operator "min" overload (euint32, euint128) => euint128 test 2 (3299606260, 3299606264)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3299606260n },
        { type: 'uint128', value: 3299606264n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(3299606260n);
  });

  it('test operator "min" overload (euint32, euint128) => euint128 test 3 (3299606264, 3299606264)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3299606264n },
        { type: 'uint128', value: 3299606264n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(3299606264n);
  });

  it('test operator "min" overload (euint32, euint128) => euint128 test 4 (3299606264, 3299606260)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 3299606264n },
        { type: 'uint128', value: 3299606260n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(3299606260n);
  });

  it('test operator "max" overload (euint32, euint128) => euint128 test 1 (1092947533, 340282366920938463463367963287053693351)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1092947533n },
        { type: 'uint128', value: 340282366920938463463367963287053693351n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(340282366920938463463367963287053693351n);
  });

  it('test operator "max" overload (euint32, euint128) => euint128 test 2 (1092947529, 1092947533)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1092947529n },
        { type: 'uint128', value: 1092947533n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(1092947533n);
  });

  it('test operator "max" overload (euint32, euint128) => euint128 test 3 (1092947533, 1092947533)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1092947533n },
        { type: 'uint128', value: 1092947533n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(1092947533n);
  });

  it('test operator "max" overload (euint32, euint128) => euint128 test 4 (1092947533, 1092947529)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1092947533n },
        { type: 'uint128', value: 1092947529n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint32_euint128(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint128({ euint128: await this.contract3.resEuint128() });
    expect(res).to.equal(1092947533n);
  });

  it('test operator "and" overload (euint32, euint256) => euint256 test 1 (1078185188, 115792089237316195423570985008687907853269984665640564039457580472745878428029)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1078185188n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580472745878428029n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(4261988n);
  });

  it('test operator "and" overload (euint32, euint256) => euint256 test 2 (1078185184, 1078185188)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1078185184n },
        { type: 'uint256', value: 1078185188n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(1078185184n);
  });

  it('test operator "and" overload (euint32, euint256) => euint256 test 3 (1078185188, 1078185188)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1078185188n },
        { type: 'uint256', value: 1078185188n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(1078185188n);
  });

  it('test operator "and" overload (euint32, euint256) => euint256 test 4 (1078185188, 1078185184)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1078185188n },
        { type: 'uint256', value: 1078185184n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(1078185184n);
  });

  it('test operator "or" overload (euint32, euint256) => euint256 test 1 (1726982139, 115792089237316195423570985008687907853269984665640564039457580745761535873251)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1726982139n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580745761535873251n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457580745762658056187n);
  });

  it('test operator "or" overload (euint32, euint256) => euint256 test 2 (1726982135, 1726982139)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1726982135n },
        { type: 'uint256', value: 1726982139n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(1726982143n);
  });

  it('test operator "or" overload (euint32, euint256) => euint256 test 3 (1726982139, 1726982139)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1726982139n },
        { type: 'uint256', value: 1726982139n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(1726982139n);
  });

  it('test operator "or" overload (euint32, euint256) => euint256 test 4 (1726982139, 1726982135)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 1726982139n },
        { type: 'uint256', value: 1726982135n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(1726982143n);
  });

  it('test operator "xor" overload (euint32, euint256) => euint256 test 1 (410402069, 115792089237316195423570985008687907853269984665640564039457583797868224346463)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 410402069n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457583797868224346463n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(115792089237316195423570985008687907853269984665640564039457583797867829412938n);
  });

  it('test operator "xor" overload (euint32, euint256) => euint256 test 2 (410402065, 410402069)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 410402065n },
        { type: 'uint256', value: 410402069n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint32, euint256) => euint256 test 3 (410402069, 410402069)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 410402069n },
        { type: 'uint256', value: 410402069n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint32, euint256) => euint256 test 4 (410402069, 410402065)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 410402069n },
        { type: 'uint256', value: 410402065n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint256({ euint256: await this.contract3.resEuint256() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint32, euint256) => ebool test 1 (4251910691, 115792089237316195423570985008687907853269984665640564039457579804515531671853)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4251910691n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457579804515531671853n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint256) => ebool test 2 (4251910687, 4251910691)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4251910687n },
        { type: 'uint256', value: 4251910691n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint32, euint256) => ebool test 3 (4251910691, 4251910691)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4251910691n },
        { type: 'uint256', value: 4251910691n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint32, euint256) => ebool test 4 (4251910691, 4251910687)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 4251910691n },
        { type: 'uint256', value: 4251910687n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint256) => ebool test 1 (497257959, 115792089237316195423570985008687907853269984665640564039457580468644685917695)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 497257959n },
        { type: 'uint256', value: 115792089237316195423570985008687907853269984665640564039457580468644685917695n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint256) => ebool test 2 (497257955, 497257959)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 497257955n },
        { type: 'uint256', value: 497257959n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint32, euint256) => ebool test 3 (497257959, 497257959)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 497257959n },
        { type: 'uint256', value: 497257959n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint32, euint256) => ebool test 4 (497257959, 497257955)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint32', value: 497257959n },
        { type: 'uint256', value: 497257955n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint32_euint256(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "add" overload (euint64, euint8) => euint64 test 1 (129, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 129n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(131n);
  });

  it('test operator "add" overload (euint64, euint8) => euint64 test 2 (26, 30)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 26n },
        { type: 'uint8', value: 30n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(56n);
  });

  it('test operator "add" overload (euint64, euint8) => euint64 test 3 (30, 30)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 30n },
        { type: 'uint8', value: 30n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(60n);
  });

  it('test operator "add" overload (euint64, euint8) => euint64 test 4 (30, 26)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 30n },
        { type: 'uint8', value: 26n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(56n);
  });

  it('test operator "sub" overload (euint64, euint8) => euint64 test 1 (18, 18)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18n },
        { type: 'uint8', value: 18n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint64, euint8) => euint64 test 2 (18, 14)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18n },
        { type: 'uint8', value: 14n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint64, euint8) => euint64 test 1 (65, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 65n },
        { type: 'uint8', value: 2n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(130n);
  });

  it('test operator "mul" overload (euint64, euint8) => euint64 test 2 (9, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 9n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(90n);
  });

  it('test operator "mul" overload (euint64, euint8) => euint64 test 3 (10, 10)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 10n },
        { type: 'uint8', value: 10n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(100n);
  });

  it('test operator "mul" overload (euint64, euint8) => euint64 test 4 (10, 9)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 10n },
        { type: 'uint8', value: 9n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(90n);
  });

  it('test operator "and" overload (euint64, euint8) => euint64 test 1 (18445498395785648437, 27)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18445498395785648437n },
        { type: 'uint8', value: 27n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(17n);
  });

  it('test operator "and" overload (euint64, euint8) => euint64 test 2 (23, 27)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 23n },
        { type: 'uint8', value: 27n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(19n);
  });

  it('test operator "and" overload (euint64, euint8) => euint64 test 3 (27, 27)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 27n },
        { type: 'uint8', value: 27n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(27n);
  });

  it('test operator "and" overload (euint64, euint8) => euint64 test 4 (27, 23)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 27n },
        { type: 'uint8', value: 23n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(19n);
  });

  it('test operator "or" overload (euint64, euint8) => euint64 test 1 (18438420536438705649, 241)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18438420536438705649n },
        { type: 'uint8', value: 241n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18438420536438705649n);
  });

  it('test operator "or" overload (euint64, euint8) => euint64 test 2 (237, 241)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 237n },
        { type: 'uint8', value: 241n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(253n);
  });

  it('test operator "or" overload (euint64, euint8) => euint64 test 3 (241, 241)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 241n },
        { type: 'uint8', value: 241n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(241n);
  });

  it('test operator "or" overload (euint64, euint8) => euint64 test 4 (241, 237)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 241n },
        { type: 'uint8', value: 237n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(253n);
  });

  it('test operator "xor" overload (euint64, euint8) => euint64 test 1 (18444572575960820901, 242)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18444572575960820901n },
        { type: 'uint8', value: 242n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18444572575960820823n);
  });

  it('test operator "xor" overload (euint64, euint8) => euint64 test 2 (238, 242)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 238n },
        { type: 'uint8', value: 242n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(28n);
  });

  it('test operator "xor" overload (euint64, euint8) => euint64 test 3 (242, 242)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 242n },
        { type: 'uint8', value: 242n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint64, euint8) => euint64 test 4 (242, 238)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 242n },
        { type: 'uint8', value: 238n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(28n);
  });

  it('test operator "eq" overload (euint64, euint8) => ebool test 1 (18442128329303514307, 229)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18442128329303514307n },
        { type: 'uint8', value: 229n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint64, euint8) => ebool test 2 (225, 229)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 225n },
        { type: 'uint8', value: 229n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint64, euint8) => ebool test 3 (229, 229)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 229n },
        { type: 'uint8', value: 229n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint64, euint8) => ebool test 4 (229, 225)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 229n },
        { type: 'uint8', value: 225n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint64, euint8) => ebool test 1 (18443279266798069147, 231)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18443279266798069147n },
        { type: 'uint8', value: 231n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint64, euint8) => ebool test 2 (227, 231)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 227n },
        { type: 'uint8', value: 231n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint64, euint8) => ebool test 3 (231, 231)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 231n },
        { type: 'uint8', value: 231n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint64, euint8) => ebool test 4 (231, 227)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 231n },
        { type: 'uint8', value: 227n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint64, euint8) => ebool test 1 (18441771528558285547, 66)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18441771528558285547n },
        { type: 'uint8', value: 66n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint64, euint8) => ebool test 2 (62, 66)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 62n },
        { type: 'uint8', value: 66n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint64, euint8) => ebool test 3 (66, 66)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 66n },
        { type: 'uint8', value: 66n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint64, euint8) => ebool test 4 (66, 62)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 66n },
        { type: 'uint8', value: 62n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint64, euint8) => ebool test 1 (18437989215549973191, 49)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18437989215549973191n },
        { type: 'uint8', value: 49n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint64, euint8) => ebool test 2 (45, 49)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 45n },
        { type: 'uint8', value: 49n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint64, euint8) => ebool test 3 (49, 49)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 49n },
        { type: 'uint8', value: 49n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint64, euint8) => ebool test 4 (49, 45)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 49n },
        { type: 'uint8', value: 45n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, euint8) => ebool test 1 (18440212028447888255, 184)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18440212028447888255n },
        { type: 'uint8', value: 184n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint64, euint8) => ebool test 2 (180, 184)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 180n },
        { type: 'uint8', value: 184n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, euint8) => ebool test 3 (184, 184)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 184n },
        { type: 'uint8', value: 184n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, euint8) => ebool test 4 (184, 180)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 184n },
        { type: 'uint8', value: 180n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint64, euint8) => ebool test 1 (18440174645627611915, 246)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18440174645627611915n },
        { type: 'uint8', value: 246n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint64, euint8) => ebool test 2 (242, 246)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 242n },
        { type: 'uint8', value: 246n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint64, euint8) => ebool test 3 (246, 246)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 246n },
        { type: 'uint8', value: 246n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint64, euint8) => ebool test 4 (246, 242)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 246n },
        { type: 'uint8', value: 242n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint64, euint8) => euint64 test 1 (18444954946579596581, 45)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18444954946579596581n },
        { type: 'uint8', value: 45n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(45n);
  });

  it('test operator "min" overload (euint64, euint8) => euint64 test 2 (41, 45)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 41n },
        { type: 'uint8', value: 45n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(41n);
  });

  it('test operator "min" overload (euint64, euint8) => euint64 test 3 (45, 45)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 45n },
        { type: 'uint8', value: 45n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(45n);
  });

  it('test operator "min" overload (euint64, euint8) => euint64 test 4 (45, 41)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 45n },
        { type: 'uint8', value: 41n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(41n);
  });

  it('test operator "max" overload (euint64, euint8) => euint64 test 1 (18445307489647444665, 175)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18445307489647444665n },
        { type: 'uint8', value: 175n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18445307489647444665n);
  });

  it('test operator "max" overload (euint64, euint8) => euint64 test 2 (171, 175)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 171n },
        { type: 'uint8', value: 175n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(175n);
  });

  it('test operator "max" overload (euint64, euint8) => euint64 test 3 (175, 175)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 175n },
        { type: 'uint8', value: 175n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(175n);
  });

  it('test operator "max" overload (euint64, euint8) => euint64 test 4 (175, 171)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 175n },
        { type: 'uint8', value: 171n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint64_euint8(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(175n);
  });

  it('test operator "add" overload (euint64, euint16) => euint64 test 1 (65515, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 65515n },
        { type: 'uint16', value: 2n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(65517n);
  });

  it('test operator "add" overload (euint64, euint16) => euint64 test 2 (20385, 20387)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 20385n },
        { type: 'uint16', value: 20387n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(40772n);
  });

  it('test operator "add" overload (euint64, euint16) => euint64 test 3 (20387, 20387)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 20387n },
        { type: 'uint16', value: 20387n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(40774n);
  });

  it('test operator "add" overload (euint64, euint16) => euint64 test 4 (20387, 20385)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 20387n },
        { type: 'uint16', value: 20385n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(40772n);
  });

  it('test operator "sub" overload (euint64, euint16) => euint64 test 1 (48672, 48672)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 48672n },
        { type: 'uint16', value: 48672n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint64, euint16) => euint64 test 2 (48672, 48668)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 48672n },
        { type: 'uint16', value: 48668n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint64, euint16) => euint64 test 1 (32758, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 32758n },
        { type: 'uint16', value: 2n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(65516n);
  });

  it('test operator "mul" overload (euint64, euint16) => euint64 test 2 (207, 208)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 207n },
        { type: 'uint16', value: 208n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(43056n);
  });

  it('test operator "mul" overload (euint64, euint16) => euint64 test 3 (208, 208)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 208n },
        { type: 'uint16', value: 208n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(43264n);
  });

  it('test operator "mul" overload (euint64, euint16) => euint64 test 4 (208, 207)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 208n },
        { type: 'uint16', value: 207n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(43056n);
  });

  it('test operator "and" overload (euint64, euint16) => euint64 test 1 (18446694512172513655, 42356)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18446694512172513655n },
        { type: 'uint16', value: 42356n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(41332n);
  });

  it('test operator "and" overload (euint64, euint16) => euint64 test 2 (42352, 42356)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42352n },
        { type: 'uint16', value: 42356n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(42352n);
  });

  it('test operator "and" overload (euint64, euint16) => euint64 test 3 (42356, 42356)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42356n },
        { type: 'uint16', value: 42356n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(42356n);
  });

  it('test operator "and" overload (euint64, euint16) => euint64 test 4 (42356, 42352)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42356n },
        { type: 'uint16', value: 42352n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(42352n);
  });

  it('test operator "or" overload (euint64, euint16) => euint64 test 1 (18440120307098042859, 35861)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18440120307098042859n },
        { type: 'uint16', value: 35861n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18440120307098045951n);
  });

  it('test operator "or" overload (euint64, euint16) => euint64 test 2 (35857, 35861)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 35857n },
        { type: 'uint16', value: 35861n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(35861n);
  });

  it('test operator "or" overload (euint64, euint16) => euint64 test 3 (35861, 35861)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 35861n },
        { type: 'uint16', value: 35861n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(35861n);
  });

  it('test operator "or" overload (euint64, euint16) => euint64 test 4 (35861, 35857)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 35861n },
        { type: 'uint16', value: 35857n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(35861n);
  });

  it('test operator "xor" overload (euint64, euint16) => euint64 test 1 (18439782139000815853, 49347)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18439782139000815853n },
        { type: 'uint16', value: 49347n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18439782139000799278n);
  });

  it('test operator "xor" overload (euint64, euint16) => euint64 test 2 (49343, 49347)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 49343n },
        { type: 'uint16', value: 49347n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(124n);
  });

  it('test operator "xor" overload (euint64, euint16) => euint64 test 3 (49347, 49347)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 49347n },
        { type: 'uint16', value: 49347n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint64, euint16) => euint64 test 4 (49347, 49343)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 49347n },
        { type: 'uint16', value: 49343n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(124n);
  });

  it('test operator "eq" overload (euint64, euint16) => ebool test 1 (18442818998699466915, 25868)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18442818998699466915n },
        { type: 'uint16', value: 25868n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint64, euint16) => ebool test 2 (25864, 25868)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 25864n },
        { type: 'uint16', value: 25868n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint64, euint16) => ebool test 3 (25868, 25868)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 25868n },
        { type: 'uint16', value: 25868n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint64, euint16) => ebool test 4 (25868, 25864)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 25868n },
        { type: 'uint16', value: 25864n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint64, euint16) => ebool test 1 (18441600648606039729, 51316)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18441600648606039729n },
        { type: 'uint16', value: 51316n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint64, euint16) => ebool test 2 (51312, 51316)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 51312n },
        { type: 'uint16', value: 51316n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ne" overload (euint64, euint16) => ebool test 3 (51316, 51316)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 51316n },
        { type: 'uint16', value: 51316n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ne" overload (euint64, euint16) => ebool test 4 (51316, 51312)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 51316n },
        { type: 'uint16', value: 51312n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ne_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint64, euint16) => ebool test 1 (18446458105134413869, 25867)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18446458105134413869n },
        { type: 'uint16', value: 25867n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint64, euint16) => ebool test 2 (25863, 25867)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 25863n },
        { type: 'uint16', value: 25867n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "ge" overload (euint64, euint16) => ebool test 3 (25867, 25867)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 25867n },
        { type: 'uint16', value: 25867n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "ge" overload (euint64, euint16) => ebool test 4 (25867, 25863)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 25867n },
        { type: 'uint16', value: 25863n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.ge_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint64, euint16) => ebool test 1 (18445504611557102287, 42444)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18445504611557102287n },
        { type: 'uint16', value: 42444n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "gt" overload (euint64, euint16) => ebool test 2 (42440, 42444)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42440n },
        { type: 'uint16', value: 42444n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint64, euint16) => ebool test 3 (42444, 42444)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42444n },
        { type: 'uint16', value: 42444n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "gt" overload (euint64, euint16) => ebool test 4 (42444, 42440)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42444n },
        { type: 'uint16', value: 42440n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.gt_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, euint16) => ebool test 1 (18445448684909009407, 63403)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18445448684909009407n },
        { type: 'uint16', value: 63403n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "le" overload (euint64, euint16) => ebool test 2 (63399, 63403)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 63399n },
        { type: 'uint16', value: 63403n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, euint16) => ebool test 3 (63403, 63403)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 63403n },
        { type: 'uint16', value: 63403n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "le" overload (euint64, euint16) => ebool test 4 (63403, 63399)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 63403n },
        { type: 'uint16', value: 63399n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.le_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint64, euint16) => ebool test 1 (18441919338059746685, 13434)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18441919338059746685n },
        { type: 'uint16', value: 13434n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint64, euint16) => ebool test 2 (13430, 13434)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 13430n },
        { type: 'uint16', value: 13434n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "lt" overload (euint64, euint16) => ebool test 3 (13434, 13434)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 13434n },
        { type: 'uint16', value: 13434n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "lt" overload (euint64, euint16) => ebool test 4 (13434, 13430)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 13434n },
        { type: 'uint16', value: 13430n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.lt_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "min" overload (euint64, euint16) => euint64 test 1 (18438060593556197041, 44942)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18438060593556197041n },
        { type: 'uint16', value: 44942n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(44942n);
  });

  it('test operator "min" overload (euint64, euint16) => euint64 test 2 (44938, 44942)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 44938n },
        { type: 'uint16', value: 44942n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(44938n);
  });

  it('test operator "min" overload (euint64, euint16) => euint64 test 3 (44942, 44942)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 44942n },
        { type: 'uint16', value: 44942n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(44942n);
  });

  it('test operator "min" overload (euint64, euint16) => euint64 test 4 (44942, 44938)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 44942n },
        { type: 'uint16', value: 44938n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.min_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(44938n);
  });

  it('test operator "max" overload (euint64, euint16) => euint64 test 1 (18443755423752084495, 11729)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18443755423752084495n },
        { type: 'uint16', value: 11729n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18443755423752084495n);
  });

  it('test operator "max" overload (euint64, euint16) => euint64 test 2 (11725, 11729)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 11725n },
        { type: 'uint16', value: 11729n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(11729n);
  });

  it('test operator "max" overload (euint64, euint16) => euint64 test 3 (11729, 11729)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 11729n },
        { type: 'uint16', value: 11729n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(11729n);
  });

  it('test operator "max" overload (euint64, euint16) => euint64 test 4 (11729, 11725)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 11729n },
        { type: 'uint16', value: 11725n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.max_euint64_euint16(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(11729n);
  });

  it('test operator "add" overload (euint64, euint32) => euint64 test 1 (4293602302, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 4293602302n },
        { type: 'uint32', value: 2n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4293602304n);
  });

  it('test operator "add" overload (euint64, euint32) => euint64 test 2 (1917361697, 1917361699)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1917361697n },
        { type: 'uint32', value: 1917361699n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3834723396n);
  });

  it('test operator "add" overload (euint64, euint32) => euint64 test 3 (1917361699, 1917361699)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1917361699n },
        { type: 'uint32', value: 1917361699n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3834723398n);
  });

  it('test operator "add" overload (euint64, euint32) => euint64 test 4 (1917361699, 1917361697)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1917361699n },
        { type: 'uint32', value: 1917361697n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.add_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3834723396n);
  });

  it('test operator "sub" overload (euint64, euint32) => euint64 test 1 (3557013474, 3557013474)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 3557013474n },
        { type: 'uint32', value: 3557013474n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "sub" overload (euint64, euint32) => euint64 test 2 (3557013474, 3557013470)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 3557013474n },
        { type: 'uint32', value: 3557013470n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.sub_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "mul" overload (euint64, euint32) => euint64 test 1 (2147373003, 2)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 2147373003n },
        { type: 'uint32', value: 2n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4294746006n);
  });

  it('test operator "mul" overload (euint64, euint32) => euint64 test 2 (42092, 42092)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42092n },
        { type: 'uint32', value: 42092n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1771736464n);
  });

  it('test operator "mul" overload (euint64, euint32) => euint64 test 3 (42092, 42092)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42092n },
        { type: 'uint32', value: 42092n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1771736464n);
  });

  it('test operator "mul" overload (euint64, euint32) => euint64 test 4 (42092, 42092)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 42092n },
        { type: 'uint32', value: 42092n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.mul_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1771736464n);
  });

  it('test operator "and" overload (euint64, euint32) => euint64 test 1 (18443340615747495721, 1886269589)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18443340615747495721n },
        { type: 'uint32', value: 1886269589n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(807936001n);
  });

  it('test operator "and" overload (euint64, euint32) => euint64 test 2 (1886269585, 1886269589)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1886269585n },
        { type: 'uint32', value: 1886269589n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1886269585n);
  });

  it('test operator "and" overload (euint64, euint32) => euint64 test 3 (1886269589, 1886269589)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1886269589n },
        { type: 'uint32', value: 1886269589n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1886269589n);
  });

  it('test operator "and" overload (euint64, euint32) => euint64 test 4 (1886269589, 1886269585)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 1886269589n },
        { type: 'uint32', value: 1886269585n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.and_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(1886269585n);
  });

  it('test operator "or" overload (euint64, euint32) => euint64 test 1 (18440498729023018751, 3083026667)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18440498729023018751n },
        { type: 'uint32', value: 3083026667n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18440498731564914431n);
  });

  it('test operator "or" overload (euint64, euint32) => euint64 test 2 (3083026663, 3083026667)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 3083026663n },
        { type: 'uint32', value: 3083026667n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3083026671n);
  });

  it('test operator "or" overload (euint64, euint32) => euint64 test 3 (3083026667, 3083026667)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 3083026667n },
        { type: 'uint32', value: 3083026667n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3083026667n);
  });

  it('test operator "or" overload (euint64, euint32) => euint64 test 4 (3083026667, 3083026663)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 3083026667n },
        { type: 'uint32', value: 3083026663n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.or_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(3083026671n);
  });

  it('test operator "xor" overload (euint64, euint32) => euint64 test 1 (18440290765836745353, 2806942302)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18440290765836745353n },
        { type: 'uint32', value: 2806942302n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(18440290767434150103n);
  });

  it('test operator "xor" overload (euint64, euint32) => euint64 test 2 (2806942298, 2806942302)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 2806942298n },
        { type: 'uint32', value: 2806942302n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "xor" overload (euint64, euint32) => euint64 test 3 (2806942302, 2806942302)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 2806942302n },
        { type: 'uint32', value: 2806942302n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(0n);
  });

  it('test operator "xor" overload (euint64, euint32) => euint64 test 4 (2806942302, 2806942298)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 2806942302n },
        { type: 'uint32', value: 2806942298n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.xor_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readUint64({ euint64: await this.contract3.resEuint64() });
    expect(res).to.equal(4n);
  });

  it('test operator "eq" overload (euint64, euint32) => ebool test 1 (18440592499984158377, 4273029219)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 18440592499984158377n },
        { type: 'uint32', value: 4273029219n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint64, euint32) => ebool test 2 (4273029215, 4273029219)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 4273029215n },
        { type: 'uint32', value: 4273029219n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });

  it('test operator "eq" overload (euint64, euint32) => ebool test 3 (4273029219, 4273029219)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 4273029219n },
        { type: 'uint32', value: 4273029219n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(true);
  });

  it('test operator "eq" overload (euint64, euint32) => ebool test 4 (4273029219, 4273029215)', async function () {
    const encryptedAmount = await fhevm.client.encryptValues({
      values: [
        { type: 'uint64', value: 4273029219n },
        { type: 'uint32', value: 4273029215n },
      ],
      contractAddress: this.contract3Address,
      userAddress: this.signers.alice.address,
    });
    const tx = await this.contract3.eq_euint64_euint32(
      at(encryptedAmount.encryptedValues, 0),
      at(encryptedAmount.encryptedValues, 1),
      encryptedAmount.inputProof,
    );
    await tx.wait();
    const res = await fhevm.cleartextDb.readBool({ ebool: await this.contract3.resEbool() });
    expect(res).to.equal(false);
  });
});
