import { FhevmType } from "@fhevm/mock-utils";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { FHECounterUserDecrypt } from "../../typechain-types";

type Signers = {
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const fheCounterContractAddress = "0xe5952b5244d360a4C04292cDCAe5fa2229ebBdF2";
  const fheCounterContract = await ethers.getContractAt("FHECounterUserDecrypt", fheCounterContractAddress);
  return { fheCounterContract, fheCounterContractAddress };
}

describe("Sepolia:FHECounterUserDecrypt", function () {
  let signers: Signers;
  let fheCounterContract: FHECounterUserDecrypt;
  let fheCounterContractAddress: string;

  before(async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    ({ fheCounterContract, fheCounterContractAddress } = await deployFixture());
  });

  it("Sepolia:Encrypt 123", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    console.log(`Encrypting 123...`);
    const encryptedOneTwoThree = await fhevm
      .createEncryptedInput(fheCounterContractAddress, signers.alice.address)
      .add32(123)
      .encrypt();

    /*
      FHECounterUserDecrypt=0xe5952b5244d360a4C04292cDCAe5fa2229ebBdF2
      User=0x37AC010c1c566696326813b840319B58Bb5840E4
      Handle (euint32)=0x8c2ce702e2015a9cbc36100abe5f872650cb47e04e000000000000aa36a70400
      InputProof=0x01018c2ce702e2015a9cbc36100abe5f872650cb47e04e000000000000aa36a70400a0112f1f7db117202bf6f428e063ad71b6101cf2c934ae0ca85f944d7c46d06156bbfb183f3a3343d2cf365a5a9dfa0ddf4b5a127aeef66c8a1f644a815e4b741b00
    */

    console.log(`FHECounterUserDecrypt=${fheCounterContractAddress}`);
    console.log(`User=${signers.alice.address}`);
    console.log(`Handle=${ethers.hexlify(encryptedOneTwoThree.handles[0])}`);
    console.log(`InputProof=${ethers.hexlify(encryptedOneTwoThree.inputProof)}`);
  });

  it("Sepolia:Increment 123", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    //FHECounterUserDecrypt=0xe5952b5244d360a4C04292cDCAe5fa2229ebBdF2
    //User=0x37AC010c1c566696326813b840319B58Bb5840E4
    const handle = "0x8c2ce702e2015a9cbc36100abe5f872650cb47e04e000000000000aa36a70400";
    const proof =
      "0x01018c2ce702e2015a9cbc36100abe5f872650cb47e04e000000000000aa36a70400a0112f1f7db117202bf6f428e063ad71b6101cf2c934ae0ca85f944d7c46d06156bbfb183f3a3343d2cf365a5a9dfa0ddf4b5a127aeef66c8a1f644a815e4b741b00";

    console.log(`increment ${handle}...`);

    const tx = await fheCounterContract.connect(signers.alice).increment(handle, proof);
    const receipt = await tx.wait();

    // Tx: 0xc7f3f225ae5fa5ed2899a836055926379a24caed26912bd4f5c96aa1635b83b9
    console.log(`Tx: ${receipt?.hash}`);
  });

  it("Sepolia:GetCount", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    console.log(`GetCount...`);

    const enc = await fheCounterContract.connect(signers.alice).getCount();

    // Count=0x6f2a0e691faf5829e2de5e794a34049352be1abf1bff0000000000aa36a70400
    console.log(`Handle: ${enc}`);
  });

  it("Sepolia:UserDecrypt", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    console.log(`GetCount...`);

    const enc = await fheCounterContract.connect(signers.alice).getCount();

    // Count=0x6f2a0e691faf5829e2de5e794a34049352be1abf1bff0000000000aa36a70400
    console.log(`Handle: ${enc}`);

    try {
      const clear = await fhevm.userDecryptEuint(FhevmType.euint32, enc, fheCounterContractAddress, signers.alice);

      console.log(`Clear: ${clear}`);
    } catch (e) {
      console.log(e);
      console.log((e as any).cause);
      throw e;
    }
  });

  it("Sepolia:Increment the counter by 1", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    let step = 1;
    let steps = 10;

    console.log(`${step++}/${steps} Encrypting '0'...`);
    const encryptedZero = await fhevm
      .createEncryptedInput(fheCounterContractAddress, signers.alice.address)
      .add32(0)
      .encrypt();

    console.log(
      `${step++}/${steps} Call increment(0) FHECounter=${fheCounterContractAddress} handle=${ethers.hexlify(encryptedZero.handles[0])} signer=${signers.alice.address}...`,
    );
    let tx = await fheCounterContract
      .connect(signers.alice)
      .increment(encryptedZero.handles[0], encryptedZero.inputProof);
    await tx.wait();

    console.log(`${step++}/${steps} Call FHECounter.getCount()...`);
    const encryptedCountBeforeInc = await fheCounterContract.getCount();
    expect(encryptedCountBeforeInc).to.not.eq(ethers.ZeroHash);

    console.log(`${step++}/${steps} Decrypting FHECounter.getCount()=${encryptedCountBeforeInc}...`);
    const clearCountBeforeInc = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCountBeforeInc,
      fheCounterContractAddress,
      signers.alice,
    );
    console.log(`${step++}/${steps} Clear FHECounter.getCount()=${clearCountBeforeInc}`);

    console.log(`${step++}/${steps} Encrypting '1'...`);
    const encryptedOne = await fhevm
      .createEncryptedInput(fheCounterContractAddress, signers.alice.address)
      .add32(1)
      .encrypt();

    console.log(
      `${step++}/${steps} Call increment(1) FHECounter=${fheCounterContractAddress} handle=${ethers.hexlify(encryptedOne.handles[0])} signer=${signers.alice.address}...`,
    );
    tx = await fheCounterContract.connect(signers.alice).increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    console.log(`${step++}/${steps} Call FHECounter.getCount()...`);
    const encryptedCountAfterInc = await fheCounterContract.getCount();

    console.log(`${step++}/${steps} Decrypting FHECounter.getCount()=${encryptedCountAfterInc}...`);
    const clearCountAfterInc = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCountAfterInc,
      fheCounterContractAddress,
      signers.alice,
    );
    console.log(`${step++}/${steps} Clear FHECounter.getCount()=${clearCountAfterInc}`);

    expect(clearCountAfterInc - clearCountBeforeInc).to.eq(1);
  });
});
