// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/**
 * @notice EIP-170 applies to one of the cleartext executors and deliberately not to the other.
 *
 * @dev `CleartextFHEVMExecutor` is deployed by ordinary transactions, so 24,576 bytes is a hard
 *      ceiling for it — exceeding it makes the contract undeployable on any EVM chain, and the failure
 *      arrives at deploy time on whatever network someone tried, far from the commit that caused it.
 *      It is already close enough that ordinary work can cross the line: `CleartextArithmetic` exists
 *      as a separate contract for exactly this reason.
 *
 *      `CleartextForgeFHEVMExecutor` is the test-only variant. It is never deployed by a transaction —
 *      only `_create`d inside a forge test, where the limit is not enforced — so it is allowed over,
 *      and today it is. That exemption is a decision, not an oversight, which is why it is asserted
 *      here rather than left for `forge build --sizes` to report at no one.
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

    /// THE ONE THAT NEED NOT. Asserted so the exemption is recorded, and so that a future change making
    /// it fit is noticed rather than silently relied upon.
    function test_cleartextForgeFhevmExecutorIsExemptAndOver() public view {
        uint256 size = _runtimeSize("CleartextForgeFHEVMExecutor.sol:CleartextForgeFHEVMExecutor");

        assertGt(size, MAX_RUNTIME_SIZE, "the forge variant now fits; drop this test and the exemption");
    }
}
