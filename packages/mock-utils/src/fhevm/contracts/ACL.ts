import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { FhevmError, assertFhevm } from "../../utils/error.js";
import { assertIsString } from "../../utils/string.js";
import { FhevmCoprocessorContractWrapper } from "./FhevmContractWrapper.js";
import { ACLPartialInterface } from "./interfaces/ACL.itf.js";

export type ACLProperties = {
  fhevmExecutorAddress?: string;
  version?: string;
};

// Shareable
export class ACL extends FhevmCoprocessorContractWrapper {
  #aclReadOnlyContract: EthersT.Contract | undefined;
  #aclContractAddress: string | undefined;
  #fhevmExecutorAddress: string | undefined;
  #version: string | undefined;

  constructor() {
    super("ACL");
  }

  public static async create(
    runner: EthersT.ContractRunner,
    aclContractAddress: string,
    abi?: EthersT.Interface | EthersT.InterfaceAbi,
    properties?: ACLProperties,
  ): Promise<ACL> {
    assertIsAddress(aclContractAddress, "aclContractAddress");
    const acl = new ACL();
    acl.#aclContractAddress = aclContractAddress;
    acl.#aclReadOnlyContract = new EthersT.Contract(aclContractAddress, abi ?? ACLPartialInterface, runner);
    acl.#fhevmExecutorAddress = properties?.fhevmExecutorAddress;
    acl.#version = properties?.version;
    await acl._initialize();
    return acl;
  }

  public override get readonlyContract(): EthersT.Contract {
    assertFhevm(this.#aclReadOnlyContract !== undefined, `ACL wrapper is not yet initialized`);
    return this.#aclReadOnlyContract;
  }

  public override get interface(): EthersT.Interface {
    assertFhevm(this.#aclReadOnlyContract !== undefined, `ACL wrapper is not yet initialized`);
    return this.#aclReadOnlyContract.interface;
  }

  public get address(): string {
    assertFhevm(this.#aclContractAddress !== undefined, `ACL wrapper is not yet initialized`);
    return this.#aclContractAddress;
  }

  public get version(): string {
    assertFhevm(this.#version !== undefined, `ACL wrapper is not yet initialized`);
    return this.#version;
  }

  public get fhevmExecutorAddress(): string {
    assertFhevm(this.#fhevmExecutorAddress !== undefined, `ACL wrapper is not yet initialized`);
    return this.#fhevmExecutorAddress;
  }

  private async _initialize() {
    assertFhevm(this.#aclReadOnlyContract !== undefined, `ACL wrapper is not yet initialized`);

    if (!this.#fhevmExecutorAddress) {
      this.#fhevmExecutorAddress = await this.#aclReadOnlyContract.getFHEVMExecutorAddress();
    }
    assertIsAddress(this.#fhevmExecutorAddress, "fhemExecutorAddress");

    if (!this.#version) {
      this.#version = await this.#aclReadOnlyContract.getVersion();
    }
    assertIsString(this.#version, "version");
  }

  public async checkIsAllowedForDecryption(handlesBytes32Hex: string[], readonlyProvider: EthersT.Provider) {
    assertFhevm(this.#aclReadOnlyContract !== undefined, `ACL wrapper is not yet initialized`);
    const c = this.#aclReadOnlyContract.connect(readonlyProvider) as EthersT.Contract;

    const isAllowedForDec: boolean[] = await Promise.all(
      handlesBytes32Hex.map(async (handleBytes32Hex: string) => c.isAllowedForDecryption(handleBytes32Hex)),
    );

    for (let i = 0; i < isAllowedForDec.length; ++i) {
      if (!isAllowedForDec[i]) {
        throw new FhevmError(`Handle ${handlesBytes32Hex[i]} is not authorized for decryption`);
      }
    }
  }
}
