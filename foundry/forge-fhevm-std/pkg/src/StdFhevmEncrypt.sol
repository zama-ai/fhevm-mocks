// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {StdFhevmBase} from "./StdFhevmBase.sol";
import {fhevm} from "./FhevmVm.sol";
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
import {FheType} from "./_host/shared/FheType.sol";
import {EncryptedInput} from "./LibEncryptedInput.sol";
import {TypedValue} from "./TypedValue.sol";

abstract contract StdFhevmEncrypt is StdFhevmBase {
    // -- Encrypt Single Value -------------------------------------------------

    function encryptBool(bool value, address contractAddress, address userAddress)
        internal
        unmetered
        returns (externalEbool externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(value ? 1 : 0, FheType.Bool, contractAddress, userAddress);
        externalEnc = externalEbool.wrap(handle);
    }

    function encryptUint8(uint8 value, address contractAddress, address userAddress)
        internal
        unmetered
        returns (externalEuint8 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint8, contractAddress, userAddress);
        externalEnc = externalEuint8.wrap(handle);
    }

    function encryptUint16(uint16 value, address contractAddress, address userAddress)
        internal
        unmetered
        returns (externalEuint16 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint16, contractAddress, userAddress);
        externalEnc = externalEuint16.wrap(handle);
    }

    function encryptUint32(uint32 value, address contractAddress, address userAddress)
        internal
        unmetered
        returns (externalEuint32 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint32, contractAddress, userAddress);
        externalEnc = externalEuint32.wrap(handle);
    }

    function encryptUint64(uint64 value, address contractAddress, address userAddress)
        internal
        unmetered
        returns (externalEuint64 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint64, contractAddress, userAddress);
        externalEnc = externalEuint64.wrap(handle);
    }

    function encryptUint128(uint128 value, address contractAddress, address userAddress)
        internal
        unmetered
        returns (externalEuint128 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(value), FheType.Uint128, contractAddress, userAddress);
        externalEnc = externalEuint128.wrap(handle);
    }

    function encryptUint256(uint256 value, address contractAddress, address userAddress)
        internal
        unmetered
        returns (externalEuint256 externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(value, FheType.Uint256, contractAddress, userAddress);
        externalEnc = externalEuint256.wrap(handle);
    }

    function encryptAddress(address value, address contractAddress, address userAddress)
        internal
        unmetered
        returns (externalEaddress externalEnc, bytes memory inputProof)
    {
        bytes32 handle;
        (handle, inputProof) = _encryptValue(uint256(uint160(value)), FheType.Uint160, contractAddress, userAddress);
        externalEnc = externalEaddress.wrap(handle);
    }

    // -- Typed Value Constructors ---------------------------------------------

    function tvBool(bool b) internal pure returns (TypedValue memory) {
        return TypedValue({_t: uint8(FheType.Bool), _v: b ? 1 : 0});
    }

    function tvUint8(uint8 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: uint8(FheType.Uint8), _v: x});
    }

    function tvUint16(uint16 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: uint8(FheType.Uint16), _v: x});
    }

    function tvUint32(uint32 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: uint8(FheType.Uint32), _v: x});
    }

    function tvUint64(uint64 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: uint8(FheType.Uint64), _v: x});
    }

    function tvUint128(uint128 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: uint8(FheType.Uint128), _v: x});
    }

    function tvUint256(uint256 x) internal pure returns (TypedValue memory) {
        return TypedValue({_t: uint8(FheType.Uint256), _v: x});
    }

    function tvAddress(address a) internal pure returns (TypedValue memory) {
        return TypedValue({_t: uint8(FheType.Uint160), _v: uint160(a)});
    }

    // -- Encrypt Single Typed Value -------------------------------------------

    function encryptValue(TypedValue memory a, address contractAddress, address userAddress)
        internal
        unmetered
        returns (EncryptedInput memory)
    {
        TypedValue[] memory values = new TypedValue[](1);
        values[0] = a;
        return encryptValues(values, contractAddress, userAddress);
    }

    // -- Encrypt Multiple Typed Values ----------------------------------------

    function encryptValues(TypedValue[] memory values, address contractAddress, address userAddress)
        internal
        unmetered
        returns (EncryptedInput memory e)
    {
        e = _encryptValues(values, contractAddress, userAddress);
    }

    function encryptValues(bytes memory abiTypeValuePairs, address contractAddress, address userAddress)
        internal
        unmetered
        returns (EncryptedInput memory e)
    {
        e = _encryptValues(abiTypeValuePairs, contractAddress, userAddress);
    }

    function encryptValues(TypedValue memory a, address contractAddress, address userAddress)
        internal
        unmetered
        returns (EncryptedInput memory)
    {
        TypedValue[] memory values = new TypedValue[](1);
        values[0] = a;
        return encryptValues(values, contractAddress, userAddress);
    }

    function encryptValues(TypedValue memory a, TypedValue memory b, address contractAddress, address userAddress)
        internal
        unmetered
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
    ) internal unmetered returns (EncryptedInput memory) {
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
    ) internal unmetered returns (EncryptedInput memory) {
        TypedValue[] memory values = new TypedValue[](4);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        return encryptValues(values, contractAddress, userAddress);
    }

    /// @dev FIVE is the ceiling, and it is solc's, not a taste call. `via_ir = false` here.
    function encryptValues(
        TypedValue memory a,
        TypedValue memory b,
        TypedValue memory c,
        TypedValue memory d,
        TypedValue memory e,
        address contractAddress,
        address userAddress
    ) internal unmetered returns (EncryptedInput memory) {
        TypedValue[] memory values = new TypedValue[](5);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
        return encryptValues(values, contractAddress, userAddress);
    }

    // -- PRIVATE HELPER FUNCTIONS ---------------------------------------------

    function _encryptValue(uint256 value, FheType typeId, address contractAddress, address userAddress)
        private
        returns (bytes32 externalHandle, bytes memory inputProof)
    {
        uint8[] memory typeIds = new uint8[](1);
        uint256[] memory values = new uint256[](1);
        typeIds[0] = uint8(typeId);
        values[0] = value;

        bytes32[] memory handles;
        (handles, inputProof,,) = fhevm.encrypt(typeIds, values, contractAddress, userAddress);
        externalHandle = handles[0];
    }

    function _encryptValues(TypedValue[] memory values, address contractAddress, address userAddress)
        private
        returns (EncryptedInput memory e)
    {
        require(values.length != 0, "StdFhevm: no value to encrypt");
        uint8[] memory typeIds = new uint8[](values.length);
        uint256[] memory clear = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            typeIds[i] = values[i]._t;
            clear[i] = values[i]._v;
        }
        (e._h, e._ip, e._cid, e._ver) = fhevm.encrypt(typeIds, clear, contractAddress, userAddress);
    }

    function _encryptValues(bytes memory abiTypeValuePairs, address contractAddress, address userAddress)
        private
        returns (EncryptedInput memory e)
    {
        (e._h, e._ip, e._cid, e._ver) = fhevm.encrypt(abiTypeValuePairs, contractAddress, userAddress);
    }
}
