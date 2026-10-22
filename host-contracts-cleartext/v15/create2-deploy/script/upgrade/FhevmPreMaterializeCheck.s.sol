// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointPreMaterializeCheck} from "../repoint/FhevmRepointPreMaterializeCheck.s.sol";
import {FhevmUpgradeBase} from "./FhevmUpgradeBase.s.sol";

/// @notice The upgrade's gate before the point of no return. No init parameters to print: every op is a
///         no-argument reinitializer, already named in the op list.
contract FhevmPreMaterializeCheck is FhevmRepointPreMaterializeCheck, FhevmUpgradeBase {}
