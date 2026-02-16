import {
  CoprocessorConfig,
  FhevmContractName,
  FhevmDBMap,
  FhevmMockProvider,
  FhevmMockProviderType,
  MinimalProvider,
  MockCoprocessor,
  MockFhevmInstance,
  contracts,
} from "@fhevm/mock-utils";
import { assertIsAddress } from "@fhevm/mock-utils/utils";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/node";
import { createInstance as zamaFheRelayerSdkCreateInstance } from "@zama-fhe/relayer-sdk/node";
import debug from "debug";
import { ethers as EthersT } from "ethers";
import { vars } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import * as path from "path";

import { HardhatFhevmError } from "../error";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INSTALL_SOLIDITY } from "../task-names";
import { HardhatFhevmRuntimeEnvironment } from "../types";
import { FhevmDebugger } from "./FhevmDebugger";
import { FhevmEnvironmentPaths } from "./FhevmEnvironmentPaths";
import { FhevmExternalAPI } from "./FhevmExternalAPI";
import constants from "./constants";
import { loadPrecompiledFhevmHostContractsAddresses } from "./deploy/PrecompiledFhevmHostContracts";
import { generateZamaConfigDotSol } from "./deploy/ZamaConfigDotSol";
import { loadCoprocessorSigners, loadKMSSigners, loadRelayerSignerAddress } from "./deploy/addresses";
import { setupMockUsingHostContractsArtifacts } from "./deploy/setup";
import { assertHHFhevm } from "./error";
import { PrecompiledHostContractsAddresses } from "./types";
import { getEnvString, getOptionalEnvString } from "./utils/env";
import { checkHardhatRuntimeEnvironment } from "./utils/hh";

const debugProvider = debug("@fhevm/hardhat:provider");
const debugInstance = debug("@fhevm/hardhat:instance");
const debugAddresses = debug("@fhevm/hardhat:addresses");

export type FhevmEnvironmentAddresses = {
  /**
   * Indicates the addresses stored in the solidity `CoprocessorConfig` struct used in the project.
   */
  CoprocessorConfig: CoprocessorConfig;
  /**
   * Indicates the address of the solidity contract `InputVerifier.sol` used in the project.
   */
  InputVerifierAddress: `0x${string}`;
  /**
   * Indicates the address of the solidity contract `HCULimit.sol` used in the project.
   */
  HCULimitAddress: `0x${string}`;
  /**
   * Indicates the absolute path of the 'ZamaConfig.sol' solidity file used in the project.
   */
  CoprocessorConfigDotSolPath: string;
  /**
   * Indicates the relayer url used in the project.
   */
  relayerUrl?: string;
  /**
   * Indicates whether the addresses were resolved using env variables.
   */
  resolvedUsingEnv: boolean;
};

export type FhevmSigners = {
  coprocessor: EthersT.Signer[];
  kms: EthersT.Signer[];
  zero: EthersT.Signer;
  zeroAddress: string;
  one: EthersT.Signer;
  oneAddress: string;
};

export type FhevmProviderInfo = {
  web3ClientVersion: string;
  url?: string;
  networkName: string;
  isNetworkHardhatNode: boolean;
  isAnvil: boolean;
  methods: {
    setCode?: string;
    impersonateAccount?: string;
    setBalance?: string;
  };
};

export type FhevmContractRecordEntry = {
  contractName: FhevmContractName;
  address: string;
  contract: EthersT.Contract;
  package: string;
};

export class FhevmEnvironment {
  private _hre: HardhatRuntimeEnvironment;
  private _runningInHHNode: boolean | undefined;
  private _runningInHHTest: boolean | undefined;
  private _runningInHHFHEVMInstallSolidity: boolean | undefined;
  private _paths: FhevmEnvironmentPaths;
  private _deployRunning: boolean = false;
  private _deployCompleted: boolean = false;
  private _cliAPIInitializing: boolean = false;
  private _cliAPIInitialized: boolean = false;
  private _setupAddressesRunning: boolean = false;
  private _setupAddressesCompleted: boolean = false;
  private _addresses: FhevmEnvironmentAddresses | undefined;
  private _fhevmMockProvider: FhevmMockProvider | undefined;
  private _minimalInitPromise: Promise<void> | undefined;
  private _initializeCLIApiPromise: Promise<void> | undefined;
  private _contractsRepository: contracts.FhevmContractsRepository | undefined;
  private _instance: FhevmInstance | undefined;
  private _fhevmAPI: FhevmExternalAPI;
  private _fhevmDebugger: FhevmDebugger;
  private _mockCoprocessor: MockCoprocessor | undefined;
  private _relayerSignerAddress: string | undefined;

  private _id: number = -1;
  private static _idCount: number = -1;

