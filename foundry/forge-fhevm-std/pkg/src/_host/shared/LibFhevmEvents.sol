// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FheType} from "./LibFheType.sol";

/**
 * @notice The events an `FHEVMExecutor` emits, declared apart from the contract that emits them.
 *
 * @dev WHY A SECOND DECLARATION. These belong to `contracts/FHEEvents.sol`, which is VENDORED — synced
 *      from upstream, never edited here. A log READER needs only the signatures, but inheriting the
 *      contract to reach them drags the vendored tree into anything that wants to recognise an event.
 *      `ForgeFhevmEventProcessor` is exactly that reader, and being free of `contracts/` is what
 *      makes it portable.
 *
 * @dev A LIBRARY, NOT A CONTRACT. Nothing inherits it: a reader names an event as
 *      `LibFhevmEvents.FheAdd` and there is no second `FHEEvents` type to be mistaken for the vendored
 *      one. A library rather than file-level events because a source unit with no contract-like item
 *      yields no artifact, and forge's incremental build then warns "AST source not found" for it on
 *      every rebuild that touches it. The EVENT NAMES must match exactly, unlike
 *      `shared/FhevmOperatorsEnum.sol` where only the order mattered: an event's topic0 is
 *      `keccak256("FheAdd(address,bytes32,bytes32,bytes1,bytes32)")`, so the name and every parameter
 *      type are part of its identity.
 *
 * @dev THE SIGNATURES ARE THE WIRE FORMAT. Rename a parameter type, reorder two arguments, or change
 *      what is `indexed`, and topic0 changes — the processor then silently recognises nothing and
 *      replays an empty stream, which looks exactly like a test that did no FHE work.
 *      `FhevmEvents.t.sol` compares every topic0 against the vendored declaration; do not edit this
 *      file without it.
 */
library LibFhevmEvents {
    event FheAdd(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheSub(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheMul(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheDiv(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheRem(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheBitAnd(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheBitOr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheBitXor(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheShl(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheShr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheRotl(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheRotr(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheEq(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheNe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheGe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheGt(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheLe(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheLt(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheMin(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheMax(address indexed caller, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, bytes32 result);
    event FheNeg(address indexed caller, bytes32 ct, bytes32 result);
    event FheNot(address indexed caller, bytes32 ct, bytes32 result);
    event VerifyInput(
        address indexed caller,
        bytes32 inputHandle,
        address userAddress,
        bytes inputProof,
        FheType inputType,
        bytes32 result
    );
    event Cast(address indexed caller, bytes32 ct, FheType toType, bytes32 result);
    event TrivialEncrypt(address indexed caller, uint256 pt, FheType toType, bytes32 result);
    event FheIfThenElse(address indexed caller, bytes32 control, bytes32 ifTrue, bytes32 ifFalse, bytes32 result);
    event FheRand(address indexed caller, FheType randType, bytes16 seed, bytes32 result);
    event FheRandBounded(address indexed caller, uint256 upperBound, FheType randType, bytes16 seed, bytes32 result);
    event FheSum(address indexed caller, bytes32[] values, bytes32 result);
    event FheIsIn(address indexed caller, bytes32 value, bytes32[] values, bytes32 result);
    event FheMulDiv(
        address indexed caller, bytes32 factor1, bytes32 factor2, bytes32 divisor, bytes1 scalarByte, bytes32 result
    );
}
