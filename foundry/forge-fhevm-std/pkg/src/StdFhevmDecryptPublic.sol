// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    ebool,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    eaddress
} from "encrypted-types/EncryptedTypes.sol";

import {FhevmCleartextDeploy} from "./_host/FhevmCleartextDeploy.sol";
import {FhevmCleartextDecryptPublic} from "./_host/FhevmCleartextDecryptPublic.sol";

/// @notice Reading cleartexts back out of publicly decryptable handles. Inherited by `StdFhevm`.
abstract contract StdFhevmDecryptPublic is FhevmCleartextDeploy {
    // -- Decrypt Public Values ------------------------------------------------

    function decryptPublicWithSignatures(ebool value) internal view returns (bool clear, bytes memory decryptionProof) {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (bool));
    }

    function decryptPublicWithSignatures(euint8 value)
        internal
        view
        returns (uint8 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint8));
    }

    function decryptPublicWithSignatures(euint16 value)
        internal
        view
        returns (uint16 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint16));
    }

    function decryptPublicWithSignatures(euint32 value)
        internal
        view
        returns (uint32 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint32));
    }

    function decryptPublicWithSignatures(euint64 value)
        internal
        view
        returns (uint64 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint64));
    }

    function decryptPublicWithSignatures(euint128 value)
        internal
        view
        returns (uint128 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint128));
    }

    function decryptPublicWithSignatures(euint256 value)
        internal
        view
        returns (uint256 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint256));
    }

    function decryptPublicWithSignatures(eaddress value)
        internal
        view
        returns (address clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (address));
    }

    /**
     * @notice Publicly decrypts several handles at once, and returns the KMS proof over them.
     * @param abiEncryptedValues `abi.encode(eA, eB, ...)` — every handle type is a `bytes32`, so this
     *        is simply the handles laid end to end.
     * @return abiClearValues `abi.encode(clearA, clearB, ...)`, in the SAME order.
     * @return decryptionProof The KMS proof over that payload, for an on-chain `checkSignatures`.
     *
     * (uint128 clearA, uint256 clearB) =
     *     abi.decode(decryptPublicWithSignatures(abi.encode(eA, eB)), (uint128, uint256));
     */
    function decryptPublicWithSignatures(bytes memory abiEncryptedValues)
        internal
        view
        returns (bytes memory abiClearValues, bytes memory decryptionProof)
    {
        (abiClearValues, decryptionProof) =
            FhevmCleartextDecryptPublic.decryptPublicWithProof(_toHandles(abiEncryptedValues));
    }

    // -- Decrypt Single Public Value ------------------------------------------

    /**
     * @notice Publicly decrypts several handles at once.
     * @param abiEncryptedValues `abi.encode(eA, eB, ...)` — every handle type is a `bytes32`, so this
     *        is simply the handles laid end to end.
     * @return abiClearValues `abi.encode(clearA, clearB, ...)`, in the SAME order.
     *
     * (address clearAddr, uint128 clearUint128, uint256 clearUint256) =
     *     abi.decode(decryptPublic(abi.encode(eAddr, eUint128, eUint256)), (address, uint128, uint256));
     */
    function decryptPublic(bytes memory abiEncryptedValues) internal view returns (bytes memory abiClearValues) {
        (abiClearValues,) = FhevmCleartextDecryptPublic.decryptPublicWithProof(_toHandles(abiEncryptedValues));
    }

    function decryptPublic(ebool value) internal view returns (bool clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (bool));
    }

    function decryptPublic(euint8 value) internal view returns (uint8 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint8));
    }

    function decryptPublic(euint16 value) internal view returns (uint16 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint16));
    }

    function decryptPublic(euint32 value) internal view returns (uint32 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint32));
    }

    function decryptPublic(euint64 value) internal view returns (uint64 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint64));
    }

    function decryptPublic(euint128 value) internal view returns (uint128 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint128));
    }

    function decryptPublic(euint256 value) internal view returns (uint256 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint256));
    }

    function decryptPublic(eaddress value) internal view returns (address clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (address));
    }

    // -- PRIVATE HELPER FUNCTIONS ---------------------------------------------

    function _toBytes32(ebool value) private pure returns (bytes32 handle) {
        return ebool.unwrap(value);
    }

    function _toBytes32(euint8 value) private pure returns (bytes32 handle) {
        return euint8.unwrap(value);
    }

    function _toBytes32(euint16 value) private pure returns (bytes32 handle) {
        return euint16.unwrap(value);
    }

    function _toBytes32(euint32 value) private pure returns (bytes32 handle) {
        return euint32.unwrap(value);
    }

    function _toBytes32(euint64 value) private pure returns (bytes32 handle) {
        return euint64.unwrap(value);
    }

    function _toBytes32(euint128 value) private pure returns (bytes32 handle) {
        return euint128.unwrap(value);
    }

    function _toBytes32(euint256 value) private pure returns (bytes32 handle) {
        return euint256.unwrap(value);
    }

    function _toBytes32(eaddress value) private pure returns (bytes32 handle) {
        return eaddress.unwrap(value);
    }

    /**
     * @dev Splits `abi.encode(eA, eB, ...)` back into its handles. Every encrypted type is a
     *      user-defined value type over `bytes32`, so each occupies exactly one static 32-byte word
     *      with no offsets or length prefix — which is what makes this a plain slice. Passing a
     *      dynamic type (a `bytes`, a `string`, an array) would encode an offset instead, so the
     *      length check below is the guard that catches it.
     */
    function _toHandles(bytes memory abiEncryptedValues) private pure returns (bytes32[] memory handles) {
        require(abiEncryptedValues.length != 0, "StdFhevm: no encrypted value to decrypt");
        require(
            abiEncryptedValues.length % 32 == 0, "StdFhevm: abiEncryptedValues is not a whole number of 32-byte handles"
        );

        uint256 count = abiEncryptedValues.length / 32;
        handles = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            bytes32 handle;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                handle := mload(add(add(abiEncryptedValues, 0x20), mul(i, 0x20)))
            }
            handles[i] = handle;
        }
    }

    function _decryptPublicHandle(bytes32 handle) private view returns (bytes memory abiClearValues) {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        (abiClearValues,) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);
    }

    function _decryptPublicHandleWithSignatures(bytes32 handle)
        private
        view
        returns (bytes memory abiClearValues, bytes memory decryptionProof)
    {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        (abiClearValues, decryptionProof) = FhevmCleartextDecryptPublic.decryptPublicWithProof(handles);
    }
}
