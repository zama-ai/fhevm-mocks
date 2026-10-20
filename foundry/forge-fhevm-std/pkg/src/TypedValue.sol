// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

struct TypedValue {
    /// @dev The FHE type id to encrypt `_v` as — byte 30 of the handle it will mint.
    uint8 _t;
    /// @dev The cleartext, widened to `uint256`.
    uint256 _v;
}
