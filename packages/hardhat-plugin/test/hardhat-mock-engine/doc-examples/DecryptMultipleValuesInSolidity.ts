// import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import * as hre from "hardhat";

// import { DecryptMultipleValuesInSolidity, DecryptMultipleValuesInSolidity__factory } from "../../../typechain-types";
// import { HardhatFhevmRuntimeEnvironment } from "../../types";
// import { Signers } from "../signers";

// async function deployFixture() {
//   // Contracts are deployed using the first signer/account by default
//   const factory = (await ethers.getContractFactory(
//     "DecryptMultipleValuesInSolidity",
//   )) as DecryptMultipleValuesInSolidity__factory;
//   const decryptMultipleValuesInSolidity = (await factory.deploy()) as DecryptMultipleValuesInSolidity;
//   const decryptMultipleValuesInSolidity_address = await decryptMultipleValuesInSolidity.getAddress();

//   return { decryptMultipleValuesInSolidity, decryptMultipleValuesInSolidity_address };
// }

// /**
//  * This trivial example demonstrates the FHE decryption mechanism
//  * and highlights a common pitfall developers may encounter.
//  */
// describe("DecryptMultipleValuesInSolidity", function () {
//   let contract: DecryptMultipleValuesInSolidity;
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
//     contract = deployment.decryptMultipleValuesInSolidity;
//   });

//   // ✅ Test should succeed
//   it("decryption should succeed", async function () {
//     // For simplicity, we create 3 trivialy encrypted values on-chain.
//     let tx = await contract.connect(signers.alice).initialize(true, 123456, 78901234567);
//     await tx.wait();

//     tx = await contract.requestDecryptMultipleValues();
//     await tx.wait();

//     // We use the FHEVM Hardhat plugin to simulate the asynchronous on-chain
//     // decryption
//     const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

//     // Use the built-in `awaitDecryptionOracle` helper to wait for the FHEVM decryption oracle
//     // to complete all pending Solidity decryption requests.
//     await fhevm.awaitDecryptionOracle();

//     // At this point, the Solidity callback should have been invoked by the FHEVM backend.
//     // We can now retrieve the 3 decrypted (clear) values.
//     const clearBool = await contract.clearBool();
//     const clearUint32 = await contract.clearUint32();
//     const clearUint64 = await contract.clearUint64();

//     expect(clearBool).to.equal(true);
//     expect(clearUint32).to.equal(123456 + 1);
//     expect(clearUint64).to.equal(78901234567 + 1);
//   });
// });
