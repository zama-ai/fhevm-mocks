import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { expect } from 'chai';
import { network } from 'hardhat';
import type { ethers as EthersT } from 'ethers';

import type { HeadsOrTails, HeadsOrTails__factory } from '../../types/ethers-contracts/index.ts';
import { requireReceipt } from '../utils/receipts.ts';
import { getSigners } from '../utils/signers.ts';

const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;
// The doc example's cast (accounts #0, #1, #2).
type Signers = { owner: HardhatEthersSigner; alice: HardhatEthersSigner; bob: HardhatEthersSigner };
// ethers' receipt type, named through the contract so `ethers` stays an indirect dependency of the suite.
type Receipt = NonNullable<Awaited<ReturnType<Awaited<ReturnType<HeadsOrTails['headsOrTails']>>['wait']>>>;

async function deployFixture(): Promise<{
  readonly headsOrTails: HeadsOrTails;
  readonly headsOrTailsAddress: Hex;
}> {
  // Contracts are deployed using the first signer/account by default
  const factory: HeadsOrTails__factory = await ethers.getContractFactory('HeadsOrTails');
  const headsOrTails = await factory.deploy();
  const headsOrTailsAddress = (await headsOrTails.getAddress()) as Hex;

  return { headsOrTails, headsOrTailsAddress };
}

// `KMSInvalidSigner` is declared by `KMSVerifier`, a stack contract this suite never deploys, so there
// is no contract instance to hand chai. Declaring the one error signature is enough for it to match the
// revert data — it only needs something that can decode the error.
const kmsVerifier = (): { interface: EthersT.Interface } => ({
  interface: new ethers.Interface(['error KMSInvalidSigner(address invalidSigner)']),
});

/**
 * The `HeadsOrTails` example showcases the public decryption mechanism and
 * its corresponding on-chain verification in the case of a single value.
 * The core assertion is to guarantee that a single given cleartext is the
 * cryptographically verifiable result of the decryption of a single original
 * on-chain ciphertext.
 */
