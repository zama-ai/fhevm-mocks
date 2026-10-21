// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointPreMaterializeCheck} from "../repoint/FhevmRepointPreMaterializeCheck.s.sol";
import {FhevmUpgradeBase} from "./FhevmUpgradeBase.s.sol";

/// @notice The upgrade's gate before the point of no return; it also prints the sealed KMS migration.
contract FhevmPreMaterializeCheck is FhevmRepointPreMaterializeCheck, FhevmUpgradeBase {
    function _printExtras() internal view override {
        _printMigration();
    }
}
