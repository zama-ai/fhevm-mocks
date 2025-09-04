import { ethers as EthersT } from "ethers";

import constants from "../../constants.js";
import type { EIP712Domain, EthersEIP712 } from "../../ethers/eip712.js";
import { isThresholdReached } from "../../ethers/eip712.js";
import { assertIsAddress, assertIsAddressArray } from "../../utils/address.js";
import { assertIsBytes32String } from "../../utils/bytes.js";
import { FhevmError, assertFhevm, assertIsArray } from "../../utils/error.js";
import { numberToHexNoPrefix } from "../../utils/hex.js";
import { assertIsBigUint8, assertIsBigUint256 } from "../../utils/math.js";
import { assertIsString, ensure0x, removePrefix } from "../../utils/string.js";
import { FhevmCoprocessorContractWrapper } from "./FhevmContractWrapper.js";
import { InputVerifierPartialInterface } from "./interfaces/InputVerifier.itf.js";

export type InputVerifierProperties = {
  signersAddresses?: string[];
  threshold?: number;
  eip712Domain?: EIP712Domain;
};

// Shareable
export class InputVerifier extends FhevmCoprocessorContractWrapper {
  #inputVerifierReadonlyContract: EthersT.Contract | undefined;
  #inputVerifierContractAddress: string | undefined;
  #signersAddresses: string[] | undefined;
  #threshold: number | undefined;
  #eip712Domain: EIP712Domain | undefined;

  constructor() {
    super("InputVerifier");
  }

  public static async create(
    runner: EthersT.ContractRunner,
    inputVerifierContractAddress: string,
    abi?: EthersT.Interface | EthersT.InterfaceAbi,
    properties?: InputVerifierProperties,
  ): Promise<InputVerifier> {
    assertIsAddress(inputVerifierContractAddress, "inputVerifierContractAddress");

    const inputVerifier = new InputVerifier();
    inputVerifier.#inputVerifierContractAddress = inputVerifierContractAddress;
    inputVerifier.#inputVerifierReadonlyContract = new EthersT.Contract(
      inputVerifierContractAddress,
      abi ?? InputVerifierPartialInterface,
      runner,
    );
    inputVerifier.#eip712Domain = properties?.eip712Domain;
    inputVerifier.#signersAddresses = properties?.signersAddresses;
    inputVerifier.#threshold = properties?.threshold;

