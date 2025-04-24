import { Signer } from "ethers";
import hre from "hardhat";

import { FhevmType } from "../../../src/types";
import type { CompoundTimelock, TestConfidentialGovernorAlpha } from "../../../typechain-types";

export async function deployTimelockFixture(account: Signer, adminAddress: string): Promise<CompoundTimelock> {
  const timelockFactory = await hre.ethers.getContractFactory("CompoundTimelock");
  const timelock = await timelockFactory.connect(account).deploy(adminAddress, 60 * 60 * 24 * 2);
  await timelock.waitForDeployment();
  return timelock;
}

export async function deployConfidentialGovernorAlphaFixture(
  account: Signer,
  confidentialERC20VotesAddress: string,
  timelockAddress: string,
): Promise<TestConfidentialGovernorAlpha> {
  // @dev We use 5 only for testing purpose.
  // DO NOT use this value in production.
  const votingPeriod = 5;
  // @dev We use 5 minutes for the maximum decryption delay (from the Gateway).
  const maxDecryptionDelay = 60 * 5;
  const governorFactory = await hre.ethers.getContractFactory("TestConfidentialGovernorAlpha");
  const governor = await governorFactory
    .connect(account)
    .deploy(account, timelockAddress, confidentialERC20VotesAddress, votingPeriod, maxDecryptionDelay);
  await governor.waitForDeployment();
  return governor;
}

export async function userDecryptVoteReceipt(
  account: Signer,
  proposalId: bigint,
  governor: TestConfidentialGovernorAlpha,
  governorAddress: string,
): Promise<[boolean, boolean, bigint]> {
  const [hasVoted, supportHandle, voteHandle] = await governor.getReceipt(proposalId, await account.getAddress());
  const support = await hre.fhevm.userDecryptEbool(supportHandle, governorAddress, account);
  const vote = await hre.fhevm.userDecryptEuint(FhevmType.euint64, voteHandle, governorAddress, account);

  return [hasVoted, support, vote];
}
