// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {CleartextArithmetic, FheType} from "./CleartextArithmetic.sol";
import {VmSafe} from "forge-std/Vm.sol";

/**
 * @title CleartextForgeArithmetic
 */
/// @custom:security-contact https://github.com/zama-ai/fhevm/blob/main/SECURITY.md
contract CleartextForgeArithmetic is CleartextArithmetic {
    VmSafe private constant vmSafe = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @notice Marks the Forge-only variant, mirroring forge-std's `IS_TEST`. A constant rather than a
    ///         storage variable: these run behind proxies, where an initialized state variable would
    ///         only ever be set in the implementation's own storage and read back as `false`.
    bool public constant IS_FORGE = true;

    function randomUint256(
        FheType,
        /* randType */
        bytes16 /* seed */
    )
        internal
        view
        override
        returns (uint256)
    {
        return vmSafe.randomUint();
    }

    function randomBoundedUint256(
        uint256 upperBound,
        bytes16 /* seed */
    )
        internal
        view
        override
        returns (uint256)
    {
        return vmSafe.randomUint() % upperBound;
    }
}
