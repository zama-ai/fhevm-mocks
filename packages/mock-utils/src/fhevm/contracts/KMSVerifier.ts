import { ethers as EthersT } from "ethers";

import constants from "../../constants.js";
import type { EIP712Domain, EthersEIP712 } from "../../ethers/eip712.js";
import { multiSignEIP712 } from "../../ethers/eip712.js";
import { assertIsAddress, assertIsAddressArray } from "../../utils/address.js";
import { assertIsBytes32String } from "../../utils/bytes.js";
import { FhevmError, assertFhevm, assertIsArray } from "../../utils/error.js";
import { assertIsBigUint8, assertIsBigUint256 } from "../../utils/math.js";
import { assertIsString } from "../../utils/string.js";
import { FhevmHandle } from "../FhevmHandle.js";
import { FhevmType, type FhevmTypeInfo } from "../FhevmType.js";
import { FhevmCoprocessorContractWrapper } from "./FhevmContractWrapper.js";
import { KMSVerifierPartialInterface } from "./interfaces/KMSVerifier.itf.js";

export type KMSVerifierProperties = {
  signersAddresses?: string[];
  threshold?: number;
  eip712Domain?: EIP712Domain;
};

// Shareable
export class KMSVerifier extends FhevmCoprocessorContractWrapper {
  #kmsVerifierContract: EthersT.Contract | undefined;
  #kmsVerifierContractAddress: string | undefined;
  #signersAddresses: string[] | undefined;
  #threshold: number | undefined;
  #eip712Domain: EIP712Domain | undefined;

  constructor() {
    super("KMSVerifier");
  }

