import { ethers as EthersT } from "ethers";

import type { FhevmCoprocessorContractName } from "./index.js";

export abstract class FhevmCoprocessorContractWrapper {
  readonly #name: FhevmCoprocessorContractName;
  constructor(name: FhevmCoprocessorContractName) {
    this.#name = name;
  }

  public get name(): FhevmCoprocessorContractName {
    return this.#name;
  }

  public abstract get interface(): EthersT.Interface;
}
