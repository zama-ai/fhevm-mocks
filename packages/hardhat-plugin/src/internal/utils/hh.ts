import { getStorageAt as hardhatGetStorageAt } from "@nomicfoundation/hardhat-network-helpers";
import { ethers as EthersT } from "ethers";
import { HardhatError } from "hardhat/internal/core/errors";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import constants from "../../constants";
import { HardhatFhevmError } from "../../error";
import { FHEVMConfig, FhevmProvider } from "../../types";
import { assertHHFhevm } from "../error";

export function computeDummyAddress(): string {
  return EthersT.getAddress(
    EthersT.toBeHex(
      (BigInt(EthersT.keccak256(EthersT.toUtf8Bytes("fhevm-hardhat-plugin.dummy"))) - 1n) &
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

function computeStorageLocation(storageName: string): string {
  const enc = EthersT.AbiCoder.defaultAbiCoder().encode(
    ["uint256"],
    [BigInt(EthersT.keccak256(EthersT.toUtf8Bytes(storageName))) - 1n],
  );
  return EthersT.toBeHex(
    BigInt(EthersT.keccak256(enc)) & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00n,
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
  const fhevmConfigStorageLocation = computeStorageLocation("fhevm.storage.FHEVMConfig");
  assertHHFhevm(fhevmConfigStorageLocation === "0xed8d60e34876f751cc8b014c560745351147d9de11b9347c854e881b128ea600");

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
  const decryptionRequestsStorageLocation = computeStorageLocation("fhevm.storage.DecryptionRequests");
  assertHHFhevm(
    decryptionRequestsStorageLocation === "0x5ea69329017273582817d320489fbd94f775580e90c092699ca6f3d12fdf7d00",
  );

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

/**
 * @param hre
 * @returns The chainId of the network we are connected to. Returns undefined if there is no connection.
 *          Throws an error otherwise.
 */
export async function connectedChainId(hre: HardhatRuntimeEnvironment): Promise<number | undefined> {
  let chainId: number = 0;
  try {
    chainId = await hre.ethers.provider.send("eth_chainId");
    chainId = Number(BigInt(chainId));
  } catch (e) {
    if (e instanceof HardhatError) {
      // HH108: Cannot connect to the network <network name>.
      // Please make sure your node is running, and check your internet connection and networks config
      // at HttpProvider._fetchJsonRpcResponse (.../node_modules/hardhat/src/internal/core/providers/http.ts:240:15)
      if (e.number === 108) {
        return undefined;
      }
    }
    throw e;
  }
  assertHHFhevm(typeof chainId === "number");
  return chainId;
}

export async function resolveNetworkConfigChainId(
  hre: HardhatRuntimeEnvironment,
  useEthChainId: boolean,
): Promise<number> {
  if (hre.network.config.chainId === undefined) {
    const chainId: number | undefined = useEthChainId ? await connectedChainId(hre) : undefined;
    if (chainId === undefined) {
      // No network connection
      if (hre.network.name === "localhost") {
        return constants.DEVELOPMENT_NETWORK_CHAINID;
      }
      throw new HardhatFhevmError(`Unable to resolve network chainId. Network name: ${hre.network.name}`);
    }
    return chainId;
  }

  return hre.network.config.chainId;
}

export async function getWeb3ClientVersion(provider: FhevmProvider) {
  return await provider.send("web3_clientVersion");
}

export async function isHardhatNode(networkName: string, chainId: number | undefined, provider: FhevmProvider) {
  if (networkName !== "localhost") {
    return false;
  }

  try {
    const metadata = await provider.send("hardhat_metadata");
    if (!("chainId" in metadata) || metadata.chainId !== constants.DEVELOPMENT_NETWORK_CHAINID) {
      return false;
    }
    if (!("instanceId" in metadata) || metadata.instanceId.length !== 66) {
      return false;
    }
    return true;
  } catch (e) {
    if (e instanceof HardhatError) {
      if (e.number === 108) {
        // We consider that network `localhost`:
        // - with no `chainId` corresponds to the hardhat node dev server.
        // - with `chainId = 31337` also corresponds to the hardhat node dev server.
        return (
          networkName === "localhost" && (chainId === undefined || chainId === constants.DEVELOPMENT_NETWORK_CHAINID)
        );
      }
    }
    return false;
  }
}

export async function checkSupportedNetwork(hre: HardhatRuntimeEnvironment) {
  if (hre.network.name === "hardhat") {
    return;
  }

  if (await isHardhatNode(hre.network.name, hre.network.config.chainId, hre.ethers.provider)) {
    return true;
  }

  if (hre.network.name === "localhost") {
    throw new HardhatFhevmError(
      `Unsupported network: The fhevm hardhat plugin only supports the default 'localhost' hardhat node with chainId=${constants.DEVELOPMENT_NETWORK_CHAINID}. Got network 'localhost' with chainId=${hre.network.config.chainId} instead.`,
    );
  }

  throw new HardhatFhevmError(
    `Unsupported network: The fhevm hardhat plugin only supports the 'hardhat' network or the 'localhost' hardhat node with chainId=${constants.DEVELOPMENT_NETWORK_CHAINID}. Got network '${hre.network.name}' with chainId=${hre.network.config.chainId} instead.`,
  );
}

/*

 async hasSigner(address: number | string): Promise<boolean> {
        if (address == null) { address = 0; }

        const accounts = await this.send("eth_accounts", [ ]);
        if (typeof(address) === "number") {
            return (accounts.length > address);
        }

        address = address.toLowerCase();
        return accounts.filter((a: string) => (a.toLowerCase() === address)).length !== 0;
    }
async getSigner(address?: number | string): Promise<JsonRpcSigner> {
        if (address == null) { address = 0; }

        if (!(await this.hasSigner(address))) {
            try {
                //const resp = 
                await this.#request("eth_requestAccounts", [ ]);
                //console.log("RESP", resp);

            } catch (error: any) {
                const payload = error.payload;
                throw this.getRpcError(payload, { id: payload.id, error });
            }
        }

        return await super.getSigner(address);
    }
*/
/*
async function checkIfDevelopmentNetwork(
  provider: EIP1193Provider,
  networkName: string
): Promise<boolean> {
  let version: string | undefined;
  if (cachedIsDevelopmentNetwork === undefined) {
    try {
      version = (await provider.request({
        method: "web3_clientVersion",
      })) as string;

      cachedIsDevelopmentNetwork =
        version.toLowerCase().startsWith("hardhatnetwork") ||
        version.toLowerCase().startsWith("zksync") ||
        version.toLowerCase().startsWith("anvil");
    } catch (e) {
      cachedIsDevelopmentNetwork = false;
    }
  }

  if (!cachedIsDevelopmentNetwork) {
    throw new OnlyHardhatNetworkError(networkName, version);
  }

  return cachedIsDevelopmentNetwork;
}
*/
