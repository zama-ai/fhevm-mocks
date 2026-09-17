// D1: encryption over the cleartext client of an in-process development connection — the client's
// batch call and the per-type helpers, plus the guards that fail by name before any RPC.
//
// Tests import the BUILT payload (pkg/_esm); see connection.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';

import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import { HardhatPluginError } from 'hardhat/plugins';
import { isHex, size } from 'viem';

import plugin from '#esm/index.js';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const USER = '0x2222222222222222222222222222222222222222';

function isBytes32(value: unknown): boolean {
  return typeof value === 'string' && isHex(value) && size(value) === 32;
}

function pluginError(fragment: string): (e: unknown) => boolean {
  return (e: unknown) => e instanceof HardhatPluginError && e.message.includes(fragment);
}

void test('client.encryptValues batches several values under one input proof', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    // Several values under ONE proof is the client's job; `helpers` covers one value at a time.
    const { encryptedValues, inputProof } = await connection.fhevm.client.encryptValues({
      values: [
        { type: 'bool', value: true },
        { type: 'uint32', value: 123 },
        { type: 'uint64', value: 1n },
        { type: 'address', value: USER },
      ],
      contractAddress: CONTRACT,
      userAddress: USER,
    });
    assert.equal(encryptedValues.length, 4);
    for (const handle of encryptedValues) assert.ok(isBytes32(handle), `handle ${handle} is bytes32`);
    assert.ok(isHex(inputProof) && size(inputProof) > 0, 'one non-empty input proof');
  } finally {
    await connection.close();
  }
});

void test('the per-type helpers return one handle each, keyed by type', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const { fhevm } = connection;
    const uint = await fhevm.helpers.encryptUint32({ value: 42, contractAddress: CONTRACT, userAddress: USER });
    assert.ok(isBytes32(uint.externalEuint32));
    assert.ok(isHex(uint.inputProof));
    const bool = await fhevm.helpers.encryptBool({ value: false, contractAddress: CONTRACT, userAddress: USER });
    assert.ok(isBytes32(bool.externalEbool));
    const address = await fhevm.helpers.encryptAddress({ value: USER, contractAddress: CONTRACT, userAddress: USER });
    assert.ok(isBytes32(address.externalEaddress));
  } finally {
    await connection.close();
  }
});

void test('encryption guards fail by name before any RPC', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const { fhevm } = connection;
    // The address guards now sit in `encryptOne`, behind every helper, and still raise a plugin error
    // naming the offending argument rather than letting the SDK fail on its own terms.
    await assert.rejects(
      fhevm.helpers.encryptUint32({ value: 1, contractAddress: '0xnot-an-address', userAddress: USER }),
      pluginError("'contractAddress'"),
    );
    await assert.rejects(
      fhevm.helpers.encryptUint32({ value: 1, contractAddress: CONTRACT, userAddress: '0x' }),
      pluginError("'userAddress'"),
    );
    // And the value itself is bounded by the type the method names, before any RPC.
    await assert.rejects(
      fhevm.helpers.encryptUint8({ value: 256, contractAddress: CONTRACT, userAddress: USER }),
      pluginError('does not fit in euint8'),
    );
    await assert.rejects(
      fhevm.helpers.encryptBool({ value: 1 as unknown as boolean, contractAddress: CONTRACT, userAddress: USER }),
      pluginError('must be a boolean'),
    );
    // The empty batch is the client's own guard, not the plugin's, so it fails on the SDK's terms.
    await assert.rejects(
      fhevm.client.encryptValues({ values: [], contractAddress: CONTRACT, userAddress: USER }),
      /at least one value/,
    );
  } finally {
    await connection.close();
  }
});

void test('fhevm.client is the live SDK client on a development connection', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    assert.equal(connection.fhevm.client.chain.id, 31337);
  } finally {
    await connection.close();
  }
});
