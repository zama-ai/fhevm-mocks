import {
  DecryptionOracle,
  FHEVMConfig,
  FhevmContractName,
  FhevmDBMap,
  FhevmMockProvider,
  FhevmMockProviderType,
  MinimalProvider,
  MockCoprocessor,
  MockDecryptionOracle,
  MockFhevmInstance,
} from "@fhevm/mock-utils";
import { ethers as EthersT } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import * as path from "path";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INSTALL_SOLIDITY } from "../task-names";
import { HardhatFhevmRuntimeEnvironment } from "../types";
import { FhevmDebugger } from "./FhevmDebugger";
import { FhevmEnvironmentPaths } from "./FhevmEnvironmentPaths";
import { FhevmExternalAPI } from "./FhevmExternalAPI";
import { generateFHEVMConfigDotSol } from "./deploy/FHEVMConfig";
import { loadPrecompiledFhevmCoreContractsAddresses } from "./deploy/PrecompiledFhevmCoreContracts";
import { parseSepoliaZamaOracleAddress } from "./deploy/PrecompiledZamaFheOracleSolidity";
import { generateZamaOracleAddressDotSol } from "./deploy/ZamaOracleAddress";
import {
  getKMSVerifierAddress,
  getRelayerSigner,
  getRelayerSignerAddress,
  loadCoprocessorSigners,
  loadKMSSigners,
} from "./deploy/addresses";
import { setupMockUsingCoreContractsArtifacts } from "./deploy/setup";
import { assertHHFhevm } from "./error";
import { PrecompiledCoreContractsAddresses } from "./types";
import { checkHardhatRuntimeEnvironment } from "./utils/hh";

export type FhevmEnvironmentConfig = {
  ACLAddress: string;
  ACLReadOnly: EthersT.Contract;
  FHEVMExecutorAddress: string;
  FHEVMExecutorReadOnly: EthersT.Contract;
  InputVerifierAddress: string;
  InputVerifierReadOnly: EthersT.Contract;
  KMSVerifierAddress: string;
  KMSVerifierReadOnly: EthersT.Contract;
  DecryptionOracleAddress: string;
  DecryptionOracleReadOnly: EthersT.Contract;
  gatewayChainId: number;
  gatewayInputVerificationAddress: string;
  gatewayDecryptionAddress: string;
};

