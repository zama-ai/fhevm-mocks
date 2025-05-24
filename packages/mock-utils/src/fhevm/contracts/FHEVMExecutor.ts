import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { assertFhevm } from "../../utils/error.js";
import { assertIsString } from "../../utils/string.js";

const abiFHEVMExecutor = [
  "function getVersion() external pure virtual returns (string memory)",
  "function getInputVerifierAddress() public view virtual returns (address)",
  "function getFHEGasLimitAddress() public view virtual returns (address)",
  "function getACLAddress() public view virtual returns (address)",
];

export class FHEVMExecutor {
  #fhevmExecutorContract: EthersT.Contract;
  #fhevmExecutorContractAddress: string;
  #aclAddress: string | undefined;
  #fheGasLimitAddress: string | undefined;
  #inputVerifierAddress: string | undefined;
  #version: string | undefined;

  constructor(runner: EthersT.ContractRunner, fhevmExecutorContractAddress: string) {
    assertIsAddress(fhevmExecutorContractAddress, "fhevmExecutorContractAddress");
    this.#fhevmExecutorContractAddress = fhevmExecutorContractAddress;
    this.#fhevmExecutorContract = new EthersT.Contract(fhevmExecutorContractAddress, abiFHEVMExecutor, runner);
  }

  public get address(): string {
    return this.#fhevmExecutorContractAddress;
  }

  public get runner(): EthersT.ContractRunner {
    assertFhevm(this.#fhevmExecutorContract.runner);
    return this.#fhevmExecutorContract.runner;
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

  public static async create(
    runner: EthersT.ContractRunner,
    fhevmExecutorContractAddress: string,
  ): Promise<FHEVMExecutor> {
    const fhevmExecutor = new FHEVMExecutor(runner, fhevmExecutorContractAddress);
    await fhevmExecutor.initialize();
    return fhevmExecutor;
  }

  public async initialize() {
    assertFhevm(this.#aclAddress === undefined, `FHEVMExecutor wrapper already initialized`);
    assertFhevm(this.#fheGasLimitAddress === undefined, `FHEVMExecutor wrapper already initialized`);
    assertFhevm(this.#inputVerifierAddress === undefined, `FHEVMExecutor wrapper already initialized`);
    assertFhevm(this.#version === undefined, `FHEVMExecutor wrapper already initialized`);

    this.#aclAddress = await this.#fhevmExecutorContract.getACLAddress();
    assertIsAddress(this.#aclAddress, "aclAddress");

    this.#fheGasLimitAddress = await this.#fhevmExecutorContract.getFHEGasLimitAddress();
    assertIsAddress(this.#fheGasLimitAddress, "fheGasLimitAddress");

    this.#inputVerifierAddress = await this.#fhevmExecutorContract.getInputVerifierAddress();
    assertIsAddress(this.#inputVerifierAddress, "inputVerifierAddress");

    this.#version = await this.#fhevmExecutorContract.getVersion();
    assertIsString(this.#version, "version");
  }
}
