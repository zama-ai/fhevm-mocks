import { ethers as EthersT } from "ethers";

import constants from "../constants.js";
import { getProviderChainId } from "../ethers/provider.js";
import { defaultWalletsAsMap, walletsFromPrivateKeys } from "../ethers/wallet.js";
import type { FhevmInstanceConfig } from "../relayer-sdk/types.js";
import { FhevmError, assertFhevm } from "../utils/error.js";
import { FhevmContractsRepository } from "./contracts/FhevmContractsRepository.js";
import { requestRelayerMetadata } from "./relayer/MockRelayer.js";

export class MockFhevmInstanceConfig implements FhevmInstanceConfig {
  #contractsRepository: FhevmContractsRepository | undefined;
  #gatewayChainId: number | undefined;
  #chainId: number | undefined;
  #verifyingContractAddressDecryption: string | undefined;
  #verifyingContractAddressInputVerification: string | undefined;
  #relayerUrl: string | undefined;
  #networkUrl: string | undefined;
  #relayerProvider: EthersT.JsonRpcProvider | undefined;
  #readonlyRunner: EthersT.JsonRpcProvider | undefined;
  // Belongs to a "engine" config. Should be removed
  #kmsSigners: EthersT.Signer[] | undefined;
  #coprocessorSigners: EthersT.Signer[] | undefined;
  //#relayerSignerPrivateKey

  private constructor() {}

