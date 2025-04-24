import assert from "assert";
import { BigNumberish } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { HardhatFhevmError } from "../error";
import { HardhatFhevmRuntimeDebugger } from "../types";
import { FhevmEnvironment } from "./FhevmEnvironment";
import {
  FhevmType,
  FhevmTypeEbytes,
  FhevmTypeEuint,
  getFhevmTypeInfo,
  isFhevmEbytes,
  isFhevmEuint,
} from "./handle/FhevmType";
import { verifyFhevmHandle } from "./handle/handle";

export class FhevmDebugger implements HardhatFhevmRuntimeDebugger {
  #fhevmEnv: FhevmEnvironment;

  constructor(fhevmEnv: FhevmEnvironment) {
    this.#fhevmEnv = fhevmEnv;
  }

  private get hre(): HardhatRuntimeEnvironment {
    return this.#fhevmEnv.hre;
  }

  public async decryptEbool(handleBytes32: BigNumberish): Promise<boolean> {
    const handleBytes32Hex = this.#fhevmEnv.hre.ethers.toBeHex(handleBytes32, 32);
    verifyFhevmHandle(handleBytes32Hex, FhevmType.ebool, undefined, this.#fhevmEnv.hre.network.config.chainId);
    const networkName = this.hre.network.name;
    if (networkName === "hardhat") {
      await this.#fhevmEnv.coproc.awaitCoprocessor();
      return (await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(handleBytes32Hex)) === 1n;
    } else {
      throw new HardhatFhevmError(`FhevmDebugger.decryptEbool is not supported on network ${networkName}`);
    }
  }

  public async decryptEuint(fhevmType: FhevmTypeEuint, handleBytes32: BigNumberish): Promise<bigint> {
    if (!isFhevmEuint(fhevmType)) {
      throw new HardhatFhevmError(`Invalid FhevmType argument. Expecting uint type.`);
    }
    const handleBytes32Hex = this.#fhevmEnv.hre.ethers.toBeHex(handleBytes32, 32);
    verifyFhevmHandle(handleBytes32Hex, fhevmType, undefined, this.#fhevmEnv.hre.network.config.chainId);
    const networkName = this.hre.network.name;
    if (networkName === "hardhat") {
      await this.#fhevmEnv.coproc.awaitCoprocessor();
      return await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(handleBytes32Hex);
    } else {
      throw new HardhatFhevmError(`FhevmDebugger.decryptEuint is not supported on network ${networkName}`);
    }
  }

  public async decryptEbytes(fhevmType: FhevmTypeEbytes, handleBytes32: BigNumberish): Promise<string> {
    if (!isFhevmEbytes(fhevmType)) {
      throw new HardhatFhevmError(`Invalid FhevmType argument. Expecting bytes type.`);
    }
    const handleBytes32Hex = this.#fhevmEnv.hre.ethers.toBeHex(handleBytes32, 32);
    verifyFhevmHandle(handleBytes32Hex, fhevmType, undefined, this.#fhevmEnv.hre.network.config.chainId);
    const networkName = this.hre.network.name;
    if (networkName === "hardhat") {
      await this.#fhevmEnv.coproc.awaitCoprocessor();
      const ebytesBigInt = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(handleBytes32Hex);
      const fhevmTypeInfo = getFhevmTypeInfo(fhevmType);
      assert(fhevmTypeInfo.clearTextBitLength % 8 === 0);
      return this.#fhevmEnv.hre.ethers.toBeHex(ebytesBigInt, fhevmTypeInfo.clearTextBitLength / 8);
    } else {
      throw new HardhatFhevmError(`FhevmDebugger.decryptEbytes is not supported on network ${networkName}`);
    }
  }

  public async decryptEaddress(handleBytes32: BigNumberish): Promise<string> {
    const handleBytes32Hex = this.#fhevmEnv.hre.ethers.toBeHex(handleBytes32, 32);
    verifyFhevmHandle(handleBytes32Hex, FhevmType.eaddress, undefined, this.#fhevmEnv.hre.network.config.chainId);
    const networkName = this.hre.network.name;
    if (networkName === "hardhat") {
      await this.#fhevmEnv.coproc.awaitCoprocessor();
      const eaddressBigInt = await this.#fhevmEnv.db.sqlQueryHandleBytes32AsBigInt(handleBytes32Hex);
      return this.#fhevmEnv.hre.ethers.getAddress(this.#fhevmEnv.hre.ethers.toBeHex(eaddressBigInt, 20));
    } else {
      throw new HardhatFhevmError(`FhevmDebugger.decryptEaddress is not supported on network ${networkName}`);
    }
  }
}
