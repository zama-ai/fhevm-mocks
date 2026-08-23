import { createFhevmClient, hasFhevmRuntimeConfig, initFhevmRuntime, setFhevmRuntimeConfig } from "@fhevm/sdk/ethers";
import { createFhevmCleartextClient } from "@fhevm/sdk/ethers/cleartext";
import type { FhevmClient } from "./sdkTypes";
import debug from "debug";
import { ethers as EthersT } from "ethers";
import { vars } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { HardhatFhevmRuntimeEnvironment } from "../types";
import { FhevmDebugger } from "./FhevmDebugger";
import { localCleartext, mainnet, sepolia } from "./chains";
import { FhevmNetworkProvider, FhevmNetworkType } from "./networkProvider";
import type { CoprocessorConfig } from "./coprocessorConfig";
import { FhevmContractsRepository } from "./contractsRepository";
import type { FhevmContractName } from "./migration/placeholders";
import { FhevmEnvironmentPaths } from "./FhevmEnvironmentPaths";
import { FhevmExternalAPI } from "./FhevmExternalAPI";
import constants from "./constants";
import { deployFhevmCleartextHostContracts } from "./deploy/setup";
import { assertHHFhevm } from "./error";
import { getEnvString, getOptionalEnvString } from "./utils/env";
import { assertIsAddress } from "./utils/ethers";
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
  private _paths: FhevmEnvironmentPaths;
  private _deployRunning: boolean = false;
  private _deployCompleted: boolean = false;
  private _cliAPIInitializing: boolean = false;
  private _cliAPIInitialized: boolean = false;
  private _setupAddressesRunning: boolean = false;
  private _setupAddressesCompleted: boolean = false;
  private _addresses: FhevmEnvironmentAddresses | undefined;
  private _fhevmMockProvider: FhevmNetworkProvider | undefined;
  private _minimalInitPromise: Promise<void> | undefined;
  private _initializeCLIApiPromise: Promise<void> | undefined;
  private _contractsRepository: FhevmContractsRepository | undefined;
  private _instance: FhevmClient | undefined;
  private _fhevmAPI: FhevmExternalAPI;
  private _fhevmDebugger: FhevmDebugger;

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
    this._hre = hre;

    this._fhevmAPI = new FhevmExternalAPI(this);
    this._fhevmDebugger = new FhevmDebugger(this);
    this._paths = new FhevmEnvironmentPaths(hre.config.paths.root);

    checkHardhatRuntimeEnvironment(hre);
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
  public get relayerProvider(): EthersT.Provider {
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
  public get readonlyEip1193Provider(): EthersT.Eip1193Provider {
    return this.hre.network.provider;
  }

  // Should be replaced!
  public get mockProvider(): FhevmNetworkProvider {
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

  public getInstanceOrUndefined(): FhevmClient | undefined {
    return this._instance;
  }

  public get instance(): FhevmClient {
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

    // Public networks: the relayer url is part of `@fhevm/sdk`'s chain definition.
    for (const chain of [sepolia, mainnet]) {
      if (ACLAddress === chain.fhevm.contracts.acl.address) {
        return chain.fhevm.relayerUrl;
      }
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

  /** From the chain definition — `@fhevm/sdk` is the source of truth for gateway identity. */
  public getGatewayChainId(): number {
    return this.mockProvider.isEthereum
      ? (this.mockProvider.isEthereumMainnet ? mainnet : sepolia).fhevm.gateway.id
      : localCleartext.fhevm.gateway.id;
  }

  public get chainId(): number {
    if (!this._fhevmMockProvider) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._fhevmMockProvider.chainId;
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
  public getContractsRepository(): FhevmContractsRepository {
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
        this.mockProvider.info.type !== FhevmNetworkType.HardhatNode &&
        this.mockProvider.info.type !== FhevmNetworkType.SepoliaEthereumTestnet &&
        this.mockProvider.info.type !== FhevmNetworkType.EthereumMainnet
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
    type: FhevmNetworkType;
    chainId: number | undefined;
    url: string | undefined;
  } {
    const url: string | undefined = "url" in this.hre.network.config ? this.hre.network.config.url : undefined;

    if (this.hre.network.name === "hardhat") {
      assertHHFhevm(url === undefined);
      return {
        networkName: this.hre.network.name,
        type: FhevmNetworkType.Hardhat,
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
        type: FhevmNetworkType.HardhatNode,
        chainId: 31337,
        url,
      };
    }

    if (this.hre.network.name === "anvil") {
      return {
        networkName: this.hre.network.name,
        type: FhevmNetworkType.Anvil,
        chainId: this.hre.network.config.chainId,
        url,
      };
    }

    return {
      networkName: this.hre.network.name,
      type: FhevmNetworkType.Unknown,
      chainId: this.hre.network.config.chainId,
      url,
    };
  }

  //////////////////////////////////////////////////////////////////////////////
  // MinimalInit
  //////////////////////////////////////////////////////////////////////////////

  // Can be called multiple times
  public async minimalInitWithAddresses(): Promise<void> {
    return this.__minimalInit({ initializeAddresses: true });
  }

  // Can be called multiple times
  public async minimalInit(): Promise<void> {
    return this.__minimalInit();
  }

  // Can be called multiple times
  private async __minimalInit(options?: {
    initializeAddresses?: boolean;
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
  }): Promise<void> {
    if (this._fhevmMockProvider === undefined) {
      const defaults = this.__guessDefaultProvider();

      debugProvider(`Default provider network: ${defaults.networkName}, type: ${defaults.type}, url: ${defaults.url}`);
      debugProvider(`Default provider type   : ${defaults.type}, url: ${defaults.url}`);
      debugProvider(`Default provider url    : ${defaults.url}`);
      debugProvider("Resolving provider...");

      this._fhevmMockProvider = await FhevmNetworkProvider.resolve({
        readonlyEthersProvider: this.hre.ethers.provider,
        networkName: this.hre.network.name,
        configChainId: defaults.chainId,
        url: defaults.url,
      });

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
      await this.__initializeAddresses();
    }
  }

  //////////////////////////////////////////////////////////////////////////////

  private async _deployCore() {
    await this.minimalInitWithAddresses();

    // if (!this.mockProvider.isMock && !this.mockProvider.isSepoliaEthereum) {
    //   throw new HardhatFhevmError(
    //     "The current version of the fhevm hardhat plugin only supports the 'hardhat' network, 'localhost' hardhat node, anvil or sepolia.",
    //   );
    // }

    const fhevmAddresses = this.__getAddresses();

    if (!this.mockProvider.isEthereum) {
      /*
        Stand up the real cleartext host-contract stack.

        This replaces both halves of what used to happen here: the `setCode`-and-cheat-storage setup,
        and the embedded JS mock engine that followed it. There is no coprocessor to construct and no
        signer set to load — the contracts are really deployed, cleartexts live on-chain in
        `CleartextDB`, and `@fhevm/sdk` in cleartext mode derives the KMS/coprocessor keys itself.

        TODO(migration step 3): build the `FhevmClient` from the deployed addresses.
        TODO(migration step 5): rebuild `_contractsRepository` on `@fhevm/host-contracts-cleartext`'s
                                shipped ABIs — until then it stays undefined and its getters throw.
      */
      await deployFhevmCleartextHostContracts(this.hre.ethers.provider);
      this._contractsRepository = this.__createContractsRepository();
    } else {
      /*
        TODO(migration step 5): rebuild the contracts repository for public networks too. It used to
        come from `@fhevm/mock-utils`; the replacement reads `@fhevm/host-contracts-cleartext`'s
        shipped ABIs, and must re-source the KMS signer set from `ProtocolConfig` rather than
        `KMSVerifier` (v13 moved it).
      */
      this._contractsRepository = this.__createContractsRepository();
      debugAddresses(`ACL: ${fhevmAddresses.CoprocessorConfig.ACLAddress}`);
    }

    if (!this.isRunningInHHNode) {
      this._instance = await this.createInstance();
    }
  }

  /**
   * Initializes the process-wide `@fhevm/sdk` runtime config.
   *
   * `setFhevmRuntimeConfig` is a singleton that throws if called again with different parameters, and
   * both the cleartext and the real runtime refuse to build a client until it has been called. So it
   * happens exactly once, here, before any client exists — which is also why the API key has to be
   * read now: in `@fhevm/sdk` `auth` belongs to the runtime config, not to the individual client as it
   * did in `createInstance({ auth })`.
   */
  private __initFhevmRuntimeConfig(): void {
    if (hasFhevmRuntimeConfig()) {
      return;
    }

    const ZAMA_FHEVM_API_KEY: string | undefined = vars.has("ZAMA_FHEVM_API_KEY")
      ? vars.get("ZAMA_FHEVM_API_KEY")
      : undefined;

    // Note the discriminant is `type`, not the relayer-sdk's `__type`. `ApiKeyHeader` is the only
    // form Zama's hosted relayer accepts.
    setFhevmRuntimeConfig(
      ZAMA_FHEVM_API_KEY ? { auth: { type: "ApiKeyHeader", header: "x-api-key", value: ZAMA_FHEVM_API_KEY } } : {},
    );
  }

  /**
   * Builds the `@fhevm/sdk` client for the current network.
   *
   * Both factories take the same parameters and return the same `FhevmClient`, so nothing downstream
   * branches — only the factory and the chain differ:
   *
   *   local (31337)      `createFhevmCleartextClient` + the `localCleartext` chain. Reads cleartexts
   *                      straight off `CleartextDB`; no relayer, no WASM.
   *   sepolia / mainnet  `createFhevmClient` + the SDK's own chain definitions. Talks to the real
   *                      relayer, so the TFHE/TKMS WASM must be loaded first via `initFhevmRuntime()`.
   */
  /**
   * The host contracts, by ABI. Used only to decode reverts into named custom errors, so it needs
   * addresses and ABIs and nothing else.
   */
  private __createContractsRepository(): FhevmContractsRepository {
    const addresses = this.__getAddresses();
    const cleartext = constants.FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE;
    return new FhevmContractsRepository(this.readonlyEthersProvider, {
      aclAddress: addresses.CoprocessorConfig.ACLAddress,
      fhevmExecutorAddress: addresses.CoprocessorConfig.CoprocessorAddress,
      inputVerifierAddress: addresses.InputVerifierAddress,
      kmsVerifierAddress: addresses.CoprocessorConfig.KMSVerifierAddress,
      // Only the local stack exposes an HCULimit address; on public networks it is not used.
      hcuLimitAddress: cleartext.fhevmAddresses.hcuLimitAddress,
    });
  }

  public async createInstance(): Promise<FhevmClient> {
    assertHHFhevm(!this.isRunningInHHNode, "Cannot create an FhevmClient object in the 'hardhat node' server");

    this.__initFhevmRuntimeConfig();

    if (this.mockProvider.isMock) {
      debugInstance(`Creating @fhevm/sdk cleartext client (chain ${localCleartext.id})...`);
      const client = createFhevmCleartextClient({ provider: this.hre.ethers.provider, chain: localCleartext });
      // Resolving the on-chain context is a prerequisite for every action; without it the first call
      // fails with "Fhevm context has not been resolved".
      await client.ready;
      debugInstance("@fhevm/sdk cleartext client created.");
      return client;
    }

    if (this.mockProvider.isEthereum) {
      const chain = this.mockProvider.isEthereumMainnet ? mainnet : sepolia;

      debugInstance("Loading @fhevm/sdk runtime (WASM, might take some time)...");
      await initFhevmRuntime();

      debugInstance(`Creating @fhevm/sdk client (chain ${chain.id})...`);
      const client = createFhevmClient({ provider: this.hre.ethers.provider, chain });
      await client.ready;
      debugInstance("@fhevm/sdk client created.");
      return client;
    }

    throw new HardhatFhevmError(`Unsupported network.`);
  }

  /**
   * Generates:
   *  - `/path/to/user-package/fhevmTemp/@fhevm/solidity/config/ZamaConfig.sol`
   */
  private async __initializeAddresses(): Promise<FhevmEnvironmentAddresses> {
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
          addresses = this._initializeAddressesSepolia();
        }
      } else if (this.mockProvider.isEthereumMainnet) {
        addresses = this._initializeAddressesMainnet();
      } else {
        addresses = this._initializeAddressesMock();
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


    return {
      CoprocessorConfig: envCoprocessorConfig,
      InputVerifierAddress: InputVerifierAddress,
      relayerUrl,
      resolvedUsingEnv: true,
    };
  }

  /**
   * Sepolia addresses come from `@fhevm/sdk`'s own `sepolia` chain definition — the SDK is the source
   * of truth, so the plugin no longer keeps a copy that can (and did) go stale.
   *
   * `FhevmChain` does not model `FHEVMExecutor`, so the coprocessor address is taken from
   * `@fhevm/solidity`'s `ZamaConfig.sol`, which is the contract dApps compile against and which
   * `generateZamaConfigDotSol` already validates byte-for-byte against the installed package.
   */
  private _initializeAddressesSepolia(): FhevmEnvironmentAddresses {
    debugAddresses(`Resolving addresses using @fhevm/sdk's sepolia chain definition`);

    const sepoliaCoprocessorConfig: CoprocessorConfig = {
      ACLAddress: sepolia.fhevm.contracts.acl.address,
      CoprocessorAddress: constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig.CoprocessorAddress as `0x${string}`,
      KMSVerifierAddress: sepolia.fhevm.contracts.kmsVerifier.address,
    };

    const relayerUrl = sepolia.fhevm.relayerUrl;
    debugAddresses(`Using relayerUrl: ${relayerUrl}`);


    return {
      CoprocessorConfig: sepoliaCoprocessorConfig,
      InputVerifierAddress: sepolia.fhevm.contracts.inputVerifier.address,
      relayerUrl,
      resolvedUsingEnv: false,
    };
  }

  /** Mainnet, same sourcing rules as `_initializeAddressesSepolia`. */
  private _initializeAddressesMainnet(): FhevmEnvironmentAddresses {
    debugAddresses(`Resolving addresses using @fhevm/sdk's mainnet chain definition`);

    const mainnetCoprocessorConfig: CoprocessorConfig = {
      ACLAddress: mainnet.fhevm.contracts.acl.address,
      CoprocessorAddress: constants.FHEVM_SOLIDITY_PACKAGE.EthereumConfig.CoprocessorAddress as `0x${string}`,
      KMSVerifierAddress: mainnet.fhevm.contracts.kmsVerifier.address,
    };

    const relayerUrl = mainnet.fhevm.relayerUrl;
    debugAddresses(`Using relayerUrl: ${relayerUrl}`);


    return {
      CoprocessorConfig: mainnetCoprocessorConfig,
      InputVerifierAddress: mainnet.fhevm.contracts.inputVerifier.address,
      relayerUrl,
      resolvedUsingEnv: false,
    };
  }

  /**
   * The canonical localhost cleartext stack. Every address is a constant: the stack is deployed from a
   * fixed account at a fixed start nonce, so `CREATE(deployer, nonce)` fixes all of them, and
   * `@fhevm/solidity/config/ZamaConfig.sol` compiles the ACL/FHEVMExecutor/KMSVerifier triple straight
   * into consumer contracts.
   *
   * This replaces the old discovery dance — etching `ACL` at a dummy address to read
   * `getFHEVMExecutorAddress()`, caching the result to JSON, and re-entering through a child
   * `hardhat fhevm install-solidity` process when the network was not `hardhat`. None of that is
   * needed once the addresses are known up front.
   */
  private _initializeAddressesMock(): FhevmEnvironmentAddresses {
    const cleartext = constants.FHEVM_HOST_CONTRACTS_CLEARTEXT_PACKAGE;

    debugAddresses(`Resolving addresses using the canonical ${cleartext.name}@${cleartext.version} local stack`);

    const mockCoprocessorConfig: CoprocessorConfig = {
      ACLAddress: cleartext.fhevmAddresses.aclAddress as `0x${string}`,
      CoprocessorAddress: cleartext.fhevmAddresses.fhevmExecutorAddress as `0x${string}`,
      KMSVerifierAddress: cleartext.fhevmAddresses.kmsVerifierAddress as `0x${string}`,
    };


    debugAddresses(`No relayerUrl in Mock config`);


    // No relayerUrl in Mock config
    return {
      CoprocessorConfig: mockCoprocessorConfig,
      InputVerifierAddress: cleartext.fhevmAddresses.inputVerifierAddress as `0x${string}`,
      resolvedUsingEnv: true,
    };
  }

  public getSoliditySourcePaths(): string[] {
    return [];
  }
}
