import { ethers as EthersT } from "ethers";

import constants from "../../constants.js";
import type { EIP712Domain, EthersEIP712 } from "../../ethers/eip712.js";
import { multiSignEIP712 } from "../../ethers/eip712.js";
import type { ClearValues } from "../../relayer-sdk/types.js";
import { assertIsAddress, assertIsAddressArray } from "../../utils/address.js";
import { assertIsBytes32String } from "../../utils/bytes.js";
import { FhevmError, assertFhevm, assertIsArray } from "../../utils/error.js";
import { assertIsBigUint8, assertIsBigUint256 } from "../../utils/math.js";
import { assertIs0xString, assertIsString } from "../../utils/string.js";
import { FhevmHandle } from "../FhevmHandle.js";
import { FhevmType, type FhevmTypeInfo } from "../FhevmType.js";
import { FhevmHostContractWrapper } from "./FhevmContractWrapper.js";
import { KMSVerifierPartialInterface } from "./interfaces/KMSVerifier.itf.js";

export type KMSVerifierProperties = {
  signersAddresses?: `0x${string}`[];
  signers?: EthersT.Signer[];
  threshold?: number;
  eip712Domain?: EIP712Domain;
};

// Shareable
export class KMSVerifier extends FhevmHostContractWrapper {
  #kmsVerifierReadonlyContract: EthersT.Contract | undefined;
  #kmsVerifierContractAddress: `0x${string}` | undefined;
  // Warning! kms signers are ordered! kms server partyId = index + 1
  #orderedSignersAddresses: `0x${string}`[] | undefined;
  #orderedSigners: EthersT.Signer[] | undefined;
  #threshold: number | undefined;
  #eip712Domain: EIP712Domain | undefined;

  constructor() {
    super("KMSVerifier");
  }

  public static async create(
    runner: EthersT.ContractRunner,
    kmsVerifierContractAddress: `0x${string}`,
    abi?: EthersT.Interface | EthersT.InterfaceAbi,
    properties?: KMSVerifierProperties,
  ): Promise<KMSVerifier> {
    assertIsAddress(kmsVerifierContractAddress, "kmsVerifierContractAddress");

    const kmsVerifier = new KMSVerifier();
    kmsVerifier.#kmsVerifierContractAddress = kmsVerifierContractAddress;
    kmsVerifier.#kmsVerifierReadonlyContract = new EthersT.Contract(
      kmsVerifierContractAddress,
      abi ?? KMSVerifierPartialInterface,
      runner,
    );
    kmsVerifier.#eip712Domain = properties?.eip712Domain;
    kmsVerifier.#orderedSignersAddresses = properties?.signersAddresses ? [...properties.signersAddresses] : undefined;
    kmsVerifier.#orderedSigners = properties?.signers ? [...properties.signers] : undefined;
    kmsVerifier.#threshold = properties?.threshold;

