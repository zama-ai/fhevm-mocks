// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    externalEbool,
    externalEuint8,
    externalEuint16,
    externalEuint32,
    externalEuint64,
    externalEuint128,
    externalEuint256,
    externalEaddress
} from "encrypted-types/EncryptedTypes.sol";

import {FhevmCleartextDeploy} from "./_host/FhevmCleartextDeploy.sol";
import {FhevmCleartextEncrypt} from "./_host/FhevmCleartextEncrypt.sol";
import {FheType} from "./_internal/FheType.sol";
import {LibFhevmHandle} from "./_internal/LibFhevmHandle.sol";
import {EncryptedInput} from "./LibEncryptedInput.sol";
import {TypedValue} from "./LibTypedValue.sol";

/// @notice Turning cleartexts into input handles. Inherited by `StdFhevm`.
abstract contract StdFhevmEncrypt is FhevmCleartextDeploy {
    // -- Typed Cleartext Constructors -----------------------------------------

    /// @notice Tags a cleartext with the FHE type it must encrypt to.
    /// @dev Inherited rather than imported: these are plain functions, so a test that inherits
    ///      `StdFhevm` calls `asUint32(7)` with no import at all. The width is fixed by the parameter
    ///      type, so `asUint8(300)` is a compile error.
    function asBool(bool b) internal pure returns (TypedValue memory) {
        return TypedValue({_t: FheType.Bool, _v: b ? 1 : 0});
    }

    function asUint8(uint8 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: FheType.Uint8, _v: x});
    }

    function asUint16(uint16 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: FheType.Uint16, _v: x});
    }

    function asUint32(uint32 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: FheType.Uint32, _v: x});
    }

    function asUint64(uint64 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: FheType.Uint64, _v: x});
    }

    function asUint128(uint128 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: FheType.Uint128, _v: x});
    }

    function asUint256(uint256 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: FheType.Uint256, _v: x});
    }

    function asAddress(address a) internal pure returns (TypedValue memory) {
        return TypedValue({_t: FheType.Uint160, _v: uint160(a)});
    }

    // -- Encrypt Several Values -----------------------------------------------

    /**
     * @notice Encrypts several values under ONE input proof. This is the primitive every other
     *         `encryptValues` overload delegates to; call it directly for batches longer than five or
     *         built in a loop.
     * @param values One `TypedValue` per cleartext (see `asUint8`, `asBool`, ...). The width travels
     *        with the value: `abi.encode` pads everything to a 32-byte word, so `uint32(7)` and
     *        `uint64(7)` are the same bytes and the width cannot be recovered from the value alone.
     * @param contractAddress The only contract allowed to consume the handles.
     * @param userAddress The only account allowed to submit them.
     * @return e The handles in the SAME order as `values`, plus the single proof that binds them to the
     *         contract/user pair. Read them back with `e.externalEuintNAt(i)`, or as a tuple with
     *         `abi.decode(e.abiEncoded(), (externalEuintN, ...))`.
     */
    function encryptValues(TypedValue[] memory values, address contractAddress, address userAddress)
        internal
        returns (EncryptedInput memory e)
    {
        require(values.length != 0, "StdFhevm: no value to encrypt");
        uint8[] memory typeIds = new uint8[](values.length);
        uint256[] memory clear = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            typeIds[i] = values[i].fheTypeId();
            clear[i] = values[i].value();
        }
        (e.handles, e.inputProof) = FhevmCleartextEncrypt.encrypt(typeIds, clear, contractAddress, userAddress);
        _recordBatchOrigin(e);
    }

    /**
     * @notice Raw form: `abi.encode(typeId, value, typeId, value, ...)`. Prefer the `TypedValue`
     *         overloads, which get the width checked by the compiler.
     */
    function encryptValues(bytes memory abiTypeValuePairs, address contractAddress, address userAddress)
        internal
        returns (EncryptedInput memory e)
    {
        (e.handles, e.inputProof) = FhevmCleartextEncrypt.encrypt(abiTypeValuePairs, contractAddress, userAddress);
        _recordBatchOrigin(e);
    }

    /**
     * @notice Fixed-arity forms, one to five values — the same arity ceiling `console.log` lives with,
     *         for the same reason (no variadics in Solidity). Past five, pass a `TypedValue[]`.
     *
     * EncryptedInput memory e = encryptValues(asUint32(7), asUint64(1234567890123), address(dapp), alice);
     * dapp.set(e.externalEuint32At(0), e.externalEuint64At(1), e.inputProof);
     */
    function encryptValues(TypedValue memory a, address contractAddress, address userAddress)
        internal
        returns (EncryptedInput memory)
    {
        TypedValue[] memory values = new TypedValue[](1);
        values[0] = a;
        return encryptValues(values, contractAddress, userAddress);
    }

    function encryptValues(TypedValue memory a, TypedValue memory b, address contractAddress, address userAddress)
        internal
        returns (EncryptedInput memory)
    {
        TypedValue[] memory values = new TypedValue[](2);
        values[0] = a;
        values[1] = b;
        return encryptValues(values, contractAddress, userAddress);
    }

    function encryptValues(
        TypedValue memory a,
        TypedValue memory b,
        TypedValue memory c,
        address contractAddress,
        address userAddress
    ) internal returns (EncryptedInput memory) {
        TypedValue[] memory values = new TypedValue[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        return encryptValues(values, contractAddress, userAddress);
    }

    function encryptValues(
        TypedValue memory a,
        TypedValue memory b,
        TypedValue memory c,
        TypedValue memory d,
        address contractAddress,
        address userAddress
    ) internal returns (EncryptedInput memory) {
        TypedValue[] memory values = new TypedValue[](4);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        return encryptValues(values, contractAddress, userAddress);
    }

    function encryptValues(
        TypedValue memory a,
        TypedValue memory b,
        TypedValue memory c,
        TypedValue memory d,
        TypedValue memory e,
        address contractAddress,
        address userAddress
    ) internal returns (EncryptedInput memory) {
        TypedValue[] memory values = new TypedValue[](5);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
        return encryptValues(values, contractAddress, userAddress);
    }

    // -- Encrypt Single Value -------------------------------------------------

    /// @notice ONE value, one proof: the typed handle comes back directly, with no `EncryptedInput`
    ///         in between. One per `as*` constructor, same naming — `asUint32` / `encryptUint32`.
    /// @dev For several values under a SINGLE proof, use `encryptValues` instead. Calling these twice
    ///      produces two independent proofs, not one covering both.

    function encryptBool(bool value, address contractAddress, address userAddress)
        internal
        returns (externalEbool externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(value ? 1 : 0, FheType.Bool, contractAddress, userAddress);
        externalEnc = externalEbool.wrap(handle);
    }

    function encryptUint8(uint8 value, address contractAddress, address userAddress)
        internal
        returns (externalEuint8 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint8, contractAddress, userAddress);
        externalEnc = externalEuint8.wrap(handle);
    }

    function encryptUint16(uint16 value, address contractAddress, address userAddress)
        internal
        returns (externalEuint16 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint16, contractAddress, userAddress);
        externalEnc = externalEuint16.wrap(handle);
    }

    function encryptUint32(uint32 value, address contractAddress, address userAddress)
        internal
        returns (externalEuint32 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint32, contractAddress, userAddress);
        externalEnc = externalEuint32.wrap(handle);
    }

    function encryptUint64(uint64 value, address contractAddress, address userAddress)
        internal
        returns (externalEuint64 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint64, contractAddress, userAddress);
        externalEnc = externalEuint64.wrap(handle);
    }

    function encryptUint128(uint128 value, address contractAddress, address userAddress)
        internal
        returns (externalEuint128 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint128, contractAddress, userAddress);
        externalEnc = externalEuint128.wrap(handle);
    }

    function encryptUint256(uint256 value, address contractAddress, address userAddress)
        internal
        returns (externalEuint256 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(value, FheType.Uint256, contractAddress, userAddress);
        externalEnc = externalEuint256.wrap(handle);
    }

    function encryptAddress(address value, address contractAddress, address userAddress)
        internal
        returns (externalEaddress externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(uint160(value)), FheType.Uint160, contractAddress, userAddress);
        externalEnc = externalEaddress.wrap(handle);
    }

    // -- PRIVATE HELPER FUNCTIONS ---------------------------------------------

    /// @dev Takes the batch's chain and handle format from the FIRST handle, so the record is read off
    ///      the handles themselves rather than assumed. `_checked` then holds every other handle to it,
    ///      which is what catches an `EncryptedInput` stitched from two batches.
    function _recordBatchOrigin(EncryptedInput memory e) private pure {
        e.chainId = LibFhevmHandle.chainIdOf(e.handles[0]);
        e.version = LibFhevmHandle.versionOf(e.handles[0]);
    }

    function _encryptValue(uint256 value, FheType typeId, address contractAddress, address userAddress)
        private
        returns (bytes32 externalHandle, bytes memory inputProof)
    {
        uint8[] memory typeIds = new uint8[](1);
        uint256[] memory values = new uint256[](1);
        typeIds[0] = uint8(typeId);
        values[0] = uint256(value);

        bytes32[] memory handles;
        (handles, inputProof) = FhevmCleartextEncrypt.encrypt(typeIds, values, contractAddress, userAddress);
        externalHandle = handles[0];
    }
}
