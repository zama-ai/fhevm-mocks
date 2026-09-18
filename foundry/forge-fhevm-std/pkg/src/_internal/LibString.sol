// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/// ----------------------------------------------------------------------------
///   ⚠️ Private Library:
///     - Should not be exposed to the public
///     - not maintained
///     - can change at any time
/// ----------------------------------------------------------------------------

library LibString {
    /// @notice The base-10 rendering of `v`.
    /// @dev Intended for error messages; no attempt is made to be gas-efficient.
    function toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 n = v;
        uint256 digits;
        while (n != 0) {
            digits++;
            n /= 10;
        }
        bytes memory buf = new bytes(digits);
        while (v != 0) {
            buf[--digits] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(buf);
    }
}
