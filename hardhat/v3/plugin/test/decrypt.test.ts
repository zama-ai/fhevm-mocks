// D2 guards: the zero handle and a handle nobody made publicly decryptable both fail before or inside
// the SDK with a message that names the cause. The success path needs a contract, so it lives in the
// e2e counter test.
//
// Tests import the BUILT payload (pkg/_esm); see connection.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import { HardhatPluginError } from 'hardhat/plugins';
import plugin from '#esm/index.js';

const ZERO_HANDLE = `0x${'0'.repeat(64)}` as const;
const CONTRACT = '0x1111111111111111111111111111111111111111';
const USER = '0x2222222222222222222222222222222222222222';

const notInitialized = (e: unknown): boolean =>
  e instanceof HardhatPluginError && e.message.includes('not initialized');

void test('the zero handle is refused as uninitialized, in every variant and as bytes', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const { fhevm } = connection;
    await assert.rejects(fhevm.helpers.decryptPublicBool({ ebool: ZERO_HANDLE }), notInitialized);
    await assert.rejects(fhevm.helpers.decryptPublicUint32({ euint32: ZERO_HANDLE }), notInitialized);
    await assert.rejects(fhevm.helpers.decryptPublicAddress({ eaddress: ZERO_HANDLE }), notInitialized);
  } finally {
    await connection.close();
  }
});

void test('an input handle nobody allowed for decryption is rejected by the stack', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const { fhevm } = connection;
    const { externalEuint32 } = await fhevm.helpers.encryptUint32({
      value: 7,
      contractAddress: CONTRACT,
      userAddress: USER,
    });
    await assert.rejects(fhevm.helpers.decryptPublicUint32({ euint32: externalEuint32 }));
    await assert.rejects(fhevm.client.decryptPublicValues({ encryptedValues: [externalEuint32] }));
  } finally {
    await connection.close();
  }
});
