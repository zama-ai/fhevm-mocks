// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm} from "./IForgeVm.sol";

/**
 * @title ForgeVmBase
 * @notice Binds the cheatcode address.
 * @dev The constant is `fvm`, NOT `vm`: forge-std's `CommonBase` declares `Vm internal constant vm`, so a
 *      consumer writing `is Test, FhevmCleartextDeploy` would hit `Error (9097): Identifier already declared`.
 */
abstract contract ForgeVmBase {
    /// @dev `address(uint160(uint256(keccak256("hevm cheat code"))))`.
    address internal constant FORGE_VM_ADDRESS = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D;
    IForgeVm internal constant fvm = IForgeVm(FORGE_VM_ADDRESS);
}
