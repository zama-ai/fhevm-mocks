import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { network } from 'hardhat';
import { zeroHash } from 'viem';

void describe('FHECounter', async function () {
  const connection = await network.create();
  const { fhevm, viem } = connection;
  const [alice] = await viem.getWalletClients();

  void it('has an uninitialized encrypted count after deployment', async function () {
    const counter = await viem.deployContract('FHECounter');

    assert.equal(await counter.read.getCount(), zeroHash);
  });

  void it('increments the counter by one', async function () {
    const counter = await viem.deployContract('FHECounter');
    const encryptedOne = await fhevm.helpers.encryptUint32({
      value: 1,
      contractAddress: counter.address,
      userAddress: alice.account.address,
    });

    await counter.write.increment([encryptedOne.externalEuint32, encryptedOne.inputProof]);

    const clearCount = await fhevm.helpers.decryptUint32({
      euint32: await counter.read.getCount(),
      contractAddress: counter.address,
      userAddress: alice.account.address,
    });
    assert.equal(clearCount, 1);
  });

  void it('decrements the counter back to zero', async function () {
    const counter = await viem.deployContract('FHECounter');
    const encryptedOne = await fhevm.helpers.encryptUint32({
      value: 1,
      contractAddress: counter.address,
      userAddress: alice.account.address,
    });

    await counter.write.increment([encryptedOne.externalEuint32, encryptedOne.inputProof]);
    await counter.write.decrement([encryptedOne.externalEuint32, encryptedOne.inputProof]);

    const clearCount = await fhevm.helpers.decryptUint32({
      euint32: await counter.read.getCount(),
      contractAddress: counter.address,
      userAddress: alice.account.address,
    });
    assert.equal(clearCount, 0);
  });
});