describe('HeadsOrTails', function () {
  let contract: HeadsOrTails;
  let contractAddress: Hex;
  let signers: Signers;
  let playerA: HardhatEthersSigner;
  let playerB: HardhatEthersSigner;

  before(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isCleartext) {
      throw new Error(`This hardhat test suite can only run on a cleartext node`);
    }

    const suiteSigners = await getSigners(connection);
    signers = { owner: suiteSigners.alice, alice: suiteSigners.bob, bob: suiteSigners.carol };

    playerA = signers.alice;
    playerB = signers.bob;
  });

  beforeEach(async function () {
    // Deploy a new contract each time we run a new test
    const deployment = await deployFixture();
    contractAddress = deployment.headsOrTailsAddress;
    contract = deployment.headsOrTails;
  });

  /**
   * Helper: Parses the GameCreated event from a transaction receipt.
   * WARNING: This function is for illustrative purposes only and is not production-ready
   * (it does not handle several events in same tx).
   */
  function parseGameCreatedEvent(txReceipt: Receipt): {
    txHash: Hex;
    gameId: number;
    headsPlayer: Hex;
    tailsPlayer: Hex;
    encryptedHasHeadsWon: Hex;
  } {
    const gameCreatedEvents: Array<{
      txHash: Hex;
      gameId: number;
      headsPlayer: Hex;
      tailsPlayer: Hex;
      encryptedHasHeadsWon: Hex;
    }> = [];

    for (const log of txReceipt.logs) {
      const parsedLog = contract.interface.parseLog(log);
      if (parsedLog?.name !== 'GameCreated') {
        continue;
      }
      gameCreatedEvents.push({
        txHash: txReceipt.hash as Hex,
        gameId: Number(parsedLog.args[0]),
        headsPlayer: parsedLog.args[1] as Hex,
        tailsPlayer: parsedLog.args[2] as Hex,
        encryptedHasHeadsWon: parsedLog.args[3] as Hex,
      });
    }

    // In this example, we expect on one single GameCreated event
    expect(gameCreatedEvents.length).to.eq(1);
    const [event] = gameCreatedEvents;
    if (event === undefined) throw new Error('no GameCreated event');
    return event;
  }

  async function play(): Promise<ReturnType<typeof parseGameCreatedEvent>> {
    const tx = await contract.connect(signers.owner).headsOrTails(playerA, playerB);
    return parseGameCreatedEvent(requireReceipt(await tx.wait()));
  }

  // ✅ Test should succeed
  it('decryption should succeed', async function () {
    console.log(``);
    console.log(`🎲 HeadsOrTails Game contract address: ${contractAddress}`);
    console.log(`   🤖 playerA.address: ${playerA.address}`);
    console.log(`   🎃 playerB.address: ${playerB.address}`);
    console.log(``);

    // Starts a new Heads or Tails game. This will emit a `GameCreated` event
    const gameCreatedEvent = await play();

    // GameId is 1 since we are playing the first game
    expect(gameCreatedEvent.gameId).to.eq(1);
    expect(gameCreatedEvent.headsPlayer).to.eq(playerA.address);
    expect(gameCreatedEvent.tailsPlayer).to.eq(playerB.address);
    expect(await contract.getGamesCount()).to.eq(1n);

    console.log(`✅ New game #${String(gameCreatedEvent.gameId)} created!`);
    console.log(JSON.stringify(gameCreatedEvent, null, 2));

    const gameId = gameCreatedEvent.gameId;
    const encryptedBool = gameCreatedEvent.encryptedHasHeadsWon;

    // Call the Zama Relayer to compute the decryption. One handle, so this is a `helpers` call; the
    // `WithSignatures` form is the one that also returns the proof the contract needs.
    const { checkSignaturesArgs } = await fhevm.helpers.decryptPublicBoolWithSignatures({ ebool: encryptedBool });

    // Alongside the clear value, the Relayer returns a `checkSignaturesArgs` object containing:
    // - the ORDERED handles the proof was computed over (here a single one)
    // - the ORDERED clear values in ABI-encoded form
    // - the KMS decryption proof associated with the ORDERED clear values in ABI-encoded form
    const abiEncodedClearGameResult = checkSignaturesArgs.abiEncodedCleartexts;
    const decryptionProof = checkSignaturesArgs.decryptionProof;

    // Let's forward the decrypted payload and its proof to the on-chain contract whose job
    // will simply be to verify the proof and declare the final winner of the game
    await contract.recordAndVerifyWinner(gameId, abiEncodedClearGameResult, decryptionProof);

    const winner = await contract.getWinner(gameId);

    expect(winner === playerA.address || winner === playerB.address).to.eq(true);

    console.log(``);
    if (winner === playerA.address) {
      console.log(`🤖 playerA is the winner 🥇🥇`);
    } else if (winner === playerB.address) {
      console.log(`🎃 playerB is the winner 🥇🥇`);
    }
  });

  // ❌ The test must fail if the decryption proof is invalid
  it('should fail when the decryption proof is invalid', async function () {
    const gameCreatedEvent = await play();

    const { checkSignaturesArgs } = await fhevm.helpers.decryptPublicBoolWithSignatures({
      ebool: gameCreatedEvent.encryptedHasHeadsWon,
    });
    await expect(
      contract.recordAndVerifyWinner(
        gameCreatedEvent.gameId,
        checkSignaturesArgs.abiEncodedCleartexts,
        `${checkSignaturesArgs.decryptionProof}dead`,
      ),
    ).to.be.revertedWithCustomError(kmsVerifier(), 'KMSInvalidSigner');
  });

  // ❌ The test must fail if a malicious operator attempts to use a decryption proof
  // with a forged game result.
  it('should fail when using a decryption proof with a forged game result', async function () {
    const gameCreatedEvent = await play();

    const { clearValue: clearHeadsHasWon, checkSignaturesArgs } = await fhevm.helpers.decryptPublicBoolWithSignatures({
      ebool: gameCreatedEvent.encryptedHasHeadsWon,
    });

    // The clear value is also ABI-encoded
    const decodedHeadsHasWon: unknown = ethers.AbiCoder.defaultAbiCoder().decode(
      ['bool'],
      checkSignaturesArgs.abiEncodedCleartexts,
    )[0];
    expect(decodedHeadsHasWon).to.eq(clearHeadsHasWon);

    // Let's try to forge the game result. `clearValue` is already a boolean, so no cast is needed.
    const forgedABIEncodedClearValues = ethers.AbiCoder.defaultAbiCoder().encode(['bool'], [!clearHeadsHasWon]);

    await expect(
      contract.recordAndVerifyWinner(
        gameCreatedEvent.gameId,
        forgedABIEncodedClearValues,
        checkSignaturesArgs.decryptionProof,
      ),
    ).to.be.revertedWithCustomError(kmsVerifier(), 'KMSInvalidSigner');
  });

  // ❌ Two games (Game1 and Game2) are played between playerA and playerB.
  // The test must fail if a malicious operator attempts to forge the result of Game1
  // with the result of Game2
  it('should fail when using the result of a different game', async function () {
    // Game 1
    const gameCreatedEvent1 = await play();

    // Game 2
    const gameCreatedEvent2 = await play();

    // Let's try to forge the Game1's winner using the result of Game2
    const { checkSignaturesArgs: checkSignaturesArgs2 } = await fhevm.helpers.decryptPublicBoolWithSignatures({
      ebool: gameCreatedEvent2.encryptedHasHeadsWon,
    });

    await expect(
      contract.recordAndVerifyWinner(
        gameCreatedEvent1.gameId,
        checkSignaturesArgs2.abiEncodedCleartexts,
        checkSignaturesArgs2.decryptionProof,
      ),
    ).to.be.revertedWithCustomError(kmsVerifier(), 'KMSInvalidSigner');
  });
});
