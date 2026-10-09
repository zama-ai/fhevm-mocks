// D4a3: the two error helpers, now internal. `createErrorInterface` hands chai an ethers-shaped
// interface backed by viem; `parseFhevmError` structures an InputVerifier `InvalidSigner` revert and
// answers undefined for everything else. Both were `fhevm.*` methods before the surface shrank.
//
// Tests import the BUILT payload (pkg/_esm); see connection.test.ts.

import assert from 'node:assert/strict';
import test from 'node:test';

import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import { encodeErrorResult, encodeFunctionData } from 'viem';

import plugin from '#esm/index.js';
import { precomputeLocalhostAddresses } from '#esm/internal/deploy.js';
import { developmentChain, developmentPublicClient } from '#esm/internal/clients.js';
import { FhevmCleartextContractsRepository } from '#esm/internal/contracts.js';
import { createErrorInterface } from '#esm/internal/errors/interface.js';
import { parseFhevmError } from '#esm/internal/errors/parse.js';

/** The deployed contracts repository, as the runtime environment builds one internally. */
async function repositoryOf(connection: { provider: never }): Promise<FhevmCleartextContractsRepository> {
  const client = developmentPublicClient(connection.provider, await developmentChain(connection.provider));
  const { fhevmAddresses, cleartextAddresses, pauserSetAddress } = precomputeLocalhostAddresses();
  return new FhevmCleartextContractsRepository(client, { ...fhevmAddresses, ...cleartextAddresses, pauserSetAddress });
}

const ALICE = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const HANDLE = `0x${'11'.repeat(32)}` as const;

void test('createErrorInterface answers the matcher contract: abi plus an ethers-shaped interface', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const repository = await repositoryOf(connection as never);
    const contract = { abi: repository.acl.abi, interface: createErrorInterface(repository.acl) };
    assert.ok(contract.abi.length > 0);
    const fragment = contract.interface.getError('SenderNotAllowed');
    assert.ok(fragment);
    assert.equal(fragment.selector.length, 10);
    assert.equal(contract.interface.getError(fragment.selector.toUpperCase())?.name, 'SenderNotAllowed');
    assert.equal(contract.interface.getError('NoSuchError'), null);
    const data = encodeErrorResult({ abi: contract.abi, errorName: 'SenderNotAllowed', args: [ALICE] });
    assert.deepEqual(contract.interface.decodeErrorResult(fragment, data).toArray(), [ALICE]);

    // An unknown error name simply has no fragment; the old wrapper turned that into a throw.
    assert.equal(contract.interface.getError('NoSuchError'), null);
  } finally {
    await connection.close();
  }
});

void test('parseFhevmError structures an InvalidSigner revert and ignores the rest', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const repository = await repositoryOf(connection as never);
    const data = encodeErrorResult({ abi: repository.inputVerifier.abi, errorName: 'InvalidSigner', args: [ALICE] });

    // Bare provider shape, and the shapes ethers wraps it in.
    for (const e of [
      Object.assign(new Error('reverted'), { data }),
      Object.assign(new Error('wrapped'), { error: { data } }),
      Object.assign(new Error('call exception'), { info: { error: { data } } }),
    ]) {
      const parsed = await parseFhevmError(repository, e);
      assert.equal(parsed?.type, 'InputVerifier');
      assert.equal(parsed.name, 'InvalidSigner');
      assert.ok(parsed.longMessage.includes('createEncryptedInput'));
    }

    assert.equal(await parseFhevmError(repository, new Error('plain')), undefined);
    assert.equal(await parseFhevmError(repository, 'not an error'), undefined);

    // A live ACL revert is ours, but not an InputVerifier one: undefined, not a throw.
    const [from] = (await connection.provider.request({ method: 'eth_accounts' })) as string[];
    const call = encodeFunctionData({ abi: repository.acl.abi, functionName: 'allow', args: [HANDLE, ALICE] });
    const aclAddress = precomputeLocalhostAddresses().fhevmAddresses.aclAddress;
    let caught: unknown;
    try {
      await connection.provider.request({
        method: 'eth_sendTransaction',
        params: [{ from, to: aclAddress, data: call }],
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof Error);
    assert.equal(await parseFhevmError(repository, caught), undefined);
  } finally {
    await connection.close();
  }
});
