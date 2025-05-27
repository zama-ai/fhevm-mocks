import { ethers as EthersT } from "ethers";

import { assertIsAddress } from "../../utils/address.js";
import { FhevmError, assertFhevm } from "../../utils/error.js";
import { assertIsString } from "../../utils/string.js";

const abiACL = [
  "function getVersion() pure returns (string memory)",
  "function getFHEVMExecutorAddress() view returns (address)",
  "function isAllowedForDecryption(bytes32 handle) view returns (bool)",
];

export class ACL {
  #aclReadOnlyContract: EthersT.Contract;
  #aclContractAddress: string;
  #fhevmExecutorAddress: string | undefined;
  #version: string | undefined;

  constructor(runner: EthersT.ContractRunner, aclContractAddress: string) {
    assertIsAddress(aclContractAddress, "aclContractAddress");
    this.#aclContractAddress = aclContractAddress;
    this.#aclReadOnlyContract = new EthersT.Contract(aclContractAddress, abiACL, runner);
  }

  public get runner(): EthersT.ContractRunner {
    assertFhevm(this.#aclReadOnlyContract.runner);
    return this.#aclReadOnlyContract.runner;
  }

  public get address(): string {
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

  public static async create(runner: EthersT.ContractRunner, aclContractAddress: string): Promise<ACL> {
    const acl = new ACL(runner, aclContractAddress);
    await acl.initialize();
    return acl;
  }

  public async initialize() {
    assertFhevm(this.#fhevmExecutorAddress === undefined, `ACL wrapper already initialized`);

    this.#fhevmExecutorAddress = await this.#aclReadOnlyContract.getFHEVMExecutorAddress();
    assertIsAddress(this.#fhevmExecutorAddress, "fhemExecutorAddress");

    this.#version = await this.#aclReadOnlyContract.getVersion();
    assertIsString(this.#version, "version");
  }

  public async checkIsAllowedForDecryption(handlesBytes32Hex: string[], readonlyProvider: EthersT.Provider) {
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
