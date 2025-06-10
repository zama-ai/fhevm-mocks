import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { assertFhevm } from "../../utils/error.js";
import { assertIsString } from "../../utils/string.js";
import { FhevmCoprocessorContractWrapper } from "./FhevmCoprocessorContractWrapper.js";

const abiFHEGasLimit = [
  "function getVersion() external pure virtual returns (string memory)",
  "function getFHEVMExecutorAddress() public view virtual returns (address)",
];

export class FHEGasLimit extends FhevmCoprocessorContractWrapper {
  #fheGasLimitContract: EthersT.Contract | undefined;
  #fheGasLimitContractAddress: string | undefined;
  #fhemExecutorAddress: string | undefined;
  #version: string | undefined;

  constructor() {
    super("FHEGasLimit");
  }

  public static async create(runner: EthersT.ContractRunner, fheGasLimitContractAddress: string): Promise<FHEGasLimit> {
    assertIsAddress(fheGasLimitContractAddress, "fheGasLimitContractAddress");

    const kmsVerifier = new FHEGasLimit();
    kmsVerifier.#fheGasLimitContractAddress = fheGasLimitContractAddress;
    kmsVerifier.#fheGasLimitContract = new EthersT.Contract(fheGasLimitContractAddress, abiFHEGasLimit, runner);
    await kmsVerifier._initialize();
    return kmsVerifier;
  }

  public override get interface(): EthersT.Interface {
    throw new Error("Method not implemented.");
  }

  public get address(): string {
    assertFhevm(this.#fheGasLimitContractAddress !== undefined, `FHEGasLimit wrapper is not yet initialized`);
    return this.#fheGasLimitContractAddress;
  }

  public get version(): string {
    assertFhevm(this.#version !== undefined, `FHEGasLimit wrapper is not yet initialized`);
    return this.#version;
  }

  public get fhemExecutorAddress(): string {
    assertFhevm(this.#fhemExecutorAddress !== undefined, `FHEGasLimit wrapper is not yet initialized`);
    return this.#fhemExecutorAddress;
  }

  private async _initialize() {
    assertFhevm(this.#fheGasLimitContract !== undefined, `FHEGasLimit wrapper is not yet initialized`);
    assertFhevm(this.#fhemExecutorAddress === undefined, `FHEGasLimit wrapper already initialized`);

    this.#fhemExecutorAddress = await this.#fheGasLimitContract.getFHEVMExecutorAddress();
    assertIsAddress(this.#fhemExecutorAddress, "fhemExecutorAddress");

    this.#version = await this.#fheGasLimitContract.getVersion();
    assertIsString(this.#version, "version");
  }
}
