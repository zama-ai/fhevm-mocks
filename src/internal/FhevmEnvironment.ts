import assert from "assert";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { FHEVMConfig, HardhatFhevmRuntimeEnvironment } from "../types";
import { generateFHEVMConfigDotSol } from "./FHEVMConfig";
import { FhevmDebugger } from "./FhevmDebugger";
import { FhevmEnvironmentPaths } from "./FhevmEnvironmentPaths";
import { FhevmExternalAPI } from "./FhevmExternalAPI";
import { MockFhevmCoprocessor } from "./MockFhevmCoprocessor";
import { MockFhevmGatewayDecryptor } from "./MockFhevmGatewayDecryptor";
import { MockFhevmInstance } from "./MockFhevmInstance";
import { MockFhevmSQLDatabase } from "./MockFhevmSQLDatabase";
import { loadPrecompiledCoreContractsAddresses } from "./PrecompiledCoreContracts";
import { parseSepoliaZamaOracleAddress } from "./PrecompiledZamaFheOracleSolidity";
import { generateZamaOracleAddressDotSol } from "./ZamaOracleAddress";
import { getKMSVerifierAddress, getRelayerSigner, getRelayerSignerAddress } from "./addresses";
import { setupMockUsingCoreContractsArtifacts } from "./setup";
import { PrecompiledCoreContractsAddresses } from "./types";

export type FhevmEnvironmentConfig = {
  ACLAddress: string;
  ACLReadOnly: EthersT.Contract;
  FHEVMExecutorAddress: string;
  FHEVMExecutorReadOnly: EthersT.Contract;
  InputVerifierAddress: string;
  KMSVerifierAddress: string;
  DecryptionOracleAddress: string;
  DecryptionOracleReadOnly: EthersT.Contract;
  kmsSigners: EthersT.Signer[];
  coprocessorSigners: EthersT.Signer[];
  gatewayInputVerificationAddress: string;
  gatewayChainId: number;
  gatewayDecryptionAddress: string;
};

export type FhevmEnvironmentAddresses = {
  FHEVMConfig: FHEVMConfig;
  FHEVMConfigDotSolPath: string;
  SepoliaZamaOracleAddress: string;
  ZamaOracleAddressDotSolPath: string;
};

export class FhevmEnvironment {
  private _hre: HardhatRuntimeEnvironment;
  private _config: FhevmEnvironmentConfig | undefined;
  private _addresses: FhevmEnvironmentAddresses | undefined;
  private _instance: MockFhevmInstance | undefined;
  private _paths: FhevmEnvironmentPaths = new FhevmEnvironmentPaths(this);
  private _mockFhevmGatewayDecryptor: MockFhevmGatewayDecryptor | undefined;
  private _relayerSigner: EthersT.Signer | undefined;
  private _fhevmAPI: FhevmExternalAPI;
  private _fhevmDebugger: FhevmDebugger;
  private _mockFhevmSQLDatabase: MockFhevmSQLDatabase;
  private _mockFhevmCoprocessor: MockFhevmCoprocessor;
  private _relayerSignerAddress: string | undefined;
  private _deployRunning: boolean = false;
  private _deployCompleted: boolean = false;
  private _setupAddressesRunning: boolean = false;
  private _setupAddressesCompleted: boolean = false;

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
    this._mockFhevmSQLDatabase = new MockFhevmSQLDatabase(this);
    this._mockFhevmCoprocessor = new MockFhevmCoprocessor(this);
  }

  public get hre(): HardhatRuntimeEnvironment {
    assert(this._hre);
    return this._hre;
  }

  public get paths(): FhevmEnvironmentPaths {
    return this._paths;
  }

  public get debugger(): FhevmDebugger {
    assert(this._fhevmDebugger);
    return this._fhevmDebugger;
  }

  public get db(): MockFhevmSQLDatabase {
    assert(this._mockFhevmSQLDatabase);
    return this._mockFhevmSQLDatabase;
  }

  public get coproc(): MockFhevmCoprocessor {
    assert(this._mockFhevmCoprocessor);
    return this._mockFhevmCoprocessor;
  }

  public get gatewayDecryptor(): MockFhevmGatewayDecryptor {
    assert(this._mockFhevmGatewayDecryptor);
    return this._mockFhevmGatewayDecryptor;
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

  /**
   *  API
   */
  get externalFhevmAPI(): HardhatFhevmRuntimeEnvironment {
    return this._fhevmAPI;
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

  private async _deployCore() {
    this._relayerSignerAddress = await getRelayerSignerAddress(this.hre);
    this._relayerSigner = await getRelayerSigner(this.hre);

    // Should be simplified since part of the job has already been performed when runSetupAddresses was called.
    this._config = await setupMockUsingCoreContractsArtifacts(this.hre);
    this._mockFhevmGatewayDecryptor = await MockFhevmGatewayDecryptor.create(this, true);

    // instance creation could be transfered to 'runSetupAddresses' instead.
    if (this.hre.network.name === "hardhat") {
      this._instance = new MockFhevmInstance(this, {
        gatewayChainId: this._config.gatewayChainId,
        verifyingContractAddress: this._config.gatewayInputVerificationAddress,
        coprocessorSigners: this._config.coprocessorSigners,
      });
    } else {
      throw new HardhatFhevmError(
        "The current version of the fhevm hardhat plugin only supports the 'hardhat' network.",
      );
    }
  }

  /**
   * Generates:
   *  - `/path/to/user-package/fhevmTemp/@fhevm/solidity/config/FHEVMConfig.sol`
   *  - `/path/to/user-package/fhevmTemp/@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol`
   */
  public async runSetupAddresses(): Promise<{
    FHEVMConfig: FHEVMConfig;
    FHEVMConfigDotSolPath: string;
    SepoliaZamaOracleAddress: string;
    ZamaOracleAddressDotSolPath: string;
  }> {
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

    const addresses = await this._runSetupAddressesCore();
    Object.freeze(addresses);
    Object.freeze(addresses.FHEVMConfig);

    this._addresses = addresses;
    this._setupAddressesCompleted = true;
    this._setupAddressesRunning = false;

    return addresses;
  }

  private async _runSetupAddressesCore(): Promise<{
    FHEVMConfig: FHEVMConfig;
    FHEVMConfigDotSolPath: string;
    SepoliaZamaOracleAddress: string;
    ZamaOracleAddressDotSolPath: string;
  }> {
    const precompiledAddresses: PrecompiledCoreContractsAddresses = await loadPrecompiledCoreContractsAddresses(this);
    const kmsVerifierAddress: string = getKMSVerifierAddress();

    const fhevmConfig: FHEVMConfig = { ...precompiledAddresses, KMSVerifierAddress: kmsVerifierAddress };
    const fhevmConfigDotSolPath = generateFHEVMConfigDotSol(this, fhevmConfig);

    const zamaOracleAddress = parseSepoliaZamaOracleAddress(this);
    const zamaOracleAddressDotSolPath = generateZamaOracleAddressDotSol(
      this,
      zamaOracleAddress.SepoliaZamaOracleAddress,
    );

    return {
      ...zamaOracleAddress,
      FHEVMConfig: fhevmConfig,
      FHEVMConfigDotSolPath: fhevmConfigDotSolPath,
      ZamaOracleAddressDotSolPath: zamaOracleAddressDotSolPath,
    };
  }

  public getRemappings(): Record<string, string> {
    if (this.hre.network.name !== "hardhat") {
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
}