  /**
   * Constructor must be ultra-lightweight!
   */
  constructor(hre: HardhatRuntimeEnvironment) {
    //
    // Important node:
    // ===============
    // - calling `import { fhevm } from "hardhat"` does NOT call the `FhevmEnvironment` constructor
    // - since we are overriding the "hardhat test" command, the `FhevmEnvironment` is created
    //   in our builtin-task.ts/task(TASK_TEST, ...) command.
    //
    FhevmEnvironment._idCount++;
    this._id = FhevmEnvironment._idCount;

    this._hre = hre;

    this._fhevmAPI = new FhevmExternalAPI(this);
    this._fhevmDebugger = new FhevmDebugger(this);
    this._paths = new FhevmEnvironmentPaths(hre.config.paths.root);

    checkHardhatRuntimeEnvironment(hre);
  }

  /**
   * This command is only supported using the 'hardhat' network.
   */
  public setRunningInHHFHEVMInstallSolidity() {
    assertHHFhevm(
      this._hre.network.name === "hardhat",
      `Expecting network 'hardhat'. Got '${this._hre.network.name}' instead.`,
    );
    if (this._runningInHHFHEVMInstallSolidity !== undefined) {
      throw new HardhatFhevmError(
        `The fhevm hardhat plugin is already running inside a 'hardhat ${SCOPE_FHEVM} ${SCOPE_FHEVM_TASK_INSTALL_SOLIDITY}' command.`,
      );
    }
    this._runningInHHFHEVMInstallSolidity = true;
  }

  public unsetRunningInHHFHEVMInstallSolidity() {
    assertHHFhevm(
      this._hre.network.name === "hardhat",
      `Expecting network 'hardhat'. Got '${this._hre.network.name}' instead.`,
    );
    if (this._runningInHHFHEVMInstallSolidity !== true) {
      throw new HardhatFhevmError(
        `The fhevm hardhat plugin is not running inside a 'hardhat ${SCOPE_FHEVM} ${SCOPE_FHEVM_TASK_INSTALL_SOLIDITY}' command.`,
      );
    }
    this._runningInHHFHEVMInstallSolidity = undefined;
  }

  public setRunningInHHTest() {
    if (this._runningInHHTest !== undefined) {
      throw new HardhatFhevmError(`The fhevm hardhat plugin is already running inside a hardhat test command.`);
    }
    if (this._runningInHHNode !== undefined) {
      throw new HardhatFhevmError(`The fhevm hardhat plugin is already running inside a hardhat node command.`);
    }
    this._runningInHHTest = true;
  }

  /**
   * `npx hardhat node` only supports the 'hardhat' network
   * Running `npx hardhat node --network <anything-other-than-hardhat>` will raise the following error
   * Error HH605: Unsupported network for JSON-RPC server. Only hardhat is currently supported.
   * Note that `npx hardhat node --network localhost` also fails.
   */
  public setRunningInHHNode() {
    assertHHFhevm(
      this._hre.network.name === "hardhat",
      `Expecting network 'hardhat'. Got '${this._hre.network.name}' instead.`,
    );
    if (this._runningInHHTest !== undefined) {
      throw new HardhatFhevmError(`The fhevm hardhat plugin is already running inside a hardhat test command.`);
    }
    if (this._runningInHHNode !== undefined) {
      throw new HardhatFhevmError(`The fhevm hardhat plugin is already running inside a hardhat node command.`);
    }
    this._runningInHHNode = true;
  }

  public get isRunningInHHTest(): boolean {
    return this._runningInHHTest === true;
  }

  public get isRunningInHHNode(): boolean {
    return this._runningInHHNode === true;
  }

  public get isRunningInHHFHEVMInstallSolidity(): boolean {
    return this._runningInHHFHEVMInstallSolidity === true;
  }

  /*
    We need a mock engine if there is no mock engine on the server.
    For example:
    - No: `npx hardhat test --network localhost` does not create a new mock engine since it is available
      on the `npx hardhat node` server.
    - Yes: `npx hardhat test` must create a mock engine
    - Yes: `npx hardhat test --localhost anvil` must create a mock engine since there is no mock engine 
      on the anvil server.
  */
  public get useEmbeddedMockEngine(): boolean {
    return this.mockProvider.info.type !== FhevmMockProviderType.HardhatNode;
  }

  public get hre(): HardhatRuntimeEnvironment {
    if (!this._hre) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._hre;
  }

  /*
    Warning: MUST BE instance of `HardhatEthersProvider`
    Same as `readonlyEthersProvider` but in `MinimalProvider` format
  */
  public get relayerProvider(): MinimalProvider {
    return this.hre.ethers.provider;
  }

  /*
    Warning: MUST NOT BE window.ethereum!!!!!
    Same as `readonlyEthersProvider` but in `MinimalProvider` format
    To call view function on contracts
  */
  public get readonlyEthersProvider(): EthersT.Provider {
    return this.hre.ethers.provider;
  }

