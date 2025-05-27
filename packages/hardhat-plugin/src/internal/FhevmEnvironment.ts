import {
  DecryptionOracle,
  FhevmContractName,
  FhevmDBMap,
  MockCoprocessor,
  MockDecryptionOracle,
  MockFhevmInstance,
  contracts,
} from "@fhevm/mock-utils";
import { ethers as EthersT } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import * as path from "path";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INSTALL_SOLIDITY } from "../task-names";
import { HardhatFhevmRuntimeEnvironment } from "../types";
import { FHEVMConfig } from "../types";
import { FhevmDebugger } from "./FhevmDebugger";
import { FhevmEnvironmentPaths } from "./FhevmEnvironmentPaths";
import { FhevmExternalAPI } from "./FhevmExternalAPI";
import { generateFHEVMConfigDotSol } from "./deploy/FHEVMConfig";
import { loadPrecompiledFhevmCoreContractsAddresses } from "./deploy/PrecompiledFhevmCoreContracts";
import { parseSepoliaZamaOracleAddress } from "./deploy/PrecompiledZamaFheOracleSolidity";
import { generateZamaOracleAddressDotSol } from "./deploy/ZamaOracleAddress";
import {
  getCoprocessorSigners,
  getKMSSigners,
  getKMSVerifierAddress,
  getRelayerSigner,
  getRelayerSignerAddress,
} from "./deploy/addresses";
import { setupMockUsingCoreContractsArtifacts } from "./deploy/setup";
import { assertHHFhevm } from "./error";
import { PrecompiledCoreContractsAddresses } from "./types";
import { FhevmEthersProvider, FhevmEthersProviderType } from "./utils/FhevmEthersProvider";

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
  kmsSigners: EthersT.Signer[];
  coprocessorSigners: EthersT.Signer[];
  gatewayInputVerificationAddress: string;
  gatewayChainId: number;
  gatewayDecryptionAddress: string;
};

