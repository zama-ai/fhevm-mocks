import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../utils/address.js";
import { assertIsBytes32String } from "../utils/bytes.js";
import { FhevmError } from "../utils/error.js";
import { type MinimalProvider, minimalProviderSend } from "./provider.js";

/*
  /// keccak256(abi.encode(uint256(keccak256("fhevm.storage.FHEVMConfig")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant FHEVMConfigLocation = 0xed8d60e34876f751cc8b014c560745351147d9de11b9347c854e881b128ea600;

  /// keccak256(abi.encode(uint256(keccak256("fhevm.storage.DecryptionRequests")) - 1)) & ~bytes32(uint256(0xff))
  bytes32 private constant DecryptionRequestsStorageLocation =
      0x5ea69329017273582817d320489fbd94f775580e90c092699ca6f3d12fdf7d00;
*/
export function computeStorageLocation(storageName: string): string {
  const enc = EthersT.AbiCoder.defaultAbiCoder().encode(
    ["uint256"],
    [BigInt(EthersT.keccak256(EthersT.toUtf8Bytes(storageName))) - 1n],
  );
  return EthersT.toBeHex(
    BigInt(EthersT.keccak256(enc)) & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00n,
    32,
  );
}

/**
 * Reads a raw storage slot value from a smart contract using the `eth_getStorageAt` JSON-RPC method.
 *
 * This function queries the storage at a specific `index` for the given contract `address`,
 * using the `latest` block tag. The result is returned as a 32-byte hex string.
 *
 * @param provider - An EIP-1193-compatible provider used to send the RPC request.
 * @param address - The Ethereum address of the contract to read storage from.
 * @param index - The storage slot index (as a bigint) to query.
 * @returns A 32-byte hex string representing the raw storage value at the given slot.
 *
 * @throws If the provided address is invalid or if the RPC call fails or if the return value is not a valid 32-byte hex string.
 */
export async function getStorageAt(provider: MinimalProvider, address: string, index: bigint): Promise<string> {
  assertIsAddress(address);
  const indexParam = EthersT.toBeHex(index, 32);

  const data = await minimalProviderSend(provider, "eth_getStorageAt", [address, indexParam, "latest"]);

  assertIsBytes32String(data);

  return data;
}

/**
 * Reads a fixed number of consecutive addresses stored at a given storage location.
 *
 * @param provider - A `MinimalProvider` that supports either `send` or `request` for RPC interaction.
 * @param contractAddress - The Ethereum address of the contract to read storage from.
 * @param storageLocationBytes32 - The storage slot index as a 32-byte hex string.
 * @param numAddresses - The number of addresses to read.
 * @returns An array of addresses.
 *
 * @throws If the provided address is invalid or if the RPC call fails or if the storage slot does not contain the expected addresses.
 */
export async function getAddressesFromStorage(
  provider: MinimalProvider,
  contractAddress: string,
  storageLocationBytes32: string,
  numAddresses: number,
): Promise<string[]> {
  const addresses: string[] = [];
  for (let i = 0; i < numAddresses + 1; ++i) {
    const addr = await getStorageAt(provider, contractAddress, BigInt(storageLocationBytes32) + BigInt(i));
    addresses.push(addr);
  }

  const errorMsg = `The contract at address ${contractAddress} has not been initialized properly. Please call FHE.setFHEVM before.`;

  // should be numAddresses long!
  if (addresses[numAddresses] !== EthersT.ZeroHash) {
    throw new FhevmError(errorMsg);
  }

  for (let i = 0; i < numAddresses; ++i) {
    const addr = addresses[i];
    if (typeof addr !== "string" || !EthersT.isBytesLike(addr) || addr.length !== 66) {
      throw new FhevmError(errorMsg);
    }

    const hex = EthersT.toBeHex(BigInt(addr), 20);
    try {
      addresses[i] = EthersT.getAddress(hex);
    } catch {
      throw new FhevmError(errorMsg);
    }
  }

  return addresses;
}
