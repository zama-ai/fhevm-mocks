import { expect } from 'chai';
import { network } from 'hardhat';

import type { TestACL, TestACL__factory } from '../../types/ethers-contracts/index.ts';
import { type Accounts, type Signers, getAccounts, getSigners } from '../utils/signers.ts';

const connection = await network.getOrCreate();
const { ethers, fhevm } = connection;

type Hex = `0x${string}`;

async function deployFixture(): Promise<{
  readonly contract: TestACL;
  readonly contractAddress: Hex;
}> {
  const factory: TestACL__factory = await ethers.getContractFactory('TestACL');
  const contract = await factory.deploy();
  const contractAddress = (await contract.getAddress()) as Hex;

  return { contract, contractAddress };
}

// `InvalidSigner` is declared by `InputVerifier`, a stack contract this suite never deploys, so
// chai gets an interface declaring just that error instead of a contract instance.
const inputVerifier = (): { interface: InstanceType<typeof ethers.Interface> } => ({
  interface: new ethers.Interface(['error InvalidSigner(address signerRecovered)']),
});

describe('TestACL', function () {
  let signers: Signers;
  let accounts: Accounts;
  let contract: TestACL;
  let contractAddress: Hex;

  before(async function () {
    signers = await getSigners(connection);
    accounts = getAccounts();
  });

  beforeEach(async () => {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isCleartext) {
      throw new Error(`This hardhat test suite can only run on a cleartext node`);
    }
    ({ contract, contractAddress } = await deployFixture());
  });

  // Encrypts one euint32 for alice; `handles` is `Hex[]`, so the single handle is narrowed here once.
  async function encryptOneForAlice(value: number): Promise<{ handle: Hex; inputProof: Hex }> {
    const encrypted = await fhevm.helpers.encryptUint32({
      value: value,
      contractAddress: contractAddress,
      userAddress: signers.alice.address,
    });
    const handle = encrypted.externalEuint32;
    return { handle, inputProof: encrypted.inputProof };
  }

  it('encrypted count should be uninitialized after deployment', async function () {
    const encryptedCount = await contract.getCount();
    // Expect initial count to be bytes32(0) after deployment,
    // (meaning the encrypted count value is uninitialized)
    expect(encryptedCount).to.eq(ethers.ZeroHash);
  });

  it('Alice increment the counter by 1 using Alice encrypted input', async function () {
    const encryptedCountBeforeInc = await contract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);

    // Encrypt constant 1 as a euint32
    const clearOne = 1;
    const encryptedOne = await encryptOneForAlice(clearOne);

    const tx = await contract.connect(signers.alice).increment1(encryptedOne.handle, encryptedOne.inputProof);
    await tx.wait();

    const encryptedCountAfterInc = (await contract.getCount()) as Hex;

    const clearCountAlice = await fhevm.helpers.decryptUint32({
      euint32: encryptedCountAfterInc,
      contractAddress: contractAddress,
      userAddress: accounts.alice.address,
    });

    expect(clearCountAlice).to.eq(BigInt(0 + clearOne));
  });

  it('Bob cannot increment the counter by 1 using Alice encrypted input', async function () {
    const encryptedCountBeforeInc = await contract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);

    // Encrypt constant 1 as a euint32
    const clearOne = 1;
    const encryptedOne = await encryptOneForAlice(clearOne);

    await expect(
      contract.connect(signers.bob).increment1(encryptedOne.handle, encryptedOne.inputProof),
    ).to.be.revertedWithCustomError(inputVerifier(), 'InvalidSigner');
  });

  it('Bob successfully increments the counter by 1 using Alice encrypted input', async function () {
    const encryptedCountBeforeInc = await contract.getCount();
    expect(encryptedCountBeforeInc).to.eq(ethers.ZeroHash);

    // Encrypt constant 1 as a euint32
    const clearOne = 1;
    const encryptedOne = await encryptOneForAlice(clearOne);

    const tx = await contract
      .connect(signers.bob)
      .increment2(signers.alice.address, encryptedOne.handle, encryptedOne.inputProof);
    await tx.wait();

    const encryptedCountAfterInc = (await contract.getCount()) as Hex;

    const clearCountAlice = await fhevm.helpers.decryptUint32({
      euint32: encryptedCountAfterInc,
      contractAddress: contractAddress,
      userAddress: accounts.alice.address,
    });

    const clearCountBob = await fhevm.helpers.decryptUint32({
      euint32: encryptedCountAfterInc,
      contractAddress: contractAddress,
      userAddress: accounts.bob.address,
    });

    expect(clearCountAlice).to.eq(BigInt(0 + clearOne));
    expect(clearCountBob).to.eq(BigInt(0 + clearOne));
  });
});
