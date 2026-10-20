import { type HardhatFhevmRuntimeEnvironment } from '@fhevm/hardhat-plugin-v3';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { expect } from 'chai';
import { network } from 'hardhat';
import type { LocalAccount } from 'viem';

import type { EncryptMultipleValues, EncryptMultipleValues__factory } from '../../types/ethers-contracts/index.ts';
import { getAccounts, getSigners } from '../utils/signers.ts';

const connection = await network.getOrCreate();
const { ethers } = connection;

type Hex = `0x${string}`;

// The doc example's cast: `owner` deploys, `alice` is the user (accounts #0 and #1); the user's viem
// account signs the decryption permits.
type Signers = { owner: HardhatEthersSigner; alice: HardhatEthersSigner };
type Accounts = { alice: LocalAccount };

async function deployFixture(): Promise<{
  readonly encryptMultipleValues: EncryptMultipleValues;
  readonly encryptMultipleValuesAddress: Hex;
}> {
  // Contracts are deployed using the first signer/account by default
  const factory: EncryptMultipleValues__factory = await ethers.getContractFactory('EncryptMultipleValues');
  const encryptMultipleValues = await factory.deploy();
  const encryptMultipleValuesAddress = (await encryptMultipleValues.getAddress()) as Hex;

  return { encryptMultipleValues, encryptMultipleValuesAddress };
}

/**
 * This trivial example demonstrates the FHE encryption mechanism
 * and highlights a common pitfall developers may encounter.
 */
describe('EncryptMultipleValues', function () {
  let contract: EncryptMultipleValues;
  let contractAddress: Hex;
  let signers: Signers;
  let accounts: Accounts;

  before(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!connection.fhevm.isCleartext) {
      throw new Error(`This hardhat test suite can only run on a cleartext node`);
    }

    const suiteSigners = await getSigners(connection);
    const suiteAccounts = getAccounts();
    signers = { owner: suiteSigners.alice, alice: suiteSigners.bob };
    accounts = { alice: suiteAccounts.bob };
  });

  beforeEach(async function () {
    // Deploy a new contract each time we run a new test
    const deployment = await deployFixture();
    contractAddress = deployment.encryptMultipleValuesAddress;
    contract = deployment.encryptMultipleValues;
  });

  // ✅ Test should succeed
  it('encryption should succeed', async function () {
    // Use the FHEVM Hardhat plugin runtime environment
    // to perform FHEVM input encryptions.
    const fhevm: HardhatFhevmRuntimeEnvironment = connection.fhevm;

    // Three values under ONE input proof, so this goes through the SDK client rather than
    // `fhevm.helpers`, which encrypts a single value at a time. Each entry names its Solidity type.
    const enc = await fhevm.client.encryptValues({
      values: [
        { type: 'bool', value: true },
        { type: 'uint32', value: 123456 },
        { type: 'address', value: signers.owner.address },
      ],
      contractAddress: contractAddress,
      userAddress: signers.alice.address,
    });

    // `encryptedValues` is ORDERED: one handle per value, in the order they were listed above.
    const [inputEbool, inputEuint32, inputEaddress] = enc.encryptedValues;
    if (inputEbool === undefined || inputEuint32 === undefined || inputEaddress === undefined) {
      throw new Error('encryptValues() returned fewer than three handles');
    }
    const inputProof = enc.inputProof;

    // Don't forget to call `connect(signers.alice)` to make sure
    // the Solidity `msg.sender` is `signers.alice.address`.
    const tx = await contract.connect(signers.alice).initialize(inputEbool, inputEuint32, inputEaddress, inputProof);
    await tx.wait();

    const encryptedBool = (await contract.encryptedBool()) as Hex;
    const encryptedUint32 = (await contract.encryptedUint32()) as Hex;
    const encryptedAddress = (await contract.encryptedAddress()) as Hex;

    const clearBool = await fhevm.helpers.decryptBool({
      ebool: encryptedBool,
      contractAddress: contractAddress,
      userAddress: accounts.alice.address,
    });

    const clearUint32 = await fhevm.helpers.decryptUint32({
      euint32: encryptedUint32,
      contractAddress: contractAddress,
      userAddress: accounts.alice.address,
    });

    const clearAddress = await fhevm.helpers.decryptAddress({
      eaddress: encryptedAddress,
      contractAddress: contractAddress,
      userAddress: accounts.alice.address,
    });

    expect(clearBool).to.equal(true);
    expect(clearUint32).to.equal(123456n);
    expect(clearAddress).to.equal(signers.owner.address);
  });
});
