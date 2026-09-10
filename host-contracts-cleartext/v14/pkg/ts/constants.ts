import { DEFAULT_COPROCESSOR_ADDRESSES } from './signers/defaultCoprocessorSigners.js';
import { DEFAULT_KMS_NODE_ADDRESSES } from './signers/defaultKmsSigners.js';
import { DEFAULT_KMS_NODE_TX_SENDER_ADDRESSES } from './signers/defaultKmsTxSenderSigners.js';
import type { BootstrapConfig, KmsNodeParams, KmsThresholds } from './types/public.js';
// Every scalar the cleartext stack is configured with comes from here — the generated TypeScript face of
// sdk/cleartext-config.json, synced from common-vendored/src. The values are deliberately NOT re-exported
// under `DEFAULT_*` aliases: an alias is a second name for one value, which is how the two copies of this
// config drifted in the first place.
import {
  CLEARTEXT_COPROCESSOR_COUNT,
  CLEARTEXT_COPROCESSOR_THRESHOLD,
  CLEARTEXT_DECRYPTION_ADDRESS,
  CLEARTEXT_GATEWAY_CHAIN_ID,
  CLEARTEXT_HCU_CAP_PER_BLOCK,
  CLEARTEXT_INPUT_VERIFICATION_ADDRESS,
  CLEARTEXT_KMS_NODE_COUNT,
  CLEARTEXT_KMS_NODE_IP_ADDRESS_PREFIX,
  CLEARTEXT_KMS_NODE_STORAGE_URL_PREFIX,
  CLEARTEXT_MAX_HCU_DEPTH_PER_TX,
  CLEARTEXT_MAX_HCU_PER_TX,
} from './cleartext-config.js';
import {
  CLEARTEXT_KMS_NODE_CA_CERT,
  CLEARTEXT_KMS_NODE_MPC_IDENTITY_INFIX,
  CLEARTEXT_KMS_NODE_MPC_IDENTITY_PREFIX,
  CLEARTEXT_KMS_NODE_PUBLIC_STORAGE_PREFIX,
  CLEARTEXT_KMS_SOFTWARE_VERSION,
} from './cleartext-config-v14.js';

/** Node i's metadata, all one-based like the IP and storage-URL suffixes were in v13. */
function kmsNodeMetadata(i: number): Omit<KmsNodeParams, 'txSenderAddress' | 'signerAddress'> {
  const n = String(i + 1);
  return {
    ipAddress: `${CLEARTEXT_KMS_NODE_IP_ADDRESS_PREFIX}${n}`,
    storageUrl: `${CLEARTEXT_KMS_NODE_STORAGE_URL_PREFIX}${n}`,
    partyId: i + 1,
    mpcIdentity: `${CLEARTEXT_KMS_NODE_MPC_IDENTITY_PREFIX}${n}${CLEARTEXT_KMS_NODE_MPC_IDENTITY_INFIX}${n}`,
    caCert: CLEARTEXT_KMS_NODE_CA_CERT,
    storagePrefix: `${CLEARTEXT_KMS_NODE_PUBLIC_STORAGE_PREFIX}${n}`,
  };
}

/**
 * The four KMS thresholds, each defaulting to the node count.
 *
 * `CLEARTEXT_KMS_NODE_COUNT` is a plain number — it is a count, and the harness renders it into Solidity
 * as one — whereas the on-chain struct takes `uint256`, so it is widened here rather than stored twice in
 * two types.
 */
export const DEFAULT_KMS_THRESHOLDS: KmsThresholds = {
  publicDecryption: BigInt(CLEARTEXT_KMS_NODE_COUNT),
  userDecryption: BigInt(CLEARTEXT_KMS_NODE_COUNT),
  kmsGen: BigInt(CLEARTEXT_KMS_NODE_COUNT),
  mpc: BigInt(CLEARTEXT_KMS_NODE_COUNT),
};

function generateDefaultKmsNodes(num: number): KmsNodeParams[] {
  if (num > DEFAULT_KMS_NODE_ADDRESSES.length) {
    throw new Error('Too many kms nodes');
  }
  const nodes: KmsNodeParams[] = [];
  for (let i = 0; i < num; ++i) {
    const n: KmsNodeParams = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      txSenderAddress: DEFAULT_KMS_NODE_TX_SENDER_ADDRESSES[i]!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      signerAddress: DEFAULT_KMS_NODE_ADDRESSES[i]!,
      ...kmsNodeMetadata(i),
    };
    nodes.push(n);
  }

  return nodes;
}

