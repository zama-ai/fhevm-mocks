// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/**
 * @notice EIP-170 applies to the deployable cleartext stack, and deliberately not to the forge variants.
 *
 * @dev `CleartextFHEVMExecutor` is deployed by ordinary transactions, so 24,576 bytes is a hard
 *      ceiling for it — exceeding it makes the contract undeployable on any EVM chain, and the failure
 *      arrives at deploy time on whatever network someone tried, far from the commit that caused it.
 *      It is already close enough that ordinary work can cross the line: `CleartextArithmetic` exists
 *      as a separate contract for exactly this reason.
 *
 *      `CleartextForgeFHEVMExecutor` is the test-only variant. It is never deployed by a transaction —
 *      only `_create`d inside a forge test, where the limit is not enforced — so it is allowed over.
 *      Up to v14 it was (26.3 KB); upstream v0.15.0-3 shrank the executor and it now fits (24.3 KB), so
 *      nothing here asserts either way. The exemption itself stays a decision, recorded with the other
 *      forge-only variants in `internal/checkContractSizes.ts` (`CONTRACT_SIZE_EXCEPTIONS`).
 */
contract ContractSizeLimitsTest is Test {
    /// @dev EIP-170.
    uint256 internal constant MAX_RUNTIME_SIZE = 24_576;

    function _runtimeSize(string memory artifact) private view returns (uint256) {
        return vm.getDeployedCode(artifact).length;
    }

    /// THE ONE THAT MUST FIT. Deployed by a transaction, so the limit is real.
    function test_cleartextFhevmExecutorFitsInTheCodeSizeLimit() public view {
        uint256 size = _runtimeSize("CleartextFHEVMExecutor.sol:CleartextFHEVMExecutor");

        assertLe(size, MAX_RUNTIME_SIZE, "CleartextFHEVMExecutor is undeployable: split something out of it");
    }

    /// Nothing else on the deployable path may creep over either.
    function test_theDeployableStackFitsInTheCodeSizeLimit() public view {
        assertLe(_runtimeSize("CleartextArithmetic.sol:CleartextArithmetic"), MAX_RUNTIME_SIZE, "CleartextArithmetic");
        assertLe(_runtimeSize("CleartextDB.sol:CleartextDB"), MAX_RUNTIME_SIZE, "CleartextDB");
        assertLe(_runtimeSize("CleartextACL.sol:CleartextACL"), MAX_RUNTIME_SIZE, "CleartextACL");
        assertLe(
            _runtimeSize("CleartextInputVerifier.sol:CleartextInputVerifier"),
            MAX_RUNTIME_SIZE,
            "CleartextInputVerifier"
        );
    }
}
