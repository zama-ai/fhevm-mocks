// D3b guards: the zero handle, a mistyped handle and a bad contract or user address fail by name
// before any permit is signed; a valid address then signs a permit the stack accepts, and the decrypt
// fails on the ACL (nothing allowed this user), which proves the signing path. The success path needs
// a contract that calls `FHE.allow`, so it lives in the e2e counter test.
//
// `fhevm.helpers.decrypt*` takes a user ADDRESS, not a signer: it builds a wallet client over the
// connection's provider, so the development node holds the key and signs the EIP-712 permit.
//
// Tests import the BUILT payload (pkg/_esm); see connection.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';

import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import { HardhatPluginError } from 'hardhat/plugins';
import { privateKeyToAccount } from 'viem/accounts';

import plugin, { timestampNow } from '#esm/index.js';

const ZERO_HANDLE = `0x${'0'.repeat(64)}` as const;
const CONTRACT = '0x1111111111111111111111111111111111111111';
// hardhat's account #0
const ALICE = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

function pluginError(fragment: string): (e: unknown) => boolean {
  return (e: unknown) => e instanceof HardhatPluginError && e.message.includes(fragment);
}

void test('user decryption guards fail by name before any permit is signed', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const { helpers } = connection.fhevm;
    await assert.rejects(
      helpers.decryptUint32({ euint32: ZERO_HANDLE, contractAddress: CONTRACT, userAddress: ALICE.address }),
      pluginError('not initialized'),
    );
    const { externalEuint32 } = await helpers.encryptUint32({
      value: 7,
      contractAddress: CONTRACT,
      userAddress: ALICE.address,
    });
    // The type in the argument name is checked against the handle, as on the public path.
    await assert.rejects(
      helpers.decryptBool({ ebool: externalEuint32, contractAddress: CONTRACT, userAddress: ALICE.address }),
      pluginError('is a euint32, not a ebool'),
    );
    await assert.rejects(
      helpers.decryptUint32({ euint32: externalEuint32, contractAddress: '0xnope', userAddress: ALICE.address }),
      pluginError("'contractAddress'"),
    );
    // Replaces the old "wallet client carries no account" guard: a caller now supplies an address, and
    // an unusable one is caught before any wallet client is built.
    await assert.rejects(
      helpers.decryptUint32({ euint32: externalEuint32, contractAddress: CONTRACT, userAddress: '0xnope' }),
      pluginError("'userAddress'"),
    );
    await assert.rejects(
      helpers.decryptUint32({
        euint32: externalEuint32,
        contractAddress: CONTRACT,
        userAddress: ALICE.address,
        options: { delegatorAddress: '0xbad' },
      }),
      pluginError("'delegatorAddress'"),
    );
  } finally {
    await connection.close();
  }
});

void test('the node signs the permit for the given address; the ACL then refuses an unallowed handle', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const { helpers } = connection.fhevm;
    const { externalEuint32 } = await helpers.encryptUint32({
      value: 7,
      contractAddress: CONTRACT,
      userAddress: ALICE.address,
    });
    const validity = { startTimestamp: timestampNow(), durationDays: 1 };
    // Not a plugin error: every guard passed, the permit was signed, and the ACL did the refusing.
    await assert.rejects(
      helpers.decryptUint32({
        euint32: externalEuint32,
        contractAddress: CONTRACT,
        userAddress: ALICE.address,
        options: { validity },
      }),
      (e: unknown) => !(e instanceof HardhatPluginError),
    );
  } finally {
    await connection.close();
  }
});

void test('timestampNow is in seconds', () => {
  const now = timestampNow();
  assert.ok(Math.abs(now - Date.now() / 1000) < 2);
});
