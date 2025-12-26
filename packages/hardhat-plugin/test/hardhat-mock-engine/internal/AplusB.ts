import { FhevmType } from "@fhevm/mock-utils";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "ethers";
import * as hre from "hardhat";

async function deployAPlusBFixture(account: HardhatEthersSigner) {
  const contractFactory = await hre.ethers.getContractFactory("APlusB");
  const contract = await contractFactory.connect(account).deploy();
  await contract.waitForDeployment();
  return contract as any as ethers.Contract;
}

describe("APlusB", function () {
  let aplusbContract: ethers.Contract;
  let aplusbContractAddress: string;

  before(async function () {
    const [alice] = await hre.ethers.getSigners();

    aplusbContract = await deployAPlusBFixture(alice);
    aplusbContractAddress = await aplusbContract.getAddress();

    await hre.fhevm.assertCoprocessorInitialized(aplusbContract, "APlusB");
  });

  it("uint8: add 80 to 123 should equal 203", async function () {
    const [alice] = await hre.ethers.getSigners();

    // 1. Validates and Stores value 'a'

    // Create the encrypted input
    const inputA = hre.fhevm.createEncryptedInput(aplusbContractAddress, alice.address);
    inputA.add8(80);
    const encryptedInputA = await inputA.encrypt();

    // Call the contract with the encrypted value `a`
    const encryptedA = encryptedInputA.handles[0];
    const proofA = encryptedInputA.inputProof;

    let tx = await aplusbContract.setA(encryptedA, proofA);
    await tx.wait();

    // 2. Validates and Stores value 'b'

    // Create the encrypted input
    const inputB = hre.fhevm.createEncryptedInput(aplusbContractAddress, alice.address);
    inputB.add8(123);
    const encryptedInputB = await inputB.encrypt();

    // Call the contract with the encrypted value `b`
    const encryptedB = encryptedInputB.handles[0];
    const proofB = encryptedInputB.inputProof;

    tx = await aplusbContract.setB(encryptedB, proofB);
    await tx.wait();

    // 3. Computes the FHE sum of `a` and `b`, storing the result as `aplusb` on chain
    tx = await aplusbContract.computeAPlusB();
    await tx.wait();

    // 4. Reads the encrypted result `aplusb` = `a` + `b`
    const encryptedAPlusB = await aplusbContract.aplusb();

    // 5. Decrypts `aplusb`
    const clearAPlusB = await hre.fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedAPlusB,
      aplusbContractAddress,
      alice as unknown as ethers.Signer,
    );

    expect(clearAPlusB).to.eq(80 + 123);
  });
});
