// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FheType} from "../../../src/contracts/shared/FheType.sol";
import {LibString} from "./LibString.sol";

/// ----------------------------------------------------------------------------
///   ⚠️ Private Library:
///     - Host-internal, shipped with the forge payload
///     - Should not be exposed to the public
///     - not maintained
///     - can change at any time
/// ----------------------------------------------------------------------------

library LibFheType {
    /// @notice The name of an FHE type, like "euint32" or "eaddress".
    /// @dev Unknown types come back as "FheType(12)".
    function toString(FheType t) internal pure returns (string memory) {
        if (t == FheType.Bool) return "ebool";
        if (t == FheType.Uint8) return "euint8";
        if (t == FheType.Uint16) return "euint16";
        if (t == FheType.Uint32) return "euint32";
        if (t == FheType.Uint64) return "euint64";
        if (t == FheType.Uint128) return "euint128";
        if (t == FheType.Uint160) return "eaddress";
        if (t == FheType.Uint256) return "euint256";
        return string.concat("FheType(", LibString.toString(uint8(t)), ")");
    }
}
