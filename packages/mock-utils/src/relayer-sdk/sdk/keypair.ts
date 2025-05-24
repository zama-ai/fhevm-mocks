import { ethers as EthersT } from "ethers";

import { FhevmError } from "../../utils/error.js";
import { removePrefix } from "../../utils/string.js";
import type { EIP712 } from "../types.js";

function _verifyKeypair(keyPair: { publicKey: string; privateKey: string }) {
  keyPair.publicKey = removePrefix(keyPair.publicKey, "0x");
  keyPair.privateKey = removePrefix(keyPair.privateKey, "0x");

  if (!EthersT.isHexString("0x" + keyPair.publicKey, 80)) {
    throw new FhevmError(
      `Invalid key pair's publicKey. Call FhevmInstance.generateKeyPair() to generate a valid FHEVM key pair.`,
    );
  }
  if (!EthersT.isHexString("0x" + keyPair.privateKey, 80)) {
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

  const prefix = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef000000";

  const publicKey = "0x" + prefix + removePrefix(wallet.publicKey, "0x");
  const privateKey = "0x" + prefix + "00" + removePrefix(wallet.privateKey, "0x");

  const keypair = {
    publicKey,
    privateKey,
  };

  _verifyKeypair(keypair);

  return keypair;
}

export const createEIP712 =
  (gatewayChainId: number, verifyingContract: string, contractsChainId: number) =>
  (
    publicKey: string | Uint8Array,
    contractAddresses: string[],
    startTimestamp: string | number,
    durationDays: string | number,
    delegatedAccount?: string,
  ): EIP712 => {
    if (delegatedAccount && !EthersT.isAddress(delegatedAccount)) throw new FhevmError("Invalid delegated account.");

    if (!EthersT.isAddress(verifyingContract)) {
      throw new FhevmError("Invalid verifying contract address.");
    }

    if (!contractAddresses.every((c) => EthersT.isAddress(c))) {
      throw new FhevmError("Invalid contract address.");
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
      chainId: gatewayChainId,
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
      },
    };
  };