    await inputVerifier._initialize();
    return inputVerifier;
  }

  public override get readonlyContract(): EthersT.Contract {
    assertFhevm(this.#inputVerifierReadonlyContract !== undefined, `InputVerifier wrapper is not initialized`);
    return this.#inputVerifierReadonlyContract;
  }

  public override get interface(): EthersT.Interface {
    assertFhevm(this.#inputVerifierReadonlyContract !== undefined, `InputVerifier wrapper is not yet initialized`);
    return this.#inputVerifierReadonlyContract.interface;
  }

  private async _initialize() {
    assertFhevm(this.#inputVerifierReadonlyContract !== undefined, `InputVerifier wrapper is not initialized`);

    if (!this.#signersAddresses) {
      const signers = await this.#inputVerifierReadonlyContract.getCoprocessorSigners();
      this.#signersAddresses = signers;
    }
    assertIsAddressArray(this.#signersAddresses);

    if (this.#threshold === undefined) {
      const threshold = await this.#inputVerifierReadonlyContract.getThreshold();
      assertIsBigUint8(threshold);
      this.#threshold = Number(threshold);
    }

    if (this.#eip712Domain === undefined) {
      // ignore extensions
      const eip712Domain = await this.#inputVerifierReadonlyContract.eip712Domain();

      // Add extra checks (in case EIP712 are changing)
      assertFhevm(eip712Domain.length === 7);
      assertIsString(eip712Domain[0], "eip712Domain[0]");
      assertIsString(eip712Domain[1], "eip712Domain[1]");
      assertIsString(eip712Domain[2], "eip712Domain[2]");
      assertIsBigUint256(eip712Domain[3], "eip712Domain[3]");
      assertIsAddress(eip712Domain[4], "eip712Domain[4]");
      assertIsBytes32String(eip712Domain[5], "eip712Domain[5]");
      assertFhevm(Array.isArray(eip712Domain[6]) && eip712Domain[6].length === 0, "eip712Domain[6]");

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
    assertFhevm(this.#eip712Domain.name === constants.INPUT_VERIFICATION_EIP712.domain.name);
    assertFhevm(this.#eip712Domain.version === constants.INPUT_VERIFICATION_EIP712.domain.version);
  }

  public get address(): string {
    assertFhevm(this.#inputVerifierContractAddress !== undefined, `InputVerifier wrapper not initialized`);
    return this.#inputVerifierContractAddress;
  }

  // The InputVerifier is always using the gatewayChainId in its eip712 domain
  public get gatewayChainId(): bigint {
    assertFhevm(this.#eip712Domain !== undefined, `InputVerifier wrapper not initialized`);
    return this.#eip712Domain.chainId;
  }

  // The InputVerifier is always using the address of the "InputVerification.sol" contract deployed
  // on the gateway chainId in its eip712 domain
  public get gatewayInputVerificationAddress(): string {
    assertFhevm(this.#eip712Domain !== undefined, `InputVerifier wrapper not initialized`);
    return this.#eip712Domain.verifyingContract;
  }

  public get eip712Domain(): EIP712Domain {
    assertFhevm(this.#eip712Domain !== undefined, `InputVerifier wrapper not initialized`);
    return this.#eip712Domain;
  }

  public getCoprocessorSigners(): string[] {
    assertFhevm(this.#signersAddresses !== undefined, `InputVerifier wrapper not initialized`);
    return this.#signersAddresses;
  }

  public getThreshold(): number {
    assertFhevm(this.#threshold !== undefined, `InputVerifier wrapper not initialized`);
    return this.#threshold;
  }

  public async assertMatchCoprocessorSigners(signers: EthersT.Signer[]) {
    const addresses = this.getCoprocessorSigners();

    assertIsArray(signers, "signers");
    assertFhevm(signers.length === addresses.length, "signers.length === addresses.length");

    for (let i = 0; i < addresses.length; ++i) {
      const s = await signers[i].getAddress();
      assertFhevm(addresses[i] === s, `addresses[${i}] === await signers[${i}].getAddress()`);
    }
  }

  public verifySignatures(
    handlesBytes32List: EthersT.BytesLike[],
    userAddress: string,
    contractAddress: string,
    contractChainId: number,
    extraData: string,
    signatures: string[],
  ) {
    assertIsArray(signatures);

    const domain = this.eip712Domain;

    const recoveredAddresses: string[] = signatures.map((signature: string) => {
      const sig = ensure0x(signature);
      const recoveredAddress = EthersT.verifyTypedData(
        {
          name: domain.name,
          version: domain.version,
          chainId: domain.chainId,
          verifyingContract: domain.verifyingContract,
        },
        constants.INPUT_VERIFICATION_EIP712.types,
        {
          ctHandles: handlesBytes32List,
          userAddress,
          contractAddress,
          contractChainId,
          extraData,
        },
        sig,
      );
      return recoveredAddress;
    });

    if (!isThresholdReached(this.getCoprocessorSigners(), recoveredAddresses, this.getThreshold(), "coprocessor")) {
      throw new FhevmError("Coprocessor signers threshold is not reached");
    }
  }

  // See: fhevm-gateway/contracts/InputVerification.sol
  public createCiphertextVerificationEIP712(
    handlesBytes32List: EthersT.BigNumberish[],
    contractChainId: number,
    contractAddress: string,
    userAddress: string,
    extraData: string,
  ): EthersEIP712 {
    assertIsAddress(userAddress, "userAddress");
    assertIsAddress(contractAddress, "contractAddress");

    const domain = this.eip712Domain;

    const eip712: EthersEIP712 = {
      domain: {
        chainId: domain.chainId,
        name: domain.name,
        version: domain.version,
        verifyingContract: domain.verifyingContract,
      },
      types: constants.INPUT_VERIFICATION_EIP712.types,
      message: {
        ctHandles: handlesBytes32List.map((handle) => EthersT.zeroPadValue(EthersT.toBeHex(handle), 32)),
        userAddress: userAddress,
        contractAddress: contractAddress,
        contractChainId: contractChainId,
        extraData,
      },
    };

    return eip712;
  }
}

export function computeInputProofHex(
  handlesBytes32Hex: string[],
  coprocessorsSignaturesHex: string[],
  extraData: string,
): string {
  const numHandles = handlesBytes32Hex.length;
  const numCoprocessorSigners = coprocessorsSignaturesHex.length;

  const numHandlesHexByte1 = numberToHexNoPrefix(numHandles);
  assertFhevm(numHandlesHexByte1.length === 2); // 1 byte

  const numCoprocessorSignersHexByte1 = numberToHexNoPrefix(numCoprocessorSigners);
  assertFhevm(numCoprocessorSignersHexByte1.length === 2); // 1 byte

  // Compute inputProof
  let inputProofHex = "0x" + numHandlesHexByte1 + numCoprocessorSignersHexByte1;

  // Append the list of handles
  for (let i = 0; i < numHandles; ++i) {
    const handlesBytes32HexNoPrefix = removePrefix(handlesBytes32Hex[i], "0x");
    assertFhevm(handlesBytes32HexNoPrefix.length === 2 * 32);
    inputProofHex += handlesBytes32HexNoPrefix;
  }

  // Append list of coprocessor signatures
  coprocessorsSignaturesHex.map((signatureHex) => {
    const signatureBytes65HexNoPrefix = removePrefix(signatureHex, "0x");
    if (signatureBytes65HexNoPrefix.length !== 2 * 65) {
      throw new FhevmError(`Invalid coprocessor signature: ${signatureBytes65HexNoPrefix}. Invalid length.`);
    }
    inputProofHex += signatureBytes65HexNoPrefix;
  });

  // Append the extra data to the input proof
  inputProofHex = EthersT.concat([inputProofHex, extraData]);

  return inputProofHex;
}
