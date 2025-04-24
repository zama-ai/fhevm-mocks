// import { FhevmInstance } from "@fhevm/sdk/node";
// import { HardhatRuntimeEnvironment } from "hardhat/types";

// import { Signers } from "./signers";

// ////////////////////////////////////////////////////////////////////////////////

// export const createInstance = async (hre?: HardhatRuntimeEnvironment): Promise<FhevmInstance> => {
//   if (hre === undefined) {
//     hre = await import("hardhat");
//   }
//   return await hre.fhevm.createInstance();
// };

// export interface FhevmInstances {
//   alice: FhevmInstance;
//   bob: FhevmInstance;
//   carol: FhevmInstance;
//   dave: FhevmInstance;
//   eve: FhevmInstance;
// }

// export const createInstances = async (accounts: Signers, hre?: HardhatRuntimeEnvironment): Promise<FhevmInstances> => {
//   if (hre === undefined) {
//     hre = await import("hardhat");
//   }

//   // Create instance
//   const instances: FhevmInstances = {} as FhevmInstances;
//   if (hre.network.name === "hardhat") {
//     await Promise.all(
//       Object.keys(accounts).map(async (k) => {
//         instances[k as keyof FhevmInstances] = await createInstance(hre);
//       }),
//     );
//   } else {
//     await Promise.all(
//       Object.keys(accounts).map(async (k) => {
//         instances[k as keyof FhevmInstances] = await createInstance();
//       }),
//     );
//   }
//   return instances;
// };

// ////////////////////////////////////////////////////////////////////////////////

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bool}
// //  */
// // export const decryptBool = async (handle: string): Promise<boolean> => {
// //   const hre: HardhatRuntimeEnvironment = await import("hardhat");

// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return (await getClearText(handle)) === '1';
// //   } else {
// //     return getDecryptor().decryptBool(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decrypt8 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decrypt8(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decrypt16 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decrypt16(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decrypt32 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decrypt32(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decrypt64 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decrypt64(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decrypt128 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decrypt128(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decrypt256 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decrypt256(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {string}
// //  */
// // export const decryptAddress = async (handle: string): Promise<string> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     const bigintAdd = BigInt(await getClearText(handle));
// //     const handleStr = '0x' + bigintAdd.toString(16).padStart(40, '0');
// //     return handleStr;
// //   } else {
// //     return getDecryptor().decryptAddress(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decryptEbytes64 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decryptEbytes64(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decryptEbytes128 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decryptEbytes128(await getCiphertext(handle, ethers));
// //   }
// // };

// // /**
// //  * @debug
// //  * This function is intended for debugging purposes only.
// //  * It cannot be used in production code, since it requires the FHE private key for decryption.
// //  * In production, decryption is only possible via an asyncronous on-chain call to the Decryption Oracle.
// //  *
// //  * @param {bigint} a handle to decrypt
// //  * @returns {bigint}
// //  */
// // export const decryptEbytes256 = async (handle: string): Promise<bigint> => {
// //   if (network.name === 'hardhat') {
// //     await awaitCoprocessor();
// //     return BigInt(await getClearText(handle));
// //   } else {
// //     return getDecryptor().decryptEbytes256(await getCiphertext(handle, ethers));
// //   }
// // };
