// Phase 3 of a v14 rotation: every incoming signer attests to the epoch's key and CRS results, and the
// context becomes Active. The package builds the EIP-712 digests and submits signatures; it never signs.
import { abi as protocolConfigAbi } from '../artifacts/ProtocolConfig.js';
import type { AbstractEthereumProvider, AbstractEthereumSigner, AbstractEthereumUtils } from '../types/public.js';
import type { EpochActivationAttestation, EpochActivationDigests, KeyDigest } from './types.js';

/** `EXTRA_DATA_V2` in the contracts' shared/Constants.sol. */
const EXTRA_DATA_V2 = 0x02;
/** The EIP-712 domain `ProtocolConfig` builds in `_hashTypedData`: its own name, version "1". */
const DOMAIN_NAME = 'ProtocolConfig';
const DOMAIN_VERSION = '1';
const KEY_DIGEST_TYPE = 'KeyDigest(uint8 keyType,bytes digest)';
const KEYGEN_TYPE = `KeygenVerification(uint256 prepKeygenId,uint256 keyId,KeyDigest[] keyDigests,bytes extraData)${KEY_DIGEST_TYPE}`;
const CRSGEN_TYPE = 'CrsgenVerification(uint256 crsId,uint256 maxBitLength,bytes crsDigest,bytes extraData)';
const DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';

/**
 * The two digests each incoming signer must sign to activate `epochId`. Every signer signs the same
 * values: the contract requires unanimity, and a divergent attestation leaves the epoch Pending for good.
 */
export function epochActivationDigests(parameters: {
  readonly ethUtils: AbstractEthereumUtils;
  readonly protocolConfigAddress: string;
  readonly chainId: bigint;
  readonly kmsContextId: bigint;
  readonly epochId: bigint;
  readonly attestation: EpochActivationAttestation;
}): EpochActivationDigests {
  const { ethUtils, attestation } = parameters;
  const domainSeparator = _domainSeparator(parameters);
  // abi.encodePacked(uint8 EXTRA_DATA_V2, uint256 contextId, uint256 epochId): one byte, two bare words.
  const extraData =
    `0x${EXTRA_DATA_V2.toString(16).padStart(2, '0')}` +
    parameters.kmsContextId.toString(16).padStart(64, '0') +
    parameters.epochId.toString(16).padStart(64, '0');
  const extraDataHash = ethUtils.keccak256({ bytes: extraData });

  const keygen = ethUtils.encodeAbiParameters({
    types: ['bytes32', 'uint256', 'uint256', 'bytes32', 'bytes32'],
    values: [
      _hashString(ethUtils, KEYGEN_TYPE),
      attestation.prepKeygenId,
      attestation.keyId,
      _keyDigestsHash(ethUtils, attestation.keyDigests),
      extraDataHash,
    ],
  });
  const crsgen = ethUtils.encodeAbiParameters({
    types: ['bytes32', 'uint256', 'uint256', 'bytes32', 'bytes32'],
    values: [
      _hashString(ethUtils, CRSGEN_TYPE),
      attestation.crsId,
      attestation.maxBitLength,
      ethUtils.keccak256({ bytes: attestation.crsDigest }),
      extraDataHash,
    ],
  });
  return {
    keygen: _typedDataHash(ethUtils, domainSeparator, ethUtils.keccak256({ bytes: keygen })),
    crsgen: _typedDataHash(ethUtils, domainSeparator, ethUtils.keccak256({ bytes: crsgen })),
  };
}

/**
 * Submit one signer's attestations from its TX SENDER (the contract resolves the signer from `msg.sender`)
 * and report whether that vote made the context Active.
 */
export async function confirmEpochActivation(parameters: {
  readonly ethProvider: AbstractEthereumProvider;
  readonly txSender: AbstractEthereumSigner;
  readonly protocolConfigAddress: string;
  readonly kmsContextId: bigint;
  readonly epochId: bigint;
  readonly attestation: EpochActivationAttestation;
  readonly keygenSignature: string;
  readonly crsgenSignature: string;
}): Promise<{ readonly active: boolean }> {
  const { attestation } = parameters;
  await parameters.txSender.writeContract({
    address: parameters.protocolConfigAddress,
    abi: protocolConfigAbi,
    functionName: 'confirmEpochActivation',
    args: [
      parameters.epochId,
      [
        {
          prepKeygenId: attestation.prepKeygenId,
          keyId: attestation.keyId,
          keyDigests: attestation.keyDigests,
          signature: parameters.keygenSignature,
        },
      ],
      [
        {
          crsId: attestation.crsId,
          maxBitLength: attestation.maxBitLength,
          crsDigest: attestation.crsDigest,
          signature: parameters.crsgenSignature,
        },
      ],
    ],
  });
  const current = (await parameters.ethProvider.readContract({
    address: parameters.protocolConfigAddress,
    abi: protocolConfigAbi,
    functionName: 'getCurrentKmsContextAndEpoch',
  })) as readonly [bigint, bigint];
  return { active: current[0] === parameters.kmsContextId };
}

// EIP-712 rebuilt from `keccak256` and `encodeAbiParameters`, so it works under any adapter.

/** `keccak256(abi.encode(typeHash, name, version, chainId, verifyingContract))`. */
function _domainSeparator(parameters: {
  readonly ethUtils: AbstractEthereumUtils;
  readonly protocolConfigAddress: string;
  readonly chainId: bigint;
}): string {
  const { ethUtils } = parameters;
  return ethUtils.keccak256({
    bytes: ethUtils.encodeAbiParameters({
      types: ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      values: [
        _hashString(ethUtils, DOMAIN_TYPE),
        _hashString(ethUtils, DOMAIN_NAME),
        _hashString(ethUtils, DOMAIN_VERSION),
        parameters.chainId,
        parameters.protocolConfigAddress,
      ],
    }),
  });
}

/** `keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash))`. */
function _typedDataHash(ethUtils: AbstractEthereumUtils, domainSeparator: string, structHash: string): string {
  return ethUtils.keccak256({ bytes: `0x1901${_strip(domainSeparator)}${_strip(structHash)}` });
}

/** `keccak256` of the concatenated `KeyDigest` struct hashes, as `_hashKeyDigests` does on-chain. */
function _keyDigestsHash(ethUtils: AbstractEthereumUtils, keyDigests: readonly KeyDigest[]): string {
  const encoded = keyDigests
    .map((keyDigest) =>
      _strip(
        ethUtils.keccak256({
          bytes: ethUtils.encodeAbiParameters({
            types: ['bytes32', 'uint8', 'bytes32'],
            values: [
              _hashString(ethUtils, KEY_DIGEST_TYPE),
              keyDigest.keyType,
              ethUtils.keccak256({ bytes: keyDigest.digest }),
            ],
          }),
        }),
      ),
    )
    .join('');
  return ethUtils.keccak256({ bytes: `0x${encoded}` });
}

/** `keccak256(bytes(s))` over the UTF-8 bytes; also the type hash of a type string. */
function _hashString(ethUtils: AbstractEthereumUtils, value: string): string {
  const bytes = [...new TextEncoder().encode(value)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return ethUtils.keccak256({ bytes: `0x${bytes}` });
}

function _strip(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}
