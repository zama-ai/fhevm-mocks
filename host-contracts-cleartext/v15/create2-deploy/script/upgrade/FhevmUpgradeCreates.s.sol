// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointCreates} from "../repoint/FhevmRepointCreates.s.sol";
import {FhevmUpgradeBase} from "./FhevmUpgradeBase.s.sol";

/// @notice The upgrade's creates: the seven resumable factory CREATE2 calls.
contract FhevmUpgradeCreates is FhevmRepointCreates, FhevmUpgradeBase {}
