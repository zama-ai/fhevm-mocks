import { deploy, defineNewKmsContextAndEpoch } from '../../pkg/ts/index.ts';
import { createPublicClient, http, type Address } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { expect, test } from 'vitest';
import { startAnvil, stopAnvil, waitForAnvil, MNEMONIC, DEPLOYER_ADDRESS_INDEX } from '@fhevm/sdk-common-dev';
import { privateKeyFromMnemonic } from '@fhevm/sdk-common-dev';
import { createViemEthereumAdapters } from '@fhevm/sdk-vendored-dev/viemEthereumLib.ts';

// The default KMS signer pool is derived from the FHEVM test mnemonic at m/44'/60'/0'/3/<i>.
const FHEVM_MNEMONIC = 'test test test test test test test future home engine virtual motion';
const defaultKmsSigner = (index: number): string =>
  mnemonicToAccount(FHEVM_MNEMONIC, { changeIndex: 3, addressIndex: index }).address.toLowerCase();

const PROTOCOL_CONFIG_ABI = [
  { type: 'function', name: 'getKmsSigners', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  {
    type: 'function',
    name: 'getCurrentKmsContextId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getCurrentKmsContextIdCounter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

test('defineNewKmsContextAndEpoch proposes the next KMS signer window as a Pending context', async () => {
  const deployerKey = privateKeyFromMnemonic({ mnemonic: MNEMONIC, addressIndex: DEPLOYER_ADDRESS_INDEX });

  const anvil = startAnvil({ port: 8630, mnemonic: MNEMONIC });
  try {
    await waitForAnvil(anvil.rpcUrl);

    const adapters = createViemEthereumAdapters({ rpcUrl: anvil.rpcUrl, privateKey: deployerKey });
    const publicClient = createPublicClient({ chain: foundry, transport: http(anvil.rpcUrl) });

    // Deploy a default v13 stack with no config AND no precomputed addresses — deploy derives them from
    // the deployer's live nonce. (no config → default KMS pool[0..3]; ACL owned by the standing
    // ACLOwner, ACLOwner owned by `admin` — exactly the topology defineNewKmsContext targets.)
    const deployed = await deploy({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      deployer: adapters.signer,
      admin: adapters.signer,
    });

    const protocolConfig = deployed.fhevmAddresses.protocolConfigAddress as Address;
    const readSigners = async (): Promise<string[]> =>
      [
        ...(await publicClient.readContract({
          address: protocolConfig,
          abi: PROTOCOL_CONFIG_ABI,
          functionName: 'getKmsSigners',
        })),
      ].map((s) => s.toLowerCase());
    const readContextId = (): Promise<bigint> =>
      publicClient.readContract({
        address: protocolConfig,
        abi: PROTOCOL_CONFIG_ABI,
        functionName: 'getCurrentKmsContextId',
      });

    const readCounter = (): Promise<bigint> =>
      publicClient.readContract({
        address: protocolConfig,
        abi: PROTOCOL_CONFIG_ABI,
        functionName: 'getCurrentKmsContextIdCounter',
      });

    // Initial context: the default pool window [0, 4).
    const initialWindow = [0, 1, 2, 3].map(defaultKmsSigner);
    expect(await readSigners()).toEqual(initialWindow);
    const initialContextId = await readContextId();
    expect(await readCounter()).toBe(initialContextId);

    // Propose the next window [4, 8), routed through ACLOwner.execute (admin owns the ACLOwner).
    const { signers, kmsContextId } = await defineNewKmsContextAndEpoch({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      admin: adapters.signer,
      aclOwnerAddress: deployed.aclOwnerAddress,
      protocolConfigAddress: deployed.fhevmAddresses.protocolConfigAddress,
    });

    const nextWindow = [4, 5, 6, 7].map(defaultKmsSigner);
    expect(signers.map((s) => s.toLowerCase())).toEqual(nextWindow);

    // v14 only proposes: the new context took the next id and holds the next window, but the old
    // committee stays in charge until creation is confirmed and its first epoch activated (kmsLifecycle/).
    expect(kmsContextId).toBe(initialContextId + 1n);
    expect(await readCounter()).toBe(kmsContextId);
    expect(await readContextId()).toBe(initialContextId);
    expect(await readSigners()).toEqual(initialWindow);
    // The proposed set itself is not behind any getter (they serve valid contexts only); it lives in the
    // NewKmsContext event, which is what the KMS connector reads.
  } finally {
    await stopAnvil(anvil.process);
  }
}, 120_000);
