// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointCreates} from "../repoint/FhevmRepointCreates.s.sol";
import {FhevmHotfixBase} from "./FhevmHotfixBase.s.sol";

/// @notice The hotfix's the resumable creates of the changed implementations.
contract FhevmHotfixCreates is FhevmRepointCreates, FhevmHotfixBase {}
