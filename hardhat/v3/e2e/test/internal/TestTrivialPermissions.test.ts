import { expect } from 'chai';
import { network } from 'hardhat';
import type { ethers as EthersT } from 'ethers';

import type { TestTrivialPermissions, TestTrivialPermissions__factory } from '../../types/ethers-contracts/index.ts';
import { type Signers, getSigners } from '../utils/signers.ts';

const connection = await network.getOrCreate();
const { ethers } = connection;

// `ACLNotAllowed` is declared by `FHEVMExecutor`, a stack contract this suite never deploys, so
// chai gets an interface declaring just that error instead of a contract instance.
const fhevmExecutor = (): { interface: EthersT.Interface } => ({
  interface: new ethers.Interface(['error ACLNotAllowed(bytes32 handle, address account)']),
});

describe('TestTrivialPermissions', function () {
  let signers: Signers;
  let testTrivialPermissions: TestTrivialPermissions;

  before(async function () {
    signers = await getSigners(connection);
  });

  beforeEach(async function () {
    const factory: TestTrivialPermissions__factory = await ethers.getContractFactory('TestTrivialPermissions');
    testTrivialPermissions = await factory.connect(signers.alice).deploy();
    await testTrivialPermissions.waitForDeployment();
  });

  it('should fail because missing ACL permission', async function () {
    await expect(testTrivialPermissions.connect(signers.carol).computeFheAdd()).to.be.revertedWithCustomError(
      fhevmExecutor(),
      'ACLNotAllowed',
    );
  });
});
