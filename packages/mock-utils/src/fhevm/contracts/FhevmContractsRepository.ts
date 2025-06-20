import { ethers as EthersT } from "ethers";

import type { FhevmInstanceConfig } from "../../relayer-sdk/types.js";
import { FhevmError, assertFhevm } from "../../utils/error.js";
import { ACL, type ACLProperties } from "./ACL.js";
import { FHEVMExecutor, type FHEVMExecutorProperties } from "./FHEVMExecutor.js";
import type {
  FhevmContractWrapper,
  FhevmCoprocessorContractWrapper,
  FhevmDecryptionOracleContractWrapper,
} from "./FhevmContractWrapper.js";
import { HCULimit, type HCULimitProperties } from "./HCULimit.js";
import { InputVerifier, type InputVerifierProperties } from "./InputVerifier.js";
import { KMSVerifier, type KMSVerifierProperties } from "./KMSVerifier.js";
import { ZamaFheDecryptionOracle } from "./ZamaFheDecryptionOracle.js";
import {
  type FhevmContractName,
  type FhevmCoprocessorContractName,
  type FhevmDecryptionOracleContractName,
} from "./index.js";

export class FhevmContractsRepository {
  #acl: ACL | undefined;
  #fhevmExecutor: FHEVMExecutor | undefined;
  #inputVerifier: InputVerifier | undefined;
  #kmsVerifier: KMSVerifier | undefined;
  #hcuLimit: HCULimit | undefined;
  #zamaFheDecryptionOracle: ZamaFheDecryptionOracle | undefined;
  #addressToContract: Record<string, FhevmContractWrapper> | undefined;

  constructor() {}

