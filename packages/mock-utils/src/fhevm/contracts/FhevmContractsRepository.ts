import { ethers as EthersT } from "ethers";

import { FhevmError, assertFhevm } from "../../utils/error.js";
import { ACL } from "./ACL.js";
import { FHEGasLimit } from "./FHEGasLimit.js";
import { FHEVMExecutor } from "./FHEVMExecutor.js";
import type { FhevmCoprocessorContractWrapper } from "./FhevmCoprocessorContractWrapper.js";
import { InputVerifier } from "./InputVerifier.js";
import { KMSVerifier } from "./KMSVerifier.js";
import type { FhevmCoprocessorContractName } from "./index.js";

export class FhevmContractsRepository {
  #acl: ACL | undefined;
  #fhevmExecutor: FHEVMExecutor | undefined;
  #inputVerifier: InputVerifier | undefined;
  #kmsVerifier: KMSVerifier | undefined;
  #fheGasLimit: FHEGasLimit | undefined;

  constructor() {}

  public static async create(
    ethersReadonlyProvider: EthersT.Provider,
    config: { aclContractAddress: string; kmsContractAddress: string },
  ): Promise<FhevmContractsRepository> {
    if (!EthersT.isAddress(config.aclContractAddress)) {
      throw new FhevmError(`Invalid ACL contract address ${config.aclContractAddress}`);
    }
    if (!EthersT.isAddress(config.kmsContractAddress)) {
      throw new FhevmError(`Invalid KMSVerifier contract address ${config.kmsContractAddress}`);
    }

    const repo = new FhevmContractsRepository();

    repo.#acl = await ACL.create(ethersReadonlyProvider, config.aclContractAddress);
    repo.#fhevmExecutor = await FHEVMExecutor.create(ethersReadonlyProvider, repo.#acl.fhevmExecutorAddress);
    repo.#inputVerifier = await InputVerifier.create(ethersReadonlyProvider, repo.#fhevmExecutor.inputVerifierAddress);
    repo.#kmsVerifier = await KMSVerifier.create(ethersReadonlyProvider, config.kmsContractAddress);
    repo.#fheGasLimit = await FHEGasLimit.create(ethersReadonlyProvider, repo.#fhevmExecutor.fheGasLimitAddress);

    return repo;
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
      case "FHEGasLimit":
        return this.fheGasLimit;
    }
  }

  public getCoprocessorInterfaceFromName(name: FhevmCoprocessorContractName) {
    return this.getCoprocessorContractFromName(name).interface;
  }

  public get acl(): ACL {
    assertFhevm(this.#acl !== undefined, "FhevmContractsRepositoty is not initialized");
    return this.#acl;
  }

  public get fhevmExecutor(): FHEVMExecutor {
    assertFhevm(this.#fhevmExecutor !== undefined, "FhevmContractsRepositoty is not initialized");
    return this.#fhevmExecutor;
  }

  public get inputVerifier(): InputVerifier {
    assertFhevm(this.#inputVerifier !== undefined, "FhevmContractsRepositoty is not initialized");
    return this.#inputVerifier;
  }

  public get kmsVerifier(): KMSVerifier {
    assertFhevm(this.#kmsVerifier !== undefined, "FhevmContractsRepositoty is not initialized");
    return this.#kmsVerifier;
  }

  public get fheGasLimit(): FHEGasLimit {
    assertFhevm(this.#fheGasLimit !== undefined, "FhevmContractsRepositoty is not initialized");
    return this.#fheGasLimit;
  }
}
