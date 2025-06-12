import { ethers as EthersT } from "ethers";

import constants from "../../constants.js";
import type { FhevmContractName, FhevmCoprocessorContractName, FhevmDecryptionOracleContractName } from "./index.js";

export abstract class FhevmContractWrapper {
  readonly #name: FhevmContractName;
  constructor(name: FhevmContractName) {
    this.#name = name;
  }

  public get name(): FhevmContractName {
    return this.#name;
  }

  public abstract get package(): string;
  public abstract get address(): string;
  public abstract get interface(): EthersT.Interface;
  public abstract get readonlyContract(): EthersT.Contract;

  public get properties(): {
    contractName: FhevmContractName;
    address: string;
    contract: EthersT.Contract;
    package: string;
  } {
    return {
      address: this.address,
      contract: this.readonlyContract,
      package: this.package,
      contractName: this.name,
    };
  }
  protected async _callOrThrow(p: Promise<any>, funcName: string) {
    try {
      return await p;
    } catch (e) {
      console.error(`invalid deployed ${this.name} contact at ${this.address}. Function ${funcName} does not exist.`);
      throw e;
    }
  }
}

export abstract class FhevmCoprocessorContractWrapper extends FhevmContractWrapper {
  constructor(name: FhevmCoprocessorContractName) {
    super(name);
  }
  public override get package(): string {
    return constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME;
  }
}

export abstract class FhevmDecryptionOracleContractWrapper extends FhevmContractWrapper {
  constructor(name: FhevmDecryptionOracleContractName) {
    super(name);
  }
  public override get package(): string {
    return constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME;
  }
}
