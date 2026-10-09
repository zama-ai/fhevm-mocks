import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { network } from 'hardhat';
import { getAddress } from 'viem';

void describe('FHECounter on Sepolia', async function () {
  const connection = await network.create();
  const { fhevm, viem } = connection;

  void it('increments the counter by one', { timeout: 160_000 }, async function (testContext) {
    if (fhevm.isCleartext) {
      testContext.skip('This test only runs on a public FHEVM network.');
      return;
    }

    const configuredAddress = process.env.FHECOUNTER_ADDRESS;
    if (configuredAddress === undefined) {
      throw new Error('Set FHECOUNTER_ADDRESS to the deployed contract address before running this test.');
    }

    const counterAddress = getAddress(configuredAddress);
    const [alice] = await viem.getWalletClients();
    const counter = await viem.getContractAt('FHECounter', counterAddress);
    const encryptedZero = await fhevm.helpers.encryptUint32({
      value: 0,
      contractAddress: counterAddress,
      userAddress: alice.account.address,
    });

    await counter.write.increment([encryptedZero.externalEuint32, encryptedZero.inputProof]);
    const before = await fhevm.helpers.decryptUint32({
      euint32: await counter.read.getCount(),
      contractAddress: counterAddress,
      userAddress: alice.account.address,
    });

    const encryptedOne = await fhevm.helpers.encryptUint32({
      value: 1,
      contractAddress: counterAddress,
      userAddress: alice.account.address,
    });
    await counter.write.increment([encryptedOne.externalEuint32, encryptedOne.inputProof]);
    const after = await fhevm.helpers.decryptUint32({
      euint32: await counter.read.getCount(),
      contractAddress: counterAddress,
      userAddress: alice.account.address,
    });

    assert.equal(after - before, 1);
  });
});
