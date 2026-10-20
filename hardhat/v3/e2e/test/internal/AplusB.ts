import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { expect } from 'chai';
import { network } from 'hardhat';

import type { APlusB, APlusB__factory } from '../../types/ethers-contracts/index.ts';
import { type Accounts, type Signers, getAccounts, getSigners } from '../utils/signers.ts';

const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;

async function deployAPlusBFixture(account: HardhatEthersSigner): Promise<APlusB> {
  const contractFactory: APlusB__factory = await ethers.getContractFactory('APlusB');
  const contract: APlusB = await contractFactory.connect(account).deploy();
  await contract.waitForDeployment();
  return contract;
}

describe('APlusB', function () {
  let signers: Signers;
  let accounts: Accounts;
  let aplusbContract: APlusB;
  let aplusbContractAddress: Hex;

  before(async function () {
    signers = await getSigners(connection);
    accounts = getAccounts();

    aplusbContract = await deployAPlusBFixture(signers.alice);
    aplusbContractAddress = (await aplusbContract.getAddress()) as Hex;

    await fhevm.assertCoprocessorInitialized(aplusbContractAddress, 'APlusB');
  });

  it('uint8: add 80 to 123 should equal 203', async function () {
    const alice = signers.alice;

    // 1. Validates and Stores value 'a'

    // Create the encrypted input
    const encryptedInputA = await fhevm.helpers.encryptUint8({
      value: 80,
      contractAddress: aplusbContractAddress,
      userAddress: alice.address,
    });

    // Call the contract with the encrypted value `a`
    const encryptedA = encryptedInputA.externalEuint8;
    const proofA = encryptedInputA.inputProof;

    let tx = await aplusbContract.setA(encryptedA, proofA);
    await tx.wait();

    // 2. Validates and Stores value 'b'

    // Create the encrypted input
    const encryptedInputB = await fhevm.helpers.encryptUint8({
      value: 123,
      contractAddress: aplusbContractAddress,
      userAddress: alice.address,
    });

    // Call the contract with the encrypted value `b`
    const encryptedB = encryptedInputB.externalEuint8;
    const proofB = encryptedInputB.inputProof;

    tx = await aplusbContract.setB(encryptedB, proofB);
    await tx.wait();

    // 3. Computes the FHE sum of `a` and `b`, storing the result as `aplusb` on chain
    tx = await aplusbContract.computeAPlusB();
    await tx.wait();

    // 4. Reads the encrypted result `aplusb` = `a` + `b`
    const encryptedAPlusB = (await aplusbContract.aplusb()) as Hex;

    // 5. Decrypts `aplusb` — the decrypting user is alice's viem account
    const clearAPlusB = await fhevm.helpers.decryptUint8({
      euint8: encryptedAPlusB,
      contractAddress: aplusbContractAddress,
      userAddress: accounts.alice.address,
    });

    expect(clearAPlusB).to.eq(BigInt(80 + 123));
  });
});
