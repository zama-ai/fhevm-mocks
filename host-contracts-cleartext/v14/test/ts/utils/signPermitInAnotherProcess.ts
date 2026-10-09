// Signs a user-decryption permit with one sdk line and prints it, serialized as an app would store it, together with
// its transport key pair. Run as its own `node` process by utils/sdkLines.ts: the sdk caches the KMS context per
// process, so a permit signed here leaves the test process's sdk untouched — the test can then load the permit in a
// process that first meets the sdk after a KMS rotation, like an app that restarted.
//
// Input (argv[2], JSON): { sdkName, rpcUrl, chain (an sdk chain definition), mnemonic, addressIndex, contractAddress,
// startTimestamp, durationSeconds }. Only the sdk and viem are imported, so node runs this file as is.
import { type PublicClient, createPublicClient, http } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

type Input = {
  sdkName: string;
  rpcUrl: string;
  chain: unknown;
  mnemonic: string;
  addressIndex: number;
  contractAddress: `0x${string}`;
  startTimestamp: number;
  durationSeconds: number;
};
type Client = {
  readonly ready: Promise<unknown>;
  generateTransportKeyPair(): Promise<unknown>;
  signLegacyDecryptionPermit(args: object): Promise<unknown>;
  serializeTransportKeyPair(args: { transportKeyPair: unknown }): Promise<unknown>;
  serializeSignedDecryptionPermit(args: { signedPermit: unknown }): Promise<unknown>;
};

const input = JSON.parse(process.argv[2] ?? '') as Input;
const viem = (await import(`${input.sdkName}/viem`)) as { setFhevmRuntimeConfig(config: object): void };
const cleartext = (await import(`${input.sdkName}/viem/cleartext`)) as {
  createFhevmCleartextClient(args: { publicClient: PublicClient; chain: unknown }): Client;
};
const chains = (await import(`${input.sdkName}/chains`)) as { defineFhevmChain(definition: unknown): unknown };

viem.setFhevmRuntimeConfig({});
const publicClient = createPublicClient({ chain: foundry, transport: http(input.rpcUrl) });
const client = cleartext.createFhevmCleartextClient({ publicClient, chain: chains.defineFhevmChain(input.chain) });
await client.ready;

const user = mnemonicToAccount(input.mnemonic, { addressIndex: input.addressIndex });
const transportKeyPair = await client.generateTransportKeyPair();
const signedPermit = await client.signLegacyDecryptionPermit({
  contractAddresses: [input.contractAddress],
  startTimestamp: input.startTimestamp,
  durationSeconds: input.durationSeconds,
  signerAddress: user.address,
  signer: { signTypedData: (data: unknown) => user.signTypedData(data as never) },
  transportKeyPair,
});

process.stdout.write(
  JSON.stringify({
    transportKeyPair: await client.serializeTransportKeyPair({ transportKeyPair }),
    signedPermit: await client.serializeSignedDecryptionPermit({ signedPermit }),
  }),
);