  /*
    Warning: MUST NOT BE window.ethereum!!!!!
    Same as `readonlyEthersProvider` but in `MinimalProvider` format
  */
  public get readonlyEip1193Provider(): MinimalProvider {
    return this.hre.network.provider;
  }

  // Should be replaced!
  public get mockProvider(): FhevmMockProvider {
    if (!this._fhevmMockProvider) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._fhevmMockProvider;
  }

  public get paths(): FhevmEnvironmentPaths {
    return this._paths;
  }

  public get debugger(): FhevmDebugger {
    if (!this._fhevmDebugger) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._fhevmDebugger;
  }

  /**
   * Only called by the FhevmProviderExtender
   */
  public get coprocessor(): MockCoprocessor {
    if (!this._mockCoprocessor) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._mockCoprocessor;
  }

  public getInstanceOrUndefined(): FhevmInstance | undefined {
    return this._instance;
  }

  public get instance(): FhevmInstance {
    if (!this._instance) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._instance;
  }

  public getRelayerUrl(): string {
    const relayerUrl = this.__getAddresses()?.relayerUrl;
    if (!relayerUrl) {
      throw new HardhatFhevmError(`The relayerUrl is not initialized.`);
    }
    return relayerUrl;
  }

  public resolveRelayerUrl(ACLAddress: string): string {
    if (this.mockProvider.isMock) {
      throw new HardhatFhevmError(`relayerUrl is not defined in mock mode.`);
    }

    if (ACLAddress === constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.ACLAddress) {
      return constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.relayerUrl;
    }

    const dotEnvFile = this._paths.dotEnvFile;
    if (ACLAddress === getEnvString({ name: "ACL_CONTRACT_ADDRESS", dotEnvFile })) {
      return getEnvString({ name: "RELAYER_URL", dotEnvFile });
    }

    throw new HardhatFhevmError(`There is no relayerUrl defined for ACL address '${ACLAddress}'.`);
  }

  private __getAddresses(): FhevmEnvironmentAddresses {
    if (!this._addresses) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._addresses;
  }

  public getACLAddress(): `0x${string}` {
    if (!this._addresses) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._addresses.CoprocessorConfig.ACLAddress;
  }

  public getFHEVMExecutorAddress(): `0x${string}` {
    if (!this._addresses) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._addresses.CoprocessorConfig.CoprocessorAddress;
  }

  public getInputVerifierAddress(): `0x${string}` {
    if (!this._addresses) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._addresses.InputVerifierAddress;
  }

  public getKMSVerifierAddress(): `0x${string}` {
    if (!this._addresses) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._addresses.CoprocessorConfig.KMSVerifierAddress;
  }

  public getCoprocessorSigners(): EthersT.Signer[] | undefined {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository.inputVerifier.getCoprocessorSigners();
  }

  public getCoprocessorSignersOrThrow(): EthersT.Signer[] {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    const cs = this._contractsRepository.inputVerifier.getCoprocessorSigners();
    if (!cs) {
      throw new HardhatFhevmError(`Undefined coprocessor signers wallets.`);
    }
    return cs;
  }

  public getKMSSigners(): EthersT.Signer[] | undefined {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository.kmsVerifier.getKmsSigners();
  }

  public getKMSSignersOrThrow(): EthersT.Signer[] {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    const cs = this._contractsRepository.kmsVerifier.getKmsSigners();
    if (!cs) {
      throw new HardhatFhevmError(`Undefined KMSVerifier signers wallets.`);
    }
    return cs;
  }

  /**
   * Fhevm Gateway InputVerification.sol contract
   * Address of the contract deployed on the gateway chain
   * (identified by the chainId returned from getGatewayChainId())
   * responsible for performing EIP-712 signature verification
   * for input values
   * @returns InputVerification contract address
   */
  public getGatewayInputVerificationAddress(): `0x${string}` {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository.inputVerifier.gatewayInputVerificationAddress;
  }

  /**
   * Fhevm Gateway Decryption.sol contract
   * Address of the contract deployed on the gateway chain
   * (identified by the chainId returned from getGatewayChainId())
   * responsible for performing EIP-712 signature verification
   * for decryption operations
   * @returns Decryption contract address
   */
  public getGatewayDecryptionAddress(): `0x${string}` {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository.kmsVerifier.gatewayDecryptionAddress;
  }

  public getACLReadOnly(): EthersT.Contract {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository.acl.readonlyContract;
  }

  public getFHEVMExecutorReadOnly(): EthersT.Contract {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository.fhevmExecutor.readonlyContract;
  }

  public getInputVerifierReadOnly(): EthersT.Contract {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository.inputVerifier.readonlyContract;
  }

  public getKMSVerifierReadOnly(): EthersT.Contract {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository.kmsVerifier.readonlyContract;
  }

