import { getStorageAt as hardhatGetStorageAt } from "@nomicfoundation/hardhat-network-helpers";
import assert from "assert";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../../error";
import { FHEVMConfig } from "../../types";

export function isSolidityCoverageRunning(hre: HardhatRuntimeEnvironment): boolean {
  //console.log("process.env.SOLIDITY_COVERAGE = " + process.env.SOLIDITY_COVERAGE);
  return "__SOLIDITY_COVERAGE_RUNNING" in hre ? hre.__SOLIDITY_COVERAGE_RUNNING === true : false;
}

export function computeDummyAddress(hre: HardhatRuntimeEnvironment): string {
  return hre.ethers.getAddress(
    hre.ethers.toBeHex(
      (BigInt(hre.ethers.keccak256(hre.ethers.toUtf8Bytes("fhevm-hardhat-plugin.dummy"))) - 1n) &
        0xffffffffffffffffffffffffffffffffffffffffn,
      20,
    ),
  );
}

/*
//cast keccak "fhevm.storage.FHEVMConfig"
    /// keccak256(abi.encode(uint256(keccak256("fhevm.storage.FHEVMConfig")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant FHEVMConfigLocation = 0xed8d60e34876f751cc8b014c560745351147d9de11b9347c854e881b128ea600;

    /// keccak256(abi.encode(uint256(keccak256("fhevm.storage.DecryptionRequests")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DecryptionRequestsStorageLocation =
        0x5ea69329017273582817d320489fbd94f775580e90c092699ca6f3d12fdf7d00;
*/

function computeStorageLocation(hre: HardhatRuntimeEnvironment, storageName: string): string {
  const enc = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256"],
    [BigInt(hre.ethers.keccak256(hre.ethers.toUtf8Bytes(storageName))) - 1n],
  );
  return hre.ethers.toBeHex(
    BigInt(hre.ethers.keccak256(enc)) & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00n,
    32,
  );
}

async function getAddressesFromStorage(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
  storageLocation: string,
  numAddresses: number,
) {
  const addresses: string[] = [];
  for (let i = 0; i < numAddresses + 1; ++i) {
    const addr = await hardhatGetStorageAt(contractAddress, BigInt(storageLocation) + BigInt(i));
    addresses.push(addr);
  }

  const errorMsg = `The contract at address ${contractAddress} has not been initialized properly. Please call FHE.setFHEVM before.`;

  // should be numAddresses long!
  if (addresses[numAddresses] !== hre.ethers.ZeroHash) {
    throw new HardhatFhevmError(errorMsg);
  }

  for (let i = 0; i < numAddresses; ++i) {
    const addr = addresses[i];
    if (typeof addr !== "string" || !hre.ethers.isBytesLike(addr) || addr.length !== 66) {
      throw new HardhatFhevmError(errorMsg);
    }

    const hex = hre.ethers.toBeHex(BigInt(addr), 20);
    try {
      addresses[i] = hre.ethers.getAddress(hex);
    } catch {
      throw new HardhatFhevmError(errorMsg);
    }
  }

  return addresses;
}

export async function getFHEVMConfig(hre: HardhatRuntimeEnvironment, contractAddress: string): Promise<FHEVMConfig> {
  const fhevmConfigStorageLocation = computeStorageLocation(hre, "fhevm.storage.FHEVMConfig");
  assert(fhevmConfigStorageLocation === "0xed8d60e34876f751cc8b014c560745351147d9de11b9347c854e881b128ea600");

  /*
    See: @fhevm/solidity/config/FHEVMConfig.sol and @fhevm/solidity/lib/Impl.sol
    
    struct FHEVMConfigStruct {
        address ACLAddress;
        address FHEVMExecutorAddress;
        address KMSVerifierAddress;
        address InputVerifierAddress;
    }
  */
  const addresses: string[] = await getAddressesFromStorage(
    hre,
    contractAddress,
    fhevmConfigStorageLocation,
    4 /* number of addresses in the struct */,
  );

  return {
    ACLAddress: addresses[0],
    FHEVMExecutorAddress: addresses[1],
    KMSVerifierAddress: addresses[2],
    InputVerifierAddress: addresses[3],
  };
}

export async function getDecryptionOracleAddress(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
): Promise<string> {
  const decryptionRequestsStorageLocation = computeStorageLocation(hre, "fhevm.storage.DecryptionRequests");
  assert(decryptionRequestsStorageLocation === "0x5ea69329017273582817d320489fbd94f775580e90c092699ca6f3d12fdf7d00");

  /*
    See: @fhevm/solidity/lib/Impl.sol

    struct DecryptionRequestsStruct {
        address DecryptionOracleAddress;
        uint256 counterRequest;
        mapping(uint256 => bytes32[]) requestedHandles;
    }
  */
  const addresses: string[] = await getAddressesFromStorage(
    hre,
    contractAddress,
    decryptionRequestsStorageLocation,
    1 /* number of addresses in the struct */,
  );

  return addresses[0];
}

export async function setCodeAt(hre: HardhatRuntimeEnvironment, address: string, byteCode: string) {
  assert(hre.network.name === "hardhat");
  assert(typeof byteCode === "string");
  await hre.network.provider.send("hardhat_setCode", [address, byteCode]);
}

export async function getCodeAt(hre: HardhatRuntimeEnvironment, address: string): Promise<string> {
  assert(hre.network.name === "hardhat");
  const res = await hre.network.provider.send("eth_getCode", [address]);
  assert(typeof res === "string");
  return res;
}