  public static async create(
    ethersReadonlyProvider: EthersT.Provider,
    config: {
      aclContractAddress: string;
      kmsContractAddress: string;
      zamaFheDecryptionOracleAddress?: string;
      aclAbi?: EthersT.Interface | EthersT.InterfaceAbi;
      fhevmExecutorAbi?: EthersT.Interface | EthersT.InterfaceAbi;
      hcuLimitAbi?: EthersT.Interface | EthersT.InterfaceAbi;
      kmsVerifierAbi?: EthersT.Interface | EthersT.InterfaceAbi;
      inputVerifierAbi?: EthersT.Interface | EthersT.InterfaceAbi;
      zamaFheDecryptionOracleAbi?: EthersT.Interface | EthersT.InterfaceAbi;
      aclProperties?: ACLProperties;
      fhevmExecutorProperties?: FHEVMExecutorProperties;
      inputVerifierProperties?: InputVerifierProperties;
      kmsVerifierProperties?: KMSVerifierProperties;
      hcuLimitProperties?: HCULimitProperties;
    },
  ): Promise<FhevmContractsRepository> {
    if (!EthersT.isAddress(config.aclContractAddress)) {
      throw new FhevmError(`Invalid ACL contract address ${config.aclContractAddress}`);
    }
    if (!EthersT.isAddress(config.kmsContractAddress)) {
      throw new FhevmError(`Invalid KMSVerifier contract address ${config.kmsContractAddress}`);
    }
    if (config.zamaFheDecryptionOracleAddress !== undefined) {
      if (!EthersT.isAddress(config.zamaFheDecryptionOracleAddress)) {
        throw new FhevmError(`Invalid DecryptionOracle contract address ${config.zamaFheDecryptionOracleAddress}`);
      }
    }

    const repo = new FhevmContractsRepository();

    repo.#acl = await ACL.create(
      ethersReadonlyProvider,
      config.aclContractAddress,
      config.aclAbi,
      config.aclProperties,
    );
    repo.#fhevmExecutor = await FHEVMExecutor.create(
      ethersReadonlyProvider,
      repo.#acl.fhevmExecutorAddress,
      config.fhevmExecutorAbi,
      config.fhevmExecutorProperties,
    );
    repo.#inputVerifier = await InputVerifier.create(
      ethersReadonlyProvider,
      repo.#fhevmExecutor.inputVerifierAddress,
      config.inputVerifierAbi,
    );
    repo.#kmsVerifier = await KMSVerifier.create(
      ethersReadonlyProvider,
      config.kmsContractAddress,
      config.kmsVerifierAbi,
    );
    repo.#hcuLimit = await HCULimit.create(
      ethersReadonlyProvider,
      repo.#fhevmExecutor.hcuLimitAddress,
      config.hcuLimitAbi,
    );
    if (config.zamaFheDecryptionOracleAddress !== undefined) {
      repo.#zamaFheDecryptionOracle = await ZamaFheDecryptionOracle.create(
        ethersReadonlyProvider,
        config.zamaFheDecryptionOracleAddress,
        config.zamaFheDecryptionOracleAbi,
      );
    }

    if (repo.#inputVerifier.gatewayChainId !== repo.#kmsVerifier.gatewayChainId) {
      throw new FhevmError(
        `gateway chainId mismatch. InputVerifier.gatewayChainId=${repo.#inputVerifier.gatewayChainId} differs from KMSVerifier.gatewayChainId=${repo.#kmsVerifier.gatewayChainId}`,
      );
    }

    repo.#addressToContract = {};

    repo.#addressToContract[repo.#acl.address.toLowerCase()] = repo.#acl;
    repo.#addressToContract[repo.#fhevmExecutor.address.toLowerCase()] = repo.#fhevmExecutor;
    if (repo.#zamaFheDecryptionOracle) {
      repo.#addressToContract[repo.#zamaFheDecryptionOracle.address.toLowerCase()] = repo.#zamaFheDecryptionOracle;
    }
    repo.#addressToContract[repo.#inputVerifier.address.toLowerCase()] = repo.#inputVerifier;
    repo.#addressToContract[repo.#kmsVerifier.address.toLowerCase()] = repo.#kmsVerifier;
    repo.#addressToContract[repo.#hcuLimit.address.toLowerCase()] = repo.#hcuLimit;

    Object.freeze(repo.#addressToContract);

    return repo;
  }

  public addressToContractMap(): Record<string, FhevmContractWrapper> {
    assertFhevm(this.#addressToContract !== undefined, "FhevmContractsRepository is not initialized");
    return this.#addressToContract;
  }

  public getContractFromAddress(address: string): FhevmContractWrapper | undefined {
    const a = address.toLowerCase();
    if (a === this.acl.address.toLowerCase()) {
      return this.acl;
    }
    if (a === this.fhevmExecutor.address.toLowerCase()) {
      return this.fhevmExecutor;
    }
    if (a === this.inputVerifier.address.toLowerCase()) {
      return this.inputVerifier;
    }
    if (a === this.kmsVerifier.address.toLowerCase()) {
      return this.kmsVerifier;
    }
    if (a === this.hcuLimit.address.toLowerCase()) {
      return this.hcuLimit;
    }
    if (this.zamaFheDecryptionOracle) {
      if (a === this.zamaFheDecryptionOracle.address.toLowerCase()) {
        return this.zamaFheDecryptionOracle;
      }
    }
    return undefined;
  }

  public getContractFromName(name: FhevmContractName): FhevmContractWrapper | undefined {
    switch (name) {
      case "ACL":
        return this.acl;
      case "FHEVMExecutor":
        return this.fhevmExecutor;
      case "InputVerifier":
        return this.inputVerifier;
      case "KMSVerifier":
        return this.kmsVerifier;
      case "HCULimit":
        return this.hcuLimit;
      case "DecryptionOracle":
        return this.zamaFheDecryptionOracle;
      default: {
        throw new FhevmError(`Unsupported contract ${name}`);
      }
    }
  }

  public getCoprocessorContractFromName(name: FhevmCoprocessorContractName): FhevmCoprocessorContractWrapper {
    switch (name) {
      case "ACL":
        return this.acl;
      case "FHEVMExecutor":
        return this.fhevmExecutor;
      case "InputVerifier":
        return this.inputVerifier;
      case "KMSVerifier":
        return this.kmsVerifier;
      case "HCULimit":
        return this.hcuLimit;
      default: {
        throw new FhevmError(`Unsupported coprocessor contract ${name}`);
      }
    }
  }

  public getDecryptionOracleContractFromName(
    name: FhevmDecryptionOracleContractName,
  ): FhevmDecryptionOracleContractWrapper | undefined {
    switch (name) {
      case "DecryptionOracle":
        return this.zamaFheDecryptionOracle;
      default: {
        throw new FhevmError(`Unsupported decryption oracle contract ${name}`);
      }
    }
  }

  public getCoprocessorInterfaceFromName(name: FhevmCoprocessorContractName): EthersT.Interface {
    return this.getCoprocessorContractFromName(name).interface;
  }

  public getDecryptionOracleInterfaceFromName(name: FhevmDecryptionOracleContractName): EthersT.Interface | undefined {
    const c = this.getDecryptionOracleContractFromName(name);
    if (c === undefined) {
      return undefined;
    }
    return c.interface;
  }

  public get zamaFheDecryptionOracle(): ZamaFheDecryptionOracle | undefined {
    return this.#zamaFheDecryptionOracle;
  }

  public get acl(): ACL {
    assertFhevm(this.#acl !== undefined, "FhevmContractsRepository is not initialized");
    return this.#acl;
  }

  public get fhevmExecutor(): FHEVMExecutor {
    assertFhevm(this.#fhevmExecutor !== undefined, "FhevmContractsRepository is not initialized");
    return this.#fhevmExecutor;
  }

  public get inputVerifier(): InputVerifier {
    assertFhevm(this.#inputVerifier !== undefined, "FhevmContractsRepository is not initialized");
    return this.#inputVerifier;
  }

  public get kmsVerifier(): KMSVerifier {
    assertFhevm(this.#kmsVerifier !== undefined, "FhevmContractsRepository is not initialized");
    return this.#kmsVerifier;
  }

  public get hcuLimit(): HCULimit {
    assertFhevm(this.#hcuLimit !== undefined, "FhevmContractsRepository is not initialized");
    return this.#hcuLimit;
  }

  public getFhevmInstanceConfig(params: {
    chainId: number;
    relayerUrl: string;
  }): FhevmInstanceConfig & { fhevmExecutorContractAddress: string; decryptionOracleAddress?: string } {
    assertFhevm(this.#acl !== undefined, "FhevmContractsRepository is not initialized");
    assertFhevm(this.#fhevmExecutor !== undefined, "FhevmContractsRepository is not initialized");
    assertFhevm(this.#kmsVerifier !== undefined, "FhevmContractsRepository is not initialized");
    assertFhevm(this.#inputVerifier !== undefined, "FhevmContractsRepository is not initialized");

    const decryptionOracleAddress = this.#zamaFheDecryptionOracle?.address;

    return {
      aclContractAddress: this.#acl.address,
      fhevmExecutorContractAddress: this.#fhevmExecutor?.address,
      chainId: params.chainId,
      gatewayChainId: Number(this.#kmsVerifier.gatewayChainId),
      inputVerifierContractAddress: this.#inputVerifier.address,
      kmsContractAddress: this.#kmsVerifier.address,
      verifyingContractAddressDecryption: this.#kmsVerifier.gatewayDecryptionAddress,
      verifyingContractAddressInputVerification: this.#inputVerifier.gatewayInputVerificationAddress,
      relayerUrl: params.relayerUrl,
      ...(decryptionOracleAddress && { decryptionOracleAddress }),
    };
  }
}
