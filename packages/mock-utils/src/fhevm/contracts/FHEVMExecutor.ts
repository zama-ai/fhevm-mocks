import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { assertFhevm } from "../../utils/error.js";
import { assertIsString } from "../../utils/string.js";
import { FHEVMExecutorPartialInterface } from "./FHEVMExecutor.itf.js";
import { FhevmCoprocessorContractWrapper } from "./FhevmCoprocessorContractWrapper.js";

// Shareable
export class FHEVMExecutor extends FhevmCoprocessorContractWrapper {
  #fhevmExecutorReadonlyContract: EthersT.Contract | undefined;
  #fhevmExecutorContractAddress: string | undefined;
  #aclAddress: string | undefined;
  #fheGasLimitAddress: string | undefined;
  #inputVerifierAddress: string | undefined;
  #version: string | undefined;

  constructor() {
    super("FHEVMExecutor");
  }

  public static async create(
    runner: EthersT.ContractRunner,
    fhevmExecutorContractAddress: string,
  ): Promise<FHEVMExecutor> {
    assertIsAddress(fhevmExecutorContractAddress, "fhevmExecutorContractAddress");
    const fhevmExecutor = new FHEVMExecutor();
    fhevmExecutor.#fhevmExecutorContractAddress = fhevmExecutorContractAddress;
    fhevmExecutor.#fhevmExecutorReadonlyContract = new EthersT.Contract(
      fhevmExecutorContractAddress,
      FHEVMExecutorPartialInterface,
      runner,
    );
    await fhevmExecutor._initialize();
    return fhevmExecutor;
  }

  public override get interface(): EthersT.Interface {
    assertFhevm(this.#fhevmExecutorReadonlyContract !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#fhevmExecutorReadonlyContract.interface;
  }

  public get address(): string {
    assertFhevm(this.#fhevmExecutorContractAddress !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#fhevmExecutorContractAddress;
  }

  public get version(): string {
    assertFhevm(this.#version !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#version;
  }

  public get aclAddress(): string {
    assertFhevm(this.#aclAddress !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#aclAddress;
  }

  public get fheGasLimitAddress(): string {
    assertFhevm(this.#fheGasLimitAddress !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#fheGasLimitAddress;
  }

  public get inputVerifierAddress(): string {
    assertFhevm(this.#inputVerifierAddress !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#inputVerifierAddress;
  }

  private async _initialize() {
    assertFhevm(this.#fhevmExecutorReadonlyContract !== undefined, `FHEVMExecutor wrapper is not initialized`);
    assertFhevm(this.#aclAddress === undefined, `FHEVMExecutor wrapper already initialized`);
    assertFhevm(this.#fheGasLimitAddress === undefined, `FHEVMExecutor wrapper already initialized`);
    assertFhevm(this.#inputVerifierAddress === undefined, `FHEVMExecutor wrapper already initialized`);
    assertFhevm(this.#version === undefined, `FHEVMExecutor wrapper already initialized`);

    this.#aclAddress = await this.#fhevmExecutorReadonlyContract.getACLAddress();
    assertIsAddress(this.#aclAddress, "aclAddress");

    this.#fheGasLimitAddress = await this.#fhevmExecutorReadonlyContract.getFHEGasLimitAddress();
    assertIsAddress(this.#fheGasLimitAddress, "fheGasLimitAddress");

    this.#inputVerifierAddress = await this.#fhevmExecutorReadonlyContract.getInputVerifierAddress();
    assertIsAddress(this.#inputVerifierAddress, "inputVerifierAddress");

    this.#version = await this.#fhevmExecutorReadonlyContract.getVersion();
    assertIsString(this.#version, "version");
  }
}
