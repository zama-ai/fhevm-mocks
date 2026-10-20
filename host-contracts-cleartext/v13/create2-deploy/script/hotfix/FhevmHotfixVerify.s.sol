// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointVerify} from "../repoint/FhevmRepointVerify.s.sol";
import {FhevmHotfixBase} from "./FhevmHotfixBase.s.sol";

/// @notice The hotfix's the terminal conditions.
contract FhevmHotfixVerify is FhevmRepointVerify, FhevmHotfixBase {}
