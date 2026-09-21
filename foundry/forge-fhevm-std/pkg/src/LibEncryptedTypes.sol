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

/**
 * @title LibEncryptedTypes
 * @notice The bridge between the `encrypted-types` types a test writes and the raw `bytes32` handles the
 *         stack stores — one value at a time, or a whole batch.
 *
 * @dev WHY A FAMILY OF ITS OWN (rules.md 2.6). Every public entry that takes an encrypted value has to
 *      reach the handle inside it before it can talk to the stack, and every entry that takes a BATCH —
 *      `decrypt(abi.encode(a, b), …)`, `decryptPublic(abi.encode(a, b))` — has to split one ABI blob into
 *      those handles. That was written twice, once in `StdFhevmDecrypt` and once in `StdFhevmDecryptPublic`,
 *      character for character. One concern, one library; the name says which concern, and the question
 *      "does this helper belong here?" has a NO answer, which a `LibUtils` would not.
 *
 * @dev THE USER NEVER SEES A HANDLE (rules.md 2.8). This library is how the API keeps that promise: the
 *      `bytes32` stops here, on the inside. `toBytes32` is deliberately not attached to the types with
 *      `using … global` — that would add a method to a type this package does not own, in every file that
 *      imports it, which is a surprise a consumer did not ask for.
 */
library LibEncryptedTypes {
    // -- One value ----------------------------------------------------------------------------------

    function toBytes32(ebool value) internal pure returns (bytes32 handle) {
        return ebool.unwrap(value);
    }

    function toBytes32(euint8 value) internal pure returns (bytes32 handle) {
        return euint8.unwrap(value);
    }

    function toBytes32(euint16 value) internal pure returns (bytes32 handle) {
        return euint16.unwrap(value);
    }

    function toBytes32(euint32 value) internal pure returns (bytes32 handle) {
        return euint32.unwrap(value);
    }

    function toBytes32(euint64 value) internal pure returns (bytes32 handle) {
        return euint64.unwrap(value);
    }

    function toBytes32(euint128 value) internal pure returns (bytes32 handle) {
        return euint128.unwrap(value);
    }

    function toBytes32(euint256 value) internal pure returns (bytes32 handle) {
        return euint256.unwrap(value);
    }

    function toBytes32(eaddress value) internal pure returns (bytes32 handle) {
        return eaddress.unwrap(value);
    }

    // -- A batch ------------------------------------------------------------------------------------

    /**
     * @notice The handles of `abi.encode(a, b, …)`, the batch form every multi-value entry takes.
     *
     * @dev A user-defined value type over `bytes32` is ABI-encoded as its underlying word, so the blob is
     *      exactly the handles end to end and no per-value type is needed to read it — which is what lets
     *      one decoder serve `decrypt` and `decryptPublic` alike, whatever mix of `euint*` the caller
     *      packed. A length that is not a whole number of words is a caller mistake, not a truncation to
     *      absorb silently.
     */
    /// @notice Positional handles, `handles(a, b, ...)`, for the positional decrypt overloads.
    function handles(bytes32 a, bytes32 b) internal pure returns (bytes32[] memory h) {
        h = new bytes32[](2);
        (h[0], h[1]) = (a, b);
    }

    function handles(bytes32 a, bytes32 b, bytes32 c) internal pure returns (bytes32[] memory h) {
        h = new bytes32[](3);
        (h[0], h[1], h[2]) = (a, b, c);
    }

    function handles(bytes32 a, bytes32 b, bytes32 c, bytes32 d) internal pure returns (bytes32[] memory h) {
        h = new bytes32[](4);
        (h[0], h[1], h[2], h[3]) = (a, b, c, d);
    }

    function handles(bytes32 a, bytes32 b, bytes32 c, bytes32 d, bytes32 e) internal pure returns (bytes32[] memory h) {
        h = new bytes32[](5);
        (h[0], h[1], h[2], h[3], h[4]) = (a, b, c, d, e);
    }

    function handles(bytes memory abiEncryptedValues) internal pure returns (bytes32[] memory decoded) {
        require(abiEncryptedValues.length != 0, "StdFhevm: no encrypted value to decrypt");
        require(
            abiEncryptedValues.length % 32 == 0, "StdFhevm: abiEncryptedValues is not a whole number of 32-byte handles"
        );

        uint256 count = abiEncryptedValues.length / 32;
        decoded = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            bytes32 handle;
            assembly {
                handle := mload(add(add(abiEncryptedValues, 0x20), mul(i, 0x20)))
            }
            decoded[i] = handle;
        }
    }
}