// Module scope — built once, not per call.
const KMS_SIGNER_INDEX = new Map(DEFAULT_KMS_NODE_ADDRESSES.map((a, i) => [a.toLowerCase(), i]));

export function generateFromExistingDefaultKmsNodes(existingSigners: string[]): KmsNodeParams[] {
  if (existingSigners.length > DEFAULT_KMS_NODE_ADDRESSES.length) {
    throw new Error('Too many kms nodes');
  }
  return existingSigners.map((signer) => {
    const j = KMS_SIGNER_INDEX.get(signer.toLowerCase());
    if (j === undefined) {
      throw new Error(`Unknown kms signer: ${signer}`);
    }
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      txSenderAddress: DEFAULT_KMS_NODE_TX_SENDER_ADDRESSES[j]!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      signerAddress: DEFAULT_KMS_NODE_ADDRESSES[j]!,
      ...kmsNodeMetadata(j),
    };
  });
}

/**
 * Rotate a KMS signer set to the next window of the default pool.
 *
 * The default signer pool is a fixed list of {@link DEFAULT_KMS_NODE_ADDRESSES.length} addresses. A KMS
 * context always uses a consecutive, circularly-wrapping window of it: `currentSigners` must be exactly
 * `[pool[i], pool[(i + 1) % N], …, pool[(i + n - 1) % N]]` for some start `i` and length `n`. This
 * returns the next window of the same length — `[pool[(i + n) % N], …, pool[(i + 2n - 1) % N]]`.
 *
 * @throws if `currentSigners` is empty, longer than the pool, contains an unknown signer, or is not a
 *         consecutive window (wrong order or a gap).
 */
export function nextDefaultKmsSignerWindow(currentSigners: readonly string[]): string[] {
  const poolSize = DEFAULT_KMS_NODE_ADDRESSES.length;
  const n = currentSigners.length;
  if (n === 0) {
    throw new Error('Empty kms signer set');
  }
  if (n > poolSize) {
    throw new Error('Too many kms signers');
  }

  const indices = currentSigners.map((signer) => {
    const index = KMS_SIGNER_INDEX.get(signer.toLowerCase());
    if (index === undefined) {
      throw new Error(`Unknown kms signer: ${signer}`);
    }
    return index;
  });

  const [start] = indices;
  if (start === undefined) {
    throw new Error('Empty kms signer set');
  }
  indices.forEach((index, k) => {
    if (index !== (start + k) % poolSize) {
      throw new Error(`Kms signers are not a consecutive window of the default pool (position ${k})`);
    }
  });

  return Array.from({ length: n }, (_unused, k) => {
    const address = DEFAULT_KMS_NODE_ADDRESSES[(start + n + k) % poolSize];
    if (address === undefined) {
      throw new Error('Unreachable: window index out of pool bounds');
    }
    return address;
  });
}

function generateDefaultCoprocessors(num: number): string[] {
  if (num > DEFAULT_COPROCESSOR_ADDRESSES.length) {
    throw new Error('Too many coprocessors');
  }
  const signers: string[] = [];
  for (let i = 0; i < num; ++i) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    signers.push(DEFAULT_COPROCESSOR_ADDRESSES[i]!);
  }

  return signers;
}

export const DEFAULT_BOOTSTRAP_CONFIG: BootstrapConfig = {
  hcuLimit: {
    hcuCapPerBlock: CLEARTEXT_HCU_CAP_PER_BLOCK,
    maxHCUDepthPerTx: CLEARTEXT_MAX_HCU_DEPTH_PER_TX,
    maxHCUPerTx: CLEARTEXT_MAX_HCU_PER_TX,
  },
  inputVerifier: {
    chainIDSource: CLEARTEXT_GATEWAY_CHAIN_ID,
    initialSigners: generateDefaultCoprocessors(CLEARTEXT_COPROCESSOR_COUNT),
    initialThreshold: BigInt(CLEARTEXT_COPROCESSOR_THRESHOLD),
    verifyingContractSource: CLEARTEXT_INPUT_VERIFICATION_ADDRESS,
  },
  protocolConfig: {
    initialKmsNodes: generateDefaultKmsNodes(CLEARTEXT_KMS_NODE_COUNT),
    initialThresholds: DEFAULT_KMS_THRESHOLDS,
    softwareVersion: CLEARTEXT_KMS_SOFTWARE_VERSION,
    pcrValues: [],
  },
  kmsVerifier: {
    chainIDSource: CLEARTEXT_GATEWAY_CHAIN_ID,
    verifyingContractSource: CLEARTEXT_DECRYPTION_ADDRESS,
  },
};
