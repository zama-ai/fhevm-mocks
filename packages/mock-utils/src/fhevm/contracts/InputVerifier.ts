import { ethers as EthersT } from "ethers";

import constants from "../../constants.js";
import type { EIP712Domain, EthersEIP712 } from "../../ethers/eip712.js";
import { isThresholdReached } from "../../ethers/eip712.js";
import { assertIsAddress, assertIsAddressArray } from "../../utils/address.js";
import { assertIsBytes32String } from "../../utils/bytes.js";
import { FhevmError, assertFhevm, assertIsArray } from "../../utils/error.js";
import { numberToHexNoPrefix } from "../../utils/hex.js";
import { assertIsBigUint8, assertIsBigUint256 } from "../../utils/math.js";
import { assertIsString, ensurePrefix, removePrefix } from "../../utils/string.js";

const abiInputVerifier = [
  "function getCoprocessorSigners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function eip712Domain() view returns (bytes1,string,string,uint256,address,bytes32,uint256[])",
];

export class InputVerifier {
  #inputVerifierContract: EthersT.Contract;
  #inputVerifierContractAddress: string;
  #signers: string[] | undefined;
  #threshold: number | undefined;
  #eip712Domain: EIP712Domain | undefined;

  constructor(runner: EthersT.ContractRunner, inputVerifierContractAddress: string) {
    assertIsAddress(inputVerifierContractAddress, "inputVerifierContractAddress");
    this.#inputVerifierContractAddress = inputVerifierContractAddress;
    this.#inputVerifierContract = new EthersT.Contract(inputVerifierContractAddress, abiInputVerifier, runner);
  }

  public get runner(): EthersT.ContractRunner {
    assertFhevm(this.#inputVerifierContract.runner);
    return this.#inputVerifierContract.runner;
  }

  public static async create(
    runner: EthersT.ContractRunner,
    inputVerifierContractAddress: string,
  ): Promise<InputVerifier> {
    const inputVerifier = new InputVerifier(runner, inputVerifierContractAddress);
    await inputVerifier.initialize();
    return inputVerifier;
  }

  public async initialize() {
    assertFhevm(this.#signers === undefined, `InputVerifier wrapper already initialized`);
    assertFhevm(this.#threshold === undefined, `InputVerifier wrapper already initialized`);

    const signers = await this.#inputVerifierContract.getCoprocessorSigners();
    assertIsAddressArray(signers);
    this.#signers = signers;

    const threshold = await this.#inputVerifierContract.getThreshold();
    assertIsBigUint8(threshold);
    this.#threshold = Number(threshold);

    // ignore extensions
    const eip712Domain = await this.#inputVerifierContract.eip712Domain();
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
    };

    assertFhevm(constants.INPUT_VERIFICATION_EIP712_DOMAIN.name === this.#eip712Domain.name);
    assertFhevm(constants.INPUT_VERIFICATION_EIP712_DOMAIN.version === this.#eip712Domain.version);
  }

  public get address(): string {
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
    assertFhevm(this.#signers !== undefined, `InputVerifier wrapper not initialized`);
    return this.#signers;
  }

  public getThreshold(): number {
    assertFhevm(this.#threshold !== undefined, `InputVerifier wrapper not initialized`);
    return this.#threshold;
  }

  public verifySignatures(
    handlesBytes32List: EthersT.BytesLike[],
    userAddress: string,
    contractAddress: string,
    contractChainId: number,
    signatures: string[],
  ) {
    assertIsArray(signatures);

    const domain = {
      name: this.eip712Domain.name,
      version: this.eip712Domain.version,
      chainId: this.eip712Domain.chainId,
      verifyingContract: this.eip712Domain.verifyingContract,
    };
    const types = constants.INPUT_VERIFICATION_EIP712_TYPE;

    const recoveredAddresses: string[] = signatures.map((signature: string) => {
      const sig = ensurePrefix(signature, "0x");
      const recoveredAddress = EthersT.verifyTypedData(
        domain,
        types,
        {
          ctHandles: handlesBytes32List,
          userAddress,
          contractAddress,
          contractChainId,
        },
        sig,
      );
      return recoveredAddress;
    });

    if (!isThresholdReached(this.getCoprocessorSigners(), recoveredAddresses, this.getThreshold())) {
      throw new FhevmError("Coprocessor signers threshold is not reached");
    }
  }

  // See: fhevm-gateway/contracts/InputVerification.sol
  public createCiphertextVerificationEIP712(
    handlesBytes32List: EthersT.BigNumberish[],
    contractChainId: number,
    contractAddress: string,
    userAddress: string,
  ): EthersEIP712 {
    assertIsAddress(userAddress, "userAddress");
    assertIsAddress(contractAddress, "contractAddress");

    const eip712: EthersEIP712 = {
      domain: {
        chainId: this.gatewayChainId,
        name: this.eip712Domain.name,
        version: this.eip712Domain.version,
        verifyingContract: this.gatewayInputVerificationAddress,
      },
      types: constants.INPUT_VERIFICATION_EIP712_TYPE,
      message: {
        ctHandles: handlesBytes32List.map((handle) => EthersT.zeroPadValue(EthersT.toBeHex(handle), 32)),
        userAddress: userAddress,
        contractAddress: contractAddress,
        contractChainId: contractChainId,
      },
    };

    return eip712;
  }
}

export function computeInputProofHex(handlesBytes32Hex: string[], coprocessorsSignaturesHex: string[]): string {
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

  return inputProofHex;
}
