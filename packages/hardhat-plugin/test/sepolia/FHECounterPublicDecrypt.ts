import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";

import { FHECounterPublicDecrypt } from "../../typechain-types";

// npx hardhat test --grep "Sepolia:FHECounterPublicDecrypt:Encrypt:456" --network sepolia
// npx hardhat test --grep "Sepolia:FHECounterPublicDecrypt:Increment:456" --network sepolia
// npx hardhat test --grep "Sepolia:FHECounterPublicDecrypt:GetCount" --network sepolia
// npx hardhat test --grep "Sepolia:FHECounterPublicDecrypt:PublicDecrypt" --network sepolia
// npx hardhat test --grep "Sepolia:FHECounterPublicDecrypt:Verify" --network sepolia

type Signers = {
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const fheCounterContractAddress = "0xF9AaCFE5bd98D05659fC76a34f4AD98A661d1D07";
  const fheCounterContract = await ethers.getContractAt("FHECounterPublicDecrypt", fheCounterContractAddress);
  return { fheCounterContract, fheCounterContractAddress };
}

describe("Sepolia:FHECounterPublicDecrypt", function () {
  let signers: Signers;
  let fheCounterContract: FHECounterPublicDecrypt;
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

  it("Sepolia:FHECounterPublicDecrypt:Encrypt:456", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    console.log(`Encrypting 456...`);
    const enc = await fhevm.createEncryptedInput(fheCounterContractAddress, signers.alice.address).add32(456).encrypt();

    /*
      FHECounterUserDecrypt=0xF9AaCFE5bd98D05659fC76a34f4AD98A661d1D07
      User=0x37AC010c1c566696326813b840319B58Bb5840E4
      Handle=0x5f14cb9cd9a0e19f9df1cdd87660c48854d68994b8000000000000aa36a70400
      InputProof=0x01015f14cb9cd9a0e19f9df1cdd87660c48854d68994b8000000000000aa36a704009e07f1a39866e27c6e7655cc6714700d4281f822c8dcb45f8b9e926b1db711260f487d3a9bc7d6aca869eca2747e81b77406d0caa75a8595e96f0f1d5bc528261c00
    */

    console.log(`FHECounterUserDecrypt=${fheCounterContractAddress}`);
    console.log(`User=${signers.alice.address}`);
    console.log(`Handle=${ethers.hexlify(enc.handles[0])}`);
    console.log(`InputProof=${ethers.hexlify(enc.inputProof)}`);
  });

  it("Sepolia:FHECounterPublicDecrypt:Increment:456", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    const handle = "0x5f14cb9cd9a0e19f9df1cdd87660c48854d68994b8000000000000aa36a70400";
    const proof =
      "0x01015f14cb9cd9a0e19f9df1cdd87660c48854d68994b8000000000000aa36a704009e07f1a39866e27c6e7655cc6714700d4281f822c8dcb45f8b9e926b1db711260f487d3a9bc7d6aca869eca2747e81b77406d0caa75a8595e96f0f1d5bc528261c00";

    console.log(`increment ${handle}...`);

    const tx = await fheCounterContract.connect(signers.alice).increment(handle, proof);
    const receipt = await tx.wait();

    // Tx: 0x0096ed6eeb9f5a39b4ee4f953c83782da44839cb3e2fe246bf8db70053a47de8
    console.log(`Tx: ${receipt?.hash}`);
  });

  it("Sepolia:FHECounterPublicDecrypt:GetCount", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    console.log(`GetCount...`);

    const enc = await fheCounterContract.connect(signers.alice).getCount();

    // Count=0x72be79061de479187921844d862adb503af6991609ff0000000000aa36a70400
    console.log(`Handle: ${enc}`);
  });

  it("Sepolia:FHECounterPublicDecrypt:PublicDecrypt", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    console.log(`GetCount...`);

    const enc = await fheCounterContract.connect(signers.alice).getCount();

    // Count=0x72be79061de479187921844d862adb503af6991609ff0000000000aa36a70400
    console.log(`Handle: ${enc}`);

    try {
      const publicDecryptResults = await fhevm.publicDecrypt([enc]);

      console.log(`Clear: ${publicDecryptResults.clearValues[enc as `0x${string}`]}`);
      console.log(`abiEncodedClearValues: ${publicDecryptResults.abiEncodedClearValues}`);
      console.log(`decryptionProof: ${publicDecryptResults.decryptionProof}`);

      /*
        Handle: 0x72be79061de479187921844d862adb503af6991609ff0000000000aa36a70400
        Clear: 456
        abiEncodedClearValues: 0x00000000000000000000000000000000000000000000000000000000000001c8
        decryptionProof: 0x07c979a46c403b9cc51dce8901e4aedc148e3ba85764df000f783c508b39fca10a33a17e8b5f19438c280672d02935eb3a45c1563669cb6826516f2a3c4331dcaf1c9af995689822dc1b5566aa7dd1915a269bd081c1fc5d94fd8ded4fb848f4ebb423d884c004a87d0194614168e0d42c557a4b379d535400dcea6d9a667150d3561bee4d80a4c775cfe4cf2e844dc928cb07c9633deba70593354ac13304c1c97db950bd48940602092762def361c8bd9bbbcba2a937b8767ebdca600824f473c9801ba8d1019ffa5a5f372ca1c697d5dd4dda4b9ff7347ff6d767e9b357eaaebd9c082e38d0cc6732e06a95894ea6c9077b0c0169d9afbd09d1ebc33610be6ec5b59e1b0c45263188d55d64689efeebc8b5d255b614ba0c8fca7a6d923b61d6796e8b9c0c6e14dc913aab93ab386751f1e66737d685e4d7b6fb7ed5258cb53e5de4f6701c867961a444274722799f8a855511292a6c699926646bf5e5adc270297a25346829d7a68ee39610449569fe2938a6f93acf38a6b508cbbee989eb929bd9fa3ce61cd2fedb5d2e37f4dd90641a319bfed0471fa6fb02a418f8ce2c9eac12baa6395050764e1c1db519bec0871079b80a34ecf736889aab2b1e9e38175cb4b9ff3e4d1c      
      */
    } catch (e) {
      console.log(e);
      console.log((e as any).cause);
      throw e;
    }
  });

  it("Sepolia:FHECounterPublicDecrypt:Verify", async function () {
    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }

    this.timeout(4 * 40000);

    console.log(`Verify...`);

    await fheCounterContract
      .connect(signers.alice)
      .verify(
        ["0x72be79061de479187921844d862adb503af6991609ff0000000000aa36a70400"],
        "0x00000000000000000000000000000000000000000000000000000000000001c8",
        "0x07c979a46c403b9cc51dce8901e4aedc148e3ba85764df000f783c508b39fca10a33a17e8b5f19438c280672d02935eb3a45c1563669cb6826516f2a3c4331dcaf1c9af995689822dc1b5566aa7dd1915a269bd081c1fc5d94fd8ded4fb848f4ebb423d884c004a87d0194614168e0d42c557a4b379d535400dcea6d9a667150d3561bee4d80a4c775cfe4cf2e844dc928cb07c9633deba70593354ac13304c1c97db950bd48940602092762def361c8bd9bbbcba2a937b8767ebdca600824f473c9801ba8d1019ffa5a5f372ca1c697d5dd4dda4b9ff7347ff6d767e9b357eaaebd9c082e38d0cc6732e06a95894ea6c9077b0c0169d9afbd09d1ebc33610be6ec5b59e1b0c45263188d55d64689efeebc8b5d255b614ba0c8fca7a6d923b61d6796e8b9c0c6e14dc913aab93ab386751f1e66737d685e4d7b6fb7ed5258cb53e5de4f6701c867961a444274722799f8a855511292a6c699926646bf5e5adc270297a25346829d7a68ee39610449569fe2938a6f93acf38a6b508cbbee989eb929bd9fa3ce61cd2fedb5d2e37f4dd90641a319bfed0471fa6fb02a418f8ce2c9eac12baa6395050764e1c1db519bec0871079b80a34ecf736889aab2b1e9e38175cb4b9ff3e4d1c",
      );
  });
});
