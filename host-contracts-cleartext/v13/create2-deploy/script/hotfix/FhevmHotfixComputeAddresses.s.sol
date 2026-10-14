// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointComputeAddresses} from "../repoint/FhevmRepointComputeAddresses.s.sol";
import {FhevmHotfixBase} from "./FhevmHotfixBase.s.sol";

/// @notice The hotfix's the two-pass compute: every proxy whose implementation in this build differs.
contract FhevmHotfixComputeAddresses is FhevmRepointComputeAddresses, FhevmHotfixBase {}
