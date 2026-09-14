// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";

/**
 * @title ForgeVmBase
 * @notice Binds the cheatcode address.
 * @dev The constant is `fvm`, NOT `vm`: forge-std's `CommonBase` declares `Vm internal constant vm`, so a
 *      consumer writing `is Test, FhevmDeploy` would hit `Error (9097): Identifier already declared`.
 */
abstract contract ForgeVmBase {
    IForgeVm internal constant fvm = IForgeVm(FORGE_VM_ADDRESS);
}
