import { expect } from "chai";
import { Signer } from "ethers";
import * as hre from "hardhat";

import { TestTrivialPermissions } from "../../../typechain-types";
import { Signers, getSigners, initSigners } from "../signers";

export async function _deployFixture(account: Signer): Promise<TestTrivialPermissions> {
  const contractFactory = await hre.ethers.getContractFactory("TestTrivialPermissions");
  const contract = await contractFactory.connect(account).deploy();
  await contract.waitForDeployment();
  return contract;
}

describe("TestTrivialPermissions", function () {
  let signers: Signers;
  let testTrivialPermissions: TestTrivialPermissions;

  before(async function () {
    await initSigners();
    signers = await getSigners();
  });

  beforeEach(async function () {
    const contract = await _deployFixture(signers.alice);
    testTrivialPermissions = contract;
  });

  it("should fail because missing ACL permission", async function () {
    await expect(testTrivialPermissions.connect(signers.carol).computeFheAdd()).to.be.revertedWithCustomError(
      ...hre.fhevm.revertedWithCustomErrorArgs("FHEVMExecutor", "ACLNotAllowed"),
    );
  });
});