    await kmsVerifier._initialize();
    return kmsVerifier;
  }

  public get kmsVerifierProperties(): KMSVerifierProperties {
    return {
      ...(this.#eip712Domain ? { eip712Domain: { ...this.#eip712Domain } } : {}),
      ...(this.#orderedSignersAddresses ? { signersAddresses: [...this.#orderedSignersAddresses] } : {}),
      ...(this.#orderedSigners ? { signers: [...this.#orderedSigners] } : {}),
      ...(this.#threshold !== undefined ? { threshold: this.#threshold } : {}),
    };
  }

  public override get readonlyContract(): EthersT.Contract {
    assertFhevm(this.#kmsVerifierReadonlyContract !== undefined, `KMSVerifier wrapper is not initialized`);
    return this.#kmsVerifierReadonlyContract;
  }

  public override get interface(): EthersT.Interface {
    assertFhevm(this.#kmsVerifierReadonlyContract !== undefined, `KMSVerifier wrapper is not yet initialized`);
    return this.#kmsVerifierReadonlyContract.interface;
  }

  private async _initialize() {
    assertFhevm(this.#kmsVerifierReadonlyContract !== undefined, `KMSVerifier wrapper is not initialized`);

    if (!this.#orderedSignersAddresses) {
      const signers = await this.#kmsVerifierReadonlyContract.getKmsSigners();
      this.#orderedSignersAddresses = signers;
    }
    assertIsAddressArray(this.#orderedSignersAddresses);

    if (this.#threshold === undefined) {
      const threshold = await this.#kmsVerifierReadonlyContract.getThreshold();
      assertIsBigUint8(threshold);
      this.#threshold = Number(threshold);
    }

    if (this.#eip712Domain === undefined) {
      // ignore extensions
      const eip712Domain = await this.#kmsVerifierReadonlyContract.eip712Domain();
      assertFhevm(eip712Domain.length === 7);
      assertIsString(eip712Domain[0], "eip712Domain[0]");
      assertIsString(eip712Domain[1], "eip712Domain[1]");
      assertIsString(eip712Domain[2], "eip712Domain[2]");
      assertIsBigUint256(eip712Domain[3], "eip712Domain[3]");
      assertIsAddress(eip712Domain[4], "eip712Domain[4]");
      assertIsBytes32String(eip712Domain[5], "eip712Domain[5]");

      this.#eip712Domain = {
        fields: Number(BigInt(eip712Domain[0])),
        name: eip712Domain[1],
        version: eip712Domain[2],
        chainId: eip712Domain[3],
        verifyingContract: eip712Domain[4],
        salt: eip712Domain[5],
        // last field is ignored
      };
    }

    // Add extra checks (in case EIP712 are chanbging)
    assertFhevm(this.#eip712Domain.fields === Number(0x0f));
    assertFhevm(this.#eip712Domain.salt === EthersT.ZeroHash);
    assertFhevm(this.#eip712Domain.name === constants.PUBLIC_DECRYPT_EIP712.domain.name);
    assertFhevm(this.#eip712Domain.version === constants.PUBLIC_DECRYPT_EIP712.domain.version);

    this._reorderKmsSigners();
  }

  private async _reorderKmsSigners() {
    assertFhevm(this.#orderedSignersAddresses);

    // check for duplicates in #orderedSignersAddresses
    const orderedAddresses: Set<string> = new Set();
    for (let i = 0; i < this.#orderedSignersAddresses.length; ++i) {
      const addr = this.#orderedSignersAddresses[i];
      if (orderedAddresses.has(addr)) {
        throw new FhevmError(`Duplicated kms signer address ${addr}`);
      }
      orderedAddresses.add(addr);
    }

    // reorder signers and verify addresses
    if (!this.#orderedSigners) {
      return;
    }

    const addressSignerPairs = await Promise.all(
      this.#orderedSigners.map(async (signer: EthersT.Signer) => {
        const addr = await signer.getAddress();
        return { addr, signer };
      }),
    );

    const signersMap: Map<string, EthersT.Signer> = new Map();
    for (const { addr, signer } of addressSignerPairs) {
      if (signersMap.has(addr)) {
        throw new FhevmError(`Duplicated kms signer address ${addr}`);
      }
      signersMap.set(addr, signer);
    }

    const newOrderedSigners: EthersT.Signer[] = [];
    for (let i = 0; i < this.#orderedSignersAddresses.length; ++i) {
      const addr = this.#orderedSignersAddresses[i];
      if (!signersMap.has(addr)) {
        throw new FhevmError(`Missing kms signer ${addr}`);
      }
      const s = signersMap.get(addr);
      if (!s) {
        throw new FhevmError(`Missing kms signer ${addr}`);
      }
      newOrderedSigners.push(s);
    }

    this.#orderedSigners = newOrderedSigners;
  }

  public get address(): `0x${string}` {
    assertFhevm(this.#kmsVerifierContractAddress !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#kmsVerifierContractAddress;
  }

  // The KMSVerifier is always using the gatewayChainId in its eip712 domain
  public get gatewayChainId(): bigint {
    assertFhevm(this.#eip712Domain !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#eip712Domain.chainId;
  }

  // The KMSVerifier is always using the address of the "Decryption.sol" contract deployed
  // on the gateway chainId in its eip712 domain
  public get gatewayDecryptionAddress(): `0x${string}` {
    assertFhevm(this.#eip712Domain !== undefined, `KMSVerifier wrapper not initialized`);
    assertIsAddress(this.#eip712Domain.verifyingContract, "KMSVerifier.eip712Domain.verifyingContract");
    return this.#eip712Domain.verifyingContract;
  }

  public get eip712Domain(): EIP712Domain {
    assertFhevm(this.#eip712Domain !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#eip712Domain;
  }

  public getKmsSignersAddresses(): `0x${string}`[] {
    assertFhevm(this.#orderedSignersAddresses !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#orderedSignersAddresses;
  }

  public getKmsSigners(): EthersT.Signer[] | undefined {
    // Check for init using #orderedSignersAddresses since #orderedSigners can be undefined
    assertFhevm(this.#orderedSignersAddresses !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#orderedSigners;
  }

  public async assertMatchKmsSigners(signers: EthersT.Signer[]) {
    const addresses = this.getKmsSignersAddresses();

    assertIsArray(signers, "signers");
    assertFhevm(signers.length === addresses.length, "signers.length === addresses.length");

    for (let i = 0; i < addresses.length; ++i) {
      const s = await signers[i].getAddress();
      assertFhevm(addresses[i] === s, `addresses[${i}] === await signers[${i}].getAddress()`);
    }
  }

  public getThreshold(): number {
    assertFhevm(this.#threshold !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#threshold;
  }

  public createPublicDecryptVerificationEIP712(
    handlesBytes32List: EthersT.BigNumberish[],
    decryptedResult: string,
    extraData: string,
  ): EthersEIP712 {
    const domain = this.eip712Domain;
    const eip712: EthersEIP712 = {
      domain: {
        chainId: domain.chainId,
        name: domain.name,
        version: domain.version,
        verifyingContract: domain.verifyingContract,
      },
      types: constants.PUBLIC_DECRYPT_EIP712.types,
      message: {
        ctHandles: handlesBytes32List,
        decryptedResult: decryptedResult,
        extraData,
      },
    };

    return eip712;
  }

  static abiEncodeClearValues(clearValues: ClearValues) {
    const handlesBytes32Hex = Object.keys(clearValues);
    const fhevmHandles: FhevmHandle[] = handlesBytes32Hex.map((handleBytes32Hex) =>
      FhevmHandle.fromBytes32Hex(handleBytes32Hex),
    );

    const abiTypes: string[] = [];
    const abiValues: (string | bigint)[] = [];

    for (let i = 0; i < handlesBytes32Hex.length; ++i) {
      const handle = handlesBytes32Hex[i];

      let clearTextValue: string | bigint | boolean = clearValues[handle as keyof typeof clearValues];
      if (typeof clearTextValue === "boolean") {
        clearTextValue = clearTextValue ? "0x01" : "0x00";
      }

      const clearTextValueBigInt = BigInt(clearTextValue);
      const fhevmTypeInfo: FhevmTypeInfo = fhevmHandles[i].fhevmTypeInfo;

      //abiTypes.push(fhevmTypeInfo.solidityTypeName);
      abiTypes.push("uint256");

      switch (fhevmTypeInfo.type) {
        case FhevmType.eaddress: {
          // string
          abiValues.push(`0x${clearTextValueBigInt.toString(16).padStart(40, "0")}`);
          break;
        }
        case FhevmType.ebool: {
          // bigint (0 or 1)
          assertFhevm(clearTextValueBigInt === 0n || clearTextValueBigInt === 1n);
          abiValues.push(clearTextValueBigInt);
          break;
        }
        case FhevmType.euint4:
        case FhevmType.euint8:
        case FhevmType.euint16:
        case FhevmType.euint32:
        case FhevmType.euint64:
        case FhevmType.euint128:
        case FhevmType.euint256: {
          // bigint
          abiValues.push(clearTextValueBigInt);
          break;
        }
        default: {
          throw new FhevmError(
            `Unsupported Fhevm primitive type id: ${fhevmTypeInfo.type}, name: ${fhevmTypeInfo.name}, solidity: ${fhevmTypeInfo.solidityTypeName}`,
          );
        }
      }
    }

    const abiCoder = EthersT.AbiCoder.defaultAbiCoder();

    // ABI encode the decryptedResult as done in the KMS, since all decrypted values
    // are native static types, thay have same abi-encoding as uint256:
    const abiEncodedClearValues: `0x${string}` = abiCoder.encode(abiTypes, abiValues) as `0x${string}`;

    return {
      abiTypes,
      abiValues,
      abiEncodedClearValues,
    };
  }

  static buildDecryptionProof(kmsSignatures: `0x${string}`[], extraData: `0x${string}`) {
    // Build the decryptionProof as numSigners + KMS signatures + extraData
    const packedNumSigners = EthersT.solidityPacked(["uint8"], [kmsSignatures.length]);
    const packedSignatures = EthersT.solidityPacked(Array(kmsSignatures.length).fill("bytes"), kmsSignatures);
    const decryptionProof: `0x${string}` = EthersT.concat([
      packedNumSigners,
      packedSignatures,
      extraData,
    ]) as `0x${string}`;
    return decryptionProof;
  }

  async computeDecryptionSignatures(
    handlesBytes32Hex: string[],
    clearTextValues: (string | bigint | boolean)[],
    extraData: string,
  ): Promise<{
    signatures: string[];
    types: ReadonlyArray<string | EthersT.ParamType>;
    values: ReadonlyArray<any>;
    decryptionProof: `0x${string}`;
    abiEncodedClearResult: `0x${string}`;
  }> {
    if (!this.#orderedSigners) {
      throw new FhevmError(`Missing Kms signers. Unable to compute decryption signature`);
    }
    const fhevmHandles: FhevmHandle[] = handlesBytes32Hex.map((handleBytes32Hex) =>
      FhevmHandle.fromBytes32Hex(handleBytes32Hex),
    );

    assertFhevm(handlesBytes32Hex.length === clearTextValues.length);

    const abiTypes: string[] = [];
    const abiValues: (string | bigint)[] = [];

    for (let i = 0; i < handlesBytes32Hex.length; ++i) {
      let clearTextValue: string | bigint | boolean = clearTextValues[i];
      if (typeof clearTextValue === "boolean") {
        clearTextValue = clearTextValue ? "0x01" : "0x00";
      }
      const clearTextValueBigInt = BigInt(clearTextValue);
      const fhevmTypeInfo: FhevmTypeInfo = fhevmHandles[i].fhevmTypeInfo;

      //abiTypes.push(fhevmTypeInfo.solidityTypeName);
      abiTypes.push("uint256");

      switch (fhevmTypeInfo.type) {
        case FhevmType.eaddress: {
          // string
          abiValues.push(`0x${clearTextValueBigInt.toString(16).padStart(40, "0")}`);
          break;
        }
        case FhevmType.ebool: {
          // bigint (0 or 1)
          abiValues.push(clearTextValueBigInt);
          break;
        }
        case FhevmType.euint4:
        case FhevmType.euint8:
        case FhevmType.euint16:
        case FhevmType.euint32:
        case FhevmType.euint64:
        case FhevmType.euint128:
        case FhevmType.euint256: {
          // bigint
          abiValues.push(clearTextValueBigInt);
          break;
        }
        default: {
          throw new FhevmError(
            `Unsupported Fhevm primitive type id: ${fhevmTypeInfo.type}, name: ${fhevmTypeInfo.name}, solidity: ${fhevmTypeInfo.solidityTypeName}`,
          );
        }
      }
    }

    const abiCoder = EthersT.AbiCoder.defaultAbiCoder();

    // ABI encode the decryptedResult as done in the KMS, since all decrypted values
    // are native static types, thay have same abi-encoding as uint256:
    const abiEncodedClearResult: `0x${string}` = abiCoder.encode(abiTypes, abiValues) as `0x${string}`;

    const eip712 = this.createPublicDecryptVerificationEIP712(handlesBytes32Hex, abiEncodedClearResult, extraData);

    const clearResultsEIP712signatures: `0x${string}`[] = await multiSignEIP712(
      this.#orderedSigners,
      eip712.domain,
      eip712.types,
      eip712.message,
    );

    // Build the decryptionProof as numSigners + KMS signatures + extraData
    const packedNumSigners = EthersT.solidityPacked(["uint8"], [clearResultsEIP712signatures.length]);
    const packedSignatures = EthersT.solidityPacked(
      Array(clearResultsEIP712signatures.length).fill("bytes"),
      clearResultsEIP712signatures,
    );
    const decryptionProof: `0x${string}` = EthersT.concat([
      packedNumSigners,
      packedSignatures,
      extraData,
    ]) as `0x${string}`;

    // ABI encode the list of values in order to pass them in the callback
    for (let i = 0; i < abiTypes.length; ++i) {
      assertFhevm(abiTypes[i] === "uint256");
    }

    assertIs0xString(decryptionProof, "decryptionProof");
    assertIs0xString(abiEncodedClearResult, "abiEncodedClearResult");

    return {
      signatures: clearResultsEIP712signatures,
      types: abiTypes,
      values: abiValues,
      abiEncodedClearResult,
      decryptionProof,
    };
  }
}

// async function __computeDecryptionSignatures(
//   handlesBytes32Hex: string[],
//   clearTextValues: (string | bigint | boolean)[],
//   extraData: string,
//   abiCoder: EthersT.AbiCoder,
//   kmsVerifier: KMSVerifier,
//   kmsSigners: EthersT.Signer[],
// ): Promise<{
//   signatures: string[];
//   types: ReadonlyArray<string | EthersT.ParamType>;
//   values: ReadonlyArray<any>;
//   decryptedResult: string;
// }> {
//   const fhevmHandles: FhevmHandle[] = handlesBytes32Hex.map((handleBytes32Hex) =>
//     FhevmHandle.fromBytes32Hex(handleBytes32Hex),
//   );

//   assertFhevm(handlesBytes32Hex.length === clearTextValues.length);

//   const abiTypes: string[] = [];
//   const abiValues: (string | bigint)[] = [];

//   for (let i = 0; i < handlesBytes32Hex.length; ++i) {
//     let clearTextValue: string | bigint | boolean = clearTextValues[i];
//     if (typeof clearTextValue === "boolean") {
//       clearTextValue = clearTextValue ? "0x01" : "0x00";
//     }
//     const clearTextValueBigInt = BigInt(clearTextValue);
//     const fhevmTypeInfo: FhevmTypeInfo = fhevmHandles[i].fhevmTypeInfo;

//     //abiTypes.push(fhevmTypeInfo.solidityTypeName);
//     abiTypes.push("uint256");

//     switch (fhevmTypeInfo.type) {
//       case FhevmType.eaddress: {
//         // string
//         abiValues.push(`0x${clearTextValueBigInt.toString(16).padStart(40, "0")}`);
//         break;
//       }
//       case FhevmType.ebool: {
//         // bigint (0 or 1)
//         abiValues.push(clearTextValueBigInt);
//         break;
//       }
//       case FhevmType.euint4:
//       case FhevmType.euint8:
//       case FhevmType.euint16:
//       case FhevmType.euint32:
//       case FhevmType.euint64:
//       case FhevmType.euint128:
//       case FhevmType.euint256: {
//         // bigint
//         abiValues.push(clearTextValueBigInt);
//         break;
//       }
//       default: {
//         throw new FhevmError(
//           `Unsupported Fhevm primitive type id: ${fhevmTypeInfo.type}, name: ${fhevmTypeInfo.name}, solidity: ${fhevmTypeInfo.solidityTypeName}`,
//         );
//       }
//     }
//   }

//   // ABI encode the decryptedResult as done in the KMS, since all decrypted values
//   // are native static types, thay have same abi-encoding as uint256:
//   const decryptedResult = abiCoder.encode(abiTypes, abiValues);

//   const eip712 = kmsVerifier.createPublicDecryptVerificationEIP712(handlesBytes32Hex, decryptedResult, extraData);

//   const decryptResultsEIP712signatures: string[] = await multiSignEIP712(
//     kmsSigners,
//     eip712.domain,
//     eip712.types,
//     eip712.message,
//   );

//   return { signatures: decryptResultsEIP712signatures, types: abiTypes, values: abiValues, decryptedResult };
// }

// async function __computeDecryptionCallbackSignaturesAndCalldata(
//   handlesBytes32Hex: string[],
//   clearTextValuesString: string[],
//   extraData: string,
//   requestID: bigint,
//   callbackSelectorBytes4Hex: string,
//   abiCoder: EthersT.AbiCoder,
//   kmsVerifier: KMSVerifier,
//   kmsSigners: EthersT.Signer[],
// ): Promise<{ calldata: string }> {
//   assertFhevm(extraData === EthersT.solidityPacked(["uint8"], [0]), "extraData must be 0x00");

//   const { signatures, types, values } = await __computeDecryptionSignatures(
//     handlesBytes32Hex,
//     clearTextValuesString,
//     extraData,
//     abiCoder,
//     kmsVerifier,
//     kmsSigners,
//   );

//   // Build the decryptionProof as numSigners + KMS signatures + extraData
//   const packedNumSigners = EthersT.solidityPacked(["uint8"], [signatures.length]);
//   const packedSignatures = EthersT.solidityPacked(Array(signatures.length).fill("bytes"), signatures);
//   const decryptionProof = EthersT.concat([packedNumSigners, packedSignatures, extraData]);

//   // ABI encode the list of values in order to pass them in the callback
//   for (let i = 0; i < types.length; ++i) {
//     assertFhevm(types[i] === "uint256");
//   }

//   const encodedCleartexts = abiCoder.encode([...types], [...values]);

//   const calldata =
//     callbackSelectorBytes4Hex +
//     abiCoder.encode(["uint256", "bytes", "bytes"], [requestID, encodedCleartexts, decryptionProof]).slice(2);

//   return { calldata };
// }