  public static async formConfig(
    config: FhevmInstanceConfig,
    options?: {
      noMetamaskChainSwap?: boolean;
      // Belongs to a "engine" config. Should be removed
      kmsSignersPrivateKeys?: string[];
      coprocessorSignersPrivateKeys?: string[];
      relayerSignerPrivateKey?: string;
    },
  ): Promise<MockFhevmInstanceConfig> {
    const mockConfig = new MockFhevmInstanceConfig();

    _checkConfigStringProperty(config, "network", "url");
    _checkConfigStringProperty(config, "relayerUrl", "url");

    mockConfig.#networkUrl = config.network;
    mockConfig.#relayerUrl = config.relayerUrl;

    mockConfig.#readonlyRunner = new EthersT.JsonRpcProvider(mockConfig.#networkUrl);
    mockConfig.#relayerProvider = new EthersT.JsonRpcProvider(mockConfig.#relayerUrl);

    _checkConfigAddressProperty(config, "aclContractAddress");
    _checkConfigAddressProperty(config, "kmsContractAddress");
    _checkConfigAddressProperty(config, "verifyingContractAddressDecryption");
    _checkConfigAddressProperty(config, "verifyingContractAddressInputVerification");
    _checkConfigAddressProperty(config, "inputVerifierContractAddress");

    const relayerMetadata = await requestRelayerMetadata(mockConfig.#relayerProvider);
    if (relayerMetadata.ACLAddress !== config.aclContractAddress) {
      throw new FhevmError(
        `ACL address mismatch: the network '${config.network}' is using ACL address ${relayerMetadata.ACLAddress}, but 'FhevmInstanceConfig.aclContractAddress' is set to ${config.aclContractAddress}. Please update the config to match the specified network.`,
      );
    }
    if (relayerMetadata.InputVerifierAddress !== config.inputVerifierContractAddress) {
      throw new FhevmError(
        `InputVerifier address mismatch: the network '${config.network}' is using InputVerifier address ${relayerMetadata.InputVerifierAddress}, but 'FhevmInstanceConfig.inputVerifierContractAddress' is set to ${config.inputVerifierContractAddress}. Please update the config to match the specified network.`,
      );
    }
    if (relayerMetadata.KMSVerifierAddress !== config.kmsContractAddress) {
      throw new FhevmError(
        `KMSVerifier address mismatch: the network '${config.network}' is using KMSVerifier address ${relayerMetadata.KMSVerifierAddress}, but 'FhevmInstanceConfig.kmsContractAddress' is set to ${config.kmsContractAddress}. Please update the config to match the specified network.`,
      );
    }

    // Verify!
    const networkChainId = await getProviderChainId(mockConfig.#readonlyRunner);
    if (networkChainId !== undefined && networkChainId !== null) {
      config.chainId = networkChainId;
    }

    _checkConfigNumberProperty(config, "chainId");

    if (networkChainId !== config.chainId) {
      throw new FhevmError(
        `Chain ID mismatch: the network '${config.network}' is using chain ID ${networkChainId}, but 'FhevmInstanceConfig.chainId' is set to ${config.chainId}. Please update the config to match the specified network.`,
      );
    }

    _checkConfigNumberProperty(config, "gatewayChainId");

    if (options?.noMetamaskChainSwap === true) {
      // In mock mode, to avoid Metamask chain swap, gatewayChainId and chainId must be the same
      mockConfig.#gatewayChainId = networkChainId;
    }

    mockConfig.#contractsRepository = await FhevmContractsRepository.create(mockConfig.#readonlyRunner, config);
    mockConfig.#verifyingContractAddressDecryption = config.verifyingContractAddressDecryption;
    mockConfig.#verifyingContractAddressInputVerification = config.verifyingContractAddressInputVerification;

    if (
      mockConfig.#contractsRepository.inputVerifier.address.toLowerCase() !==
      config.inputVerifierContractAddress.toLocaleLowerCase()
    ) {
      throw new FhevmError(
        `InputVerifier address mismatch: the ACL contract at '${config.aclContractAddress}' on network '${config.network}' (chainId: ${config.chainId}) is using InputVerifier at '${mockConfig.#contractsRepository.inputVerifier.address}', but 'FhevmInstanceConfig.inputVerifierContractAddress' is set to '${config.inputVerifierContractAddress}'. Please update the configuration to match.`,
      );
    }

    // Resolve kms signers wallets
    mockConfig.#kmsSigners = _loadSignersCategory({
      categoryName: "KMS",
      default: constants.DEFAULT_KMS_SIGNERS_ACCOUNTS,
      ...(options?.kmsSignersPrivateKeys !== undefined && { privateKeys: options?.kmsSignersPrivateKeys }),
      signersAddresses: mockConfig.#contractsRepository.kmsVerifier.getKmsSignersAddresses(),
      threshold: mockConfig.#contractsRepository.kmsVerifier.getThreshold(),
    });

    // Resolve coprocessor signers wallets
    mockConfig.#coprocessorSigners = _loadSignersCategory({
      categoryName: "Coprocessor",
      default: constants.DEFAULT_COPROCESSOR_SIGNERS_ACCOUNTS,
      ...(options?.coprocessorSignersPrivateKeys !== undefined && {
        privateKeys: options?.coprocessorSignersPrivateKeys,
      }),
      signersAddresses: mockConfig.#contractsRepository.inputVerifier.getCoprocessorSigners(),
      threshold: mockConfig.#contractsRepository.inputVerifier.getThreshold(),
    });

    return mockConfig;
  }

  public get readonlyRunner(): EthersT.JsonRpcProvider {
    assertFhevm(this.#readonlyRunner !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#readonlyRunner;
  }

  public get relayerProvider(): EthersT.JsonRpcProvider {
    assertFhevm(this.#relayerProvider !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#relayerProvider;
  }

  public get contractsRepository(): FhevmContractsRepository {
    assertFhevm(this.#contractsRepository !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#contractsRepository;
  }

  public get network(): string {
    assertFhevm(this.#networkUrl !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#networkUrl;
  }

  public get relayerUrl(): string {
    assertFhevm(this.#relayerUrl !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#relayerUrl;
  }

  public get chainId(): number {
    assertFhevm(this.#chainId !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#chainId;
  }

  public get aclContractAddress(): string {
    assertFhevm(this.#contractsRepository !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#contractsRepository.acl.address;
  }

  public get kmsContractAddress(): string {
    assertFhevm(this.#contractsRepository !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#contractsRepository.kmsVerifier.address;
  }

  public get inputVerifierContractAddress(): string {
    assertFhevm(this.#contractsRepository !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#contractsRepository.inputVerifier.address;
  }

  public get gatewayChainId(): number {
    assertFhevm(this.#gatewayChainId !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#gatewayChainId;
  }

  public get verifyingContractAddressDecryption(): string {
    assertFhevm(this.#verifyingContractAddressDecryption !== undefined, "MockFhevmInstanceConfig is not initialized");
    return this.#verifyingContractAddressDecryption;
  }

  public get verifyingContractAddressInputVerification(): string {
    assertFhevm(
      this.#verifyingContractAddressInputVerification !== undefined,
      "MockFhevmInstanceConfig is not initialized",
    );
    return this.#verifyingContractAddressInputVerification;
  }

  public get kmsSigners(): EthersT.Signer[] | undefined {
    return this.#kmsSigners;
  }

  public get coprocessorSigners(): EthersT.Signer[] | undefined {
    return this.#coprocessorSigners;
  }
}

function _checkConfigAddressProperty<K extends string>(
  config: unknown,
  propertyName: K,
): asserts config is { [P in K]: string } {
  _checkConfigStringProperty(config, propertyName, "address");

  if (!EthersT.isAddress(config[propertyName])) {
    throw new FhevmError(
      `Invalid '${propertyName}' entry in FhevmInstanceConfig. Expecting valid a address, got '${config[propertyName]}' instead.`,
    );
  }
}

function _checkConfigStringProperty<K extends string>(
  config: unknown,
  propertyName: K,
  typeName?: string,
): asserts config is { [P in K]: string } {
  if (typeof config !== "object" || config === null) {
    throw new FhevmError(`Invalid in FhevmInstanceConfig object.`);
  }

  const p = (config as any)[propertyName];

  if (!typeName) {
    typeName = "string";
  }

  if (p === undefined || p === null) {
    throw new FhevmError(`Missing '${propertyName}' entry in FhevmInstanceConfig. Expecting a valid ${typeName}.`);
  }

  if (typeof p !== "string") {
    throw new FhevmError(
      `Invalid '${propertyName}' entry in FhevmInstanceConfig. Expecting a valid ${typeName}, got '${p}' instead.`,
    );
  }
}

function _checkConfigNumberProperty<K extends string>(
  config: unknown,
  propertyName: K,
  typeName?: string,
): asserts config is { [P in K]: number } {
  if (typeof config !== "object" || config === null) {
    throw new FhevmError(`Invalid in FhevmInstanceConfig object.`);
  }

  const p = (config as any)[propertyName];

  if (!typeName) {
    typeName = "number";
  }

  if (p === undefined || p === null) {
    throw new FhevmError(`Missing '${propertyName}' entry in FhevmInstanceConfig. Expecting a valid ${typeName}.`);
  }

  if (typeof p !== "number") {
    throw new FhevmError(
      `Invalid '${propertyName}' entry in FhevmInstanceConfig. Expecting a valid ${typeName}, got '${p}' instead.`,
    );
  }
}

function _loadSignersCategory(signersCategory: {
  categoryName: string;
  threshold: number;
  signersAddresses: string[];
  privateKeys?: string[];
  default: { mnemonic?: string; initialIndex: number; path: string };
}): EthersT.Signer[] {
  let resolvedSigners: EthersT.Signer[] = [];
  if (signersCategory.privateKeys) {
    const { wallets, ignoredPrivateKeys } = walletsFromPrivateKeys(
      signersCategory.privateKeys,
      signersCategory.signersAddresses,
    );
    if (ignoredPrivateKeys.length > 0) {
      throw new FhevmError(
        `The following private keys do not match any of the expected ${signersCategory.categoryName} signers addresses. Ignored private keys: ${ignoredPrivateKeys.join(", ")}.`,
      );
    }
    resolvedSigners = wallets;
  } else {
    // Try with default signers
    const wallets = defaultWalletsAsMap(
      signersCategory.default.initialIndex,
      signersCategory.threshold,
      signersCategory.default.path,
      signersCategory.default.mnemonic,
    );
    for (let i = 0; i < signersCategory.signersAddresses.length; ++i) {
      const w = wallets.get(signersCategory.signersAddresses[i]);
      if (w) {
        resolvedSigners.push(w);
      }
    }
  }

  if (!resolvedSigners || resolvedSigners.length === 0) {
    throw new FhevmError(
      `Missing ${signersCategory.categoryName} signers. Please specify the KMS signers private keys.`,
    );
  }
  if (resolvedSigners.length < signersCategory.threshold) {
    throw new FhevmError(
      `Not enought ${signersCategory.categoryName} signers. A minimum of ${signersCategory.threshold} ${signersCategory.categoryName} signers are expected. ${signersCategory.threshold - signersCategory.signersAddresses.length} private keys are missing.`,
    );
  }

  return resolvedSigners;
}