  public getGatewayChainId(): number {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return Number(this._contractsRepository.kmsVerifier.gatewayChainId);
  }

  public get chainId(): number {
    if (!this._fhevmMockProvider) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._fhevmMockProvider.chainId;
  }

  // Only called by the FhevmProviderExtender
  public getRelayerSignerAddress(): string {
    if (!this._relayerSignerAddress) {
      throw new HardhatFhevmError(
        `Relayer signer address is not defined. Ensure that the Fhevm environment has been properly initialized by calling runSetup() (${this._id}/${FhevmEnvironment._idCount})`,
      );
    }
    return this._relayerSignerAddress;
  }

  /**
   *  Client API
   */
  get externalFhevmAPI(): HardhatFhevmRuntimeEnvironment {
    if (this.isRunningInHHNode) {
      // Cannot be called from the server process
      throw new HardhatFhevmError(
        `the HardhatFhevmRuntimeEnvironment 'fhevm' is not accessible from the 'hardhat node' server`,
      );
    }
    return this._fhevmAPI;
  }

  // Accessible after _deloyCore
  public getContractsRepository(): contracts.FhevmContractsRepository {
    if (!this._contractsRepository) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._contractsRepository;
  }

  public get isDeployed(): boolean {
    return this._deployCompleted;
  }

  public async initializeCLIApi(): Promise<void> {
    if (this._initializeCLIApiPromise !== undefined) {
      return this._initializeCLIApiPromise;
    }

    // Create one in-flight promise and allow retries on failure
    this._initializeCLIApiPromise = (async () => {
      try {
        await this.__initializeCLIApi();
      } finally {
        // Clear whether success or failure, so callers can retry if it failed.
        this._initializeCLIApiPromise = undefined;
      }
    })();

    return this._initializeCLIApiPromise;
  }

  private async __initializeCLIApi() {
    // Allow multiple calls
    if (this._cliAPIInitialized) {
      return;
    }
    // Defensive: this should already be guaranteed by _initializeCLIApiPromise
    if (this._cliAPIInitializing) {
      throw new HardhatFhevmError(`The Fhevm CLI initialization is already in progress.`);
    }

    this._cliAPIInitializing = true;

    try {
      if (this.isDeployed) {
        return;
      }

      if (this.hre.network.name === "hardhat") {
        throw new HardhatFhevmError(
          `The Fhevm CLI only supports the Hardhat Node (--network localhost) or Sepolia (--network sepolia) networks.`,
        );
      }

      await this.minimalInit();

      if (
        this.mockProvider.info.type !== FhevmMockProviderType.HardhatNode &&
        this.mockProvider.info.type !== FhevmMockProviderType.SepoliaEthereumTestnet &&
        this.mockProvider.info.type !== FhevmMockProviderType.EthereumMainnet
      ) {
        throw new HardhatFhevmError(
          `The Fhevm CLI only supports the Hardhat Node (--network localhost), Sepolia (--network sepolia) or Mainnet (--network mainnet) networks.`,
        );
      }

      // TODO: should improve deploy() (see function commentary)
      await this.deploy();

      this._cliAPIInitialized = true;
    } finally {
      this._cliAPIInitializing = false;
    }
  }

  /**
   * TODO: Should be improved:
   * - if `Sepolia`: no need to deploy! just create instance and pick up addresses
   *   Ex: `npx hardhat fhevm user-decrypt --network sepolia ...`
   * - if `Hardhat Node`: it's already deployed (because of `npx hardhat node` CLI auto deploy)
   * - if `Anvil`: may no be deployed (maybe add `npx hardhat fhevm anvil`)
   */
  public async deploy() {
    if (this._deployCompleted) {
      throw new HardhatFhevmError("The Fhevm environment is already initialized.");
    }
    if (this._deployRunning) {
      throw new HardhatFhevmError(`The Fhevm environment initialization is already in progress.`);
    }

    this._deployRunning = true;

    try {
      await this._deployCore();

      this._deployCompleted = true;
    } finally {
      this._deployRunning = false;
    }
  }

  private __guessDefaultProvider(): {
    networkName: string;
    type: FhevmMockProviderType;
    chainId: number | undefined;
    url: string | undefined;
  } {
    const url: string | undefined = "url" in this.hre.network.config ? this.hre.network.config.url : undefined;

    if (this.hre.network.name === "hardhat") {
      assertHHFhevm(url === undefined);
      return {
        networkName: this.hre.network.name,
        type: FhevmMockProviderType.Hardhat,
        chainId: this.hre.network.config.chainId,
        url,
      };
    }

    if (!url) {
      throw new HardhatFhevmError(`Missing network url`);
    }

    // Check if url is well formed
    const urlObj = new URL(url);

    // Note: specifying the chainId in the HardhatUserConfig for network "localhost"
    // has no effect when running the 'npx hardhat node' command
    // the chainId is automatically set to 31337
    if (this.hre.network.name === "localhost") {
      assertHHFhevm(urlObj.port === "8545");
      return {
        networkName: "localhost",
        type: FhevmMockProviderType.HardhatNode,
        chainId: 31337,
        url,
      };
    }

    if (this.hre.network.name === "anvil") {
      return {
        networkName: this.hre.network.name,
        type: FhevmMockProviderType.Anvil,
        chainId: this.hre.network.config.chainId,
        url,
      };
    }

    return {
      networkName: this.hre.network.name,
      type: FhevmMockProviderType.Unknown,
      chainId: this.hre.network.config.chainId,
      url,
    };
  }

