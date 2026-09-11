// v14's KMS rotation end to end: propose, reach the creation quorum, activate the epoch with every incoming
// signer's attestation, then retire the superseded context. The package builds the digests; the harness signs.
import { deploy, destroyKmsContext, rotateKmsContext } from '../../pkg/ts/index.ts';
import { abi as protocolConfigAbi } from '../../pkg/ts/artifacts/ProtocolConfig.ts';
import { createPublicClient, http, type Abi, type Address } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { expect, test } from 'vitest';
import { startAnvil, stopAnvil, waitForAnvil, MNEMONIC, DEPLOYER_ADDRESS_INDEX } from '@fhevm/sdk-common-dev';
import { privateKeyFromMnemonic } from '@fhevm/sdk-common-dev';
import { createViemEthereumAdapters } from '@fhevm/sdk-vendored-dev/viemEthereumLib.ts';
import { FIXTURE_ATTESTATION, defaultKmsEpochActivators, fundKmsTxSenders } from './utils/kmsEpochActivators.ts';

// The default KMS pools are derived from the FHEVM test mnemonic, signers at m/44'/60'/0'/3/<i>.
const FHEVM_MNEMONIC = 'test test test test test test test future home engine virtual motion';
const defaultKmsSigner = (index: number): string =>
  mnemonicToAccount(FHEVM_MNEMONIC, { changeIndex: 3, addressIndex: index }).address.toLowerCase();

test('rotateKmsContext drives a proposal through quorum and activation, and the old context can then be retired', async () => {
  const deployerKey = privateKeyFromMnemonic({ mnemonic: MNEMONIC, addressIndex: DEPLOYER_ADDRESS_INDEX });
  const anvil = startAnvil({ port: 8632, mnemonic: MNEMONIC });
  try {
    await waitForAnvil(anvil.rpcUrl);
    const adapters = createViemEthereumAdapters({ rpcUrl: anvil.rpcUrl, privateKey: deployerKey });
    const publicClient = createPublicClient({ chain: foundry, transport: http(anvil.rpcUrl) });
    const deployed = await deploy({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      deployer: adapters.signer,
      admin: adapters.signer,
    });
    const protocolConfig = deployed.fhevmAddresses.protocolConfigAddress as Address;
    const read = (functionName: string, args: readonly unknown[] = []): Promise<unknown> =>
      publicClient.readContract({ address: protocolConfig, abi: protocolConfigAbi as Abi, functionName, args });
    const readSigners = async (): Promise<string[]> =>
      ((await read('getKmsSigners')) as readonly string[]).map((s) => s.toLowerCase());
    const readContextAndEpoch = () => read('getCurrentKmsContextAndEpoch') as Promise<readonly [bigint, bigint]>;

    const initialWindow = [0, 1, 2, 3].map(defaultKmsSigner);
    const nextWindow = [4, 5, 6, 7].map(defaultKmsSigner);
    expect(await readSigners()).toEqual(initialWindow);
    const [firstContextId, firstEpochId] = await readContextAndEpoch();

    // The incoming committee attests; the outgoing one supplies the previous-committee confirmations the
    // creation quorum also needs. Both pools come from the FHEVM mnemonic, so both need gas first.
    const incoming = defaultKmsEpochActivators({
      rpcUrl: anvil.rpcUrl,
      mnemonic: FHEVM_MNEMONIC,
      indices: [4, 5, 6, 7],
    });
    const outgoing = defaultKmsEpochActivators({
      rpcUrl: anvil.rpcUrl,
      mnemonic: FHEVM_MNEMONIC,
      indices: [0, 1, 2, 3],
    });
    await fundKmsTxSenders({ rpcUrl: anvil.rpcUrl, activators: [...incoming, ...outgoing] });

    const rotated = await rotateKmsContext({
      ethProvider: adapters.provider,
      ethUtils: adapters.utils,
      admin: adapters.signer,
      aclOwnerAddress: deployed.aclOwnerAddress,
      protocolConfigAddress: deployed.fhevmAddresses.protocolConfigAddress,
      chainId: BigInt(foundry.id),
      activators: incoming,
      previousTxSenders: outgoing.map((activator) => activator.txSender),
      attestation: FIXTURE_ATTESTATION,
    });

    // Active: the new committee is in charge, one context and one epoch further along.
    expect(rotated.signers.map((s) => s.toLowerCase())).toEqual(nextWindow);
    expect(rotated.kmsContextId).toBe(firstContextId + 1n);
    expect(rotated.epochId).toBe(firstEpochId + 1n);
    expect(await readSigners()).toEqual(nextWindow);
    expect(await readContextAndEpoch()).toEqual([rotated.kmsContextId, rotated.epochId]);

    // The superseded context is now past, valid until retired, and retirable.
    expect(await read('isValidKmsContext', [firstContextId])).toBe(true);
    await destroyKmsContext({
      ethUtils: adapters.utils,
      admin: adapters.signer,
      aclOwnerAddress: deployed.aclOwnerAddress,
      protocolConfigAddress: deployed.fhevmAddresses.protocolConfigAddress,
      kmsContextId: firstContextId,
    });
    expect(await read('isValidKmsContext', [firstContextId])).toBe(false);
    expect(await readContextAndEpoch()).toEqual([rotated.kmsContextId, rotated.epochId]);
  } finally {
    await stopAnvil(anvil.process);
  }
}, 180_000);
