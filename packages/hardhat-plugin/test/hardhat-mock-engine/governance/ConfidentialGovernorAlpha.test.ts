import { expect } from "chai";
import { BytesLike } from "ethers";
import * as hre from "hardhat";

import { CompoundTimelock, TestConfidentialERC20Votes, TestConfidentialGovernorAlpha } from "../../../typechain-types";
import { Signers, getSigners, initSigners } from "../signers";
import { mineNBlocks } from "../utils";
import { deployConfidentialERC20Votes, transferTokensAndDelegate } from "./ConfidentialERC20Votes.fixture";
import {
  deployConfidentialGovernorAlphaFixture,
  deployTimelockFixture,
  userDecryptVoteReceipt,
} from "./ConfidentialGovernorAlpha.fixture";

describe("ConfidentialGovernorAlpha", function () {
  let signers: Signers;
  let timelock: CompoundTimelock;
  let timelockAddress: string;
  let governor: TestConfidentialGovernorAlpha;
  let governorAddress: string;
  let confidentialERC20Votes: TestConfidentialERC20Votes;
  let confidentialERC20VotesAddress: string;
  let VOTING_DELAY: bigint;
  let VOTING_PERIOD: bigint;
  let TIMELOCK_DELAY: bigint;

  before(async function () {
    await initSigners();
    signers = await getSigners();
  });

  beforeEach(async function () {
    confidentialERC20Votes = await deployConfidentialERC20Votes(signers.alice);
    confidentialERC20VotesAddress = await confidentialERC20Votes.getAddress();

    const precomputedGovernorAddress = hre.ethers.getCreateAddress({
      from: signers.alice.address,
      nonce: (await signers.alice.getNonce()) + 1,
    });

    timelock = await deployTimelockFixture(signers.alice, precomputedGovernorAddress);
    timelockAddress = await timelock.getAddress();

    governor = await deployConfidentialGovernorAlphaFixture(
      signers.alice,
      confidentialERC20VotesAddress,
      timelockAddress,
    );
    governorAddress = await governor.getAddress();

    const tx = await confidentialERC20Votes.setGovernor(governorAddress);
    await tx.wait();

    VOTING_DELAY = await governor.VOTING_DELAY();
    VOTING_PERIOD = await governor.VOTING_PERIOD();
    TIMELOCK_DELAY = await timelock.delay();
  });

  it("BBB can propose a vote that becomes active if votes match the token threshold", async function () {
    const transferAmount = hre.ethers.parseUnits(String(500_000), 6);
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";

    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    const blockNumber = BigInt(await hre.ethers.provider.getBlockNumber());

    const tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    await expect(tx)
      .to.emit(governor, "ProposalCreated")
      .withArgs(
        1n,
        signers.bob.address,
        targets,
        values,
        signatures,
        calldatas,
        blockNumber + VOTING_DELAY + 1n, // @dev We add one since the transaction incremented the block number
        blockNumber + VOTING_DELAY + VOTING_PERIOD + 1n,
        description,
      );

    const proposalId = await governor.latestProposalIds(signers.bob.address);
    let proposalInfo = await governor.getProposalInfo(proposalId);

    // @dev .to.eql is used to compare array elements
    expect(proposalInfo.proposer).to.equal(signers.bob.address);
    expect(proposalInfo.targets).to.eql(targets);
    expect(proposalInfo.signatures).to.eql(signatures);
    expect(proposalInfo.calldatas).to.eql(calldatas);
    // 1 ==> PendingThresholdVerification
    expect(proposalInfo.state).to.equal(1);

    await hre.fhevm.awaitDecryptionOracle();

    proposalInfo = await governor.getProposalInfo(proposalId);
    // 3 ==> Active
    expect(proposalInfo.state).to.equal(3);
  });

  it("anyone can propose a vote but it is rejected if votes are below the token threshold", async function () {
    const transferAmount = (await governor.PROPOSAL_THRESHOLD()) - 1n;
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";

    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );
    const tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    const proposalId = await governor.latestProposalIds(signers.bob.address);
    let proposalInfo = await governor.getProposalInfo(proposalId);
    expect(proposalInfo.proposer).to.equal(signers.bob.address);

    // 1 ==> PendingThresholdVerification
    expect(proposalInfo.state).to.equal(1);
    await hre.fhevm.awaitDecryptionOracle();

    proposalInfo = await governor.getProposalInfo(proposalId);

    await hre.fhevm.awaitDecryptionOracle();

    // 2 ==> Rejected
    expect(proposalInfo.state).to.equal(2);
  });

  it("multiple users can vote and the vote succeeds if forVotes > quorum", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = hre.ethers.parseUnits(String(200_000), 6);

    // Bob and Carol receive 200k tokens and delegate to themselves.
    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    await transferTokensAndDelegate(
      signers.alice,
      signers.carol,
      await signers.carol.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    // INITIATE A PROPOSAL
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // DECRYPTION FOR THE TOKEN THRESHOLD
    await hre.fhevm.awaitDecryptionOracle();
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    // VOTE
    // Bob and Carol vote for
    let input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    let encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.bob)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    await expect(tx).to.emit(governor, "VoteCast").withArgs(
      signers.bob,
      1n, // @dev proposalId
    );

    input = hre.fhevm.createEncryptedInput(governorAddress, signers.carol.address);
    input.addBool(true);
    encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.carol)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    await expect(tx).to.emit(governor, "VoteCast").withArgs(
      signers.carol,
      1n, // @dev proposalId
    );

    // Bob/Carol can reeencrypt his/her receipt
    let [hasVoted, support, votes] = await userDecryptVoteReceipt(signers.bob, proposalId, governor, governorAddress);

    expect(hasVoted).to.be.eq(true);
    expect(support).to.be.eq(true);
    expect(votes).to.be.eq(transferAmount);

    [hasVoted, support, votes] = await userDecryptVoteReceipt(signers.carol, proposalId, governor, governorAddress);

    expect(hasVoted).to.be.eq(true);
    expect(support).to.be.eq(true);
    expect(votes).to.be.eq(transferAmount);

    // Mine blocks
    await mineNBlocks(hre, 3);

    // REQUEST DECRYPTION
    tx = await governor.requestVoteDecryption(proposalId);
    await tx.wait();

    let proposalInfo = await governor.getProposalInfo(proposalId);
    expect(proposalInfo.forVotesDecrypted).to.be.eq(hre.ethers.parseUnits(String(0), 6));
    expect(proposalInfo.againstVotesDecrypted).to.be.eq(hre.ethers.parseUnits(String(0), 6));
    // 4 ==> Succeeded
    expect(proposalInfo.state).to.equal(4);

    // POST-DECRYPTION RESULTS
    await hre.fhevm.awaitDecryptionOracle();
    proposalInfo = await governor.getProposalInfo(proposalId);
    expect(proposalInfo.forVotesDecrypted).to.be.eq(transferAmount * 2n);
    expect(proposalInfo.againstVotesDecrypted).to.be.eq(hre.ethers.parseUnits(String(0), 6));
    // 7 ==> Succeeded
    expect(proposalInfo.state).to.equal(7);

    const block = await hre.ethers.provider.getBlock(await hre.ethers.provider.getBlockNumber());

    if (block === null) {
      throw "Block is null. Check RPC config.";
    }

    const nextBlockTimestamp: bigint = BigInt(block.timestamp) + 30n;

    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [nextBlockTimestamp.toString()]);

    // QUEUING
    tx = await governor.queue(proposalId);
    await tx.wait();

    await expect(tx)
      .to.emit(governor, "ProposalQueued")
      .withArgs(
        1n, // @dev proposalId,
        nextBlockTimestamp + TIMELOCK_DELAY,
      );

    proposalInfo = await governor.getProposalInfo(proposalId);
    // 8 ==> Queued
    expect(proposalInfo.state).to.equal(8);
    const eta = proposalInfo.eta;
    expect(eta).to.equal(nextBlockTimestamp + TIMELOCK_DELAY);

    // EXECUTE
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [eta.toString()]);
    tx = await governor.execute(proposalId);
    await tx.wait();

    await expect(tx).to.emit(governor, "ProposalExecuted").withArgs(
      1n, // @dev proposalId
    );

    proposalInfo = await governor.getProposalInfo(proposalId);
    // 10 ==> Executed
    expect(proposalInfo.state).to.equal(10);
  });

  it("vote is defeated if forVotes < quorum", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = (await governor.QUORUM_VOTES()) - 1n;

    // Bob receives enough to create a proposal but not enough to match the quorum.
    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    // INITIATE A PROPOSAL
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // DECRYPTION FOR THE TOKEN THRESHOLD
    await hre.fhevm.awaitDecryptionOracle();
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    // VOTE
    const input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    const encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.bob)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    // Bob reeencrypts his receipt
    const [hasVoted, support, votes] = await userDecryptVoteReceipt(signers.bob, proposalId, governor, governorAddress);

    expect(hasVoted).to.be.eq(true);
    expect(support).to.be.eq(true);
    expect(votes).to.be.eq(transferAmount);

    // Mine blocks
    await mineNBlocks(hre, 4);

    // REQUEST DECRYPTION
    tx = await governor.requestVoteDecryption(proposalId);

    await tx.wait();
    let proposalInfo = await governor.getProposalInfo(proposalId);
    expect(proposalInfo.forVotesDecrypted).to.be.eq(hre.ethers.parseUnits(String(0), 6));
    expect(proposalInfo.againstVotesDecrypted).to.be.eq(hre.ethers.parseUnits(String(0), 6));
    // 4 ==> Succeeded
    expect(proposalInfo.state).to.equal(4);

    // POST-DECRYPTION RESULTS
    await hre.fhevm.awaitDecryptionOracle();
    proposalInfo = await governor.getProposalInfo(proposalId);
    expect(proposalInfo.forVotesDecrypted).to.be.eq(transferAmount);
    expect(proposalInfo.againstVotesDecrypted).to.be.eq(hre.ethers.parseUnits(String(0), 6));

    // 6 ==> Defeated
    expect(proposalInfo.state).to.equal(6);
  });

  it("vote is rejected if forVotes <= againstVotes", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmountFor = hre.ethers.parseUnits(String(500_000), 6);
    const transferAmountAgainst = transferAmountFor;

    // Bob and Carol receive 200k tokens and delegate to themselves.
    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmountFor,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    await transferTokensAndDelegate(
      signers.alice,
      signers.carol,
      await signers.carol.getAddress(),
      transferAmountAgainst,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );
    // INITIATE A PROPOSAL
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // DECRYPTION FOR THE TOKEN THRESHOLD
    await hre.fhevm.awaitDecryptionOracle();
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    // VOTE
    // Bob votes for but Carol votes against
    let input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    let encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.bob)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    input = hre.fhevm.createEncryptedInput(governorAddress, signers.carol.address);
    input.addBool(false);
    encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.carol)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    // Bob/Carol can reeencrypt his/her receipt
    let [hasVoted, support, votes] = await userDecryptVoteReceipt(signers.bob, proposalId, governor, governorAddress);

    expect(hasVoted).to.be.eq(true);
    expect(support).to.be.eq(true);
    expect(votes).to.be.eq(transferAmountFor);

    [hasVoted, support, votes] = await userDecryptVoteReceipt(signers.carol, proposalId, governor, governorAddress);

    expect(hasVoted).to.be.eq(true);
    expect(support).to.be.eq(false);
    expect(votes).to.be.eq(transferAmountAgainst);

    // Mine blocks
    await mineNBlocks(hre, 3);

    // REQUEST DECRYPTION
    tx = await governor.requestVoteDecryption(proposalId);
    await tx.wait();
    let proposalInfo = await governor.getProposalInfo(proposalId);
    expect(proposalInfo.forVotesDecrypted).to.be.eq(hre.ethers.parseUnits(String(0), 6));
    expect(proposalInfo.againstVotesDecrypted).to.be.eq(hre.ethers.parseUnits(String(0), 6));
    // 4 ==> Succeeded
    expect(proposalInfo.state).to.equal(4);

    // POST-DECRYPTION RESULTS
    await hre.fhevm.awaitDecryptionOracle();
    proposalInfo = await governor.getProposalInfo(proposalId);
    expect(proposalInfo.forVotesDecrypted).to.be.eq(transferAmountFor);
    expect(proposalInfo.againstVotesDecrypted).to.be.eq(transferAmountAgainst);
    // 6 ==> Defeated
    expect(proposalInfo.state).to.equal(6);
  });

  it("only owner could queue setTimelockPendingAdmin then execute it, and then acceptTimelockAdmin", async function () {
    const block = await hre.ethers.provider.getBlock(await hre.ethers.provider.getBlockNumber());
    let expiry;

    if (block === null) {
      throw "Block is null. Check RPC config.";
    } else {
      expiry = BigInt(block.timestamp) + TIMELOCK_DELAY + 1n;
    }

    const tx = await governor.queueSetTimelockPendingAdmin(signers.bob, expiry);
    await tx.wait();

    if (hre.network.name === "hardhat") {
      // hardhat cheatcodes are available only in mocked mode
      await expect(governor.executeSetTimelockPendingAdmin(signers.bob, expiry)).to.be.revertedWithCustomError(
        timelock,
        "TransactionTooEarlyForExecution",
      );

      await expect(
        governor.connect(signers.carol).queueSetTimelockPendingAdmin(signers.bob, expiry),
      ).to.be.revertedWithCustomError(governor, "OwnableUnauthorizedAccount");

      await hre.ethers.provider.send("evm_increaseTime", ["0x2a33c"]);

      await expect(
        governor.connect(signers.carol).executeSetTimelockPendingAdmin(signers.bob, expiry),
      ).to.be.revertedWithCustomError(governor, "OwnableUnauthorizedAccount");

      const tx3 = await governor.executeSetTimelockPendingAdmin(signers.bob, expiry);
      await tx3.wait();

      await expect(timelock.acceptAdmin()).to.be.revertedWithCustomError(timelock, "SenderIsNotPendingAdmin");

      const tx4 = await timelock.connect(signers.bob).acceptAdmin();
      await tx4.wait();

      const latestBlockNumber = await hre.ethers.provider.getBlockNumber();
      const block = await hre.ethers.provider.getBlock(latestBlockNumber);

      let expiry2;
      if (block === null) {
        throw "Block is null. Check RPC config.";
      } else {
        expiry2 = BigInt(block.timestamp) + TIMELOCK_DELAY + 1n;
      }

      const timeLockAdd = timelockAddress;
      const callData = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [governorAddress]);
      const tx5 = await timelock
        .connect(signers.bob)
        .queueTransaction(timeLockAdd, 0, "setPendingAdmin(address)", callData, expiry2);
      await tx5.wait();
      await hre.ethers.provider.send("evm_increaseTime", ["0x2a33c"]);

      const tx6 = await timelock
        .connect(signers.bob)
        .executeTransaction(timeLockAdd, 0, "setPendingAdmin(address)", callData, expiry2);

      await tx6.wait();

      await expect(governor.connect(signers.bob).acceptTimelockAdmin()).to.be.revertedWithCustomError(
        governor,
        "OwnableUnauthorizedAccount",
      );

      const tx7 = await governor.acceptTimelockAdmin();
      await tx7.wait();
      expect(await timelock.admin()).to.eq(governorAddress);
    }
  });

  it("all arrays of a proposal should be of same length, non null and less than max operations", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";

    const invalidTargets = [signers.bob.address, signers.carol.address];
    await expect(
      governor.connect(signers.alice).propose(invalidTargets, values, signatures, calldatas, description),
    ).to.be.revertedWithCustomError(governor, "LengthsDoNotMatch");

    const invalidValues = ["0", "0"];
    await expect(
      governor.connect(signers.alice).propose(targets, invalidValues, signatures, calldatas, description),
    ).to.be.revertedWithCustomError(governor, "LengthsDoNotMatch");

    const invalidSignatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
    await expect(
      governor.connect(signers.alice).propose(targets, values, invalidSignatures, calldatas, description),
    ).to.be.revertedWithCustomError(governor, "LengthsDoNotMatch");

    const invalidCalldatas = [
      hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address]),
      hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address]),
    ];

    await expect(
      governor.connect(signers.alice).propose(targets, values, signatures, invalidCalldatas, description),
    ).to.be.revertedWithCustomError(governor, "LengthsDoNotMatch");

    await expect(governor.connect(signers.alice).propose([], [], [], [], description)).to.be.revertedWithCustomError(
      governor,
      "LengthIsNull",
    );

    await expect(
      governor
        .connect(signers.alice)
        .propose(
          new Array(11).fill(signers.alice),
          new Array(11).fill("0"),
          new Array(11).fill("getBalanceOf(address)"),
          new Array(11).fill(calldatas[0]),
          description,
        ),
    ).to.be.revertedWithCustomError(governor, "LengthAboveMaxOperations");
  });

  it("only gateway can call gateway functions", async function () {
    const emptySigs: BytesLike[] = [];
    await expect(governor.connect(signers.bob).callbackInitiateProposal(1, true, emptySigs)).to.be.reverted;
    await expect(governor.connect(signers.bob).callbackVoteDecryption(1, 10, 10, emptySigs)).to.be.reverted;
  });

  it("only owner can call owner functions", async function () {
    await expect(governor.connect(signers.bob).acceptTimelockAdmin()).to.be.revertedWithCustomError(
      governor,
      "OwnableUnauthorizedAccount",
    );

    await expect(
      governor.connect(signers.bob).executeSetTimelockPendingAdmin(signers.bob.address, 1111),
    ).to.be.revertedWithCustomError(governor, "OwnableUnauthorizedAccount");

    await expect(
      governor.connect(signers.bob).queueSetTimelockPendingAdmin(signers.bob.address, 1111),
    ).to.be.revertedWithCustomError(governor, "OwnableUnauthorizedAccount");
  });

  it("only owner or proposer can cancel proposal", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = await governor.QUORUM_VOTES();

    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );
    const tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // @dev ProposalId starts at 1.
    await expect(governor.connect(signers.carol).cancel(1)).to.be.revertedWithCustomError(
      governor,
      "OwnableUnauthorizedAccount",
    );
  });

  it("proposer cannot make a new proposal while he still has an already pending or active proposal", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = await governor.QUORUM_VOTES();

    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    const tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    await expect(
      governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description),
    ).to.be.revertedWithCustomError(governor, "ProposerHasAnotherProposal");
  });

  it("cannot queue twice or execute before queuing", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = await governor.QUORUM_VOTES();

    // Bob receives 400k tokens and delegates to himself.
    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    // INITIATE A PROPOSAL
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // DECRYPTION FOR THE TOKEN THRESHOLD
    await hre.fhevm.awaitDecryptionOracle();
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    // VOTE
    // Bob casts a vote
    const input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    const encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.bob)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    // Mine blocks
    await mineNBlocks(hre, 4);

    // REQUEST DECRYPTION
    tx = await governor.requestVoteDecryption(proposalId);
    await tx.wait();

    // POST-DECRYPTION RESULTS
    await hre.fhevm.awaitDecryptionOracle();

    // QUEUING
    // @dev Cannot execute before queuing.
    await expect(governor.execute(proposalId)).to.be.revertedWithCustomError(governor, "ProposalStateInvalid");

    tx = await governor.queue(proposalId);
    await tx.wait();

    // @dev Cannot queue twice.
    await expect(governor.queue(proposalId)).to.be.revertedWithCustomError(governor, "ProposalStateInvalid");
  });

  it("cannot cancel if state is Rejected/Defeated/Executed/Canceled", async function () {
    let transferAmount = (await governor.PROPOSAL_THRESHOLD()) - 1n;
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";

    // CANNOT CANCEL IF REJECTED
    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();

    let proposalId = await governor.latestProposalIds(signers.bob.address);

    await expect(governor.connect(signers.bob).cancel(proposalId)).to.be.revertedWithCustomError(
      governor,
      "ProposalStateInvalid",
    );

    // CANNOT CANCEL IF DEFEATED
    transferAmount = (await governor.QUORUM_VOTES()) - 1n;

    await transferTokensAndDelegate(
      signers.alice,
      signers.carol,
      await signers.carol.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    tx = await governor.connect(signers.carol).propose(targets, values, signatures, calldatas, description);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();

    proposalId = await governor.latestProposalIds(signers.carol.address);

    let input = hre.fhevm.createEncryptedInput(governorAddress, signers.carol.address);
    input.addBool(true);
    let encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.carol)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    // Mine blocks
    await mineNBlocks(hre, 4);

    // REQUEST DECRYPTION
    tx = await governor.requestVoteDecryption(proposalId);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();
    await expect(governor.connect(signers.carol).cancel(proposalId)).to.be.revertedWithCustomError(
      governor,
      "ProposalStateInvalid",
    );

    // CANNOT CANCEL IF EXECUTED
    transferAmount = await governor.QUORUM_VOTES();

    await transferTokensAndDelegate(
      signers.alice,
      signers.dave,
      signers.dave.address,
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    tx = await governor.connect(signers.dave).propose(targets, values, signatures, calldatas, description);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();

    proposalId = await governor.latestProposalIds(signers.dave.address);

    input = hre.fhevm.createEncryptedInput(governorAddress, signers.dave.address);
    input.addBool(true);
    encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.dave)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    // Mine blocks
    await mineNBlocks(hre, 4);

    // REQUEST DECRYPTION
    tx = await governor.requestVoteDecryption(proposalId);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();

    tx = await governor.queue(proposalId);
    await tx.wait();

    const eta = (await governor.getProposalInfo(proposalId)).eta;

    // EXECUTE
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [eta.toString()]);
    tx = await governor.execute(proposalId);
    await tx.wait();

    await expect(governor.connect(signers.dave).cancel(proposalId)).to.be.revertedWithCustomError(
      governor,
      "ProposalStateInvalid",
    );

    // CANNOT CANCEL TWICE
    tx = await governor.connect(signers.carol).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    proposalId = await governor.latestProposalIds(signers.carol.address);

    tx = await governor.connect(signers.carol).cancel(proposalId);
    await tx.wait();
    await expect(governor.connect(signers.carol).cancel(proposalId)).to.be.revertedWithCustomError(
      governor,
      "ProposalStateInvalid",
    );
  });

  it("cancel function clears the timelock if the proposal is queued", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = await governor.QUORUM_VOTES();

    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    // INITIATE A PROPOSAL
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // DECRYPTION FOR THE TOKEN THRESHOLD
    await hre.fhevm.awaitDecryptionOracle();
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    // VOTE
    // Bob votes for
    const input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    const encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.bob)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    // Mine blocks
    await mineNBlocks(hre, 4);

    // REQUEST DECRYPTION
    tx = await governor.requestVoteDecryption(proposalId);
    await tx.wait();

    // POST-DECRYPTION RESULTS
    await hre.fhevm.awaitDecryptionOracle();

    // QUEUING
    tx = await governor.queue(proposalId);
    await tx.wait();

    // @dev Alice is the governor's owner.
    tx = await governor.connect(signers.alice).cancel(proposalId);
    await tx.wait();
    await expect(tx).to.emit(governor, "ProposalCanceled").withArgs(
      1n, // @dev proposalId
    );

    // 5 ==> Canceled
    expect((await governor.getProposalInfo(proposalId)).state).to.equal(5);
  });

  it("cannot request vote decryption if state is not Active or if endBlock >= block.number", async function () {
    await expect(governor.connect(signers.dave).requestVoteDecryption(0)).to.be.revertedWithCustomError(
      governor,
      "ProposalStateInvalid",
    );

    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = await governor.QUORUM_VOTES();

    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    // INITIATE A PROPOSAL
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // DECRYPTION FOR THE TOKEN THRESHOLD
    await hre.fhevm.awaitDecryptionOracle();
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    // VOTE
    // Bob votes for
    const input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    const encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.bob)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    // Mine blocks but not enough
    await mineNBlocks(hre, 3);

    await expect(governor.connect(signers.dave).requestVoteDecryption(proposalId)).to.be.revertedWithCustomError(
      governor,
      "ProposalStateStillActive",
    );
  });

  it("cannot cast a vote if state is not Active or if endBlock > block.number", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = await governor.QUORUM_VOTES();

    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    const input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    const encryptedVote = await input.encrypt();

    await expect(
      governor
        .connect(signers.bob)
        ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof),
    ).to.be.revertedWithCustomError(governor, "ProposalStateInvalid");

    tx = await governor.connect(signers.bob).cancel(proposalId);
    await tx.wait();

    tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();
    await hre.fhevm.awaitDecryptionOracle();

    const newProposalId = await governor.latestProposalIds(signers.bob.address);
    // 3 --> Active
    expect((await governor.getProposalInfo(newProposalId)).state).to.equal(3);

    // Mine too many blocks so that it becomes too late to cast vote
    await mineNBlocks(hre, 5);

    await expect(
      governor
        .connect(signers.bob)
        ["castVote(uint256,bytes32,bytes)"](newProposalId, encryptedVote.handles[0], encryptedVote.inputProof),
    ).to.be.revertedWithCustomError(governor, "ProposalStateNotActive");
  });

  it("cannot cast a vote twice", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = await governor.QUORUM_VOTES();

    // Bob receives 400k tokens and delegates to himself.
    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    // INITIATE A PROPOSAL
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // DECRYPTION FOR THE TOKEN THRESHOLD
    await hre.fhevm.awaitDecryptionOracle();
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    // VOTE
    // Bob casts a vote
    const input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    const encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.bob)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    await expect(
      governor
        .connect(signers.bob)
        ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof),
    ).to.be.revertedWithCustomError(governor, "VoterHasAlreadyVoted");
  });

  it("proposal expires after grace period", async function () {
    const targets = [signers.bob.address];
    const values = ["0"];
    const signatures = ["getBalanceOf(address)"];
    const calldatas = [hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers.bob.address])];
    const description = "description";
    const transferAmount = await governor.QUORUM_VOTES();

    // Bob receives 400k tokens and delegates to himself.
    await transferTokensAndDelegate(
      signers.alice,
      signers.bob,
      await signers.bob.getAddress(),
      transferAmount,
      confidentialERC20Votes,
      confidentialERC20VotesAddress,
    );

    // INITIATE A PROPOSAL
    let tx = await governor.connect(signers.bob).propose(targets, values, signatures, calldatas, description);
    await tx.wait();

    // DECRYPTION FOR THE TOKEN THRESHOLD
    await hre.fhevm.awaitDecryptionOracle();
    const proposalId = await governor.latestProposalIds(signers.bob.address);

    // VOTE
    // Bob casts a vote
    const input = hre.fhevm.createEncryptedInput(governorAddress, signers.bob.address);
    input.addBool(true);
    const encryptedVote = await input.encrypt();
    tx = await governor
      .connect(signers.bob)
      ["castVote(uint256,bytes32,bytes)"](proposalId, encryptedVote.handles[0], encryptedVote.inputProof);
    await tx.wait();

    // Mine blocks
    await mineNBlocks(hre, 4);

    // REQUEST DECRYPTION
    tx = await governor.requestVoteDecryption(proposalId);
    await tx.wait();

    // POST-DECRYPTION RESULTS
    await hre.fhevm.awaitDecryptionOracle();

    // Proposal is queued
    tx = await governor.queue(proposalId);
    await tx.wait();

    let proposalInfo = await governor.getProposalInfo(proposalId);
    const eta = proposalInfo.eta;
    const deadlineExecutionTransaction = eta + (await timelock.GRACE_PERIOD());
    const afterDeadlineTimestamp = deadlineExecutionTransaction + 1n;

    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [afterDeadlineTimestamp.toString()]);
    await mineNBlocks(hre, 1);

    await expect(governor.execute(proposalId)).to.be.revertedWithCustomError(
      timelock,
      "TransactionTooLateForExecution",
    );

    await mineNBlocks(hre, 1);

    proposalInfo = await governor.getProposalInfo(proposalId);
    // 9 ==> Expired
    expect(proposalInfo.state).to.equal(9);
  });

  it("cannot deploy if maxDecryptionDelay is higher than 1 day (86_400 seconds)", async function () {
    const maxDecryptionDelay = 86_401;
    const votingPeriod = 5;

    const contractFactory = await hre.ethers.getContractFactory("TestConfidentialGovernorAlpha");
    await expect(
      contractFactory
        .connect(signers.alice)
        .deploy(
          signers.alice.address,
          timelockAddress,
          confidentialERC20VotesAddress,
          votingPeriod,
          maxDecryptionDelay,
        ),
    ).to.be.revertedWithCustomError(governor, "MaxDecryptionDelayTooHigh");
  });
});
