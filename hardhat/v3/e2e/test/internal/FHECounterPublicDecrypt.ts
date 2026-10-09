import { expect } from 'chai';
import { network } from 'hardhat';

import type { FHECounterPublicDecrypt, FHECounterPublicDecrypt__factory } from '../../types/ethers-contracts/index.ts';
import { type Signers, getSigners } from '../utils/signers.ts';

// One connection per run, shared with every other test file (`getOrCreate`), as v2 had one network
// per run; `--network` selects it.
const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;

async function deployFixture(): Promise<{
  readonly fheCounterContract: FHECounterPublicDecrypt;
  readonly fheCounterContractAddress: Hex;
}> {
  const factory: FHECounterPublicDecrypt__factory = await ethers.getContractFactory('FHECounterPublicDecrypt');
  const fheCounterContract = (await factory.deploy()) as FHECounterPublicDecrypt;
  const fheCounterContractAddress = (await fheCounterContract.getAddress()) as Hex;

  return { fheCounterContract, fheCounterContractAddress };
}

describe('FHECounterPublicDecrypt', function () {
  let signers: Signers;
  let fheCounterContract: FHECounterPublicDecrypt;
  let fheCounterContractAddress: Hex;

  before(async function () {
    signers = await getSigners(connection);
  });

  beforeEach(async () => {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isCleartext) {
      throw new Error(`This hardhat test suite can only run on a cleartext node`);
    }
    ({ fheCounterContract, fheCounterContractAddress } = await deployFixture());
  });

  // Encrypts one euint32 for alice. A single value, so this is `helpers`: the handle comes back
  // already named `externalEuint32`, with no array to index and nothing to narrow.
  async function encryptOne32(value: number): Promise<{ handle: Hex; inputProof: Hex }> {
    const encrypted = await fhevm.helpers.encryptUint32({
      value,
      contractAddress: fheCounterContractAddress,
      userAddress: signers.alice.address,
    });
    return { handle: encrypted.externalEuint32, inputProof: encrypted.inputProof };
  }

  it('encrypted count should be uninitialized after deployment', async function () {
    const encryptedCount = await fheCounterContract.getCount();
    // Expect initial count to be bytes32(0) after deployment,
    // (meaning the encrypted count value is uninitialized)
    expect(encryptedCount).to.eq(ethers.ZeroHash);
  });

  it('increment the counter by 123 and verify public decrypt', async function () {
    const encryptedCountBeforeInc = await fheCounterContract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);
    const clearCountBeforeInc = 0;

    // Encrypt constant 123 as a euint32
    const clearOneTwoThree = 123;
    const encryptedOneTwoThree = await encryptOne32(clearOneTwoThree);

    const tx = await fheCounterContract
      .connect(signers.alice)
      .increment(encryptedOneTwoThree.handle, encryptedOneTwoThree.inputProof);
    await tx.wait();

    const encryptedCountAfterInc = (await fheCounterContract.getCount()) as Hex;
    const { clearValue: clearCountAfterInc, checkSignaturesArgs } =
      await fhevm.helpers.decryptPublicUint32WithSignatures({ euint32: encryptedCountAfterInc });

    expect(clearCountAfterInc).to.eq(clearCountBeforeInc + clearOneTwoThree);

    await fheCounterContract.verify(
      checkSignaturesArgs.handlesList,
      checkSignaturesArgs.abiEncodedCleartexts,
      checkSignaturesArgs.decryptionProof,
    );
  });

  it('increment the counter by 1', async function () {
    const encryptedCountBeforeInc = await fheCounterContract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);
    const clearCountBeforeInc = 0;

    // Encrypt constant 1 as a euint32
    const clearOne = 1;
    const encryptedOne = await encryptOne32(clearOne);

    const tx = await fheCounterContract.connect(signers.alice).increment(encryptedOne.handle, encryptedOne.inputProof);
    await tx.wait();

    const encryptedCountAfterInc = (await fheCounterContract.getCount()) as Hex;
    const clearCountAfterInc = await fhevm.helpers.decryptPublicUint32({ euint32: encryptedCountAfterInc });

    expect(clearCountAfterInc).to.eq(clearCountBeforeInc + clearOne);
  });

  it('increment the counter by 1 multiple times', async function () {
    const encryptedCountBeforeInc = await fheCounterContract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);
    const clearCountBeforeInc = 0;

    // Encrypt constant 1 as a euint32
    const clearOne = 1;
    const encryptedOne = await encryptOne32(clearOne);

    // First Tx (increment by 1)
    const tx1 = await fheCounterContract.connect(signers.alice).increment(encryptedOne.handle, encryptedOne.inputProof);
    await tx1.wait();
    const encryptedCountAfterInc1 = (await fheCounterContract.getCount()) as Hex;

    // Second Tx (increment by one again)
    const tx2 = await fheCounterContract.connect(signers.alice).increment(encryptedOne.handle, encryptedOne.inputProof);
    await tx2.wait();
    const encryptedCountAfterInc2 = (await fheCounterContract.getCount()) as Hex;

    // Multiple public decrypt. Two handles, so this is the client and not `helpers`: the answer is
    // positional, one entry per handle in the order they were passed, rather than keyed by handle.
    const decryptedResults = await fhevm.client.decryptPublicValues({
      encryptedValues: [encryptedCountAfterInc1, encryptedCountAfterInc2],
    });

    // Result should contain 2 values
    expect(decryptedResults.length).to.eq(2);
    expect(decryptedResults[0]?.value).to.eq(clearCountBeforeInc + clearOne);
    expect(decryptedResults[1]?.value).to.eq(clearCountBeforeInc + clearOne + clearOne);
  });

  it('decrement the counter by 1', async function () {
    // Encrypt constant 1 as a euint32
    const clearOne = 1;
    const encryptedOne = await encryptOne32(clearOne);

    // First increment by 1, count becomes 1
    let tx = await fheCounterContract.connect(signers.alice).increment(encryptedOne.handle, encryptedOne.inputProof);
    await tx.wait();

    // Then decrement by 1, count goes back to 0
    tx = await fheCounterContract.connect(signers.alice).decrement(encryptedOne.handle, encryptedOne.inputProof);
    await tx.wait();

    const encryptedCountAfterDec = (await fheCounterContract.getCount()) as Hex;
    const clearCountAfterDec = await fhevm.helpers.decryptPublicUint32({ euint32: encryptedCountAfterDec });

    expect(clearCountAfterDec).to.eq(0);
  });

  it('increment the counter by 1 not decryptable', async function () {
    const encryptedCountBeforeInc = await fheCounterContract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);

    // Encrypt constant 1 as a euint32
    const clearOne = 1;
    const encryptedOne = await encryptOne32(clearOne);

    // First Tx (increment by 1)
    const tx = await fheCounterContract
      .connect(signers.alice)
      .incrementNotPubliclyDecryptable(encryptedOne.handle, encryptedOne.inputProof);
    await tx.wait();
    const encryptedCountAfterInc = (await fheCounterContract.getCount()) as Hex;

    let failed;
    try {
      await fhevm.helpers.decryptPublicUint32({ euint32: encryptedCountAfterInc });
      failed = false;
    } catch {
      failed = true;
    }
    expect(failed).to.eq(true);
  });
});
