import assert from "assert";
import { ethers as EthersT } from "ethers";

import constants from "../constants";

// See: fhevm-gateway/contracts/Decryption.sol
const EIP712_PUBLIC_DECRYPT_TYPE: Record<string, Array<EthersT.TypedDataField>> = {
  PublicDecryptVerification: [
    {
      name: "ctHandles",
      type: "bytes32[]",
    },
    {
      name: "decryptedResult",
      type: "bytes",
    },
  ],
};

// See: fhevm-gateway/contracts/InputVerification.sol
const EIP712_ZKPOK_TYPE: Record<string, Array<EthersT.TypedDataField>> = {
  CiphertextVerification: [
    {
      name: "ctHandles",
      type: "bytes32[]",
    },
    {
      name: "userAddress",
      type: "address",
    },
    {
      name: "contractAddress",
      type: "address",
    },
    {
      name: "contractChainId",
      type: "uint256",
    },
  ],
};

export type EthersEIP712 = {
  domain: EthersT.TypedDataDomain;
  message: Record<string, unknown>;
  types: Record<string, Array<EthersT.TypedDataField>>;
};

// See: fhevm-gateway/contracts/InputVerification.sol
export function createCiphertextVerificationEIP712(
  gatewayChainId: EthersT.BigNumberish,
  gatewayInputVerificationAddress: string,
  handlesBytes32List: EthersT.BigNumberish[],
  contractChainId: number,
  contractAddress: string,
  userAddress: string,
): EthersEIP712 {
  assert(EthersT.isAddress(gatewayInputVerificationAddress));
  assert(EthersT.isAddress(userAddress));
  assert(EthersT.isAddress(contractAddress));

  const eip712: EthersEIP712 = {
    domain: {
      chainId: gatewayChainId,
      name: constants.INPUT_VERIFICATION_EIP712_DOMAIN.name,
      version: constants.INPUT_VERIFICATION_EIP712_DOMAIN.version,
      verifyingContract: gatewayInputVerificationAddress,
    },
    types: EIP712_ZKPOK_TYPE,
    message: {
      ctHandles: handlesBytes32List.map((handle) => EthersT.zeroPadValue(EthersT.toBeHex(handle), 32)),
      userAddress: userAddress,
      contractAddress: contractAddress,
      contractChainId: contractChainId,
    },
  };

  return eip712;
}

// See: fhevm-gateway/contracts/Decryption.sol
export function createPublicDecryptVerificationEIP712(
  gatewayChainId: EthersT.BigNumberish,
  decryptionMgrAddress: string,
  handlesBytes32List: EthersT.BigNumberish[],
  decryptedResult: string,
): EthersEIP712 {
  assert(EthersT.isAddress(decryptionMgrAddress));

  const eip712: EthersEIP712 = {
    domain: {
      chainId: gatewayChainId,
      name: constants.DECRYPTION_EIP712_DOMAIN.name,
      version: constants.DECRYPTION_EIP712_DOMAIN.version,
      verifyingContract: decryptionMgrAddress,
    },
    types: EIP712_PUBLIC_DECRYPT_TYPE,
    message: {
      ctHandles: handlesBytes32List,
      decryptedResult: decryptedResult,
    },
  };

  return eip712;
}
