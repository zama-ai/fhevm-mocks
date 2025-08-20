import { ethers as EthersT } from "ethers";

import { FhevmError, assertFhevm } from "../../utils/error.js";
import { remove0x } from "../../utils/string.js";
import type { EIP712 } from "../types.js";

// Follows relayer-sdk keys lengths
const ML_KEM_CT_PK_LENGTH: number = 1568;
const ML_KEM_SK_LENGTH: number = 3168;

const PUBLIC_KEY_LENGTH: number = (ML_KEM_CT_PK_LENGTH + 8) * 2;
const PRIVATE_KEY_LENGTH: number = (ML_KEM_SK_LENGTH + 8) * 2;

function _verifyKeypair(keyPair: { publicKey: string; privateKey: string }) {
  keyPair.publicKey = remove0x(keyPair.publicKey);
  keyPair.privateKey = remove0x(keyPair.privateKey);

  if (!EthersT.isHexString("0x" + keyPair.publicKey, PUBLIC_KEY_LENGTH)) {
    throw new FhevmError(
      `Invalid key pair's publicKey. Call FhevmInstance.generateKeyPair() to generate a valid FHEVM key pair.`,
    );
  }
  if (!EthersT.isHexString("0x" + keyPair.privateKey, PRIVATE_KEY_LENGTH)) {
    throw new FhevmError(
      `Invalid key pair's publicKey. Call FhevmInstance.generateKeyPair() to generate a valid FHEVM key pair.`,
    );
  }
}

export function generateKeypair(): {
  publicKey: string;
  privateKey: string;
} {
  const wallet = EthersT.Wallet.createRandom();

  const walletPublicKeyNoPrefix = remove0x(wallet.publicKey);
  const walletPrivateKeyNoPrefix = remove0x(wallet.privateKey);

  assertFhevm(walletPublicKeyNoPrefix.length === walletPrivateKeyNoPrefix.length + 2);

  const publicKeyPrefixLen = 2 * PUBLIC_KEY_LENGTH - walletPublicKeyNoPrefix.length;
  const privateKeyPrefixLen = 2 * PRIVATE_KEY_LENGTH - (2 + walletPrivateKeyNoPrefix.length);

  let n = Math.floor(publicKeyPrefixLen / 8);
  const publicKeyPrefix = "deadbeef".repeat(n) + "0".repeat(publicKeyPrefixLen - n * 8);

  n = Math.floor(privateKeyPrefixLen / 8);
  const privateKeyPrefix = "deadbeef".repeat(n) + "0".repeat(privateKeyPrefixLen - n * 8);

  const publicKey = "0x" + publicKeyPrefix + walletPublicKeyNoPrefix;
  const privateKey = "0x" + privateKeyPrefix + "00" + walletPrivateKeyNoPrefix;

  assertFhevm(publicKey.length === 2 + 2 * PUBLIC_KEY_LENGTH);
  assertFhevm(privateKey.length === 2 + 2 * PRIVATE_KEY_LENGTH);
  assertFhevm(walletPublicKeyNoPrefix.length === 66);
  assertFhevm(walletPrivateKeyNoPrefix.length === 64);

  const keypair = {
    publicKey,
    privateKey,
  };

  _verifyKeypair(keypair);

  return keypair;
}

/*
  Copy/Paste from https://github.com/zama-ai/relayer-sdk/main/src/sdk/keypair.ts
*/

/**
 * Creates an EIP712 structure specifically for user decrypt requests
 *
 * @param gatewayChainId - The chain ID of the gateway
 * @param verifyingContract - The address of the contract that will verify the signature
 * @param publicKey - The user's public key as a hex string or Uint8Array
 * @param contractAddresses - Array of contract addresses that can access the decryption
 * @param contractsChainId - The chain ID where the contracts are deployed
 * @param startTimestamp - The timestamp when the decryption permission becomes valid
 * @param durationDays - How many days the decryption permission remains valid
 * @param delegatedAccount - Optional delegated account address
 * @returns EIP712 typed data structure for user decryption
 */
export const createEIP712 =
  (verifyingContract: string, contractsChainId: number) =>
  (
    publicKey: string | Uint8Array,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
    delegatedAccount?: string,
  ): EIP712 => {
    const extraData: `0x${string}` = "0x00";
    if (delegatedAccount && !EthersT.isAddress(delegatedAccount)) throw new Error("Invalid delegated account.");

    if (!EthersT.isAddress(verifyingContract)) {
      throw new Error("Invalid verifying contract address.");
    }

    if (!contractAddresses.every((c) => EthersT.isAddress(c))) {
      throw new Error("Invalid contract address.");
    }
    // Format the public key based on its type
    const formattedPublicKey =
      typeof publicKey === "string" ? (publicKey.startsWith("0x") ? publicKey : `0x${publicKey}`) : publicKey;

    // Convert timestamps to strings if they're bigints
    const formattedStartTimestamp = typeof startTimestamp === "number" ? startTimestamp.toString() : startTimestamp;

    const formattedDurationDays = typeof durationDays === "number" ? durationDays.toString() : durationDays;

    const EIP712Domain = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ];

    const domain = {
      name: "Decryption",
      version: "1",
      chainId: contractsChainId,
      verifyingContract,
    };

    if (delegatedAccount) {
      return {
        types: {
          EIP712Domain,
          DelegatedUserDecryptRequestVerification: [
            { name: "publicKey", type: "bytes" },
            { name: "contractAddresses", type: "address[]" },
            { name: "contractsChainId", type: "uint256" },
            { name: "startTimestamp", type: "uint256" },
            { name: "durationDays", type: "uint256" },
            { name: "extraData", type: "bytes" },
            {
              name: "delegatedAccount",
              type: "address",
            },
          ],
        },
        primaryType: "DelegatedUserDecryptRequestVerification",
        domain,
        message: {
          publicKey: formattedPublicKey,
          contractAddresses,
          contractsChainId,
          startTimestamp: formattedStartTimestamp,
          durationDays: formattedDurationDays,
          extraData,
          delegatedAccount: delegatedAccount,
        },
      };
    }

    return {
      types: {
        EIP712Domain,
        UserDecryptRequestVerification: [
          { name: "publicKey", type: "bytes" },
          { name: "contractAddresses", type: "address[]" },
          { name: "contractsChainId", type: "uint256" },
          { name: "startTimestamp", type: "uint256" },
          { name: "durationDays", type: "uint256" },
          { name: "extraData", type: "bytes" },
        ],
      },
      primaryType: "UserDecryptRequestVerification",
      domain,
      message: {
        publicKey: formattedPublicKey,
        contractAddresses,
        contractsChainId,
        startTimestamp: formattedStartTimestamp,
        durationDays: formattedDurationDays,
        extraData,
      },
    };
  };
