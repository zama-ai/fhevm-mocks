import { defineNewKmsContextAndEpoch, deploy, destroyKmsContext, precomputeAddresses } from '../../pkg/ts/index.ts';
import { createPublicClient, http, type Address } from 'viem';
import { foundry } from 'viem/chains';
import { expect, test } from 'vitest';
import { startAnvil, stopAnvil, waitForAnvil, MNEMONIC, DEPLOYER_ADDRESS_INDEX } from '@fhevm/sdk-common-dev';
import { privateKeyFromMnemonic, privateKeyToAddress } from '@fhevm/sdk-common-dev';
import { createViemEthereumAdapters } from '@fhevm/sdk-vendored-dev/viemEthereumLib.ts';

const PROTOCOL_CONFIG_ABI = [
  {
    type: 'function',
    name: 'getCurrentKmsContextId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isValidKmsContext',
    stateMutability: 'view',
    inputs: [{ name: 'kmsContextId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

test('destroyKmsContext aborts a Pending KMS context through ACLOwner.execute', async () => {
  const deployerKey = privateKeyFromMnemonic({ mnemonic: MNEMONIC, addressIndex: DEPLOYER_ADDRESS_INDEX });
  const deployerAddress = privateKeyToAddress({ privateKey: deployerKey });

  const anvil = startAnvil({ port: 8631, mnemonic: MNEMONIC });
  try {
    await waitForAnvil(anvil.rpcUrl);

    const adapters = createViemEthereumAdapters({ rpcUrl: anvil.rpcUrl, privateKey: deployerKey });
    const publicClient = createPublicClient({ chain: foundry, transport: http(anvil.rpcUrl) });

    const { fhevmAddresses, cleartextAddresses, pauserSetAddress } = precomputeAddresses({
      ethUtils: adapters.utils,
      from: deployerAddress,
      startNonce: 0n,
    });

    // Deploy a default v13 stack (ACL owned by the standing ACLOwner, ACLOwner owned by `admin`).
    const deployed = await deploy({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      deployer: adapters.signer,
      admin: adapters.signer,
      precomputed: { fhevmAddresses, cleartextAddresses, pauserSetAddress },
    });

    const protocolConfig = deployed.fhevmAddresses.protocolConfigAddress as Address;
    const currentContextId = (): Promise<bigint> =>
      publicClient.readContract({
        address: protocolConfig,
        abi: PROTOCOL_CONFIG_ABI,
        functionName: 'getCurrentKmsContextId',
      });
    const isValid = (kmsContextId: bigint): Promise<boolean> =>
      publicClient.readContract({
        address: protocolConfig,
        abi: PROTOCOL_CONFIG_ABI,
        functionName: 'isValidKmsContext',
        args: [kmsContextId],
      });

    // The deploy seeds the first context. In v14 a proposal is Pending, not active: the first context
    // stays current and valid, the proposal is not yet valid, and before its confirmation the one thing
    // that can happen to it is an abort — which is what destroying a non-active context is.
    const firstContextId = await currentContextId();
    expect(await isValid(firstContextId)).toBe(true);

    const { kmsContextId: pendingContextId } = await defineNewKmsContextAndEpoch({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      admin: adapters.signer,
      aclOwnerAddress: deployed.aclOwnerAddress,
      protocolConfigAddress: deployed.fhevmAddresses.protocolConfigAddress,
    });
    expect(pendingContextId).toBe(firstContextId + 1n);
    expect(await currentContextId()).toBe(firstContextId);
    expect(await isValid(firstContextId)).toBe(true);
    expect(await isValid(pendingContextId)).toBe(false);

    // Abort the proposal.
    await destroyKmsContext({
      ethUtils: adapters.utils,
      admin: adapters.signer,
      aclOwnerAddress: deployed.aclOwnerAddress,
      protocolConfigAddress: deployed.fhevmAddresses.protocolConfigAddress,
      kmsContextId: pendingContextId,
    });

    // The proposal stays invalid; the active context is untouched.
    expect(await isValid(pendingContextId)).toBe(false);
    expect(await currentContextId()).toBe(firstContextId);
    expect(await isValid(firstContextId)).toBe(true);
  } finally {
    await stopAnvil(anvil.process);
  }
}, 120_000);
