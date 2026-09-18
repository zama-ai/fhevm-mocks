// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmCleartextDeploy} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {CLEARTEXT_ARITHMETIC_ADDRESS, FHEVM_EXECUTOR_ADDRESS} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/FhevmCleartextDeploy.sol";
import {FheType} from "../../pkg/src/contracts/shared/FheType.sol";
import {CleartextHandle} from "../../pkg/src/cleartext/CleartextHandle.sol";

/**
 * `plaintexts` reads the DB by handle, and now checks the handle belongs to THIS chain — the same
 * guard every `record*` entry point already had.
 *
 * A handle carries its chain in bytes 22..29. One minted elsewhere names a slot in this chain's DB
 * that is either empty or some unrelated handle's value, so reading it would answer a question nobody
 * asked.
 */
contract CleartextPlaintextsChainIdTest is Test, FhevmCleartextDeploy {
    ICleartextArithmetic internal arithmetic;
    ICleartextFHEVMExecutor internal executor;

    function setUp() public {
        deployLocalFhevm();
        arithmetic = ICleartextArithmetic(CLEARTEXT_ARITHMETIC_ADDRESS);
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
    }

    /// A handle from this chain reads back the value it was trivially encrypted with.
    function test_aLocalHandleReadsBack() public {
        bytes32 handle = executor.trivialEncrypt(42, FheType.Uint32);

        assertEq(CleartextHandle.chainIdOf(handle), uint64(block.chainid), "minted here");
        assertEq(arithmetic.plaintexts(handle), 42);
    }

    /// The same handle with its chain field changed is refused rather than read.
    function test_aForeignHandleIsRefused() public {
        bytes32 handle = executor.trivialEncrypt(42, FheType.Uint32);

        uint64 otherChain = uint64(block.chainid) + 1;
        bytes32 foreign = _withChainId(handle, otherChain);

        vm.expectRevert(
            abi.encodeWithSelector(
                CleartextHandle.CleartextErrorHandleChainIdMismatch.selector, foreign, otherChain, uint64(block.chainid)
            )
        );
        arithmetic.plaintexts(foreign);
    }

    /// @dev Rewrites bytes 22..29, the chain field, leaving every other field intact.
    function _withChainId(bytes32 handle, uint64 chainId) private pure returns (bytes32) {
        uint256 cleared = uint256(handle) & ~(uint256(type(uint64).max) << 16);
        return bytes32(cleared | (uint256(chainId) << 16));
    }
}