  public static async create(
    runner: EthersT.ContractRunner,
    kmsVerifierContractAddress: string,
    abi?: EthersT.Interface | EthersT.InterfaceAbi,
    properties?: KMSVerifierProperties,
  ): Promise<KMSVerifier> {
    assertIsAddress(kmsVerifierContractAddress, "kmsVerifierContractAddress");

    if (properties !== undefined) {
      throw new FhevmError("Not yet implemented");
    }

    const kmsVerifier = new KMSVerifier();
    kmsVerifier.#kmsVerifierContractAddress = kmsVerifierContractAddress;
    kmsVerifier.#kmsVerifierContract = new EthersT.Contract(
      kmsVerifierContractAddress,
      abi ?? KMSVerifierPartialInterface,
      runner,
    );
    await kmsVerifier._initialize();
    return kmsVerifier;
  }

  public override get readonlyContract(): EthersT.Contract {
    assertFhevm(this.#kmsVerifierContract !== undefined, `KMSVerifier wrapper is not initialized`);
    return this.#kmsVerifierContract;
  }

  public override get interface(): EthersT.Interface {
    assertFhevm(this.#kmsVerifierContract !== undefined, `KMSVerifier wrapper is not yet initialized`);
    return this.#kmsVerifierContract.interface;
  }

  private async _initialize() {
    assertFhevm(this.#kmsVerifierContract !== undefined, `KMSVerifier wrapper is not initialized`);
    assertFhevm(this.#signersAddresses === undefined, `KMSVerifier wrapper already initialized`);
    assertFhevm(this.#threshold === undefined, `KMSVerifier wrapper already initialized`);

    const signers = await this.#kmsVerifierContract.getKmsSigners();
    assertIsAddressArray(signers);
    this.#signersAddresses = signers;

    const threshold = await this.#kmsVerifierContract.getThreshold();
    assertIsBigUint8(threshold);
    this.#threshold = Number(threshold);

    if (this.#eip712Domain === undefined) {
      // ignore extensions
      const eip712Domain = await this.#kmsVerifierContract.eip712Domain();
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
  }

  public get address(): string {
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
  public get gatewayDecryptionAddress(): string {
    assertFhevm(this.#eip712Domain !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#eip712Domain.verifyingContract;
  }

  public get eip712Domain(): EIP712Domain {
    assertFhevm(this.#eip712Domain !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#eip712Domain;
  }

  public getKmsSignersAddresses(): string[] {
    assertFhevm(this.#signersAddresses !== undefined, `KMSVerifier wrapper not initialized`);
    return this.#signersAddresses;
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
}

export async function computeDecryptionSignatures(
  handlesBytes32Hex: string[],
  clearTextValues: (string | bigint | boolean)[],
  extraData: string,
  abiCoder: EthersT.AbiCoder,
  kmsVerifier: KMSVerifier,
  kmsSigners: EthersT.Signer[],
): Promise<{
  signatures: string[];
  types: ReadonlyArray<string | EthersT.ParamType>;
  values: ReadonlyArray<any>;
  decryptedResult: string;
}> {
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

    abiTypes.push(fhevmTypeInfo.solidityTypeName);

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
      case FhevmType.ebytes64: {
        // string
        abiValues.push(`0x${clearTextValueBigInt.toString(16).padStart(128, "0")}`);
        break;
      }
      case FhevmType.ebytes128: {
        // string
        abiValues.push(`0x${clearTextValueBigInt.toString(16).padStart(256, "0")}`);
        break;
      }
      case FhevmType.ebytes256: {
        // string
        abiValues.push(`0x${clearTextValueBigInt.toString(16).padStart(512, "0")}`);
        break;
      }
      default: {
        throw new FhevmError(
          `Unsupported Fhevm primitive type id: ${fhevmTypeInfo.type}, name: ${fhevmTypeInfo.name}, solidity: ${fhevmTypeInfo.solidityTypeName}`,
        );
      }
    }
  }

  // 1. 31 is just a dummy uint256 requestID to get correct abi encoding for the remaining arguments
  //    (i.e everything except the requestID)
  // 2. Adding also a dummy empty array of bytes for correct abi-encoding when used with signatures
  const encodedData = abiCoder.encode(["uint256", ...abiTypes, "bytes[]"], [31, ...abiValues, []]);

  // 1. We pop the dummy requestID to get the correct value to pass for `decryptedCts`
  // 2. We also pop the last 32 bytes (empty bytes[])
  const decryptedResult = "0x" + encodedData.slice(66).slice(0, -64);
  assertFhevm(
    decryptedResult === "0x" + encodedData.slice(66, -64),
    "decryptedResult === '0x' + encodedData.slice(66, -64)",
  );

  const eip712 = kmsVerifier.createPublicDecryptVerificationEIP712(handlesBytes32Hex, decryptedResult, extraData);

  const decryptResultsEIP712signatures: string[] = await multiSignEIP712(
    kmsSigners,
    eip712.domain,
    eip712.types,
    eip712.message,
  );

  return { signatures: decryptResultsEIP712signatures, types: abiTypes, values: abiValues, decryptedResult };
}

export async function computeDecryptionCallbackSignaturesAndCalldata(
  handlesBytes32Hex: string[],
  clearTextValuesString: string[],
  extraData: string,
  requestID: bigint,
  callbackSelectorBytes4Hex: string,
  abiCoder: EthersT.AbiCoder,
  kmsVerifier: KMSVerifier,
  kmsSigners: EthersT.Signer[],
): Promise<{ calldata: string }> {
  assertFhevm(extraData === EthersT.solidityPacked(["uint8"], [0]), "extraData must be 0x00");

  const { signatures, types, values } = await computeDecryptionSignatures(
    handlesBytes32Hex,
    clearTextValuesString,
    extraData,
    abiCoder,
    kmsVerifier,
    kmsSigners,
  );

  // Build the decryptionProof as numSigners + KMS signatures + extraData
  const packedNumSigners = EthersT.solidityPacked(["uint8"], [signatures.length]);
  const packedSignatures = EthersT.solidityPacked(Array(signatures.length).fill("bytes"), signatures);
  const decryptionProof = EthersT.concat([packedNumSigners, packedSignatures, extraData]);

  // ABI encode the list of values in order to pass them in the callback
  const encodedCleartexts = abiCoder.encode([...types], [...values]);

  const calldata =
    callbackSelectorBytes4Hex +
    abiCoder.encode(["uint256", "bytes", "bytes"], [requestID, encodedCleartexts, decryptionProof]).slice(2);

  return { calldata };
}
