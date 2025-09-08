import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { FhevmError, assertFhevm } from "../../utils/error.js";
import { assertIsString } from "../../utils/string.js";
import { FhevmCoprocessorContractWrapper } from "./FhevmContractWrapper.js";
import { HCULimitPartialInterface } from "./interfaces/HCULimit.itf.js";

export type HCULimitProperties = {
  fhemExecutorAddress?: string;
  version?: string;
};

export class HCULimit extends FhevmCoprocessorContractWrapper {
  #hcuLimitContract: EthersT.Contract | undefined;
  #hcuLimitContractAddress: string | undefined;
  #fhemExecutorAddress: string | undefined;
  #version: string | undefined;

  constructor() {
    super("HCULimit");
  }

  public static async create(
    runner: EthersT.ContractRunner,
    hcuLimitContractAddress: string,
    abi?: EthersT.Interface | EthersT.InterfaceAbi,
    properties?: HCULimitProperties,
  ): Promise<HCULimit> {
    assertIsAddress(hcuLimitContractAddress, "hcuLimitContractAddress");

    if (properties !== undefined) {
      throw new FhevmError("Not yet implemented");
    }

    const hcuLimit = new HCULimit();
    hcuLimit.#hcuLimitContractAddress = hcuLimitContractAddress;
    hcuLimit.#hcuLimitContract = new EthersT.Contract(hcuLimitContractAddress, abi ?? HCULimitPartialInterface, runner);
    await hcuLimit._initialize();
    return hcuLimit;
  }

  public override get readonlyContract(): EthersT.Contract {
    assertFhevm(this.#hcuLimitContract !== undefined, `HCULimit wrapper is not yet initialized`);
    return this.#hcuLimitContract;
  }

  public override get interface(): EthersT.Interface {
    assertFhevm(this.#hcuLimitContract !== undefined, `HCULimit wrapper is not yet initialized`);
    return this.#hcuLimitContract.interface;
  }

  public get address(): string {
    assertFhevm(this.#hcuLimitContractAddress !== undefined, `HCULimit wrapper is not yet initialized`);
    return this.#hcuLimitContractAddress;
  }

  public get version(): string {
    assertFhevm(this.#version !== undefined, `HCULimit wrapper is not yet initialized`);
    return this.#version;
  }

  public get fhemExecutorAddress(): string {
    assertFhevm(this.#fhemExecutorAddress !== undefined, `HCULimit wrapper is not yet initialized`);
    return this.#fhemExecutorAddress;
  }

  private async _initialize() {
    assertFhevm(this.#hcuLimitContract !== undefined, `HCULimit wrapper is not yet initialized`);
    assertFhevm(this.#fhemExecutorAddress === undefined, `HCULimit wrapper already initialized`);

    this.#fhemExecutorAddress = await this.#hcuLimitContract.getFHEVMExecutorAddress();
    assertIsAddress(this.#fhemExecutorAddress, "fhemExecutorAddress");

    this.#version = await this.#hcuLimitContract.getVersion();
    assertIsString(this.#version, "version");
  }
}
