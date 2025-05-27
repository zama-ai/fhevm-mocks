import { expect } from "chai";
import * as hre from "hardhat";

import { TestAsyncDecrypt } from "../../../typechain-types";
import { Signers, getSigners, initSigners } from "../signers";

describe("TestAsyncDecrypt", function () {
  let signers: Signers;
  let relayerAddress: string;
  let contract: TestAsyncDecrypt;
  let contractAddress: string;
  let otherContract: TestAsyncDecrypt;
  let otherContractAddress: string;

  before(async function () {
    await initSigners();
    signers = await getSigners();
    relayerAddress = hre.fhevm.relayerSignerAddress;
  });

  beforeEach(async function () {
    const contractFactory = await hre.ethers.getContractFactory("TestAsyncDecrypt");
    contract = await contractFactory.connect(signers.alice).deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
    await hre.fhevm.assertCoprocessorInitialized(contract, "TestAsyncDecrypt");
    await hre.fhevm.assertDecryptionOracleInitialized(contract, "TestAsyncDecrypt");

    otherContract = await contractFactory.connect(signers.alice).deploy();
    await otherContract.waitForDeployment();
    otherContractAddress = await otherContract.getAddress();
  });

  it.skip("test async decrypt bool infinite loop", async function () {
    const balanceBeforeR = await hre.ethers.provider.getBalance(relayerAddress);
    const balanceBeforeU = await hre.ethers.provider.getBalance(signers.carol.address);
    const tx = await contract.connect(signers.carol).requestBoolInfinite();
    await tx.wait();
    const balanceAfterU = await hre.ethers.provider.getBalance(signers.carol.address);
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBool();
    console.log(y);
    const balanceAfterR = await hre.ethers.provider.getBalance(relayerAddress);
    console.log("gas paid by relayer (fulfil tx) : ", balanceBeforeR - balanceAfterR);
    console.log("gas paid by user (request tx) : ", balanceBeforeU - balanceAfterU);
  });

  it("test async decrypt bool", async function () {
    const balanceBeforeR = await hre.ethers.provider.getBalance(relayerAddress);
    const balanceBeforeU = await hre.ethers.provider.getBalance(signers.carol.address);
    const tx2 = await contract.connect(signers.carol).requestBool();
    await tx2.wait();
    const balanceAfterU = await hre.ethers.provider.getBalance(signers.carol.address);
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBool();
    expect(y).to.equal(true);
    const balanceAfterR = await hre.ethers.provider.getBalance(relayerAddress);
    console.log("gas paid by relayer (fulfil tx) : ", balanceBeforeR - balanceAfterR);
    console.log("gas paid by user (request tx) : ", balanceBeforeU - balanceAfterU);
  });

  // it.skip("test async decrypt FAKE bool", async function () {
  //   if (hre.network.name !== "hardhat") {
  //     // only in fhevm mode
  //     const txObject = await contract.requestFakeBool.populateTransaction();
  //     const tx = await signers.carol.sendTransaction(txObject);
  //     let receipt = null;
  //     let waitTime = 0;
  //     while (receipt === null && waitTime < 15000) {
  //       receipt = await hre.ethers.provider.getTransactionReceipt(tx.hash);
  //       if (receipt === null) {
  //         console.log("Trying again to fetch txn receipt....");
  //         await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  //         waitTime += 5000;
  //       }
  //     }
  //     receipt === null ? expect(waitTime >= 15000).to.be.true : expect(receipt!.status).to.equal(0);
  //   }
  // });

  it("test async decrypt uint8", async function () {
    const tx2 = await contract.connect(signers.carol).requestUint8();
    await tx2.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint8();
    expect(y).to.equal(42);
  });

  it("Trace encrypted input", async function () {
    const inputCarol = hre.fhevm.createEncryptedInput(contractAddress, signers.carol.address);
    inputCarol.add64(12345n);
    const enc = await inputCarol.encrypt();
    const tx = await contract.connect(signers.carol).externalEuint64ToEuint64(enc.handles[0], enc.inputProof);
    const receipt = await tx.wait();
    const evts = hre.fhevm.parseCoprocessorEvents(receipt?.logs);
    console.log(evts);

    const inputEuint64 = await contract.inputEuint64();
    const inputEuint64Bytes32 = await contract.inputEuint64Bytes32();

    console.log("enc.handles[0]      : " + hre.ethers.hexlify(enc.handles[0]));
    console.log("inputEuint64        : " + inputEuint64);
    console.log("inputEuint64Bytes32 : " + inputEuint64Bytes32);
  });

  // it.skip("test async decrypt FAKE uint8", async function () {
  //   if (hre.network.name !== "hardhat") {
  //     // only in fhevm mode
  //     const txObject = await contract.requestFakeUint8.populateTransaction();
  //     const tx = await signers.carol.sendTransaction(txObject);
  //     let receipt = null;
  //     let waitTime = 0;
  //     while (receipt === null && waitTime < 15000) {
  //       receipt = await hre.ethers.provider.getTransactionReceipt(tx.hash);
  //       if (receipt === null) {
  //         console.log("Trying again to fetch txn receipt....");
  //         await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  //         waitTime += 5000;
  //       }
  //     }
  //     expect(waitTime >= 15000).to.be.true;
  //   }
  // });

  it.skip("Debug test async decrypt uint16 using fhevm.debugger.createDecryptionSignatures", async function () {
    const tx = await contract.connect(signers.carol).requestUint16();
    await tx.wait();
    const xUint16 = await contract.getXUint16();
    // if test fails in Anvil, this means that requestIDs are probably not in sync.
    // An old test has been executed and the chain is not in sync with the current test.
    // Restart anvil.
    const signatures = await hre.fhevm.debugger.createDecryptionSignatures([xUint16], [16n]);
    await contract.callbackUint16(0, 16, signatures);
    const y = await contract.yUint16();
    expect(y).to.equal(16);
  });

  it("test async decrypt uint16", async function () {
    const tx = await contract.connect(signers.carol).requestUint16();
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint16();
    expect(y).to.equal(16);
  });

  // it.skip("test async decrypt FAKE uint16", async function () {
  //   if (hre.network.name !== "hardhat") {
  //     // only in fhevm mode
  //     const txObject = await contract.requestFakeUint16.populateTransaction();
  //     const tx = await signers.carol.sendTransaction(txObject);
  //     let receipt = null;
  //     let waitTime = 0;
  //     while (receipt === null && waitTime < 15000) {
  //       receipt = await hre.ethers.provider.getTransactionReceipt(tx.hash);
  //       if (receipt === null) {
  //         console.log("Trying again to fetch txn receipt....");
  //         await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  //         waitTime += 5000;
  //       }
  //     }
  //     expect(waitTime >= 15000).to.be.true;
  //   }
  // });

  it("test async decrypt uint32", async function () {
    const tx2 = await contract.connect(signers.carol).requestUint32(5, 15);
    await tx2.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint32();
    expect(y).to.equal(52); // 5+15+32
  });

  // it.skip("test async decrypt FAKE uint32", async function () {
  //   if (hre.network.name !== "hardhat") {
  //     // only in fhevm mode
  //     const txObject = await contract.requestFakeUint32.populateTransaction();
  //     const tx = await signers.carol.sendTransaction(txObject);
  //     let receipt = null;
  //     let waitTime = 0;
  //     while (receipt === null && waitTime < 15000) {
  //       receipt = await hre.ethers.provider.getTransactionReceipt(tx.hash);
  //       if (receipt === null) {
  //         console.log("Trying again to fetch txn receipt....");
  //         await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  //         waitTime += 5000;
  //       }
  //     }
  //     expect(waitTime >= 15000).to.be.true;
  //   }
  // });

  it("test async decrypt uint64", async function () {
    const tx2 = await contract.connect(signers.carol).requestUint64();
    await tx2.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint64();
    expect(y).to.equal(18446744073709551600n);
  });

  it("test async decrypt uint128", async function () {
    const tx2 = await contract.connect(signers.carol).requestUint128();
    await tx2.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint128();
    expect(y).to.equal(1267650600228229401496703205443n);
  });

  it("test async decrypt uint128 non-trivial", async function () {
    const inputAlice = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.add128(184467440737095500429401496n);
    const encryptedAmount = await inputAlice.encrypt();
    const tx = await contract.requestUint128NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint128();
    expect(y).to.equal(184467440737095500429401496n);
  });

  it("test async decrypt uint256", async function () {
    const tx2 = await contract.connect(signers.carol).requestUint256();
    await tx2.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint256();
    expect(y).to.equal(27606985387162255149739023449108101809804435888681546220650096895197251n);
  });

  it("test async decrypt uint256 non-trivial", async function () {
    const inputAlice = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.add256(6985387162255149739023449108101809804435888681546n);
    const encryptedAmount = await inputAlice.encrypt();
    const tx = await contract.requestUint256NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint256();
    expect(y).to.equal(6985387162255149739023449108101809804435888681546n);
  });

  // it.skip("test async decrypt FAKE uint64", async function () {
  //   if (hre.network.name !== "hardhat") {
  //     // only in fhevm mode
  //     const txObject = await contract.requestFakeUint64.populateTransaction();
  //     const tx = await signers.carol.sendTransaction(txObject);
  //     let receipt = null;
  //     let waitTime = 0;
  //     while (receipt === null && waitTime < 15000) {
  //       receipt = await hre.ethers.provider.getTransactionReceipt(tx.hash);
  //       if (receipt === null) {
  //         console.log("Trying again to fetch txn receipt....");
  //         await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  //         waitTime += 5000;
  //       }
  //     }
  //     expect(waitTime >= 15000).to.be.true;
  //   }
  // });

  it("test async decrypt address", async function () {
    const tx2 = await contract.connect(signers.carol).requestAddress();
    await tx2.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yAddress();
    expect(y).to.equal("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
  });

  it("test async decrypt several addresses", async function () {
    const tx2 = await contract.connect(signers.carol).requestSeveralAddresses();
    await tx2.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yAddress();
    const y2 = await contract.yAddress2();
    expect(y).to.equal("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    expect(y2).to.equal("0xf48b8840387ba3809DAE990c930F3b4766A86ca3");
  });

  // it.skip("test async decrypt FAKE address", async function () {
  //   if (hre.network.name !== "hardhat") {
  //     // only in fhevm mode
  //     const txObject = await contract.requestFakeAddress.populateTransaction();
  //     const tx = await signers.carol.sendTransaction(txObject);
  //     let receipt = null;
  //     let waitTime = 0;
  //     while (receipt === null && waitTime < 15000) {
  //       receipt = await hre.ethers.provider.getTransactionReceipt(tx.hash);
  //       if (receipt === null) {
  //         console.log("Trying again to fetch txn receipt....");
  //         await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds
  //         waitTime += 5000;
  //       }
  //     }
  //     expect(waitTime >= 15000).to.be.true;
  //   }
  // });

  it("test async decrypt uint64 non-trivial", async function () {
    const someUint64 = 18446744073709550042n;
    const inputAlice = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.add64(someUint64);
    const encryptedAmount = await inputAlice.encrypt();
    encryptedAmount.handles.forEach((handle, index) => {
      // Assuming handle is a Uint8Array or Buffer
      console.log(`  Handle ${index}: 0x${Buffer.from(handle).toString("hex")}`);
    });
    console.log("InputProof: 0x" + Buffer.from(encryptedAmount.inputProof).toString("hex"));
    const tx = await contract.requestUint64NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof);
    const receipt = await tx.wait();
    expect(receipt!.status).to.equal(1);
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yUint64();
    expect(y).to.equal(someUint64);
  });

  it("test async decrypt ebytes64 trivial", async function () {
    const tx = await contract.requestEbytes64Trivial("0x78685689");
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBytes64();
    expect(y).to.equal(hre.ethers.toBeHex(BigInt("0x78685689"), 64));
  });

  it("test async decrypt ebytes64 non-trivial", async function () {
    const inputAlice = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
    const someHex64 = hre.ethers.toBeHex(
      98870780878070870878787887072921111299111111000000292928818818818818221112111n,
      64,
    );
    inputAlice.addBytes64(hre.ethers.getBytes(someHex64));
    const encryptedAmount = await inputAlice.encrypt();
    const tx = await contract.requestEbytes64NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBytes64();
    expect(y).to.equal(someHex64);
  });

  it("test async decrypt ebytes128 trivial", async function () {
    const tx = await contract.requestEbytes128Trivial(
      "0x8701d11594415047dfac2d9cb87e6631df5a735a2f364fba1511fa7b812dfad2972b809b80ff25ec19591a598081af357cba384cf5aa8e085678ff70bc55faee",
    );
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBytes128();
    expect(y).to.equal(
      hre.ethers.toBeHex(
        BigInt(
          "0x8701d11594415047dfac2d9cb87e6631df5a735a2f364fba1511fa7b812dfad2972b809b80ff25ec19591a598081af357cba384cf5aa8e085678ff70bc55faee",
        ),
        128,
      ),
    );
  });

  it("test async decrypt ebytes128 non-trivial", async function () {
    const inputAlice = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
    const someHex128 = hre.ethers.toBeHex(
      9887078087807087087878788707292111129911111100000029292881881881881822111211198870780878070870878787887072921111299111111000000292928818818818818221112111n,
      128,
    );

    inputAlice.addBytes128(hre.ethers.getBytes(someHex128));
    const encryptedAmount = await inputAlice.encrypt();
    const tx = await contract.requestEbytes128NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBytes128();
    expect(y).to.equal(someHex128);
  });

  it("test async decrypt ebytes256 trivial", async function () {
    const tx = await contract.requestEbytes256Trivial("0x78685689");
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBytes256();
    expect(y).to.equal(hre.ethers.toBeHex(BigInt("0x78685689"), 256));
  });

  it("test async decrypt ebytes256 non-trivial", async function () {
    const inputAlice = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
    const someHex256 = hre.ethers.toBeHex(18446744073709550022n, 256);
    inputAlice.addBytes256(hre.ethers.getBytes(someHex256));
    const encryptedAmount = await inputAlice.encrypt();
    const tx = await contract.requestEbytes256NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBytes256();
    expect(y).to.equal(someHex256);
  });

  it("test async decrypt ebytes256 non-trivial with snapshot [skip-on-coverage]", async function () {
    if (hre.network.name === "hardhat" || hre.network.name === "localCoprocessorL1") {
      const snapshotId = await hre.ethers.provider.send("evm_snapshot");
      const inputAlice = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
      const someHex256 = hre.ethers.toBeHex(18446744073709550022n, 256);
      inputAlice.addBytes256(hre.ethers.getBytes(someHex256));
      const encryptedAmount = await inputAlice.encrypt();
      const tx = await contract.requestEbytes256NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof);
      await tx.wait();
      await hre.fhevm.awaitDecryptionOracle();
      const y = await contract.yBytes256();
      expect(y).to.equal(someHex256);

      await hre.ethers.provider.send("evm_revert", [snapshotId]);

      const someHex256_2 = hre.ethers.toBeHex(424242n, 256);
      const inputAlice2 = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
      inputAlice2.addBytes256(hre.ethers.getBytes(someHex256_2));

      const encryptedAmount2 = await inputAlice2.encrypt();
      const tx2 = await contract.requestEbytes256NonTrivial(encryptedAmount2.handles[0], encryptedAmount2.inputProof);
      await tx2.wait();
      await hre.fhevm.awaitDecryptionOracle();
      const y2 = await contract.yBytes256();
      expect(y2).to.equal(someHex256_2);
    }
  });

  it("test async decrypt mixed with ebytes256", async function () {
    const inputAlice = hre.fhevm.createEncryptedInput(contractAddress, signers.alice.address);
    const someHex256 = hre.ethers.toBeHex(18446744073709550032n, 256);
    inputAlice.addBytes256(hre.ethers.getBytes(someHex256));
    const encryptedAmount = await inputAlice.encrypt();
    const tx = await contract.requestMixedBytes256(encryptedAmount.handles[0], encryptedAmount.inputProof);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBytes256();
    expect(y).to.equal(someHex256);
    const y2 = await contract.yBytes64();
    expect(y2).to.equal(hre.ethers.toBeHex(BigInt("0xaaff42"), 64));
    const yb = await contract.yBool();
    expect(yb).to.equal(true);
    const yAdd = await contract.yAddress();
    expect(yAdd).to.equal("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
  });

  it("Test kms verification error because of a wrong signature should be human readable", async function () {
    const tx = await contract.requestEbytes64Trivial("0x78685689");
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    const y = await contract.yBytes64();
    expect(y).to.equal(hre.ethers.toBeHex(BigInt("0x78685689"), 64));

    const dummySig =
      "0x0a2c9b9dc10f296331f223a9ce6c859e332fff6fc8143462200c66f368cfb7f7432ace062b2381fc8071d89f01f0e38748da641fa8433fc24c8ff6fec9e321bd1b";

    // const tx2 = await contract
    //   .connect(signers.alice)
    //   .callbackUint64(0, hre.ethers.toBeHex(BigInt("0x78685689"), 64), [dummySig]);
    // await tx2.wait();

    await expect(
      contract.connect(signers.alice).callbackUint64(0, hre.ethers.toBeHex(BigInt("0x78685689"), 64), [dummySig]),
    ).to.be.revertedWithCustomError(...hre.fhevm.revertedWithCustomErrorArgs("KMSVerifier", "KMSInvalidSigner"));
  });

  it("Test input verification error because of a wrong contract address should be human readable", async function () {
    const input = hre.fhevm.createEncryptedInput(otherContractAddress, signers.alice.address);
    input.add64(12345n);
    const enc = await input.encrypt();
    try {
      const tx = await contract.externalEuint64ToEuint64(enc.handles[0], enc.inputProof);
      await tx.wait();
    } catch (e) {
      expect(
        (e as any).message.startsWith(
          `FHEVM Input verification error 'InvalidSigner()': The contract address ${contractAddress}`,
        ),
      ).to.eq(true);
    }
  });

  it("Test input verification error because of a wrong user address should be human readable", async function () {
    const input = hre.fhevm.createEncryptedInput(contractAddress, signers.bob.address);
    input.add64(12345n);
    const enc = await input.encrypt();
    try {
      const tx = await contract.externalEuint64ToEuint64(enc.handles[0], enc.inputProof);
      await tx.wait();
    } catch (e) {
      expect(
        (e as any).message.startsWith(
          `FHEVM Input verification error 'InvalidSigner()': The contract address ${contractAddress}`,
        ),
      ).to.eq(true);
    }
  });
});
