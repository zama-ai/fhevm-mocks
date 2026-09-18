// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FheType} from "./_internal/FheType.sol";

/// @notice A cleartext together with the FHE type it encrypts to. Build one with the `as*`
///         constructors below and hand it to `encryptValues`.
/// @dev The width is fixed by the CONSTRUCTOR's parameter type, so `asUint8(300)` is a compile error
///      rather than a runtime revert — which is the point of building a batch from these instead of
///      raw `abi.encode` pairs. `asAddress` encrypts to the type id `eaddress` and `euint160` share.
///      The fields are internal to `forge-fhevm-std`; read the results back off the `EncryptedInput`
///      that `encryptValues` returns.
///
///      The `as*` constructors live on `StdFhevmEncrypt` instead of here, so that inheriting
///      `StdFhevm` is enough to call them — a free function would have to be imported by name.
struct TypedValue {
    FheType _t;
    uint256 _v;
}

// -- ACCESSORS ----------------------------------------------------------------

using LibTypedValue for TypedValue global;

/// @notice Reads the two internal fields of a `TypedValue`, so callers never touch `_t` / `_v`.
library LibTypedValue {
    /// @notice The raw FHE type id of `self`.
    /// @dev Returned as `uint8`, not `FheType`, to keep the enum internal to `forge-fhevm-std`.
    function fheTypeId(TypedValue memory self) internal pure returns (uint8) {
        return uint8(self._t);
    }

    function value(TypedValue memory self) internal pure returns (uint256) {
        return self._v;
    }
}