export type FhevmEnvironmentAddresses = {
  /**
   * Indicates the addresses stored in the solidity `FHEVMConfigStruct` used in the project.
   */
  FHEVMConfig: FHEVMConfig;
  /**
   * Indicates the addresse of the solidity contract `FHEGasLimit.sol` used in the project.
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
  private _runningInHHNode: boolean | undefined;
  private _runningInHHTest: boolean | undefined;
  private _runningInHHFHEVMInstallSolidity: boolean | undefined;
  private _fhevmEthersProvider: FhevmEthersProvider | undefined;
  private _hre: HardhatRuntimeEnvironment;
  private _config: FhevmEnvironmentConfig | undefined;
  private _addresses: FhevmEnvironmentAddresses | undefined;
  private _instance: MockFhevmInstance | undefined;
  private _paths: FhevmEnvironmentPaths;
  private _relayerSigner: EthersT.Signer | undefined;
  private _fhevmAPI: FhevmExternalAPI;
  private _fhevmDebugger: FhevmDebugger;
  private _mockDecryptionOracle: DecryptionOracle | undefined;
  private _mockCoprocessor: MockCoprocessor | undefined;
  private _relayerSignerAddress: string | undefined;
  private _deployRunning: boolean = false;
  private _deployCompleted: boolean = false;
  private _setupAddressesRunning: boolean = false;
  private _setupAddressesCompleted: boolean = false;
  private _addressToReadonlyContract: Record<string, FhevmContractRecordEntry> | undefined;

  private _id: number = -1;
  private static _idCount: number = -1;

  /**
   * Constructor must be ultra-lightweight!
   */
  constructor(hre: HardhatRuntimeEnvironment) {
    FhevmEnvironment._idCount++;
    this._id = FhevmEnvironment._idCount;

    this._hre = hre;

    this._fhevmAPI = new FhevmExternalAPI(this);
    this._fhevmDebugger = new FhevmDebugger(this);
    this._paths = new FhevmEnvironmentPaths(hre.config.paths.root);
  }

  public setRunningInHHFHEVMInstallSolidity() {
    if (this._runningInHHFHEVMInstallSolidity !== undefined) {
      throw new HardhatFhevmError(
        `The fhevm hardhat plugin is already running inside a 'hardhat ${SCOPE_FHEVM} ${SCOPE_FHEVM_TASK_INSTALL_SOLIDITY}' command.`,
      );
    }
    this._runningInHHFHEVMInstallSolidity = true;
  }

  public unsetRunningInHHFHEVMInstallSolidity() {
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

  public setRunningInHHNode() {
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

  public get hre(): HardhatRuntimeEnvironment {
    if (!this._hre) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._hre;
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

  public get coprocessor(): MockCoprocessor {
    if (!this._mockCoprocessor) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._mockCoprocessor;
  }

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

  public getKMSSigners(): EthersT.Signer[] {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.kmsSigners;
  }

  public getKMSVerifierReadOnly(): EthersT.Contract {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.KMSVerifierReadOnly;
  }

  public getCoprocessorSigners(): EthersT.Signer[] {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.coprocessorSigners;
  }

  public getRelayerSignerAddress(): string {
    if (!this._relayerSignerAddress) {
      throw new HardhatFhevmError(
        `Relayer signer address is not defined. Ensure that the Fhevm environment has been properly initialized by calling runSetup() (${this._id}/${FhevmEnvironment._idCount})`,
      );
    }
    return this._relayerSignerAddress;
  }

  /**
   * Called by the MockFhevmGatewayDecryptor
   */
  public getRelayerSigner(): EthersT.Signer {
    if (!this._relayerSigner) {
      throw new HardhatFhevmError(
        "Relayer signer is not defined. Ensure that the Fhevm environment has been properly initialized by calling runSetup()",
      );
    }
    return this._relayerSigner;
  }

  public getGatewayChainId(): number {
    if (!this._config) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._config.gatewayChainId;
  }

  public get chainId(): number {
    if (!this._fhevmEthersProvider) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._fhevmEthersProvider.chainId;
  }

  /**
   *  API
   */
  get externalFhevmAPI(): HardhatFhevmRuntimeEnvironment {
    return this._fhevmAPI;
  }

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

  public get ethersProvider(): FhevmEthersProvider {
    if (!this._fhevmEthersProvider) {
      throw new HardhatFhevmError(`The Hardhat Fhevm plugin is not initialized.`);
    }
    return this._fhevmEthersProvider;
  }

  public async minimalInit(): Promise<void> {
    if (this._fhevmEthersProvider === undefined) {
      this._fhevmEthersProvider = await FhevmEthersProvider.create(this.hre);
    }
  }

  private async _createSigners(): Promise<FhevmSigners> {
    const kmsSigners = await getKMSSigners(this.hre, this.ethersProvider.provider);
    const coprocessorSigners = await getCoprocessorSigners(this.hre, this.ethersProvider.provider);
    const oneAddress = "0x0000000000000000000000000000000000000001";
    // Should be very very high in case of solidity coverage
    // Solidity coverage performs code instrumentations thus considerably increasing
    // the gas cost. Therefore any test account must have a huge balance at startup.
    const balance = EthersT.parseEther("10000");
    return {
      coprocessor: coprocessorSigners,
      kms: kmsSigners,
      oneAddress,
      zeroAddress: EthersT.ZeroAddress,
      zero: await this.ethersProvider.impersonateAddressAndSetBalance(this.hre, EthersT.ZeroAddress, balance),
      one: await this.ethersProvider.impersonateAddressAndSetBalance(this.hre, oneAddress, balance),
    };
  }

  /*
    In the case of:
    npx hardhat test --network localhost 
    - The process running `npx hardhat test --network localhost` does not trigger a mock engine
    - However, the process running `npx hardhat node` will.
  */
  public get useEmbeddedMockEngine(): boolean {
    return this.ethersProvider.info.type !== FhevmEthersProviderType.HardhatNode;
  }

  private async _deployCore() {
    await this.minimalInit();

    this._relayerSignerAddress = await getRelayerSignerAddress(this.hre);
    this._relayerSigner = await getRelayerSigner(this.hre);

    const fhevmAddresses = await this.initializeAddresses(false /* ignoreCache */);
    const fhevmSigners = await this._createSigners();

    await this.ethersProvider.setTemporaryMinimumBlockGasLimit(0x1fffffffffffffn);

    try {
      this._config = await setupMockUsingCoreContractsArtifacts(
        this.ethersProvider,
        fhevmAddresses,
        fhevmSigners,
        this.paths,
      );

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
    } finally {
      await this.ethersProvider.unsetTemporaryMinimumBlockGasLimit();
    }

    /*
     CREATED if : network === hardhat (inside hardhat node or hardhat runner) or ANVIL or TESTNET ?
    */
    if (this.useEmbeddedMockEngine) {
      const blockNumber = await this.hre.ethers.provider.getBlockNumber();
      //const db = new MockFhevmSQLDatabase();
      const db = new FhevmDBMap();
      await db.init(blockNumber);

      // To be improved (called twice at least...)
      const inputVerifier = await contracts.InputVerifier.create(
        this.hre.ethers.provider,
        this.getInputVerifierAddress(),
      );
      const kmsVerifier = await contracts.KMSVerifier.create(this.hre.ethers.provider, this.getKMSVerifierAddress());
      const acl = await contracts.ACL.create(this.hre.ethers.provider, this.getACLAddress());

      this._mockCoprocessor = new MockCoprocessor(
        this.interfaceFromName("FHEVMExecutor")!,
        this.getFHEVMExecutorAddress(),
        this.ethersProvider.provider,
        db,
        inputVerifier,
        this.getCoprocessorSigners(),
      );

      this._mockDecryptionOracle = new MockDecryptionOracle(
        this.interfaceFromName("DecryptionOracle")!,
        this.getDecryptionOracleAddress(),
        this.ethersProvider.provider,
        this._mockCoprocessor,
        db,
        kmsVerifier,
        acl,
        this.getKMSSigners(),
        this.getRelayerSigner(),
      );
    }

    // instance creation could be transfered to 'runSetupAddresses' instead.
    if (this.ethersProvider.isMock) {
      this._instance = await this.createInstance();
    } else {
      throw new HardhatFhevmError(
        "The current version of the fhevm hardhat plugin only supports the 'hardhat' network or 'localhost' hardhat node.",
      );
    }
  }

  public async createInstance(): Promise<MockFhevmInstance> {
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
      this.ethersProvider,
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
    if (!this.ethersProvider.isMock) {
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
