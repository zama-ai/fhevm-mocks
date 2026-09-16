import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { expect } from 'chai';
import { network } from 'hardhat';
import type { ethers as EthersT } from 'ethers';

import type { HighestDieRoll, HighestDieRoll__factory } from '../../types/ethers-contracts/index.ts';
import { requireReceipt } from '../utils/receipts.ts';
import { getSigners } from '../utils/signers.ts';

const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;
// The doc example's cast (accounts #0, #1, #2).
type Signers = { owner: HardhatEthersSigner; alice: HardhatEthersSigner; bob: HardhatEthersSigner };
// ethers' receipt type, named through the contract so `ethers` stays an indirect dependency of the suite.
type Receipt = NonNullable<Awaited<ReturnType<Awaited<ReturnType<HighestDieRoll['highestDieRoll']>>['wait']>>>;

async function deployFixture(): Promise<{
  readonly highestDiceRoll: HighestDieRoll;
  readonly highestDiceRollAddress: Hex;
}> {
  // Contracts are deployed using the first signer/account by default
  const factory: HighestDieRoll__factory = await ethers.getContractFactory('HighestDieRoll');
  const highestDiceRoll = await factory.deploy();
  const highestDiceRollAddress = (await highestDiceRoll.getAddress()) as Hex;

  return { highestDiceRoll, highestDiceRollAddress };
}

// `KMSInvalidSigner` is declared by `KMSVerifier`, a stack contract this suite never deploys, so there
// is no contract instance to hand chai. Declaring the one error signature is enough for it to match the
// revert data — it only needs something that can decode the error.
const kmsVerifier = (): { interface: EthersT.Interface } => ({
  interface: new ethers.Interface(['error KMSInvalidSigner(address invalidSigner)']),
});

/**
 * The `HighestDieRoll` example showcases the public decryption mechanism and
 * its corresponding on-chain verification in the case of multiple values.
 * The core assertion is to guarantee that multiple given cleartexts are the
 * cryptographically verifiable results of the decryption of multiple original
 * on-chain ciphertexts.
 */
