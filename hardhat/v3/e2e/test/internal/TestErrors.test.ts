import { expect } from 'chai';
import { network } from 'hardhat';

import type { TestErrors, TestErrors__factory } from '../../types/ethers-contracts/index.ts';
import { type Signers, getSigners } from '../utils/signers.ts';

const connection = await network.getOrCreate();
const { ethers } = connection;

// `ACLNotAllowed` is declared by `FHEVMExecutor`, a stack contract this suite never deploys, so
// chai gets an interface declaring just that error instead of a contract instance.
const fhevmExecutor = (): { interface: InstanceType<typeof ethers.Interface> } => ({
  interface: new ethers.Interface(['error ACLNotAllowed(bytes32 handle, address account)']),
});

describe('TestErrors', function () {
  let signers: Signers;
  let testErrors: TestErrors;

  before(async function () {
    signers = await getSigners(connection);
  });

  beforeEach(async function () {
    const factory: TestErrors__factory = await ethers.getContractFactory('TestErrors');
    testErrors = await factory.connect(signers.alice).deploy();
    await testErrors.waitForDeployment();
  });

  it('Test ACL error permissions', async function () {
    const tx = await testErrors.connect(signers.alice).initCypherTextUint64NoAllow(123);
    await tx.wait();

    await expect(testErrors.connect(signers.alice).add(456)).to.be.revertedWithCustomError(
      fhevmExecutor(),
      'ACLNotAllowed',
    );
  });
});
