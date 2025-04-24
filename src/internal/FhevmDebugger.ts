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
      return this.#fhevmEnv.hre.ethers.toBeHex(ebytesBigInt, fhevmTypeInfo.clearTextBitLength);
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

// const EBOOL_T = 0;
// const EUINT4_T = 1;
// const EUINT8_T = 2;
// const EUINT16_T = 3;
// const EUINT32_T = 4;
// const EUINT64_T = 5;
// const EUINT128_T = 6;
// const EUINT160_T = 7; // @dev It is the one for eaddresses.
// const EUINT256_T = 8;
// const EBYTES64_T = 9;
// const EBYTES128_T = 10;
// const EBYTES256_T = 11;

// function verifyType(handle: bigint, expectedType: number) {
//   if (handle === 0n) {
//     throw "Handle is not initialized";
//   }
//   if (handle.toString(2).length > 256) {
//     throw "Handle is not a bytes32";
//   }
//   const typeCt = handle >> 8n;
//   if (Number(typeCt % 256n) !== expectedType) {
//     throw "Wrong encrypted type for the handle";
//   }
// }

// export const debug = {
//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} a handle to decrypt
//    * @returns {bool}
//    */
//   decryptBool: async (handle: bigint): Promise<boolean> => {
//     verifyType(handle, EBOOL_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return (await getClearText(handle)) === "1";
//     } else {
//       throw Error("The debug.decryptBool function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {bigint}
//    */
//   decrypt4: async (handle: bigint): Promise<bigint> => {
//     verifyType(handle, EUINT4_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return BigInt(await getClearText(handle));
//     } else {
//       throw Error("The debug.decrypt4 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} a handle to decrypt
//    * @returns {bigint}
//    */
//   decrypt8: async (handle: bigint): Promise<bigint> => {
//     verifyType(handle, EUINT8_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return BigInt(await getClearText(handle));
//     } else {
//       throw Error("The debug.decrypt8 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {bigint}
//    */
//   decrypt16: async (handle: bigint): Promise<bigint> => {
//     verifyType(handle, EUINT16_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return BigInt(await getClearText(handle));
//     } else {
//       throw Error("The debug.decrypt16 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {bigint}
//    */
//   decrypt32: async (handle: bigint): Promise<bigint> => {
//     verifyType(handle, EUINT32_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return BigInt(await getClearText(handle));
//     } else {
//       throw Error("The debug.decrypt32 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {bigint}
//    */
//   decrypt64: async (handle: bigint): Promise<bigint> => {
//     verifyType(handle, EUINT64_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return BigInt(await getClearText(handle));
//     } else {
//       throw Error("The debug.decrypt64 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {bigint}
//    */
//   decrypt128: async (handle: bigint): Promise<bigint> => {
//     verifyType(handle, EUINT128_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return BigInt(await getClearText(handle));
//     } else {
//       throw Error("The debug.decrypt128 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {bigint}
//    */
//   decrypt256: async (handle: bigint): Promise<bigint> => {
//     verifyType(handle, EUINT256_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return BigInt(await getClearText(handle));
//     } else {
//       throw Error("The debug.decrypt256 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {string}
//    */
//   decryptAddress: async (handle: bigint): Promise<string> => {
//     verifyType(handle, EUINT160_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       const bigintAdd = BigInt(await getClearText(handle));
//       const handleStr = "0x" + bigintAdd.toString(16).padStart(40, "0");
//       return handleStr;
//     } else {
//       throw Error("The debug.decryptAddress function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} a handle to decrypt
//    * @returns {bigint}
//    */
//   decryptEbytes64: async (handle: bigint): Promise<string> => {
//     verifyType(handle, EBYTES64_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return ethers.toBeHex(await getClearText(handle), 64);
//     } else {
//       throw Error("The debug.decryptEbytes64 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {bigint}
//    */
//   decryptEbytes128: async (handle: bigint): Promise<string> => {
//     verifyType(handle, EBYTES128_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return ethers.toBeHex(await getClearText(handle), 128);
//     } else {
//       throw Error("The debug.decryptEbytes128 function can only be called in mocked mode");
//     }
//   },

//   /**
//    * @debug
//    * This function is intended for debugging purposes only.
//    * It cannot be used in production code, since it requires the FHE private key for decryption.
//    * In production, decryption is only possible via an asyncronous on-chain call to the Gateway.
//    *
//    * @param {bigint} handle to decrypt
//    * @returns {bigint}
//    */
//   decryptEbytes256: async (handle: bigint): Promise<string> => {
//     verifyType(handle, EBYTES256_T);
//     if (network.name === "hardhat") {
//       await awaitCoprocessor();
//       return ethers.toBeHex(await getClearText(handle), 256);
//     } else {
//       throw Error("The debug.decryptEbytes256 function can only be called in mocked mode");
//     }
//   },
// };
