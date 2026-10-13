// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointComputeAddresses} from "../repoint/FhevmRepointComputeAddresses.s.sol";
import {FhevmUpgradeBase} from "./FhevmUpgradeBase.s.sol";

/// @notice The upgrade's compute: the re-point engine's two passes over the seven-role table.
contract FhevmComputeUpgradeAddresses is FhevmRepointComputeAddresses, FhevmUpgradeBase {}
