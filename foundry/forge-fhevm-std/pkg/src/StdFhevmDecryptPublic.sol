// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {StdFhevmBase} from "./StdFhevmBase.sol";
import {fhevm} from "./FhevmVm.sol";
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
import {LibForgeFhevmPublicDecrypt} from "./_host/LibForgeFhevmPublicDecrypt.sol";
import {FhevmProtocol, LibFhevmProtocol} from "./LibFhevmProtocol.sol";

abstract contract StdFhevmDecryptPublic is StdFhevmBase {
    // -- Decrypt Single Public Value ------------------------------------------

    function decryptPublic(ebool value) internal unmetered returns (bool clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (bool));
    }

    function decryptPublic(euint8 value) internal unmetered returns (uint8 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint8));
    }

    function decryptPublic(euint16 value) internal unmetered returns (uint16 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint16));
    }

    function decryptPublic(euint32 value) internal unmetered returns (uint32 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint32));
    }

    function decryptPublic(euint64 value) internal unmetered returns (uint64 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint64));
    }

    function decryptPublic(euint128 value) internal unmetered returns (uint128 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint128));
    }

    function decryptPublic(euint256 value) internal unmetered returns (uint256 clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (uint256));
    }

    function decryptPublic(eaddress value) internal unmetered returns (address clear) {
        clear = abi.decode(_decryptPublicHandle(_toBytes32(value)), (address));
    }

    // -- Decrypt Single Value With Signatures ---------------------------------

    function decryptPublicWithSignatures(ebool value)
        internal
        unmetered
        returns (bool clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (bool));
    }

    function decryptPublicWithSignatures(euint8 value)
        internal
        unmetered
        returns (uint8 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint8));
    }

    function decryptPublicWithSignatures(euint16 value)
        internal
        unmetered
        returns (uint16 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint16));
    }

    function decryptPublicWithSignatures(euint32 value)
        internal
        unmetered
        returns (uint32 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint32));
    }

    function decryptPublicWithSignatures(euint64 value)
        internal
        unmetered
        returns (uint64 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint64));
    }

    function decryptPublicWithSignatures(euint128 value)
        internal
        unmetered
        returns (uint128 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint128));
    }

    function decryptPublicWithSignatures(euint256 value)
        internal
        unmetered
        returns (uint256 clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (uint256));
    }

    function decryptPublicWithSignatures(eaddress value)
        internal
        unmetered
        returns (address clear, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = _decryptPublicHandleWithSignatures(_toBytes32(value));
        clear = abi.decode(abiClearValues, (address));
    }

    // -- Decrypt Multiple Values ----------------------------------------------

    function decryptPublic(bytes memory abiEncryptedValues) internal unmetered returns (bytes memory abiClearValues) {
        (abiClearValues,) = _decryptPublicWithProof(_toHandles(abiEncryptedValues));
    }

    // -- Decrypt Multiple Values With Signatures ------------------------------

    function decryptPublicWithSignatures(bytes memory abiEncryptedValues)
        internal
        unmetered
        returns (bytes memory abiClearValues, bytes memory decryptionProof)
    {
        (abiClearValues, decryptionProof) = _decryptPublicWithProof(_toHandles(abiEncryptedValues));
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

    function _decryptPublicHandle(bytes32 handle) private returns (bytes memory abiClearValues) {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        (abiClearValues,) = _decryptPublicWithProof(handles);
    }

    function _decryptPublicHandleWithSignatures(bytes32 handle)
        private
        returns (bytes memory abiClearValues, bytes memory decryptionProof)
    {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        (abiClearValues, decryptionProof) = _decryptPublicWithProof(handles);
    }

    /**
     * @notice Public decryption against the stack this test is pointed at.
     *
     * @dev RESOLVED, NOT NAMED, for the same reason as in `StdFhevmDecrypt`: the local cleartext
     *      verifier answers for itself, and a forked production one is served from the ACL and the
     *      plaintext source this config names.
     */
    function _decryptPublicWithProof(bytes32[] memory handles)
        private
        returns (bytes memory abiClearValues, bytes memory decryptionProof)
    {
        fhevm.ensureForkPrepared(address(0));
        fhevm.drainFheEvents();
        FhevmProtocol memory protocol = LibFhevmProtocol.currentConfigWithPlaintexts();
        return LibForgeFhevmPublicDecrypt.decryptPublicWithProof(
            handles, protocol.kmsVerifier, protocol.acl, protocol.plaintexts, fhevm.useCleartextVerifier()
        );
    }
}
