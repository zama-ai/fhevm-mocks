import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { assertFhevm } from "../../utils/error.js";
import { assertIsString } from "../../utils/string.js";
import { type FhevmTransactionHCUInfo, getTxHCUFromTxReceipt } from "../coprocessor/hcu.js";
import { FhevmCoprocessorContractWrapper } from "./FhevmContractWrapper.js";
import { FHEVMExecutorPartialInterface } from "./interfaces/FHEVMExecutor.itf.js";

export type FHEVMExecutorProperties = {
  aclAddress?: `0x${string}`;
  hcuLimitAddress?: `0x${string}`;
  inputVerifierAddress?: `0x${string}`;
  version?: string;
};

// Shareable
export class FHEVMExecutor extends FhevmCoprocessorContractWrapper {
  #fhevmExecutorReadonlyContract: EthersT.Contract | undefined;
  #fhevmExecutorContractAddress: `0x${string}` | undefined;
  #aclAddress: `0x${string}` | undefined;
  #hcuLimitAddress: `0x${string}` | undefined;
  #inputVerifierAddress: `0x${string}` | undefined;
  #version: string | undefined;

  constructor() {
    super("FHEVMExecutor");
  }

  public static async create(
    runner: EthersT.ContractRunner,
    fhevmExecutorContractAddress: `0x${string}`,
    abi?: EthersT.Interface | EthersT.InterfaceAbi,
    properties?: FHEVMExecutorProperties,
  ): Promise<FHEVMExecutor> {
    assertIsAddress(fhevmExecutorContractAddress, "fhevmExecutorContractAddress");
    const fhevmExecutor = new FHEVMExecutor();
    fhevmExecutor.#fhevmExecutorContractAddress = fhevmExecutorContractAddress;
    fhevmExecutor.#fhevmExecutorReadonlyContract = new EthersT.Contract(
      fhevmExecutorContractAddress,
      abi ?? FHEVMExecutorPartialInterface,
      runner,
    );
    fhevmExecutor.#aclAddress = properties?.aclAddress;
    fhevmExecutor.#hcuLimitAddress = properties?.hcuLimitAddress;
    fhevmExecutor.#inputVerifierAddress = properties?.inputVerifierAddress;
    fhevmExecutor.#version = properties?.version;
    await fhevmExecutor._initialize();
    return fhevmExecutor;
  }

  public override get readonlyContract(): EthersT.Contract {
    assertFhevm(this.#fhevmExecutorReadonlyContract !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#fhevmExecutorReadonlyContract;
  }

  public override get interface(): EthersT.Interface {
    assertFhevm(this.#fhevmExecutorReadonlyContract !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#fhevmExecutorReadonlyContract.interface;
  }

  public get address(): `0x${string}` {
    assertFhevm(this.#fhevmExecutorContractAddress !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#fhevmExecutorContractAddress;
  }

  public get version(): string {
    assertFhevm(this.#version !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#version;
  }

  public get aclAddress(): `0x${string}` {
    assertFhevm(this.#aclAddress !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#aclAddress;
  }

  public get hcuLimitAddress(): `0x${string}` {
    assertFhevm(this.#hcuLimitAddress !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#hcuLimitAddress;
  }

  public get inputVerifierAddress(): `0x${string}` {
    assertFhevm(this.#inputVerifierAddress !== undefined, `FHEVMExecutor wrapper is not yet initialized`);
    return this.#inputVerifierAddress;
  }

  private async _initialize() {
    assertFhevm(this.#fhevmExecutorReadonlyContract !== undefined, `FHEVMExecutor wrapper is not initialized`);

    if (!this.#aclAddress) {
      this.#aclAddress = await this._callOrThrow(
        this.#fhevmExecutorReadonlyContract.getACLAddress(),
        "getACLAddress()",
      );
    }
    assertIsAddress(this.#aclAddress, "aclAddress");

    if (!this.#hcuLimitAddress) {
      this.#hcuLimitAddress = await this._callOrThrow(
        this.#fhevmExecutorReadonlyContract.getHCULimitAddress(),
        "getHCULimitAddress()",
      );
    }
    assertIsAddress(this.#hcuLimitAddress, "hcuLimitAddress");

    if (!this.#inputVerifierAddress) {
      this.#inputVerifierAddress = await this._callOrThrow(
        this.#fhevmExecutorReadonlyContract.getInputVerifierAddress(),
        "getInputVerifierAddress()",
      );
    }
    assertIsAddress(this.#inputVerifierAddress, "inputVerifierAddress");

    if (!this.#version) {
      this.#version = await this._callOrThrow(this.#fhevmExecutorReadonlyContract.getVersion(), "getVersion()");
    }
    assertIsString(this.#version, "version");
  }

  public computeTransactionHCU(transactionReceipt: EthersT.TransactionReceipt): FhevmTransactionHCUInfo {
    return getTxHCUFromTxReceipt(this.address, this.readonlyContract.interface, transactionReceipt);
  }
}
