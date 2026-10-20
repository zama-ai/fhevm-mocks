// The per-connection fhevm object — hardhat 3 scopes networks to CONNECTIONS, so fhevm state lives on
// each one (v2 had a per-process singleton). It implements the public surface in ../types.ts over the
// SDK client and the contracts repository of a development connection; on any other network the
// members that need them fail by name.
import { HardhatPluginError } from 'hardhat/plugins';
import type { Abi, Hex } from 'viem';
import {
  type FhevmClient,
  type FhevmClientHelpers,
  type CoprocessorConfig,
  type FhevmTransactionHCUInfo,
  type FhevmTypeName,
  type FhevmNetworkInfo,
  type FhevmCleartextDB,
  type HardhatFhevmRuntimeEnvironment,
} from '../types.js';
import type { FhevmContractsRepository } from './contracts.js';
import { PLUGIN_ID } from './constants.js';
import { assertCoprocessorInitialized, readCoprocessorConfig, resolveAddress } from './coprocessorConfig.js';
import { parseCoprocessorEvents } from './events.js';
import { FhevmCleartextDBImpl } from './FhevmCleartextDB.js';
import { type Eip1193Provider, FhevmClientHelpersImpl } from './FhevmClientHelpers.js';
import { createErrorInterface } from './errors/interface.js';
import { parseFhevmHandle } from './fhevmHandle.js';
import { computeTransactionHCU } from './hcu/hcu.js';
import { parseFhevmError } from './errors/parse.js';
import { type LogOutput, logBox } from './log.js';
import { isCleartextNetwork, isDevelopmentNetwork } from './network.js';
import type {
  CoprocessorEvent,
  FhevmAddressLike,
  FhevmContractError,
  FhevmContractName,
  FhevmErrorInterface,
  FhevmLog,
} from '../types-p.js';

////////////////////////////////////////////////////////////////////////////////
// class FhevmRuntimeEnvironmentImpl
////////////////////////////////////////////////////////////////////////////////

class FhevmRuntimeEnvironmentImpl implements HardhatFhevmRuntimeEnvironment {
  readonly network: FhevmNetworkInfo;
  readonly isCleartext: boolean;
  readonly isDevelopment: boolean;
  readonly #client: FhevmClient | undefined;
  readonly #clientHelpers: FhevmClientHelpers;
  readonly #cleartextDb: FhevmCleartextDB;
  readonly #repository: FhevmContractsRepository | undefined;

  constructor(
    network: FhevmNetworkInfo,
    client: FhevmClient | undefined,
    repository: FhevmContractsRepository | undefined,
    provider: Eip1193Provider,
  ) {
    this.network = network;
    this.isCleartext = isCleartextNetwork(network);
    this.isDevelopment = isDevelopmentNetwork(network);
    this.#repository = repository;
    this.#client = client;
    // `() => this.client` and not `client`: on a network without one, `fhevm.helpers` stays reachable
    // and only the call that needs a client throws, matching `createEncryptedInput`.
    this.#clientHelpers = new FhevmClientHelpersImpl(() => this.client, provider);
    // `() => this.#contracts` keeps the old lazy behaviour: reachable everywhere, throws only on use.
    // The RAW repository, not `#contracts`: `cleartextDb` reports a missing stack in its own words.
    this.#cleartextDb = new FhevmCleartextDBImpl(() => this.#repository, network);
  }

  get #contracts(): FhevmContractsRepository {
    if (this.#repository !== undefined) return this.#repository;
    const { networkName, chainId } = this.network;
    throw new HardhatPluginError(
      PLUGIN_ID,
      `The FHEVM contracts are not available on '${networkName}' (chainId ${String(chainId)}): only development networks are supported yet.`,
    );
  }

  get isMock(): boolean {
    return this.isCleartext;
  }

  /** The fixed-width encryption shorthands, kept off this object so the client API stays distinct. */
  get helpers(): FhevmClientHelpers {
    return this.#clientHelpers;
  }

  /** Reads straight out of `CleartextDB`, bypassing the ACL: test tooling, cleartext networks only. */
  get cleartextDb(): FhevmCleartextDB {
    return this.#cleartextDb;
  }