  //////////////////////////////////////////////////////////////////////////////
  // MinimalInit
  //////////////////////////////////////////////////////////////////////////////

  // Can be called multiple times
  public async minimalInitWithAddresses(ignoreCache: boolean): Promise<void> {
    return this.__minimalInit({ initializeAddresses: true, ignoreAddressesCache: ignoreCache });
  }

  // Can be called multiple times
  public async minimalInit(): Promise<void> {
    return this.__minimalInit();
  }

  // Can be called multiple times
  private async __minimalInit(options?: {
    initializeAddresses?: boolean;
    ignoreAddressesCache?: boolean;
  }): Promise<void> {
    if (this._minimalInitPromise !== undefined) {
      return this._minimalInitPromise;
    }

    // Create one in-flight promise and allow retries on failure
    this._minimalInitPromise = (async () => {
      try {
        await this.__minimalInitCore(options);
      } finally {
        // Clear whether success or failure, so callers can retry if it failed.
        this._minimalInitPromise = undefined;
      }
    })();

    return this._minimalInitPromise;
  }

  private async __minimalInitCore(options?: {
    initializeAddresses?: boolean;
    ignoreAddressesCache?: boolean;
  }): Promise<void> {
    if (this._fhevmMockProvider === undefined) {
      const defaults = this.__guessDefaultProvider();

      debugProvider(`Default provider network: ${defaults.networkName}, type: ${defaults.type}, url: ${defaults.url}`);
      debugProvider(`Default provider type   : ${defaults.type}, url: ${defaults.url}`);
      debugProvider(`Default provider url    : ${defaults.url}`);
      debugProvider("Resolving provider...");

      this._fhevmMockProvider = await FhevmMockProvider.fromReadonlyProvider(
        this.hre.ethers.provider,
        this.hre.network.name,
        defaults.type,
        defaults.chainId,
        defaults.url,
      );

      debugProvider(
        `Provider name: ${this._fhevmMockProvider.info.networkName} chainId: ${this._fhevmMockProvider.info.chainId} type: ${this._fhevmMockProvider.info.type}`,
      );
    }

    if (!this.mockProvider.isMock && !this.mockProvider.isEthereum) {
      throw new HardhatFhevmError(
        "The current version of the fhevm hardhat plugin only supports the 'hardhat' network, 'localhost' hardhat node, anvil, sepolia or mainnet.",
      );
    }

    if (options?.initializeAddresses === true) {
      // Can be called multiple times
      await this.__initializeAddresses(options?.ignoreAddressesCache ?? false);
    }
  }

  //////////////////////////////////////////////////////////////////////////////

  private async _createSigners(): Promise<FhevmSigners> {
    const params = { hre: this.hre, provider: this.mockProvider.readonlyEthersProvider };
    const kmsSigners = await loadKMSSigners(params);
    const coprocessorSigners = await loadCoprocessorSigners(params);

    const oneAddress = "0x0000000000000000000000000000000000000001";
    // Should be very very high in case of solidity coverage
    // Solidity coverage performs code instrumentations thus considerably increasing
    // the gas cost. Therefore any test account must have a huge balance at startup.
    const balance = EthersT.parseEther("10000");
    let zero = await this.mockProvider.impersonateAddressAndSetBalance(EthersT.ZeroAddress, balance);
    // If the mockProvider could not resolve the signer, do it now using HardhatEthersHelpers
    if (zero === undefined) {
      zero = await this.hre.ethers.getSigner(EthersT.ZeroAddress);
    }
    let one = await this.mockProvider.impersonateAddressAndSetBalance(oneAddress, balance);
    // If the mockProvider could not resolve the signer, do it now using HardhatEthersHelpers
    if (one === undefined) {
      one = await this.hre.ethers.getSigner(oneAddress);
    }
    return {
      coprocessor: coprocessorSigners,
      kms: kmsSigners,
      oneAddress,
      zeroAddress: EthersT.ZeroAddress,
      zero,
      one,
    };
  }

