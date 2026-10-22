// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {CLEARTEXT_ARITHMETIC_ADDRESS, FHEVM_EXECUTOR_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {LibFhevmHandle} from "../../pkg/src/cleartext/shared/LibFhevmHandle.sol";

/**
 * `plaintexts` reads the DB by handle, and now checks the handle belongs to THIS chain — the same
 * guard every `record*` entry point already had.
 *
 * A handle carries its chain in bytes 22..29. One minted elsewhere names a slot in this chain's DB
 * that is either empty or some unrelated handle's value, so reading it would answer a question nobody
 * asked.
 */
contract CleartextPlaintextsChainIdTest is Test, ForgeFhevmDeploy {
    ICleartextArithmetic internal arithmetic;
    ICleartextFHEVMExecutor internal executor;

    function setUp() public {
        deployLocalFhevm();
        arithmetic = ICleartextArithmetic(CLEARTEXT_ARITHMETIC_ADDRESS);
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
    }

    /// A handle from this chain reads back the value it was trivially encrypted with — through the store and
    /// through the (forge) executor, which forwards both `IPlaintexts` questions to it.
    function test_aLocalHandleReadsBack() public {
        bytes32 handle = executor.trivialEncrypt(42, FheType.Uint32);

        assertEq(LibFhevmHandle.chainIdOf(handle), uint64(block.chainid), "minted here");
        assertEq(arithmetic.plaintexts(handle), 42);
        assertTrue(arithmetic.hasPlaintext(handle));
        assertEq(executor.plaintexts(handle), 42, "the executor forwards the value");
        assertTrue(executor.hasPlaintext(handle), "and the predicate");
        assertFalse(executor.hasPlaintext(bytes32(0)), "the zero word is unknown, and this does not revert");
    }

    /// The zero word is not a handle — it is an encrypted value nothing ever wrote to — and it says so by
    /// name. Without its own check it would fail the chain field (chain id 0) and read as a fork problem.
    function test_theZeroHandleIsRefusedAsUninitialized() public {
        vm.expectRevert(abi.encodeWithSelector(LibFhevmHandle.CleartextErrorHandleUninitialized.selector, bytes32(0)));
        arithmetic.plaintexts(bytes32(0));
    }

    /// The same handle with its chain field changed is refused rather than read.
    function test_aForeignHandleIsRefused() public {
        bytes32 handle = executor.trivialEncrypt(42, FheType.Uint32);

        uint64 otherChain = uint64(block.chainid) + 1;
        bytes32 foreign = _withChainId(handle, otherChain);

        vm.expectRevert(
            abi.encodeWithSelector(
                LibFhevmHandle.CleartextErrorHandleChainIdMismatch.selector, foreign, otherChain, uint64(block.chainid)
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
