import {
  FhevmHandle,
  FhevmHandleCoder,
  FhevmType,
  type FhevmTypeEbytes,
  type FhevmTypeEuint,
  isFhevmEbytes,
  isFhevmEuint,
  relayer,
} from "@fhevm/mock-utils";
import { getFhevmTypeInfo } from "@fhevm/mock-utils";
import { ethers as EthersT } from "ethers";
import type { BigNumberish } from "ethers";

import { HardhatFhevmError } from "../error";
import type { HardhatFhevmRuntimeDebugger } from "../types";
import type { FhevmEnvironment } from "./FhevmEnvironment";
import { assertHHFhevm } from "./error";

export class FhevmDebugger implements HardhatFhevmRuntimeDebugger {
  #fhevmEnv: FhevmEnvironment;

  constructor(fhevmEnv: FhevmEnvironment) {
    this.#fhevmEnv = fhevmEnv;
  }

  public async createDecryptionSignatures(
    handlesBytes32Hex: string[],
    clearTextValues: (bigint | string | boolean)[],
  ): Promise<string[]> {
    // Should perform a request on the provider since decryptionOracle === undefined in localhost mode!
    return await this.#fhevmEnv.decryptionOracle.createDecryptionSignatures(handlesBytes32Hex, clearTextValues);
  }

  public createHandleCoder(): FhevmHandleCoder {
    return new FhevmHandleCoder(this.#fhevmEnv.getACLAddress(), this.#fhevmEnv.chainId);
  }

  public async decryptEbool(handleBytes32: BigNumberish): Promise<boolean> {
    const handleBytes32Hex = EthersT.toBeHex(handleBytes32, 32);
    FhevmHandle.verify(handleBytes32Hex, {
      fhevmType: FhevmType.ebool,
      chainId: this.#fhevmEnv.ethersProvider.chainId,
    });

    const clearTextHexList: string[] = await relayer.requestFhevmGetClearText(this.#fhevmEnv.hre.ethers.provider, [
      handleBytes32Hex,
    ]);
    assertHHFhevm(clearTextHexList.length === 1);
    const clearTextBigIntList: bigint[] = clearTextHexList.map(EthersT.toBigInt);
    return clearTextBigIntList[0] === 1n;
  }

  public async decryptEuint(fhevmType: FhevmTypeEuint, handleBytes32: BigNumberish): Promise<bigint> {
    if (!isFhevmEuint(fhevmType)) {
      throw new HardhatFhevmError(`Invalid FhevmType argument. Expecting uint type.`);
    }
    const handleBytes32Hex = EthersT.toBeHex(handleBytes32, 32);
    FhevmHandle.verify(handleBytes32Hex, { fhevmType, chainId: this.#fhevmEnv.ethersProvider.chainId });

    const clearTextHexList: string[] = await relayer.requestFhevmGetClearText(this.#fhevmEnv.hre.ethers.provider, [
      handleBytes32Hex,
    ]);
    assertHHFhevm(clearTextHexList.length === 1);
    const clearTextBigIntList: bigint[] = clearTextHexList.map(EthersT.toBigInt);

    // Check we do not exceed ma value!
    return clearTextBigIntList[0];
  }

  public async decryptEbytes(fhevmType: FhevmTypeEbytes, handleBytes32: BigNumberish): Promise<string> {
    if (!isFhevmEbytes(fhevmType)) {
      throw new HardhatFhevmError(`Invalid FhevmType argument. Expecting bytes type.`);
    }
    const handleBytes32Hex = EthersT.toBeHex(handleBytes32, 32);
    FhevmHandle.verify(handleBytes32Hex, { fhevmType, chainId: this.#fhevmEnv.ethersProvider.chainId });

    const clearTextHexList: string[] = await relayer.requestFhevmGetClearText(this.#fhevmEnv.hre.ethers.provider, [
      handleBytes32Hex,
    ]);
    assertHHFhevm(clearTextHexList.length === 1);
    const clearTextBigIntList: bigint[] = clearTextHexList.map(EthersT.toBigInt);

    const ebytesBigInt: bigint = clearTextBigIntList[0];
    const fhevmTypeInfo = getFhevmTypeInfo(fhevmType);
    assertHHFhevm(fhevmTypeInfo.clearTextBitLength % 8 === 0);
    return EthersT.toBeHex(ebytesBigInt, fhevmTypeInfo.clearTextBitLength / 8);
  }

  public async decryptEaddress(handleBytes32: BigNumberish): Promise<string> {
    const handleBytes32Hex = EthersT.toBeHex(handleBytes32, 32);
    FhevmHandle.verify(handleBytes32Hex, {
      fhevmType: FhevmType.eaddress,
      chainId: this.#fhevmEnv.ethersProvider.chainId,
    });

    const clearTextHexList: string[] = await relayer.requestFhevmGetClearText(this.#fhevmEnv.hre.ethers.provider, [
      handleBytes32Hex,
    ]);
    assertHHFhevm(clearTextHexList.length === 1);
    const clearTextBigIntList: bigint[] = clearTextHexList.map(EthersT.toBigInt);
    const eaddressBigInt: bigint = clearTextBigIntList[0];

    return EthersT.getAddress(EthersT.toBeHex(eaddressBigInt, 20));
  }
}
