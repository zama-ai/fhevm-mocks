import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import * as hre from "hardhat";

type Signers = {
  alice: HardhatEthersSigner;
};

const SEPOLIA_CONTRACT_ADDRESS = "0xe5952b5244d360a4C04292cDCAe5fa2229ebBdF2";

describe("DeployFHECounterUserDecrypt-Sepolia", function () {
  let signers: Signers;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };

    // Only Sepolia
    if (fhevm.isMock) {
      return;
    }
  });

  it("Deploy", async function () {
    // Set test timeout. Must be long enough since we are deploying a contract on Sepolia
    this.timeout(4 * 40000);

    // Only Sepolia
    if (!fhevm.isMock) {
      const code = await hre.ethers.provider.getCode(SEPOLIA_CONTRACT_ADDRESS);
      if (code.length > 3) {
        console.log(`FHECounterUserDecrypt: ${SEPOLIA_CONTRACT_ADDRESS}`);
        return;
      }
    }

    const contractFactory = await hre.ethers.getContractFactory("FHECounterUserDecrypt");
    const contract = await contractFactory.connect(signers.alice).deploy();
    const tx = await contract.waitForDeployment();
    const deployTx = tx.deploymentTransaction();
    if (deployTx) {
      console.log(`Tx: ${deployTx.hash}`);
      console.log(`BlockHash: ${deployTx.blockHash}`);
      console.log(`chainId: ${deployTx.chainId}`);
    }

    console.log(`Deployer: ${signers.alice.address}`);
    console.log(`FHECounterUserDecrypt: ${await contract.getAddress()}`);
  });
});