describe('HighestDieRoll', function () {
  let contract: HighestDieRoll;
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
    contractAddress = deployment.highestDiceRollAddress;
    contract = deployment.highestDiceRoll;
  });

  /**
   * Helper: Parses the GameCreated event from a transaction receipt.
   * WARNING: This function is for illustrative purposes only and is not production-ready
   * (it does not handle several events in same tx).
   */
  function parseGameCreatedEvent(txReceipt: Receipt): {
    txHash: Hex;
    gameId: number;
    playerA: Hex;
    playerB: Hex;
    playerAEncryptedDiceRoll: Hex;
    playerBEncryptedDiceRoll: Hex;
  } {
    const gameCreatedEvents: Array<{
      txHash: Hex;
      gameId: number;
      playerA: Hex;
      playerB: Hex;
      playerAEncryptedDiceRoll: Hex;
      playerBEncryptedDiceRoll: Hex;
    }> = [];

    for (const log of txReceipt.logs) {
      const parsedLog = contract.interface.parseLog(log);
      if (parsedLog?.name !== 'GameCreated') {
        continue;
      }
      // `parsedLog.args` is a Result: every element is `any`, so each one is asserted to the
      // field type declared above rather than assigned blind.
      gameCreatedEvents.push({
        txHash: txReceipt.hash as Hex,
        gameId: Number(parsedLog.args[0]),
        playerA: parsedLog.args[1] as Hex,
        playerB: parsedLog.args[2] as Hex,
        playerAEncryptedDiceRoll: parsedLog.args[3] as Hex,
        playerBEncryptedDiceRoll: parsedLog.args[4] as Hex,
      });
    }

    // In this example, we expect on one single GameCreated event
    expect(gameCreatedEvents.length).to.eq(1);
    const [event] = gameCreatedEvents;
    if (event === undefined) throw new Error('no GameCreated event');
    return event;
  }

  // ✅ Test should succeed
  it('decryption should succeed', async function () {
    console.log(``);
    console.log(`🎲 HighestDieRoll Game contract address: ${contractAddress}`);
    console.log(`   🤖 playerA.address: ${playerA.address}`);
    console.log(`   🎃 playerB.address: ${playerB.address}`);
    console.log(``);

    // Starts a new game. This will emit a `GameCreated` event
    const tx = await contract.connect(signers.owner).highestDieRoll(playerA, playerB);

    const receipt = requireReceipt(await tx.wait());

    // Parse the `GameCreated` event
    const gameCreatedEvent = parseGameCreatedEvent(receipt);

    // GameId is 1 since we are playing the first game
    expect(gameCreatedEvent.gameId).to.eq(1);
    expect(gameCreatedEvent.playerA).to.eq(playerA.address);
    expect(gameCreatedEvent.playerB).to.eq(playerB.address);
    expect(await contract.getGamesCount()).to.eq(1n);

    console.log(`✅ New game #${String(gameCreatedEvent.gameId)} created!`);
    console.log(JSON.stringify(gameCreatedEvent, null, 2));

    const gameId = gameCreatedEvent.gameId;
    const playerADiceRoll = gameCreatedEvent.playerAEncryptedDiceRoll;
    const playerBDiceRoll = gameCreatedEvent.playerBEncryptedDiceRoll;

    // Call the Zama Relayer to compute the decryption. TWO handles under ONE proof is the client's
    // job: `fhevm.helpers` decrypts a single value at a time and could not tie the two together.
    const publicDecryptResults = await fhevm.client.decryptPublicValuesWithSignatures({
      encryptedValues: [playerADiceRoll, playerBDiceRoll],
    });

    // The Relayer returns:
    // - the ORDERED clear values, one entry per handle, in the order they were passed
    // - `checkSignaturesArgs.abiEncodedCleartexts`: those same clear values in ABI-encoded form
    // - `checkSignaturesArgs.decryptionProof`: the KMS proof over that ABI-encoded payload
    const abiEncodedClearGameResult = publicDecryptResults.checkSignaturesArgs.abiEncodedCleartexts;
    const decryptionProof = publicDecryptResults.checkSignaturesArgs.decryptionProof;

    // Positional, not keyed by handle: entry 0 is A's roll because A's handle was passed first.
    const clearValueA = publicDecryptResults.clearValues[0].value;
    const clearValueB = publicDecryptResults.clearValues[1]?.value;

    // A die roll is a euint8, which clears as a `number` — bigint only starts at euint64.
    expect(typeof clearValueA).to.eq('number');
    expect(typeof clearValueB).to.eq('number');

    // playerA's 8-sided die roll result (between 1 and 8)
    const a = (Number(clearValueA) % 8) + 1;
    // playerB's 8-sided die roll result (between 1 and 8)
    const b = (Number(clearValueB) % 8) + 1;

    const isDraw = a === b;
    const playerAWon = a > b;
    const playerBWon = a < b;

    console.log(``);
    console.log(`🎲 playerA's 8-sided die roll is ${String(a)}`);
    console.log(`🎲 playerB's 8-sided die roll is ${String(b)}`);

    // Let's forward the decrypted payload and its proof to the on-chain contract whose job
    // will simply be to verify the proof and store the final winner of the game
    await contract.recordAndVerifyWinner(gameId, abiEncodedClearGameResult, decryptionProof);

    const isRevealed = await contract.isGameRevealed(gameId);
    const winner = await contract.getWinner(gameId);

    expect(isRevealed).to.eq(true);
    expect(winner === playerA.address || winner === playerB.address || winner === ethers.ZeroAddress).to.eq(true);

    expect(isDraw).to.eq(winner === ethers.ZeroAddress);
    expect(playerAWon).to.eq(winner === playerA.address);
    expect(playerBWon).to.eq(winner === playerB.address);

    console.log(``);
    if (winner === playerA.address) {
      console.log(`🤖 playerA is the winner 🥇🥇`);
    } else if (winner === playerB.address) {
      console.log(`🎃 playerB is the winner 🥇🥇`);
    } else if (winner === ethers.ZeroAddress) {
      console.log(`Game is a draw!`);
    }
  });

  // ❌ Test should fail because clear values are ABI-encoded in the wrong order.
  it('decryption should fail when ABI-encoding is wrongly ordered', async function () {
    // Test Case: Verify strict ordering is enforced for cryptographic proof generation.
    // The `decryptionProof` is generated based on the expected order (A, B). By ABI-encoding
    // the clear values in the **reverse order** (B, A), we create a mismatch when the contract
    // internally verifies the proof (e.g., checks a signature against a newly computed hash).
    // This intentional failure is expected to revert with the `KMSInvalidSigner` error,
    // confirming the proof's order dependency.
    // The reordering below only changes the payload when the two rolls DIFFER. `randEuint8()` is a full
    // byte, not a one-to-six die, so the two collide roughly once in 256 games. The "wrong" order is
    // then byte-identical to the right one: the proof verifies, nothing reverts, and this test fails
    // for a reason that has nothing to do with ordering. Play until the rolls differ, so the mutation
    // under test is always a real one.
    const MAX_DRAWS = 20;
    let game:
      | {
          readonly gameId: number;
          readonly clearValueA: number;
          readonly clearValueB: number;
          readonly results: Awaited<ReturnType<typeof fhevm.client.decryptPublicValuesWithSignatures>>;
        }
      | undefined;

    for (let attempt = 0; attempt < MAX_DRAWS && game === undefined; attempt++) {
      const tx = await contract.connect(signers.owner).highestDieRoll(playerA, playerB);
      const receipt = requireReceipt(await tx.wait());
      const gameCreatedEvent = parseGameCreatedEvent(receipt);
      const playerADiceRoll = gameCreatedEvent.playerAEncryptedDiceRoll;
      const playerBDiceRoll = gameCreatedEvent.playerBEncryptedDiceRoll;
      // Decrypt using order (A, B); the answer comes back in that same order.
      const results = await fhevm.client.decryptPublicValuesWithSignatures({
        encryptedValues: [playerADiceRoll, playerBDiceRoll],
      });
      const clearValueA = results.clearValues[0].value;
      const clearValueB = results.clearValues[1]?.value;
      // A die roll is a euint8, which clears as a `number` — bigint only starts at euint64.
      expect(typeof clearValueA).to.eq('number');
      expect(typeof clearValueB).to.eq('number');
      if (clearValueA !== clearValueB) {
        game = {
          gameId: gameCreatedEvent.gameId,
          clearValueA: clearValueA as number,
          clearValueB: clearValueB as number,
          results,
        };
      }
    }

    if (game === undefined) {
      throw new Error(`${MAX_DRAWS} games in a row were a draw; the reordering could not be tested`);
    }

    expect(
      ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'uint256'], [game.clearValueA, game.clearValueB]),
    ).to.eq(game.results.checkSignaturesArgs.abiEncodedCleartexts);
    const wrongOrderBAInsteadOfABAbiEncodedValues = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256'],
      [game.clearValueB, game.clearValueA],
    );
    // ❌ Call `contract.recordAndVerifyWinner` using order (B, A)
    await expect(
      contract.recordAndVerifyWinner(
        game.gameId,
        wrongOrderBAInsteadOfABAbiEncodedValues,
        game.results.checkSignaturesArgs.decryptionProof,
      ),
    ).to.be.revertedWithCustomError(kmsVerifier(), 'KMSInvalidSigner');
  });
});
