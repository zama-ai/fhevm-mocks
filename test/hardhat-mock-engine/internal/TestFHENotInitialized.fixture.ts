import { Signer } from "ethers";
import hre from "hardhat";

import type { TestFHENotInitialized } from "../../../typechain-types";

export async function deployTestFHENotInitializedFixture(account: Signer): Promise<TestFHENotInitialized> {
  const contractFactory = await hre.ethers.getContractFactory("TestFHENotInitialized");
  const contract = await contractFactory.connect(account).deploy();
  await contract.waitForDeployment();
  return contract;
}