  private async _deployCore() {
    await this.minimalInitWithAddresses(false /* ignoreCache */);

    // if (!this.mockProvider.isMock && !this.mockProvider.isSepoliaEthereum) {
    //   throw new HardhatFhevmError(
    //     "The current version of the fhevm hardhat plugin only supports the 'hardhat' network, 'localhost' hardhat node, anvil or sepolia.",
    //   );
    // }
    // const fhevmAddresses = await this.initializeAddresses(false /* ignoreCache */);

    const fhevmAddresses = this.__getAddresses();

    if (!this.mockProvider.isEthereum) {
      const fhevmSigners = await this._createSigners();

      await this.mockProvider.setTemporaryMinimumBlockGasLimit(0x1fffffffffffffn);
      try {
        // 'setup' should contain the FhevmContractsRepository instance as well
        const setup = await setupMockUsingHostContractsArtifacts(
          this.mockProvider,
          fhevmAddresses,
          fhevmSigners,
          this.paths,
        );
        this._contractsRepository = setup.contracts;

        // Debug
        assertHHFhevm(setup.gatewayChainId === this.getGatewayChainId());
        assertHHFhevm(setup.gatewayDecryptionAddress === this.getGatewayDecryptionAddress());
        assertHHFhevm(setup.gatewayInputVerificationAddress === this.getGatewayInputVerificationAddress());
      } finally {
        await this.mockProvider.unsetTemporaryMinimumBlockGasLimit();
      }

      /*
        CREATED if env is not running inside a hardhat node
      */
      if (this.useEmbeddedMockEngine) {
        const readonlyEthersProvider = this.mockProvider.readonlyEthersProvider;
        if (!readonlyEthersProvider) {
          throw new HardhatFhevmError(
            `Missing ethers.Provider. The FhevmMockProvider instance does not have a valid ethers.Provider.`,
          );
        }

        const blockNumber = await this.mockProvider.getBlockNumber();

        const db = new FhevmDBMap();
        await db.init(blockNumber);

        this._relayerSignerAddress = await loadRelayerSignerAddress(this.hre);

        this._mockCoprocessor = await MockCoprocessor.create(readonlyEthersProvider, {
          coprocessorContractAddress: this.getFHEVMExecutorAddress(),
          coprocessorSigners: this.getCoprocessorSignersOrThrow(),
          inputVerifierContractAddress: this.getInputVerifierAddress(),
          db,
        });
      }
    } else {
      const repo = await contracts.FhevmContractsRepository.create(this.readonlyEthersProvider, {
        aclContractAddress: fhevmAddresses.CoprocessorConfig.ACLAddress,
        kmsContractAddress: fhevmAddresses.CoprocessorConfig.KMSVerifierAddress,
      });
      this._contractsRepository = repo;

      debugAddresses(`Gateway ChainId: ${this.getGatewayChainId()}`);
    }

    if (!this.isRunningInHHNode) {
      this._instance = await this.createInstance();
    }
  }

  public async createInstance(): Promise<FhevmInstance> {
    assertHHFhevm(!this.isRunningInHHNode, "Cannot create a MockFhevmInstance object in the 'hardhat node' server");
    if (this.mockProvider.isMock) {
      return MockFhevmInstance.create(
        this.hre.ethers.provider,
        this.hre.ethers.provider,
        {
          verifyingContractAddressDecryption: this.getGatewayDecryptionAddress(),
          verifyingContractAddressInputVerification: this.getGatewayInputVerificationAddress(),
          kmsContractAddress: this.getKMSVerifierAddress(),
          inputVerifierContractAddress: this.getInputVerifierAddress(),
          aclContractAddress: this.getACLAddress(),
          chainId: this.chainId,
          gatewayChainId: this.getGatewayChainId(),
        },
        {
          inputVerifierProperties: this._contractsRepository?.inputVerifier.inputVerifierProperties!,
          kmsVerifierProperties: this._contractsRepository?.kmsVerifier.kmsVerifierProperties!,
        },
      );
    } else if (this.mockProvider.isEthereum) {
      debugInstance("Creating @zama-fhe/relayer-sdk instance (might take some time)...");

      const ZAMA_FHEVM_API_KEY: string | undefined = vars.has("ZAMA_FHEVM_API_KEY")
        ? vars.get("ZAMA_FHEVM_API_KEY")
        : undefined;

      const instance = await zamaFheRelayerSdkCreateInstance({
        ...this.getContractsRepository().getFhevmInstanceConfig({
          chainId: this.mockProvider.chainId,
          relayerUrl: this.getRelayerUrl(),
        }),
        network: this.hre.network.provider,
        ...(ZAMA_FHEVM_API_KEY
          ? {
              auth: {
                __type: "ApiKeyHeader",
                header: "x-api-key",
                value: ZAMA_FHEVM_API_KEY,
              },
            }
          : {}),
      });

      debugInstance("@zama-fhe/relayer-sdk instance created.");
      return instance;
    } else {
      throw new HardhatFhevmError(`Unsupported network.`);
    }
  }

