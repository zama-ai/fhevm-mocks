import { Signer } from "ethers";
import * as hre from "hardhat";

import type { TestErrors } from "../../../typechain-types";

export async function deployTestErrorsFixture(account: Signer): Promise<TestErrors> {
  const contractFactory = await hre.ethers.getContractFactory("TestErrors");
  const contract = await contractFactory.connect(account).deploy();
  await contract.waitForDeployment();
  return contract as unknown as TestErrors;
}
