import { FhevmType } from "@fhevm/mock-utils";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import type { FHEVMTestSuite1 } from "../../../typechain-types/contracts/operators/FHEVMTestSuite1";
import type { FHEVMTestSuite2 } from "../../../typechain-types/contracts/operators/FHEVMTestSuite2";
import type { FHEVMTestSuite3 } from "../../../typechain-types/contracts/operators/FHEVMTestSuite3";
import type { FHEVMTestSuite4 } from "../../../typechain-types/contracts/operators/FHEVMTestSuite4";
import type { FHEVMTestSuite5 } from "../../../typechain-types/contracts/operators/FHEVMTestSuite5";
import type { FHEVMTestSuite6 } from "../../../typechain-types/contracts/operators/FHEVMTestSuite6";
import type { FHEVMTestSuite7 } from "../../../typechain-types/contracts/operators/FHEVMTestSuite7";
import { getSigners, initSigners } from "../signers";

async function deployFHEVMTestFixture1(): Promise<FHEVMTestSuite1> {
  const signers = await getSigners();
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory("FHEVMTestSuite1");
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture2(): Promise<FHEVMTestSuite2> {
  const signers = await getSigners();
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory("FHEVMTestSuite2");
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture3(): Promise<FHEVMTestSuite3> {
  const signers = await getSigners();
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory("FHEVMTestSuite3");
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture4(): Promise<FHEVMTestSuite4> {
  const signers = await getSigners();
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory("FHEVMTestSuite4");
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture5(): Promise<FHEVMTestSuite5> {
  const signers = await getSigners();
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory("FHEVMTestSuite5");
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture6(): Promise<FHEVMTestSuite6> {
  const signers = await getSigners();
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory("FHEVMTestSuite6");
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

async function deployFHEVMTestFixture7(): Promise<FHEVMTestSuite7> {
  const signers = await getSigners();
  const admin = signers.alice;

  const contractFactory = await ethers.getContractFactory("FHEVMTestSuite7");
  const contract = await contractFactory.connect(admin).deploy();
  await contract.waitForDeployment();

  return contract;
}

describe("FHEVM operations 13", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();

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

  it('test operator "not" overload (euint256) => euint256 test 1 (115792089237316195423570985008687907853269984665640564039457575743487352122021)', async function () {
    const input = hre.fhevm.createEncryptedInput(this.contract7Address, this.signers.alice.address);
    input.add256(115792089237316195423570985008687907853269984665640564039457575743487352122021n);
    const encryptedAmount = await input.encrypt();
    const tx = await this.contract7.not_euint256(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx.wait();
    const res = await hre.fhevm.debugger.decryptEuint(FhevmType.euint256, await this.contract7.resEuint256());
    expect(res).to.equal(8264425777517914n);
  });
});
