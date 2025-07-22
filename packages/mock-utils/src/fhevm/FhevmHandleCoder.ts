import { ethers as EthersT } from "ethers";

import constants from "../constants.js";
import { FhevmError } from "../utils/error.js";
import { FheType } from "./FheType.js";
import { FhevmHandle } from "./FhevmHandle.js";

export enum FhevmOperator {
  fheAdd = 0,
  fheSub = 1,
  fheMul = 2,
  fheDiv = 3,
  fheRem = 4,
  fheBitAnd = 5,
  fheBitOr = 6,
  fheBitXor = 7,
  fheShl = 8,
  fheShr = 9,
  fheRotl = 10,
  fheRotr = 11,
  fheEq = 12,
  fheNe = 13,
  fheGe = 14,
  fheGt = 15,
  fheLe = 16,
  fheLt = 17,
  fheMin = 18,
  fheMax = 19,
  fheNeg = 20,
  fheNot = 21,
  verifyCiphertext = 22,
  cast = 23,
  trivialEncrypt = 24,
  fheIfThenElse = 25,
  fheRand = 26,
  fheRandBounded = 27,
}

export class FhevmHandleCoder {
  #aclAddress: string;
  #chainId: number;

  constructor(aclAddress: string, chainId: number) {
    if (!EthersT.isAddress(aclAddress)) {
      throw new FhevmError(`Invalid ACL address`);
    }
    if (typeof chainId !== "number") {
      throw new FhevmError(`Invalid chainId`);
    }
    this.#aclAddress = aclAddress;
    this.#chainId = chainId;
  }
  public fheAdd(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createNumericalOpHandle(
      FhevmOperator.fheAdd,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheSub(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createNumericalOpHandle(
      FhevmOperator.fheSub,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheMul(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createNumericalOpHandle(
      FhevmOperator.fheMul,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheDiv(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createNumericalOpHandle(
      FhevmOperator.fheDiv,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheRem(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createNumericalOpHandle(
      FhevmOperator.fheRem,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheBitAnd(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createBitwiseOpHandle(
      FhevmOperator.fheBitAnd,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheBitOr(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createBitwiseOpHandle(
      FhevmOperator.fheBitOr,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheBitXor(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createBitwiseOpHandle(
      FhevmOperator.fheBitXor,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheShl(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createBitwiseOpHandle(
      FhevmOperator.fheShl,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheShr(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createBitwiseOpHandle(
      FhevmOperator.fheShr,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheRotl(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createBitwiseOpHandle(
      FhevmOperator.fheRotl,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheRotr(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createBitwiseOpHandle(
      FhevmOperator.fheRotr,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheEq(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createCompareOpHandle(
      FhevmOperator.fheEq,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheNe(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createCompareOpHandle(
      FhevmOperator.fheNe,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheGe(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createCompareOpHandle(
      FhevmOperator.fheGe,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheGt(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createCompareOpHandle(
      FhevmOperator.fheGt,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheLe(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createCompareOpHandle(
      FhevmOperator.fheLe,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
  public fheLt(lhsBytes32Hex: string, rhsBytes32Hex: string, scalar: boolean) {
    return createCompareOpHandle(
      FhevmOperator.fheLt,
      lhsBytes32Hex,
      rhsBytes32Hex,
      scalar,
      this.#aclAddress,
      this.#chainId,
    );
  }
}

/*
    function _appendMetadataToPrehandle(
        bytes32 prehandle,
        FheType handleType
    ) internal view virtual returns (bytes32 result) {
        /// @dev Clear bytes 21-31.
        result = prehandle & 0xffffffffffffffffffffffffffffffffffffffffff0000000000000000000000;
        /// @dev Set byte 21 to 0xff since the new handle comes from computation.
        result = result | (bytes32(uint256(0xff)) << 80);
        /// @dev chainId is cast to uint64 first to make sure it does not take more than 8 bytes before shifting.
        /// If EIP2294 gets approved, it will force the chainID's size to be lower than MAX_UINT64.
        result = result | (bytes32(uint256(uint64(block.chainid))) << 16);
        /// @dev Insert handleType into byte 30.
        result = result | (bytes32(uint256(uint8(handleType))) << 8);
        /// @dev Insert HANDLE_VERSION into byte 31.
        result = result | bytes32(uint256(HANDLE_VERSION));
    }

*/

function _appendMetadataToPrehandle(prehandle: bigint, handleType: FheType, chainId: bigint): bigint {
  let result: bigint = prehandle & 0xffffffffffffffffffffffffffffffffffffffffff0000000000000000000000n;
  result = result | (0xffn << 80n);
  result = result | (chainId << 16n);
  result = result | (BigInt(handleType) << 8n);
  result = result | BigInt(constants.FHEVM_HANDLE_VERSION);
  return result;
}

export function createBinaryOpHandle(
  op: FhevmOperator,
  lhs: string,
  rhs: string,
  scalar: string | boolean,
  type: FheType,
  aclAddress: string,
  chainId: number,
): string {
  if (typeof scalar === "boolean") {
    scalar = scalar ? "0x01" : "0x00";
  }
  const enc = EthersT.solidityPacked(
    ["uint8", "bytes32", "bytes32", "bytes1", "address", "uint256"],
    [op, lhs, rhs, scalar, aclAddress, chainId],
  );
  const prehandle = BigInt(EthersT.keccak256(enc));
  return EthersT.toBeHex(_appendMetadataToPrehandle(prehandle, type, BigInt(chainId)));
}

export function createNumericalOpHandle(
  op: FhevmOperator,
  lhs: string,
  rhs: string,
  scalar: string | boolean,
  aclAddress: string,
  chainId: number,
): string {
  const handleLhs = FhevmHandle.fromBytes32Hex(lhs);
  return createBinaryOpHandle(op, lhs, rhs, scalar, handleLhs.fheType, aclAddress, chainId);
}

export function createBitwiseOpHandle(
  op: FhevmOperator,
  lhs: string,
  rhs: string,
  scalar: string | boolean,
  aclAddress: string,
  chainId: number,
): string {
  const handleLhs = FhevmHandle.fromBytes32Hex(lhs);
  return createBinaryOpHandle(op, lhs, rhs, scalar, handleLhs.fheType, aclAddress, chainId);
}

export function createCompareOpHandle(
  op: FhevmOperator,
  lhs: string,
  rhs: string,
  scalar: string | boolean,
  aclAddress: string,
  chainId: number,
): string {
  return createBinaryOpHandle(op, lhs, rhs, scalar, FheType.Bool, aclAddress, chainId);
}
