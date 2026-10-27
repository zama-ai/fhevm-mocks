// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointPreMaterializeCheck} from "../repoint/FhevmRepointPreMaterializeCheck.s.sol";
import {FhevmHotfixBase} from "./FhevmHotfixBase.s.sol";

/// @notice The hotfix's the gate before the one atomic re-point.
contract FhevmHotfixPreMaterializeCheck is FhevmRepointPreMaterializeCheck, FhevmHotfixBase {}
