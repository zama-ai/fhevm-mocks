// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointMaterialize} from "../repoint/FhevmRepointMaterialize.s.sol";
import {FhevmUpgradeBase} from "./FhevmUpgradeBase.s.sol";

/// @notice The upgrade's one atomic ACLOwner.upgrade: six ops, each with its reinitializer.
contract FhevmMaterializeUpgrade is FhevmRepointMaterialize, FhevmUpgradeBase {}
