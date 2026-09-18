// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FheType} from "./FheType.sol";

/// ----------------------------------------------------------------------------
///   ⚠️ Private Library:
///     - Should not be exposed to the public
///     - not maintained
///     - can change at any time
/// ----------------------------------------------------------------------------

/// @notice The internal binary format of an FHEVM handle.
///
/// @dev Handle layout (see `FhevmCleartextEncrypt._inputHandle`):
///      `hash21[0:20] || index[21] || chainId[22:29] || fheTypeId[30] || version[31]`
///
///      TODO: isExternal(), toString().
library LibFhevmHandle {
    /// @notice The FHE type `handle` was minted for.
    /// @dev Byte 30 of the layout.
    function typeOf(bytes32 handle) internal pure returns (FheType) {
        return FheType(uint8(handle[30]));
    }

    /// @notice The position `handle` had in the batch it was minted with.
    /// @dev Byte 21. `encryptValues` returns the handles in call order, so this is the same `i` the
    ///      caller reads them back with.
    function indexOf(bytes32 handle) internal pure returns (uint8) {
        return uint8(handle[21]);
    }

    /// @notice The handle format `handle` was minted in.
    /// @dev Byte 31, the last one.
    function versionOf(bytes32 handle) internal pure returns (uint8) {
        return uint8(handle[31]);
    }

    /// @notice The chain `handle` was minted on.
    /// @dev Bytes 22..29, written as `uint64(block.chainid)`.
    function chainIdOf(bytes32 handle) internal pure returns (uint64) {
        return uint64(uint256(handle) >> 16);
    }
}
