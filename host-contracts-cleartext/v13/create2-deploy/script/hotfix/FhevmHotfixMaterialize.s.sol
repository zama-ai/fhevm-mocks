// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmRepointMaterialize} from "../repoint/FhevmRepointMaterialize.s.sol";
import {FhevmHotfixBase} from "./FhevmHotfixBase.s.sol";

/// @notice The hotfix's one atomic ACLOwner.upgrade, an op per changed proxy, no init data.
contract FhevmHotfixMaterialize is FhevmRepointMaterialize, FhevmHotfixBase {}
