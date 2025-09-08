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

import { HardhatFhevmError } from "../error";
import type { HardhatFhevmRuntimeDebugger } from "../types";
import type { FhevmEnvironment } from "./FhevmEnvironment";
import { assertHHFhevm } from "./error";

// TODO transfer FhevmDebugger to mock utils
export class FhevmDebugger implements HardhatFhevmRuntimeDebugger {
  #fhevmEnv: FhevmEnvironment;

  constructor(fhevmEnv: FhevmEnvironment) {
    this.#fhevmEnv = fhevmEnv;
  }

  /**
   * TODO: Should be modified. We want a function that returns the list of callback arguments
   */
  public async createDecryptionSignatures(
    handlesBytes32Hex: string[],
    clearTextValues: (bigint | string | boolean)[],
  ): Promise<string[]> {
    const extraDataV0 = EthersT.solidityPacked(["uint8"], [0]);
    const clearTextValuesHex: string[] = [];
    for (let i = 0; i < clearTextValues.length; ++i) {
      const ct = clearTextValues[i];
      if (typeof ct === "boolean") {
        clearTextValuesHex.push(ct ? "0x01" : "0x00");
      } else if (typeof ct === "bigint") {
        clearTextValuesHex.push("0x" + ct.toString(16));
      } else if (typeof ct === "string") {
        clearTextValuesHex.push(ct);
      } else {
        throw new HardhatFhevmError(`Unsupported type ${typeof ct}, expecting bigint | string | boolean`);
      }
    }
    return await relayer.requestFhevmCreateDecryptionSignatures(this.#fhevmEnv.relayerProvider, {
      handlesBytes32Hex,
      clearTextValuesHex,
      extraData: extraDataV0,
    });
  }

  public createHandleCoder(): FhevmHandleCoder {
    return new FhevmHandleCoder(this.#fhevmEnv.getACLAddress(), this.#fhevmEnv.mockProvider.chainId);
  }

  public async decryptEbool(handleBytes32: EthersT.BigNumberish): Promise<boolean> {
    const handleBytes32Hex = EthersT.toBeHex(handleBytes32, 32);
    FhevmHandle.verify(handleBytes32Hex, {
      fhevmType: FhevmType.ebool,
      chainId: this.#fhevmEnv.mockProvider.chainId,
    });

    const clearTextHexList: string[] = await relayer.requestFhevmGetClearText(this.#fhevmEnv.relayerProvider, [
      handleBytes32Hex,
    ]);
    assertHHFhevm(clearTextHexList.length === 1);
    const clearTextBigIntList: bigint[] = clearTextHexList.map(EthersT.toBigInt);
    return clearTextBigIntList[0] === 1n;
  }

  public async decryptEuint(fhevmType: FhevmTypeEuint, handleBytes32: EthersT.BigNumberish): Promise<bigint> {
    if (!isFhevmEuint(fhevmType)) {
      throw new HardhatFhevmError(`Invalid FhevmType argument. Expecting uint type.`);
    }
    const handleBytes32Hex = EthersT.toBeHex(handleBytes32, 32);
    FhevmHandle.verify(handleBytes32Hex, { fhevmType, chainId: this.#fhevmEnv.mockProvider.chainId });

    const clearTextHexList: string[] = await relayer.requestFhevmGetClearText(this.#fhevmEnv.relayerProvider, [
      handleBytes32Hex,
    ]);
    assertHHFhevm(clearTextHexList.length === 1);
    const clearTextBigIntList: bigint[] = clearTextHexList.map(EthersT.toBigInt);

    // Check we do not exceed ma value!
    return clearTextBigIntList[0];
  }

  public async decryptEbytes(fhevmType: FhevmTypeEbytes, handleBytes32: EthersT.BigNumberish): Promise<string> {
    if (!isFhevmEbytes(fhevmType)) {
      throw new HardhatFhevmError(`Invalid FhevmType argument. Expecting bytes type.`);
    }
    const handleBytes32Hex = EthersT.toBeHex(handleBytes32, 32);
    FhevmHandle.verify(handleBytes32Hex, { fhevmType, chainId: this.#fhevmEnv.mockProvider.chainId });

    const clearTextHexList: string[] = await relayer.requestFhevmGetClearText(this.#fhevmEnv.relayerProvider, [
      handleBytes32Hex,
    ]);
    assertHHFhevm(clearTextHexList.length === 1);
    const clearTextBigIntList: bigint[] = clearTextHexList.map(EthersT.toBigInt);

    const ebytesBigInt: bigint = clearTextBigIntList[0];
    const fhevmTypeInfo = getFhevmTypeInfo(fhevmType);
    assertHHFhevm(fhevmTypeInfo.clearTextBitLength % 8 === 0);
    return EthersT.toBeHex(ebytesBigInt, fhevmTypeInfo.clearTextBitLength / 8);
  }

  public async decryptEaddress(handleBytes32: EthersT.BigNumberish): Promise<string> {
    const handleBytes32Hex = EthersT.toBeHex(handleBytes32, 32);
    FhevmHandle.verify(handleBytes32Hex, {
      fhevmType: FhevmType.eaddress,
      chainId: this.#fhevmEnv.mockProvider.chainId,
    });

    const clearTextHexList: string[] = await relayer.requestFhevmGetClearText(this.#fhevmEnv.relayerProvider, [
      handleBytes32Hex,
    ]);
    assertHHFhevm(clearTextHexList.length === 1);
    const clearTextBigIntList: bigint[] = clearTextHexList.map(EthersT.toBigInt);
    const eaddressBigInt: bigint = clearTextBigIntList[0];

    return EthersT.getAddress(EthersT.toBeHex(eaddressBigInt, 20));
  }
}
