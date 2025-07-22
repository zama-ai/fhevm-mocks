import { FhevmType } from "@fhevm/mock-utils";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { FHECounterUserDecrypt } from "../../typechain-types";

type Signers = {
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const fheCounterContractAddress = "0x5E895c26ED09A183CD28F81A4978891b9FdC2253";
  const fheCounterContract = await ethers.getContractAt("FHECounterUserDecrypt", fheCounterContractAddress);
  return { fheCounterContract, fheCounterContractAddress };
}

describe("FHECounterUserDecrypt-Sepolia", function () {
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

  it("increment the counter by 1", async function () {
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
