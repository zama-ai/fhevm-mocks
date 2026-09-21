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
import {LibEncryptedTypes} from "./LibEncryptedTypes.sol";
import {Plaintexts} from "./LibPlaintexts.sol";

abstract contract StdFhevmDecryptPublic is StdFhevmBase {
    // -- Decrypt single (euintN -> clear) -------------------------------------

    function decryptPublic(ebool value) internal unmetered returns (bool clear) {
        clear = _decryptPublicOne(LibEncryptedTypes.toBytes32(value)).plaintext(value);
    }

    function decryptPublic(euint8 value) internal unmetered returns (uint8 clear) {
        clear = _decryptPublicOne(LibEncryptedTypes.toBytes32(value)).plaintext(value);
    }

    function decryptPublic(euint16 value) internal unmetered returns (uint16 clear) {
        clear = _decryptPublicOne(LibEncryptedTypes.toBytes32(value)).plaintext(value);
    }

    function decryptPublic(euint32 value) internal unmetered returns (uint32 clear) {
        clear = _decryptPublicOne(LibEncryptedTypes.toBytes32(value)).plaintext(value);
    }

    function decryptPublic(euint64 value) internal unmetered returns (uint64 clear) {
        clear = _decryptPublicOne(LibEncryptedTypes.toBytes32(value)).plaintext(value);
    }

    function decryptPublic(euint128 value) internal unmetered returns (uint128 clear) {
        clear = _decryptPublicOne(LibEncryptedTypes.toBytes32(value)).plaintext(value);
    }

    function decryptPublic(euint256 value) internal unmetered returns (uint256 clear) {
        clear = _decryptPublicOne(LibEncryptedTypes.toBytes32(value)).plaintext(value);
    }

    function decryptPublic(eaddress value) internal unmetered returns (address clear) {
        clear = _decryptPublicOne(LibEncryptedTypes.toBytes32(value)).plaintext(value);
    }

    // -- Decrypt single (euintN -> clear, proof) ------------------------------

    function decryptPublicWithSignatures(ebool value)
        internal
        unmetered
        returns (bool clear, bytes memory decryptionProof)
    {
        Plaintexts memory decrypted;
        (decrypted, decryptionProof) = _decryptPublicOneWithProof(LibEncryptedTypes.toBytes32(value));
        clear = decrypted.plaintext(value);
    }

    function decryptPublicWithSignatures(euint8 value)
        internal
        unmetered
        returns (uint8 clear, bytes memory decryptionProof)
    {
        Plaintexts memory decrypted;
        (decrypted, decryptionProof) = _decryptPublicOneWithProof(LibEncryptedTypes.toBytes32(value));
        clear = decrypted.plaintext(value);
    }

    function decryptPublicWithSignatures(euint16 value)
        internal
        unmetered
        returns (uint16 clear, bytes memory decryptionProof)
    {
        Plaintexts memory decrypted;
        (decrypted, decryptionProof) = _decryptPublicOneWithProof(LibEncryptedTypes.toBytes32(value));
        clear = decrypted.plaintext(value);
    }

    function decryptPublicWithSignatures(euint32 value)
        internal
        unmetered
        returns (uint32 clear, bytes memory decryptionProof)
    {
        Plaintexts memory decrypted;
        (decrypted, decryptionProof) = _decryptPublicOneWithProof(LibEncryptedTypes.toBytes32(value));
        clear = decrypted.plaintext(value);
    }

    function decryptPublicWithSignatures(euint64 value)
        internal
        unmetered
        returns (uint64 clear, bytes memory decryptionProof)
    {
        Plaintexts memory decrypted;
        (decrypted, decryptionProof) = _decryptPublicOneWithProof(LibEncryptedTypes.toBytes32(value));
        clear = decrypted.plaintext(value);
    }

    function decryptPublicWithSignatures(euint128 value)
        internal
        unmetered
        returns (uint128 clear, bytes memory decryptionProof)
    {
        Plaintexts memory decrypted;
        (decrypted, decryptionProof) = _decryptPublicOneWithProof(LibEncryptedTypes.toBytes32(value));
        clear = decrypted.plaintext(value);
    }

    function decryptPublicWithSignatures(euint256 value)
        internal
        unmetered
        returns (uint256 clear, bytes memory decryptionProof)
    {
        Plaintexts memory decrypted;
        (decrypted, decryptionProof) = _decryptPublicOneWithProof(LibEncryptedTypes.toBytes32(value));
        clear = decrypted.plaintext(value);
    }

    function decryptPublicWithSignatures(eaddress value)
        internal
        unmetered
        returns (address clear, bytes memory decryptionProof)
    {
        Plaintexts memory decrypted;
        (decrypted, decryptionProof) = _decryptPublicOneWithProof(LibEncryptedTypes.toBytes32(value));
        clear = decrypted.plaintext(value);
    }

    // Multiple values come back as a `Plaintexts`, as for a user decryption — read by `decrypted.uint32At(i)`
    // or by the value itself. Three input shapes: POSITIONAL, like `encryptValues(a, b, ...)`, answered in
    // the same order; an ARRAY of handles; and the ABI blob a dApp's multi-value getter returns.

    // -- Decrypt multiple (bytes32 a..e -> Plaintexts) ------------------------

    function decryptPublic(bytes32 a, bytes32 b) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decryptPublic(LibEncryptedTypes.handles(a, b));
    }

    function decryptPublic(bytes32 a, bytes32 b, bytes32 c) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decryptPublic(LibEncryptedTypes.handles(a, b, c));
    }

    function decryptPublic(bytes32 a, bytes32 b, bytes32 c, bytes32 d)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decryptPublic(LibEncryptedTypes.handles(a, b, c, d));
    }

    function decryptPublic(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e)
        internal
        unmetered
        returns (Plaintexts memory decrypted)
    {
        decrypted = decryptPublic(LibEncryptedTypes.handles(a, b, c, d, e));
    }

    // -- Decrypt multiple (bytes32[] -> Plaintexts) ---------------------------

    function decryptPublic(bytes32[] memory handles) internal unmetered returns (Plaintexts memory decrypted) {
        (decrypted,) = _decryptPublicWithProof(handles);
    }

    // -- Decrypt multiple (bytes abi -> Plaintexts) ---------------------------

    /// @notice Public decryption of `abi.encode(a, b, ...)`, as `decrypt(bytes, ...)` answers a user one.
    function decryptPublic(bytes memory abiEncryptedValues) internal unmetered returns (Plaintexts memory decrypted) {
        decrypted = decryptPublic(LibEncryptedTypes.handles(abiEncryptedValues));
    }

    // -- Decrypt multiple (bytes32 a..e -> Plaintexts, proof) -----------------

    function decryptPublicWithSignatures(bytes32 a, bytes32 b)
        internal
        unmetered
        returns (Plaintexts memory decrypted, bytes memory decryptionProof)
    {
        (decrypted, decryptionProof) = decryptPublicWithSignatures(LibEncryptedTypes.handles(a, b));
    }

    function decryptPublicWithSignatures(bytes32 a, bytes32 b, bytes32 c)
        internal
        unmetered
        returns (Plaintexts memory decrypted, bytes memory decryptionProof)
    {
        (decrypted, decryptionProof) = decryptPublicWithSignatures(LibEncryptedTypes.handles(a, b, c));
    }

    function decryptPublicWithSignatures(bytes32 a, bytes32 b, bytes32 c, bytes32 d)
        internal
        unmetered
        returns (Plaintexts memory decrypted, bytes memory decryptionProof)
    {
        (decrypted, decryptionProof) = decryptPublicWithSignatures(LibEncryptedTypes.handles(a, b, c, d));
    }

    function decryptPublicWithSignatures(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e)
        internal
        unmetered
        returns (Plaintexts memory decrypted, bytes memory decryptionProof)
    {
        (decrypted, decryptionProof) = decryptPublicWithSignatures(LibEncryptedTypes.handles(a, b, c, d, e));
    }

    // -- Decrypt multiple (bytes32[] -> Plaintexts, proof) --------------------

    /**
     * @notice The same, with the proof a dApp's `FHE.checkSignatures` accepts. The three arguments that
     *         call takes are `decrypted.handles()`, `decrypted.abiEncoded()` and `decryptionProof`.
     * @dev `abiEncoded()` reproduces the signed bytes exactly: the plaintexts are read off those very
     *      bytes, one word each, rather than re-read from the store.
     */
    function decryptPublicWithSignatures(bytes32[] memory handles)
        internal
        unmetered
        returns (Plaintexts memory decrypted, bytes memory decryptionProof)
    {
        (decrypted, decryptionProof) = _decryptPublicWithProof(handles);
    }

    // -- Decrypt multiple (bytes abi -> Plaintexts, proof) --------------------

    function decryptPublicWithSignatures(bytes memory abiEncryptedValues)
        internal
        unmetered
        returns (Plaintexts memory decrypted, bytes memory decryptionProof)
    {
        (decrypted, decryptionProof) = decryptPublicWithSignatures(LibEncryptedTypes.handles(abiEncryptedValues));
    }

    // -- PRIVATE HELPER FUNCTIONS ---------------------------------------------

    function _decryptPublicOne(bytes32 handle) private returns (Plaintexts memory decrypted) {
        (decrypted,) = _decryptPublicOneWithProof(handle);
    }

    function _decryptPublicOneWithProof(bytes32 handle)
        private
        returns (Plaintexts memory decrypted, bytes memory decryptionProof)
    {
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = handle;
        (decrypted, decryptionProof) = _decryptPublicWithProof(handles);
    }

    /// @dev One kernel step (rules.md 2.10). The signed clear-value bytes are one 32-byte word per handle,
    ///      so they are split into the `Plaintexts` as they are: what `abiEncoded()` gives back is what
    ///      the KMS signed.
    function _decryptPublicWithProof(bytes32[] memory handles)
        private
        returns (Plaintexts memory decrypted, bytes memory decryptionProof)
    {
        bytes memory abiClearValues;
        (abiClearValues, decryptionProof) = fhevm.decryptPublicWithProof(handles);
        decrypted._h = handles;
        decrypted._p = _words(abiClearValues);
    }

    function _words(bytes memory encoded) private pure returns (uint256[] memory words) {
        require(encoded.length % 32 == 0, "StdFhevm: clear values are not whole words");
        words = new uint256[](encoded.length / 32);
        for (uint256 i = 0; i < words.length; i++) {
            uint256 w;
            assembly ("memory-safe") {
                w := mload(add(add(encoded, 32), mul(i, 32)))
            }
            words[i] = w;
        }
    }
}