  get client(): FhevmClient {
    if (this.#client !== undefined) return this.#client;
    const { networkName, chainId } = this.network;
    throw new HardhatPluginError(
      PLUGIN_ID,
      `fhevm.client is not available on '${networkName}' (chainId ${String(chainId)}): only development networks are supported yet.`,
    );
  }

  typeof(handleBytes32: Hex): FhevmTypeName {
    return parseFhevmHandle(handleBytes32).typeName;
  }

  parseCoprocessorEvents(logs: readonly FhevmLog[] | null | undefined): CoprocessorEvent[] {
    return parseCoprocessorEvents(this.#contracts.fhevmExecutor, logs);
  }

  computeTransactionHCU(txHash: string): Promise<FhevmTransactionHCUInfo> {
    return computeTransactionHCU(this.#contracts.fhevmExecutor, this.#contracts.client, txHash);
  }

  assertCoprocessorInitialized(contract: FhevmAddressLike, contractName?: string): Promise<void> {
    return assertCoprocessorInitialized(this.#contracts, contract, contractName);
  }

  async getCoprocessorConfig(contract: FhevmAddressLike): Promise<CoprocessorConfig> {
    return readCoprocessorConfig(this.#contracts.client, await resolveAddress(contract));
  }

  revertedWithCustomErrorArgs(
    contractName: FhevmContractName,
    customErrorName: string,
  ): [{ abi: Abi; interface: FhevmErrorInterface }, string] {
    const wrapper = this.#contracts.getContractFromName(contractName);
    if (wrapper === undefined) {
      throw new HardhatPluginError(PLUGIN_ID, `Unknown FHEVM contract '${contractName}' on this network.`);
    }
    const errorInterface = createErrorInterface(wrapper);
    if (errorInterface.getError(customErrorName) === null) {
      throw new HardhatPluginError(
        PLUGIN_ID,
        `FHEVM contract '${contractName}' declares no custom error '${customErrorName}'.`,
      );
    }
    return [{ abi: wrapper.abi, interface: errorInterface }, customErrorName];
  }

  async tryParseFhevmError(e: unknown, options?: { out?: LogOutput }): Promise<FhevmContractError | undefined> {
    const error = await parseFhevmError(this.#contracts, e);
    if (error !== undefined && options?.out !== undefined)
      logBox(`${error.name} error`, error.longMessage, options.out);
    return error;
  }

  // createEncryptedInput(contractAddress: Address, userAddress: Address): FhevmEncryptedInput {
  //   return createEncryptedInput(() => this.client, contractAddress, userAddress);
  // }

  // publicDecrypt(handles: Array<Hex | Uint8Array>): Promise<PublicDecryptResults> {
  //   return publicDecrypt(this.client, handles);
  // }

  // async userDecryptEbool(
  //   handleBytes32: Hex,
  //   contractAddress: Address,
  //   user: FhevmUser,
  //   options?: FhevmUserDecryptOptions,
  // ): Promise<boolean> {
  //   const value = await userDecryptOne(this.client, 'userDecryptEbool', handleBytes32, contractAddress, user, options);
  //   return asBoolean(value, handleBytes32);
  // }

  // async userDecryptEuint(
  //   _fhevmType: FhevmTypeEuint,
  //   handleBytes32: Hex,
  //   contractAddress: Address,
  //   user: FhevmUser,
  //   options?: FhevmUserDecryptOptions,
  // ): Promise<bigint> {
  //   const value = await userDecryptOne(this.client, 'userDecryptEuint', handleBytes32, contractAddress, user, options);
  //   return asBigInt(value, handleBytes32);
  // }

  // async userDecryptEaddress(
  //   handleBytes32: Hex,
  //   contractAddress: Address,
  //   user: FhevmUser,
  //   options?: FhevmUserDecryptOptions,
  // ): Promise<Address> {
  //   const value = await userDecryptOne(
  //     this.client,
  //     'userDecryptEaddress',
  //     handleBytes32,
  //     contractAddress,
  //     user,
  //     options,
  //   );
  //   return asAddress(value, handleBytes32);
  // }
}

////////////////////////////////////////////////////////////////////////////////
// createFhevmConnection
////////////////////////////////////////////////////////////////////////////////

export function createFhevmConnection(
  network: FhevmNetworkInfo,
  client: FhevmClient | undefined,
  repository: FhevmContractsRepository | undefined,
  provider: Eip1193Provider,
): HardhatFhevmRuntimeEnvironment {
  return Object.freeze(new FhevmRuntimeEnvironmentImpl(network, client, repository, provider));
}
