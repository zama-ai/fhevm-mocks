import { expect } from "chai";
import * as hre from "hardhat";

import { deployConfidentialERC20Fixture, userDecryptBalance } from "../confidentialERC20/ConfidentialERC20.fixture";
import { getSigners, initSigners } from "../signers";
import { userDecryptReleased } from "./ConfidentialVestingWallet.fixture";
import { deployConfidentialVestingWalletCliffFixture } from "./ConfidentialVestingWalletCliff.fixture";

describe("ConfidentialVestingWalletCliff", function () {
  before(async function () {
    await initSigners();
    this.signers = await getSigners();
  });

  beforeEach(async function () {
    const latestBlockNumber = await hre.ethers.provider.getBlockNumber();
    const block = await hre.ethers.provider.getBlock(latestBlockNumber);

    this.beneficiary = this.signers.bob;
    this.beneficiaryAddress = this.signers.bob.address;

    const contractConfidentialERC20 = await deployConfidentialERC20Fixture(
      this.signers.alice,
      "Naraggara",
      "NARA",
      this.signers.alice.address,
    );
    this.confidentialERC20Address = await contractConfidentialERC20.getAddress();
    this.confidentialERC20 = contractConfidentialERC20;
    this.startTimestamp = BigInt(block!.timestamp + 3600);
    this.duration = BigInt(36_000); // 36,000 seconds
    this.cliffSeconds = this.duration / 4n;

    const contractConfidentialVestingWallet = await deployConfidentialVestingWalletCliffFixture(
      this.signers.alice,
      this.beneficiaryAddress,
      this.startTimestamp,
      this.duration,
      this.cliffSeconds,
    );

    this.confidentialVestingWallet = contractConfidentialVestingWallet;
    this.confidentialVestingWalletAddress = await contractConfidentialVestingWallet.getAddress();
  });

  it("post-deployment state", async function () {
    expect(await this.confidentialVestingWallet.BENEFICIARY()).to.equal(this.beneficiaryAddress);
    expect(await this.confidentialVestingWallet.DURATION()).to.equal(this.duration);
    expect(await this.confidentialVestingWallet.END_TIMESTAMP()).to.be.eq(this.startTimestamp + this.duration);
    expect(await this.confidentialVestingWallet.START_TIMESTAMP()).to.be.eq(this.startTimestamp);
    expect(await this.confidentialVestingWallet.START_TIMESTAMP()).to.be.eq(this.startTimestamp);
    expect(await this.confidentialVestingWallet.CLIFF()).to.be.eq(this.cliffSeconds + this.startTimestamp);
  });

  it("can release", async function () {
    // 10M
    const amount = hre.ethers.parseUnits("10000000", 6);

    let tx = await this.confidentialERC20.connect(this.signers.alice).mint(this.signers.alice, amount);
    await tx.wait();

    const input = hre.fhevm.createEncryptedInput(this.confidentialERC20Address, this.signers.alice.address);
    input.add64(amount);
    const encryptedTransferAmount = await input.encrypt();

    tx = await this.confidentialERC20
      .connect(this.signers.alice)
      [
        "transfer(address,bytes32,bytes)"
      ](this.confidentialVestingWalletAddress, encryptedTransferAmount.handles[0], encryptedTransferAmount.inputProof);

    await tx.wait();

    let nextTimestamp = this.startTimestamp;
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toString()]);

    tx = await this.confidentialVestingWallet.connect(this.beneficiary).release(this.confidentialERC20Address);
    await tx.wait();
    await expect(tx).to.emit(this.confidentialVestingWallet, "ConfidentialERC20Released");

    // It should be equal to 0 because the vesting has not started.
    expect(
      await userDecryptReleased(
        this.beneficiary,
        this.confidentialERC20Address,
        this.confidentialVestingWallet,
        this.confidentialVestingWalletAddress,
      ),
    ).to.be.eq(0n);

    // Move to the cliff - 1 second
    nextTimestamp = this.startTimestamp + this.cliffSeconds - 1n;
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toString()]);

    tx = await this.confidentialVestingWallet.connect(this.beneficiary).release(this.confidentialERC20Address);
    await tx.wait();

    // It should be equal to 0 because of the cliff.
    expect(
      await userDecryptReleased(
        this.beneficiary,
        this.confidentialERC20Address,
        this.confidentialVestingWallet,
        this.confidentialVestingWalletAddress,
      ),
    ).to.be.eq(0);

    expect(await userDecryptBalance(this.beneficiary, this.confidentialERC20, this.confidentialERC20Address)).to.be.eq(
      0,
    );

    // Bump to the end of the cliff
    nextTimestamp = this.startTimestamp + this.cliffSeconds;
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toString()]);

    tx = await this.confidentialVestingWallet.connect(this.beneficiary).release(this.confidentialERC20Address);
    await tx.wait();

    // It should be equal to 1/4 since the cliff was reached so everything that was pending is releasable at once.
    expect(
      await userDecryptReleased(
        this.beneficiary,
        this.confidentialERC20Address,
        this.confidentialVestingWallet,
        this.confidentialVestingWalletAddress,
      ),
    ).to.be.eq(BigInt(amount) / BigInt(4));

    expect(await userDecryptBalance(this.beneficiary, this.confidentialERC20, this.confidentialERC20Address)).to.be.eq(
      BigInt(amount) / BigInt(4),
    );

    nextTimestamp = this.startTimestamp + this.duration / BigInt(2);
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toString()]);

    tx = await this.confidentialVestingWallet.connect(this.beneficiary).release(this.confidentialERC20Address);
    await tx.wait();

    // It should be equal to 1/4 of the amount vested since 1/4 was already collected.
    expect(
      await userDecryptReleased(
        this.beneficiary,
        this.confidentialERC20Address,
        this.confidentialVestingWallet,
        this.confidentialVestingWalletAddress,
      ),
    ).to.be.eq(BigInt(amount) / BigInt(2));

    expect(await userDecryptBalance(this.beneficiary, this.confidentialERC20, this.confidentialERC20Address)).to.be.eq(
      BigInt(amount) / BigInt(2),
    );

    nextTimestamp = this.startTimestamp + this.duration;
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toString()]);

    tx = await this.confidentialVestingWallet.connect(this.beneficiary).release(this.confidentialERC20Address);
    await tx.wait();

    // It should be equal to 1/2 of the amount vested since 2/4 was already collected.
    expect(
      await userDecryptReleased(
        this.beneficiary,
        this.confidentialERC20Address,
        this.confidentialVestingWallet,
        this.confidentialVestingWalletAddress,
      ),
    ).to.be.eq(BigInt(amount));

    expect(await userDecryptBalance(this.beneficiary, this.confidentialERC20, this.confidentialERC20Address)).to.be.eq(
      BigInt(amount),
    );
  });

  it("cannot deploy if cliff > duration", async function () {
    const latestBlockNumber = await hre.ethers.provider.getBlockNumber();
    const block = await hre.ethers.provider.getBlock(latestBlockNumber);
    const startTimestamp = BigInt(block!.timestamp + 3600);
    const duration = 100n;
    const cliff = duration + 1n;

    const contractFactory = await hre.ethers.getContractFactory("TestConfidentialVestingWalletCliff");
    await expect(
      contractFactory.connect(this.signers.alice).deploy(this.signers.alice.address, startTimestamp, duration, cliff),
    )
      .to.be.revertedWithCustomError(this.confidentialVestingWallet, "InvalidCliffDuration")
      .withArgs(cliff, duration);
  });
});
