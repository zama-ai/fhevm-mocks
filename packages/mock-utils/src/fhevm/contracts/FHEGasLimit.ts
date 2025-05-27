import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { assertFhevm } from "../../utils/error.js";
import { assertIsString } from "../../utils/string.js";

const abiFHEGasLimit = [
  "function getVersion() external pure virtual returns (string memory)",
  "function getFHEVMExecutorAddress() public view virtual returns (address)",
];

export class FHEGasLimit {
  #fheGasLimitContract: EthersT.Contract;
  #fheGasLimitContractAddress: string;
  #fhemExecutorAddress: string | undefined;
  #version: string | undefined;

  constructor(runner: EthersT.ContractRunner, fheGasLimitContractAddress: string) {
    assertIsAddress(fheGasLimitContractAddress, "fheGasLimitContractAddress");
    this.#fheGasLimitContractAddress = fheGasLimitContractAddress;
    this.#fheGasLimitContract = new EthersT.Contract(fheGasLimitContractAddress, abiFHEGasLimit, runner);
  }

  public get runner(): EthersT.ContractRunner {
    assertFhevm(this.#fheGasLimitContract.runner);
    return this.#fheGasLimitContract.runner;
  }

  public get address(): string {
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

  public static async create(runner: EthersT.ContractRunner, fheGasLimitContractAddress: string): Promise<FHEGasLimit> {
    const fheGasLimit = new FHEGasLimit(runner, fheGasLimitContractAddress);
    await fheGasLimit.initialize();
    return fheGasLimit;
  }

  public async initialize() {
    assertFhevm(this.#fhemExecutorAddress === undefined, `FHEGasLimit wrapper already initialized`);

    this.#fhemExecutorAddress = await this.#fheGasLimitContract.getFHEVMExecutorAddress();
    assertIsAddress(this.#fhemExecutorAddress, "fhemExecutorAddress");

    this.#version = await this.#fheGasLimitContract.getVersion();
    assertIsString(this.#version, "version");
  }
}
