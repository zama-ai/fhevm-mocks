// Signing for v14's epoch activation, which the package deliberately cannot do: it holds no keys and its
// signer adapter has no `signTypedData`, so the harness signs the digests the package computes, with viem.
import { mnemonicToAccount, sign } from 'viem/accounts';
import type { EpochActivationAttestation, EpochActivationDigests, KmsEpochActivator } from '../../../pkg/ts/index.ts';
import { createViemEthereumAdapters } from '@fhevm/sdk-vendored-dev/viemEthereumLib.ts';

/** The KMS mnemonic's HD branches: signers attest at change index 3, tx senders submit at 4. */
const KMS_SIGNER_CHANGE_INDEX = 3;
const KMS_TX_SENDER_CHANGE_INDEX = 4;

/** Fixture key and CRS results: a cleartext stack runs no keygen, and activation needs one of each. */
export const FIXTURE_ATTESTATION: EpochActivationAttestation = {
  prepKeygenId: 1n,
  keyId: 1n,
  keyDigests: [{ keyType: 0, digest: '0x00' }],
  crsId: 1n,
  maxBitLength: 2048n,
  crsDigest: '0x00',
};

/** Activators for a window of the default KMS pool; `indices` are pool positions, pairing signer and tx sender. */
export function defaultKmsEpochActivators(parameters: {
  readonly rpcUrl: string;
  readonly mnemonic: string;
  readonly indices: readonly number[];
}): KmsEpochActivator[] {
  return parameters.indices.map((index) => {
    const signerKey = _keyAt(parameters.mnemonic, KMS_SIGNER_CHANGE_INDEX, index);
    const txSenderKey = _keyAt(parameters.mnemonic, KMS_TX_SENDER_CHANGE_INDEX, index);
    return {
      txSender: createViemEthereumAdapters({ rpcUrl: parameters.rpcUrl, privateKey: txSenderKey }).signer,
      sign: async (digests: EpochActivationDigests) => ({
        keygen: await _signDigest(signerKey, digests.keygen),
        crsgen: await _signDigest(signerKey, digests.crsgen),
      }),
    };
  });
}

/** Anvil funds the deploy mnemonic's accounts only; the KMS tx senders start empty and need gas to submit. */
export async function fundKmsTxSenders(parameters: {
  readonly rpcUrl: string;
  readonly activators: readonly KmsEpochActivator[];
}): Promise<void> {
  for (const activator of parameters.activators) {
    const address = await activator.txSender.getAddress();
    const response = await fetch(parameters.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'anvil_setBalance',
        params: [address, '0xde0b6b3a7640000'],
      }),
    });
    if (!response.ok) throw new Error(`anvil_setBalance failed for ${address}: ${String(response.status)}`);
  }
}

/** The private key at `m/44'/60'/0'/<change>/<index>`, which the shared helper cannot select by change index. */
function _keyAt(mnemonic: string, changeIndex: number, addressIndex: number): `0x${string}` {
  const privateKey = mnemonicToAccount(mnemonic, { changeIndex, addressIndex }).getHdKey().privateKey;
  if (privateKey === null) throw new Error('could not derive a KMS key from the mnemonic');
  return `0x${[...privateKey].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Raw secp256k1 over an already-computed EIP-712 digest, as 65-byte r||s||v hex. */
async function _signDigest(privateKey: string, digest: string): Promise<string> {
  return sign({ hash: digest as `0x${string}`, privateKey: privateKey as `0x${string}`, to: 'hex' });
}
