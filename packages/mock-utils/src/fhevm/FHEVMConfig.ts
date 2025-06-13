import type { MinimalProvider } from "../ethers/provider.js";
import { computeStorageLocation, getAddressesFromStorage } from "../ethers/storage.js";
import { assertFhevm } from "../utils/error.js";

/**
 * Maps the Solidity struct `FHEVMConfigStruct` defined in
 * [`@fhevm/solidity/lib/Impl.sol`](https://github.com/zama-ai/fhevm-solidity/blob/main/lib/Impl.sol)
 * This struct contains all addresses of the FHEVM Coprocessor contracts, which are required in by a FHEVM dApp.
 */
export type FHEVMConfig = {
  /**
   * Address of the deployed
   * [`ACL.sol`](https://github.com/zama-ai/fhevm-backend/blob/main/contracts/contracts/ACL.sol)
   * contract from `@fhevm/core-contracts`.
   */
  ACLAddress: string;
  /**
   * Address of the deployed
   * [`FHEVMExecutor.sol`](https://github.com/zama-ai/fhevm-backend/blob/main/contracts/contracts/FHEVMExecutor.sol)
   * contract from `@fhevm/core-contracts`.
   */
  FHEVMExecutorAddress: string;
  /**
   * Address of the deployed
   * [`KMSVerifier.sol`](https://github.com/zama-ai/fhevm-backend/blob/main/contracts/contracts/KMSVerifier.sol)
   * contract from `@fhevm/core-contracts`.
   */
  KMSVerifierAddress: string;
  /**
   * Address of the deployed
   * [`InputVerifier.sol`](https://github.com/zama-ai/fhevm-backend/blob/main/contracts/contracts/InputVerifier.sol)
   * contract from `@fhevm/core-contracts`.
   */
  InputVerifierAddress: string;
};

/**
 * Retrieves the `FHEVMConfigStruct` from a smart contract that utilizes the FHEVM framework,
 * deployed at the given `contractAddress`.
 *
 * This function computes the storage slot corresponding to the `FHEVMConfigStruct` defined in
 * [`@fhevm/solidity/lib/Impl.sol`](https://github.com/zama-ai/fhevm-solidity/blob/main/lib/Impl.sol),
 * then reads the four consecutive addresses fields directly from storage.
 *
 * @param provider - A `MinimalProvider` that implements either `send` or `request` for JSON-RPC communication.
 * @param contractAddress - The on-chain address of the FHEVM contract to query.
 * @returns A Promise that resolves to the `FHEVMConfigStruct`.
 *
 * @throws If the computed storage slot does not match the expected constant layout, indicating a version or layout mismatch.
 */
export async function getFHEVMConfig(provider: MinimalProvider, contractAddress: string): Promise<FHEVMConfig> {
  const fhevmConfigStorageLocation = computeStorageLocation("fhevm.storage.FHEVMConfig");
  assertFhevm(fhevmConfigStorageLocation === "0xed8d60e34876f751cc8b014c560745351147d9de11b9347c854e881b128ea600");

  /*
    See: @fhevm/solidity/config/ZamaConfig.sol and @fhevm/solidity/lib/Impl.sol
    
    struct FHEVMConfigStruct {
        address ACLAddress;
        address FHEVMExecutorAddress;
        address KMSVerifierAddress;
        address InputVerifierAddress;
    }
  */
  const addresses: string[] = await getAddressesFromStorage(
    provider,
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
