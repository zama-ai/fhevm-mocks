// Setup smoke test. It passes only if every part of the environment works:
// the Solidity compiler, the FHEVM plugin, the local FHEVM contracts and the SDK.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { network } from 'hardhat';

void describe('FHECounter', async function () {
  const { fhevm, viem } = await network.create();
  const [alice] = await viem.getWalletClients();

  void it('encrypts a value, adds it on chain, and decrypts the result', async function () {
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
});
