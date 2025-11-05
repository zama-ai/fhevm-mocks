// import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import * as hre from "hardhat";

// import { HardhatFhevmRuntimeEnvironment } from "../../../src/types";
// import { DecryptSingleValueInSolidity, DecryptSingleValueInSolidity__factory } from "../../../typechain-types";
// import { Signers } from "../signers";

// async function deployFixture() {
//   // Contracts are deployed using the first signer/account by default
//   const factory = (await ethers.getContractFactory(
//     "DecryptSingleValueInSolidity",
//   )) as DecryptSingleValueInSolidity__factory;
//   const decryptSingleValueInSolidity = (await factory.deploy()) as DecryptSingleValueInSolidity;
//   const decryptSingleValueInSolidity_address = await decryptSingleValueInSolidity.getAddress();

//   return { decryptSingleValueInSolidity, decryptSingleValueInSolidity_address };
// }

// /**
//  * This trivial example demonstrates the FHE decryption mechanism
//  * and highlights a common pitfall developers may encounter.
//  */
// describe("DecryptSingleValueInSolidity", function () {
//   let contract: DecryptSingleValueInSolidity;
//   let signers: Signers;

//   before(async function () {
//     // Check whether the tests are running against an FHEVM mock environment
//     if (!hre.fhevm.isMock) {
//       throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
//     }

//     const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
//     signers = { owner: ethSigners[0], alice: ethSigners[1] };
//   });

//   beforeEach(async function () {
//     // Deploy a new contract each time we run a new test
//     const deployment = await deployFixture();
//     contract = deployment.decryptSingleValueInSolidity;
//   });

//   // ✅ Test should succeed
//   it("decryption should succeed", async function () {
//     let tx = await contract.connect(signers.alice).initializeUint32(123456);
//     await tx.wait();

//     tx = await contract.requestDecryptSingleUint32();
//     await tx.wait();

//     // We use the FHEVM Hardhat plugin to simulate the asynchronous on-chain
//     // decryption
//     const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

//     // Use the built-in `awaitDecryptionOracle` helper to wait for the FHEVM decryption oracle
//     // to complete all pending Solidity decryption requests.
//     await fhevm.awaitDecryptionOracle();

//     // At this point, the Solidity callback should have been invoked by the FHEVM backend.
//     // We can now retrieve the decrypted (clear) value.
//     const clearUint32 = await contract.clearUint32();

//     expect(clearUint32).to.equal(123456 + 1);
//   });

//   // ❌ Test should fail
//   it("decryption should fail", async function () {
//     const tx = await contract.connect(signers.alice).initializeUint32Wrong(123456);
//     await tx.wait();

//     const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

//     const senderNotAllowedError = fhevm.revertedWithCustomErrorArgs("ACL", "SenderNotAllowed");

//     await expect(contract.connect(signers.alice).requestDecryptSingleUint32()).to.be.revertedWithCustomError(
//       ...senderNotAllowedError,
//     );
//   });
// });
