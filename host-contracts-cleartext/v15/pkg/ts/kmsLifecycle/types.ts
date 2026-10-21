// Types of v14's KMS context rotation. Re-exported from ../types/public.ts so consumers see one type surface.
import type { AbstractEthereumSigner } from '../types/public.js';

/** One generated key's digest, as `IKMSGeneration.KeyDigest`; `keyType` 0 is Server, 1 is Public. */
export type KeyDigest = {
  readonly keyType: number;
  readonly digest: string;
};

/** What every signer of the incoming committee attests to for an epoch: identical values, or the vote splits. */
export type EpochActivationAttestation = {
  readonly prepKeygenId: bigint;
  readonly keyId: bigint;
  readonly keyDigests: readonly KeyDigest[];
  readonly crsId: bigint;
  readonly maxBitLength: bigint;
  readonly crsDigest: string;
};

/** The two EIP-712 digests a signer must sign for an epoch, built by the package, signed by the caller. */
export type EpochActivationDigests = {
  readonly keygen: string;
  readonly crsgen: string;
};

/** One incoming node: the tx sender that submits, and a signing callback for the keys this package never holds. */
export type KmsEpochActivator = {
  readonly txSender: AbstractEthereumSigner;
  readonly sign: (digests: EpochActivationDigests) => Promise<{ readonly keygen: string; readonly crsgen: string }>;
};
