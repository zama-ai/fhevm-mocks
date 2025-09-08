import type { MinimalProvider } from "../ethers/provider.js";
import { computeStorageLocation, getAddressesFromStorage } from "../ethers/storage.js";
import { assertFhevm } from "../utils/error.js";

/**
 * Maps the Solidity struct `CoprocessorConfig` struct defined in
 * [`@fhevm/solidity/lib/Impl.sol`](https://github.com/zama-ai/fhevm-solidity/blob/main/lib/Impl.sol)
 * This struct contains all addresses of the FHEVM Coprocessor contracts, which are required in by a FHEVM dApp.
 */
export type CoprocessorConfig = {
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
  CoprocessorAddress: string;
  /**
   * Address of the deployed
   * [`InputVerifier.sol`](https://github.com/zama-ai/fhevm-backend/blob/main/contracts/contracts/InputVerifier.sol)
   * contract from `@fhevm/core-contracts`.
   */
  DecryptionOracleAddress: string;
  /**
   * Address of the deployed
   * [`KMSVerifier.sol`](https://github.com/zama-ai/fhevm-backend/blob/main/contracts/contracts/KMSVerifier.sol)
   * contract from `@fhevm/core-contracts`.
   */
  KMSVerifierAddress: string;
};

/**
 * Retrieves the `CoprocessorConfig` struct from a smart contract that utilizes the FHEVM framework,
 * deployed at the given `contractAddress`.
 *
 * This function computes the storage slot corresponding to the `CoprocessorConfig` defined in
 * [`@fhevm/solidity/lib/Impl.sol`](https://github.com/zama-ai/fhevm-solidity/blob/main/lib/Impl.sol),
 * then reads the four consecutive addresses fields directly from storage.
 *
 * @param provider - A `MinimalProvider` that implements either `send` or `request` for JSON-RPC communication.
 * @param contractAddress - The on-chain address of the FHEVM contract to query.
 * @returns A Promise that resolves to the `CoprocessorConfig`.
 *
 * @throws If the computed storage slot does not match the expected constant layout, indicating a version or layout mismatch.
 */
export async function getCoprocessorConfig(
  provider: MinimalProvider,
  contractAddress: string,
): Promise<CoprocessorConfig> {
  const coprocessorConfigStorageLocation = computeStorageLocation("confidential.storage.config");
  assertFhevm(
    coprocessorConfigStorageLocation === "0x9e7b61f58c47dc699ac88507c4f5bb9f121c03808c5676a8078fe583e4649700",
  );

  /*
    See: @fhevm/solidity/config/ZamaConfig.sol and @fhevm/solidity/lib/Impl.sol
    
    struct CoprocessorConfig {
      address ACLAddress;
      address CoprocessorAddress;
      address DecryptionOracleAddress;
      address KMSVerifierAddress;
    }
  */
  const addresses: string[] = await getAddressesFromStorage(
    provider,
    contractAddress,
    coprocessorConfigStorageLocation,
    4 /* number of addresses in the struct */,
  );

  return {
    ACLAddress: addresses[0],
    CoprocessorAddress: addresses[1],
    DecryptionOracleAddress: addresses[2],
    KMSVerifierAddress: addresses[3],
  };
}
