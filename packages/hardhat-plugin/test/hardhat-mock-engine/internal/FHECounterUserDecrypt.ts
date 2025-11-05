import { utils } from "@fhevm/mock-utils";
import { FhevmType } from "@fhevm/mock-utils";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

import { FHECounterUserDecrypt, FHECounterUserDecrypt__factory } from "../../../typechain-types";

type Signers = {
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHECounterUserDecrypt")) as FHECounterUserDecrypt__factory;
  const fheCounterContract = (await factory.deploy()) as FHECounterUserDecrypt;
  const fheCounterContractAddress = await fheCounterContract.getAddress();

  return { fheCounterContract, fheCounterContractAddress };
}

describe("FHECounterUserDecrypt", function () {
  let signers: Signers;
  let fheCounterContract: FHECounterUserDecrypt;
  let fheCounterContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    ({ fheCounterContract, fheCounterContractAddress } = await deployFixture());
  });

  it("increment the counter by 1 multiple times - userDecrypt multiple values", async function () {
    const encryptedOne = await fhevm
      .createEncryptedInput(fheCounterContractAddress, signers.alice.address)
      .add32(1)
      .encrypt();

    let tx = await fheCounterContract
      .connect(signers.alice)
      .increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    const encryptedCountAfterInc1 = await fheCounterContract.getCount();

    tx = await fheCounterContract.connect(signers.alice).increment(encryptedOne.handles[0], encryptedOne.inputProof);
    await tx.wait();

    const encryptedCountAfterInc2 = await fheCounterContract.getCount();

    const clearCountAfterInc1 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCountAfterInc1,
      fheCounterContractAddress,
      signers.alice,
    );
    const clearCountAfterInc2 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedCountAfterInc2,
      fheCounterContractAddress,
      signers.alice,
    );

    const { publicKey: publicKeyAlice, privateKey: privateKeyAlice } = fhevm.generateKeypair();

    const startTimestamp = utils.timestampNow();
    const durationDays = 365;

    const eip712Alice = fhevm.createEIP712(publicKeyAlice, [fheCounterContractAddress], startTimestamp, durationDays);
    const signatureAlice = await signers.alice.signTypedData(
      eip712Alice.domain,
      { UserDecryptRequestVerification: eip712Alice.types.UserDecryptRequestVerification },
      eip712Alice.message,
    );

    // Test multiple decryptions
    const decryptedResults = await fhevm.userDecrypt(
      [
        { handle: encryptedCountAfterInc1, contractAddress: fheCounterContractAddress },
        { handle: encryptedCountAfterInc2, contractAddress: fheCounterContractAddress },
      ],
      privateKeyAlice,
      publicKeyAlice,
      signatureAlice,
      [fheCounterContractAddress],
      signers.alice.address,
      startTimestamp,
      durationDays,
    );

    expect(clearCountAfterInc1).to.eq(1);
    expect(clearCountAfterInc2).to.eq(2);
    expect(decryptedResults[encryptedCountAfterInc1 as `0x${string}`]).to.eq(1);
    expect(decryptedResults[encryptedCountAfterInc2 as `0x${string}`]).to.eq(2);
  });
});