  /**
   * Generates:
   *  - `/path/to/user-package/fhevmTemp/@fhevm/solidity/config/ZamaConfig.sol`
   */
  private async __initializeAddresses(ignoreCache: boolean): Promise<FhevmEnvironmentAddresses> {
    if (this._addresses !== undefined) {
      return this._addresses;
    }

    // Prevent multiple calls.
    if (this._setupAddressesCompleted) {
      throw new HardhatFhevmError("The Fhevm environment addresses are already initialized.");
    }
    if (this._setupAddressesRunning) {
      throw new HardhatFhevmError("The Fhevm environment addresses are already being initialized.");
    }

    this._setupAddressesRunning = true;

    {
      let addresses: FhevmEnvironmentAddresses;
      if (this.mockProvider.isSepoliaEthereumTestnet) {
        const envNetworkName = getOptionalEnvString({
          name: "FHEVM_HARDHAT_NETWORK",
          dotEnvFile: this.paths.dotEnvFile,
        });
        // Could be removed in the future.
        // This is a security check to prevent invalid contract configuration
        if (this.mockProvider.info.networkName === "devnet" && envNetworkName !== "devnet") {
          throw new HardhatFhevmError(
            `Network 'devnet' requires an .env file. File '${this._paths.dotEnvFile}' does not exist or is invalid.`,
          );
        }
        if (envNetworkName === this.mockProvider.info.networkName) {
          addresses = this._initializeAddressesEnv();
        } else {
          addresses = await this._initializeAddressesSepolia();
        }
      } else if (this.mockProvider.isEthereumMainnet) {
        addresses = await this._initializeAddressesMainnet();
      } else {
        addresses = await this._initializeAddressesMock(ignoreCache);
      }
      Object.freeze(addresses);
      Object.freeze(addresses.CoprocessorConfig);

      this._addresses = addresses;
    }

    this._setupAddressesCompleted = true;
    this._setupAddressesRunning = false;

    return this._addresses;
  }

  private _initializeAddressesEnv(): FhevmEnvironmentAddresses {
    const dotEnvFile = this._paths.dotEnvFile;

    debugAddresses(`Resolving addresses using ${dotEnvFile}`);

    const ACLAddress = getEnvString({ name: "ACL_CONTRACT_ADDRESS", dotEnvFile });
    const CoprocessorAddress = getEnvString({ name: "FHEVM_EXECUTOR_CONTRACT_ADDRESS", dotEnvFile });
    const KMSVerifierAddress = getEnvString({ name: "KMS_VERIFIER_CONTRACT_ADDRESS", dotEnvFile });
    const InputVerifierAddress = getEnvString({ name: "INPUT_VERIFIER_CONTRACT_ADDRESS", dotEnvFile });
    const HCULimitAddress = getEnvString({ name: "HCU_LIMIT_CONTRACT_ADDRESS", dotEnvFile });
    const relayerUrl = getEnvString({ name: "RELAYER_URL", dotEnvFile });

    assertIsAddress(ACLAddress, "Environment variable ACL_CONTRACT_ADDRESS");
    assertIsAddress(CoprocessorAddress, "Environment variable FHEVM_EXECUTOR_CONTRACT_ADDRESS");
    assertIsAddress(KMSVerifierAddress, "Environment variable KMS_VERIFIER_CONTRACT_ADDRESS");
    assertIsAddress(InputVerifierAddress, "Environment variable INPUT_VERIFIER_CONTRACT_ADDRESS");
    assertIsAddress(HCULimitAddress, "Environment variable HCU_LIMIT_CONTRACT_ADDRESS");

    debugAddresses(`Using relayerUrl: ${relayerUrl}`);

    const envCoprocessorConfig: CoprocessorConfig = {
      ACLAddress,
      CoprocessorAddress,
      KMSVerifierAddress,
    };

    const coprocessorConfigDotSolPath = generateZamaConfigDotSol({
      paths: this.paths,
      localAddresses: envCoprocessorConfig,
      sepoliaAddresses: envCoprocessorConfig,
      mainnetAddresses: envCoprocessorConfig,
    });
    assertHHFhevm(path.isAbsolute(coprocessorConfigDotSolPath));

    return {
      CoprocessorConfig: envCoprocessorConfig,
      InputVerifierAddress: InputVerifierAddress,
      HCULimitAddress: HCULimitAddress,
      CoprocessorConfigDotSolPath: coprocessorConfigDotSolPath,
      relayerUrl,
      resolvedUsingEnv: true,
    };
  }

