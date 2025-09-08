import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../utils/address.js";
import { assertIsBytes32String } from "../utils/bytes.js";
import { FhevmError, assertFhevm } from "../utils/error.js";
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

export async function setStorageAt(
  provider: MinimalProvider,
  methodName: string,
  address: string,
  index: bigint,
  valueBytes32: string,
) {
  assertIsAddress(address);
  assertIsBytes32String(valueBytes32);

  if (methodName !== "hardhat_setStorageAt") {
    throw new FhevmError(`Only hardhat_setStorageAt is supported. Got ${methodName} instead.`);
  }

  const indexParam = EthersT.toBeHex(index, 32);

  await minimalProviderSend(provider, methodName, [address, indexParam, valueBytes32]);
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
  for (let i = 0; i < numAddresses; ++i) {
    const addr = await getStorageAt(provider, contractAddress, BigInt(storageLocationBytes32) + BigInt(i));
    addresses.push(addr);
  }

  const errorMsg = `The contract at address ${contractAddress} has not been initialized properly.`;

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

export async function getInitializableStorage(
  provider: MinimalProvider,
  contractAddress: string,
): Promise<{ initialized: bigint; initializing: boolean }> {
  const storageLocationBytes32 = computeStorageLocation("openzeppelin.storage.Initializable");
  assertFhevm(
    storageLocationBytes32 === "0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00",
    "Wrong 'openzeppelin.storage.Initializable' storage location",
  );

  // One single 32 bytes slot with data packed in reverse order
  // 0x0000000000000000000000000000000000000000000000_01_0000000000000005
  //                                                 bool      uint64
  let data = await getStorageAt(provider, contractAddress, BigInt(storageLocationBytes32) + BigInt(0));
  data = data.replace(/^0x/, "").padStart(64, "0");

  // _initialized (uint64): first 8 bytes
  const initializedHex = "0x" + data.slice(-16); // 8 bytes = 16 hex chars
  const initialized = BigInt(initializedHex);

  // _initializing (bool): next byte (9th byte)
  const initializingByte = parseInt(data.slice(-18, -16), 16);
  const initializing = initializingByte !== 0;

  return { initialized, initializing };
}

export async function setInitializableStorage(
  provider: MinimalProvider,
  contractAddress: string,
  value: { initialized: bigint; initializing: boolean },
) {
  //
  // @openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol
  // struct InitializableStorage {
  //     /**
  //      * @dev Indicates that the contract has been initialized.
  //      */
  //     uint64 _initialized;
  //     /**
  //      * @dev Indicates that the contract is in the process of being initialized.
  //      */
  //     bool _initializing;
  // }
  //
  // // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Initializable")) - 1)) & ~bytes32(uint256(0xff))
  // bytes32 private constant INITIALIZABLE_STORAGE = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;
  //
  const storageLocationBytes32 = computeStorageLocation("openzeppelin.storage.Initializable");
  assertFhevm(
    storageLocationBytes32 === "0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00",
    "Wrong 'openzeppelin.storage.Initializable' storage location",
  );

  // Encode uint64 _initialized
  const initializedBytes = EthersT.toBeHex(value.initialized, 8); // 8 bytes
  // Encode bool _initializing (1 byte)
  const initializingByte = value.initializing ? "0x01" : "0x00";

  const packedHex = initializingByte + initializedBytes.slice(2); // drop '0x' from bool byte
  const paddedSlotValue = EthersT.zeroPadValue(packedHex, 32); // full 32-byte slot

  await setStorageAt(
    provider,
    "hardhat_setStorageAt",
    contractAddress,
    BigInt(storageLocationBytes32) + BigInt(0),
    paddedSlotValue,
  );
}

export async function setOwnableStorage(provider: MinimalProvider, contractAddress: string, ownerAddress: string) {
  //
  // abstract contract OwnableUpgradeable is Initializable, ContextUpgradeable {
  //   /// @custom:storage-location erc7201:openzeppelin.storage.Ownable
  //   struct OwnableStorage {
  //       address _owner;
  //   }
  //   ...
  // }
  //
  // // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Ownable")) - 1)) & ~bytes32(uint256(0xff))
  // bytes32 private constant OwnableStorageLocation = 0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;
  //
  const storageLocationBytes32 = computeStorageLocation("openzeppelin.storage.Ownable");
  assertFhevm(
    storageLocationBytes32 === "0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300",
    "Wrong 'openzeppelin.storage.Ownable' storage location",
  );

  const paddedSlotValue = EthersT.zeroPadValue(ownerAddress, 32); // full 32-byte slot

  await setStorageAt(
    provider,
    "hardhat_setStorageAt",
    contractAddress,
    BigInt(storageLocationBytes32) + BigInt(0),
    paddedSlotValue,
  );
}