export type FhevmEnvironmentAddresses = {
  /**
   * Indicates the addresses stored in the solidity `FHEVMConfigStruct` used in the project.
   */
  FHEVMConfig: FHEVMConfig;
  /**
   * Indicates the address of the solidity contract `FHEGasLimit.sol` used in the project.
   */
  FHEGasLimitAddress: string;
  /**
   * Indicates the absolute path of the 'FHEVMConfig.sol' solidity file used in the project.
   */
  FHEVMConfigDotSolPath: string;
  /**
   * Indicates the address stored in the 'ZamaOracleAddress.sol' solidity file used in the project.
   */
  SepoliaZamaOracleAddress: string;
  /**
   * Indicates the absolute path of the 'ZamaOracleAddress.sol' solidity file used in the project.
   */
  ZamaOracleAddressDotSolPath: string;
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
  private _setupAddressesRunning: boolean = false;
  private _setupAddressesCompleted: boolean = false;
  private _addresses: FhevmEnvironmentAddresses | undefined;

  private _fhevmMockProvider: FhevmMockProvider | undefined;
  private _config: FhevmEnvironmentConfig | undefined;
  private _instance: MockFhevmInstance | undefined;
  private _fhevmAPI: FhevmExternalAPI;
  private _fhevmDebugger: FhevmDebugger;
  private _mockDecryptionOracle: DecryptionOracle | undefined;
  private _mockCoprocessor: MockCoprocessor | undefined;
  private _relayerSignerAddress: string | undefined;
  private _addressToReadonlyContract: Record<string, FhevmContractRecordEntry> | undefined;
  //private _contractsRepository: contracts.FhevmContractsRepository | undefined;

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

  /**
   * Only called by the FhevmProviderExtender
   */
  public get decryptionOracle(): DecryptionOracle {
    if (!this._mockDecryptionOracle) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._mockDecryptionOracle;
  }

  public getInstanceOrUndefined(): MockFhevmInstance | undefined {
    return this._instance;
  }

  public get instance(): MockFhevmInstance {
    if (!this._instance) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._instance;
  }

  public getACLAddress(): string {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.ACLAddress;
  }

  public getFHEVMExecutorAddress(): string {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.FHEVMExecutorAddress;
  }

  public getInputVerifierAddress(): string {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.InputVerifierAddress;
  }

  public getKMSVerifierAddress(): string {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.KMSVerifierAddress;
  }

  public getDecryptionOracleAddress(): string {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.DecryptionOracleAddress;
  }

  /**
   * Fhevm Gateway InputVerification.sol contract
   * Address of the contract deployed on the gateway chain
   * (identified by the chainId returned from getGatewayChainId())
   * responsible for performing EIP-712 signature verification
   * for input values
   * @returns InputVerification contract address
   */
  public getGatewayInputVerificationAddress(): string {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.gatewayInputVerificationAddress;
  }

  /**
   * Fhevm Gateway Decryption.sol contract
   * Address of the contract deployed on the gateway chain
   * (identified by the chainId returned from getGatewayChainId())
   * responsible for performing EIP-712 signature verification
   * for decryption operations
   * @returns Decryption contract address
   */
  public getGatewayDecryptionAddress(): string {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.gatewayDecryptionAddress;
  }

  public getACLReadOnly(): EthersT.Contract {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.ACLReadOnly;
  }

  public getFHEVMExecutorReadOnly(): EthersT.Contract {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.FHEVMExecutorReadOnly;
  }

  public getInputVerifierReadOnly(): EthersT.Contract {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.InputVerifierReadOnly;
  }

  public getDecryptionOracleReadOnly(): EthersT.Contract {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.DecryptionOracleReadOnly;
  }

  public getKMSVerifierReadOnly(): EthersT.Contract {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.KMSVerifierReadOnly;
  }

  public getGatewayChainId(): number {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.gatewayChainId;
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
  public getFHEVMContractsMap() {
    if (!this._addressToReadonlyContract) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._addressToReadonlyContract;
  }

  public get isDeployed(): boolean {
    return this._deployCompleted;
  }

  public async deploy() {
    if (this._deployCompleted) {
      throw new HardhatFhevmError("The Fhevm environment is already initialized.");
    }
    if (this._deployRunning) {
      throw new HardhatFhevmError("The Fhevm environment is already being initialized.");
    }

    this._deployRunning = true;

    await this._deployCore();

    this._deployCompleted = true;
    this._deployRunning = false;
  }

  private _guessDefaultProvider(): {
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

  public async minimalInit(): Promise<void> {
    if (this._fhevmMockProvider === undefined) {
      const defaults = this._guessDefaultProvider();

      this._fhevmMockProvider = await FhevmMockProvider.fromProvider(
        this.hre.ethers.provider,
        this.hre.network.name,
        defaults.type,
        defaults.chainId,
        defaults.url,
      );
    }
  }

  private async _createSigners(): Promise<FhevmSigners> {
    const kmsSigners = await loadKMSSigners(this.hre, this.mockProvider.ethersProvider);
    const coprocessorSigners = await loadCoprocessorSigners(this.hre, this.mockProvider.ethersProvider);
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
    await this.minimalInit();

    if (!this.mockProvider.isMock) {
      throw new HardhatFhevmError(
        "The current version of the fhevm hardhat plugin only supports the 'hardhat' network, 'localhost' hardhat node or anvil.",
      );
    }

    const fhevmAddresses = await this.initializeAddresses(false /* ignoreCache */);

    const fhevmSigners = await this._createSigners();

    let coprocessorSigners: EthersT.Signer[];
    let kmsSigners: EthersT.Signer[];

    await this.mockProvider.setTemporaryMinimumBlockGasLimit(0x1fffffffffffffn);
    try {
      // 'setup' should contain the FhevmContractsRepository instance as well
      const setup = await setupMockUsingCoreContractsArtifacts(
        this.mockProvider,
        fhevmAddresses,
        fhevmSigners,
        this.paths,
      );
      this._config = setup.config;
      coprocessorSigners = setup.coprocessorSigners;
      kmsSigners = setup.kmsSigners;
    } finally {
      await this.mockProvider.unsetTemporaryMinimumBlockGasLimit();
    }

    // Duplicated! should be executed in setup!
    // this._contractsRepository = await contracts.FhevmContractsRepository.create(this.readonlyEthersProvider, {
    //   aclContractAddress: this._config.ACLAddress,
    //   kmsContractAddress: this._config.KMSVerifierAddress,
    // });

    this._buildAddressToReadonlyContract();

    /*
     CREATED if env is not running inside a hardhat node
    */
    if (this.useEmbeddedMockEngine) {
      const ethersProvider = this.mockProvider.ethersProvider;
      if (!ethersProvider) {
        throw new HardhatFhevmError(
          `Missing ethers.Provider. The FhevmMockProvider instance does not have a valid ethers.Provider.`,
        );
      }

      const blockNumber = await this.mockProvider.getBlockNumber();

      const db = new FhevmDBMap();
      await db.init(blockNumber);

      this._relayerSignerAddress = await getRelayerSignerAddress(this.hre);
      const relayerSigner = await getRelayerSigner(this.hre);

      /*
        mockProvider: FhevmMockProvider
        MockConfig = FhevmInstanceConfig & {
          kmsSigners: EthersT.Signer[] | string[],
          coprocessorSigners: EthersT.Signer[] | string[],
          relayerSigner: EtherT.Signer | string
          db: FhevmDB,
        }
      */

      this._mockCoprocessor = await MockCoprocessor.create(ethersProvider, {
        coprocessorContractAddress: this.getFHEVMExecutorAddress(),
        coprocessorSigners,
        inputVerifierContractAddress: this.getInputVerifierAddress(),
        db,
      });

      this._mockDecryptionOracle = await MockDecryptionOracle.create(ethersProvider, {
        decryptionOracleContractAddress: this.getDecryptionOracleAddress(),
        aclContractAddress: this.getACLAddress(),
        kmsVerifierContractAddress: this.getKMSVerifierAddress(),
        coprocessor: this._mockCoprocessor,
        kmsSigners,
        relayerSigner,
      });
    }

    // TODO: instance creation could be transfered to 'runSetupAddresses' instead.
    if (!this.isRunningInHHNode) {
      this._instance = await this.createInstance();
    }
  }

  public async createInstance(): Promise<MockFhevmInstance> {
    assertHHFhevm(!this.isRunningInHHNode, "Cannot create a MockFhevmInstance object in the 'hardhat node' server");
    return MockFhevmInstance.create(this.hre.ethers.provider, this.hre.ethers.provider, {
      verifyingContractAddressDecryption: this.getGatewayDecryptionAddress(),
      verifyingContractAddressInputVerification: this.getGatewayInputVerificationAddress(),
      kmsContractAddress: this.getKMSVerifierAddress(),
      inputVerifierContractAddress: this.getInputVerifierAddress(),
      aclContractAddress: this.getACLAddress(),
      chainId: this.chainId,
      gatewayChainId: this.getGatewayChainId(),
    });
  }

  /**
   * Generates:
   *  - `/path/to/user-package/fhevmTemp/@fhevm/solidity/config/FHEVMConfig.sol`
   *  - `/path/to/user-package/fhevmTemp/@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol`
   */
  public async initializeAddresses(ignoreCache: boolean): Promise<FhevmEnvironmentAddresses> {
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

    const addresses = await this._initializeAddressesCore(ignoreCache);
    Object.freeze(addresses);
    Object.freeze(addresses.FHEVMConfig);

    this._addresses = addresses;
    this._setupAddressesCompleted = true;
    this._setupAddressesRunning = false;

    return addresses;
  }

  private async _initializeAddressesCore(ignoreCache: boolean): Promise<FhevmEnvironmentAddresses> {
    const precompiledAddresses: PrecompiledCoreContractsAddresses = await loadPrecompiledFhevmCoreContractsAddresses(
      this.mockProvider,
      this.paths,
      ignoreCache,
      this.isRunningInHHFHEVMInstallSolidity,
    );
    const kmsVerifierAddress: string = getKMSVerifierAddress();

    const fhevmConfig: FHEVMConfig = {
      ACLAddress: precompiledAddresses.ACLAddress,
      FHEVMExecutorAddress: precompiledAddresses.FHEVMExecutorAddress,
      InputVerifierAddress: precompiledAddresses.InputVerifierAddress,
      KMSVerifierAddress: kmsVerifierAddress,
    };
    const fhevmConfigDotSolPath = generateFHEVMConfigDotSol(this.paths, fhevmConfig);

    const zamaOracleAddress = parseSepoliaZamaOracleAddress(this.paths);
    const zamaOracleAddressDotSolPath = generateZamaOracleAddressDotSol(
      this.paths,
      zamaOracleAddress.SepoliaZamaOracleAddress,
    );

    assertHHFhevm(path.isAbsolute(fhevmConfigDotSolPath));
    assertHHFhevm(path.isAbsolute(zamaOracleAddressDotSolPath));

    return {
      ...zamaOracleAddress,
      FHEVMConfig: fhevmConfig,
      FHEGasLimitAddress: precompiledAddresses.FHEGasLimitAddress,
      FHEVMConfigDotSolPath: fhevmConfigDotSolPath,
      ZamaOracleAddressDotSolPath: zamaOracleAddressDotSolPath,
    };
  }

  public getRemappings(): Record<string, string> {
    if (!this.mockProvider.isMock) {
      return {};
    }
    return {
      "@fhevm/solidity/config": this.paths.relCacheFhevmSolidityConfig,
      "@zama-fhe/oracle-solidity/address": this.paths.relCacheZamaFheOracleSolidityAddress,
    };
  }

  public getSoliditySourcePaths(): string[] {
    return [];
  }

  public interfaceFromName(fhevmContractName: FhevmContractName): EthersT.Interface | undefined {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }

    switch (fhevmContractName) {
      case "ACL":
        return this._config.ACLReadOnly.interface;
      case "FHEVMExecutor":
        return this._config.FHEVMExecutorReadOnly.interface;
      case "InputVerifier":
        return this._config.InputVerifierReadOnly.interface;
      case "KMSVerifier":
        return this._config.KMSVerifierReadOnly.interface;
      case "DecryptionOracle":
        return this._config.DecryptionOracleReadOnly.interface;
    }

    return undefined;
  }

  public addressFromName(fhevmContractName: FhevmContractName): string | undefined {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }

    switch (fhevmContractName) {
      case "ACL":
        return this._config.ACLAddress;
      case "FHEVMExecutor":
        return this._config.FHEVMExecutorAddress;
      case "InputVerifier":
        return this._config.InputVerifierAddress;
      case "KMSVerifier":
        return this._config.KMSVerifierAddress;
      case "DecryptionOracle":
        return this._config.DecryptionOracleAddress;
    }

    return undefined;
  }

  // _deployCore
  private _buildAddressToReadonlyContract() {
    assertHHFhevm(this._config !== undefined);
    assertHHFhevm(this._addressToReadonlyContract === undefined);

    this._addressToReadonlyContract = {};
    this._addressToReadonlyContract[this._config.ACLAddress.toLowerCase()] = {
      contractName: "ACL",
      address: this._config.ACLAddress,
      contract: this._config.ACLReadOnly,
      package: constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME,
    };
    this._addressToReadonlyContract[this._config.FHEVMExecutorAddress.toLowerCase()] = {
      contractName: "FHEVMExecutor",
      address: this._config.FHEVMExecutorAddress,
      contract: this._config.FHEVMExecutorReadOnly,
      package: constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME,
    };
    this._addressToReadonlyContract[this._config.DecryptionOracleAddress.toLowerCase()] = {
      contractName: "DecryptionOracle",
      address: this._config.DecryptionOracleAddress,
      contract: this._config.DecryptionOracleReadOnly,
      package: constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME,
    };
    this._addressToReadonlyContract[this._config.InputVerifierAddress.toLowerCase()] = {
      contractName: "InputVerifier",
      address: this._config.InputVerifierAddress,
      contract: this._config.InputVerifierReadOnly,
      package: constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME,
    };
    this._addressToReadonlyContract[this._config.KMSVerifierAddress.toLowerCase()] = {
      contractName: "KMSVerifier",
      address: this._config.KMSVerifierAddress,
      contract: this._config.KMSVerifierReadOnly,
      package: constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME,
    };
  }

  public readonlyContractFromAddress(address: string) {
    if (!this._addressToReadonlyContract) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    const addressLC = address.toLowerCase();
    if (addressLC in this._addressToReadonlyContract) {
      return this._addressToReadonlyContract[addressLC];
    }
    return undefined;
  }
}