  private async _initializeAddressesSepolia(): Promise<FhevmEnvironmentAddresses> {
    debugAddresses(`Resolving addresses using Sepolia Testnet config`);

    const sepoliaCoprocessorConfig: CoprocessorConfig = {
      ACLAddress: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.ACLAddress as `0x${string}`,
      CoprocessorAddress: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.CoprocessorAddress as `0x${string}`,
      KMSVerifierAddress: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.KMSVerifierAddress as `0x${string}`,
    };

    const InputVerifierAddress = constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.InputVerifierAddress as `0x${string}`;
    const HCULimitAddress = constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.HCULimitAddress as `0x${string}`;

    const relayerUrl = constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.relayerUrl;

    debugAddresses(`Using relayerUrl: ${relayerUrl}`);

    const coprocessorConfigDotSolPath = generateZamaConfigDotSol({
      paths: this.paths,
      // localAddresses: sepoliaCoprocessorConfig,
      // sepoliaAddresses: sepoliaCoprocessorConfig,
      // mainnetAddresses: mainnetCoprocessorConfig,
    });
    assertHHFhevm(path.isAbsolute(coprocessorConfigDotSolPath));

    return {
      CoprocessorConfig: sepoliaCoprocessorConfig,
      CoprocessorConfigDotSolPath: coprocessorConfigDotSolPath,
      InputVerifierAddress,
      HCULimitAddress,
      relayerUrl,
      resolvedUsingEnv: false,
    };
  }

  private async _initializeAddressesMainnet(): Promise<FhevmEnvironmentAddresses> {
    debugAddresses(`Resolving addresses using Mainnet config`);

    const mainnetCoprocessorConfig: CoprocessorConfig = {
      ACLAddress: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.mainnet.ACLAddress as `0x${string}`,
      CoprocessorAddress: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.mainnet.CoprocessorAddress as `0x${string}`,
      KMSVerifierAddress: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.mainnet.KMSVerifierAddress as `0x${string}`,
    };

    const InputVerifierAddress = constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.mainnet.InputVerifierAddress as `0x${string}`;
    const HCULimitAddress = constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.mainnet.HCULimitAddress as `0x${string}`;

    const relayerUrl = constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.mainnet.relayerUrl;

    debugAddresses(`Using relayerUrl: ${relayerUrl}`);

    const coprocessorConfigDotSolPath = generateZamaConfigDotSol({
      paths: this.paths,
      // localAddresses: mainnetCoprocessorConfig,
      // sepoliaAddresses: sepoliaCoprocessorConfig,
      // mainnetAddresses: mainnetCoprocessorConfig,
    });
    assertHHFhevm(path.isAbsolute(coprocessorConfigDotSolPath));

    return {
      CoprocessorConfig: mainnetCoprocessorConfig,
      CoprocessorConfigDotSolPath: coprocessorConfigDotSolPath,
      InputVerifierAddress,
      HCULimitAddress,
      relayerUrl,
      resolvedUsingEnv: false,
    };
  }

  private async _initializeAddressesMock(ignoreCache: boolean): Promise<FhevmEnvironmentAddresses> {
    debugAddresses(`Resolving addresses using Mock config`);

    // Extract hardcoded addresses from the "@fhevm/host-contracts" package.
    const hardcodedAddresses: PrecompiledHostContractsAddresses = await loadPrecompiledFhevmHostContractsAddresses(
      this.mockProvider,
      this.paths,
      ignoreCache,
      this.isRunningInHHFHEVMInstallSolidity,
    );

    // Build the CoprocessorConfig struct using the hardcoded addresses and
    // use Sepolia addresses for all the missing addresses.
    const mockCoprocessorConfig: CoprocessorConfig = {
      ACLAddress: hardcodedAddresses.ACLAddress,
      CoprocessorAddress: hardcodedAddresses.CoprocessorAddress,
      // Use Sepolia addresses for all other missing addresses.
      KMSVerifierAddress: constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia.KMSVerifierAddress as `0x${string}`,
    };

    const coprocessorConfigDotSolPath = generateZamaConfigDotSol({
      paths: this.paths,
      localAddresses: mockCoprocessorConfig,
    });

    debugAddresses(`No relayerUrl in Mock config`);

    assertHHFhevm(path.isAbsolute(coprocessorConfigDotSolPath));

    // No relayerUrl in Mock config
    return {
      CoprocessorConfig: mockCoprocessorConfig,
      InputVerifierAddress: hardcodedAddresses.InputVerifierAddress,
      HCULimitAddress: hardcodedAddresses.HCULimitAddress,
      CoprocessorConfigDotSolPath: coprocessorConfigDotSolPath,
      resolvedUsingEnv: true,
    };
  }

  public getRemappings(): Record<string, string> {
    if (!this.mockProvider.isMock && !this.mockProvider.isEthereum) {
      throw new HardhatFhevmError(`This network configuration is not yet supported by the FHEVM hardhat plugin`);
    }

    return {
      "@fhevm/solidity/config": this.paths.relCacheFhevmSolidityConfigDirUnix,
    };
  }

  public getSoliditySourcePaths(): string[] {
    return [];
  }
}
