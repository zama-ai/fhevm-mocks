// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {TestErrors} from "./contracts/TestErrors.sol";

/// Port of hardhat/v3/e2e/test/internal/TestErrors.test.ts.
///
/// `ACLNotAllowed` is declared by the stack's FHEVMExecutor, which this test never imports (golden
/// rule: nothing from `_host`). The hardhat suite hands chai a bare ABI fragment for the same reason;
/// here the selector is computed from the same signature.
contract TestErrorsTest is TestFhevm {
    bytes4 internal constant ACL_NOT_ALLOWED = bytes4(keccak256("ACLNotAllowed(bytes32,address)"));

    TestErrors internal testErrors;
    address internal alice;

    function setUp() public override {
        super.setUp();
        alice = makeAddr("alice");
        vm.prank(alice);
        testErrors = new TestErrors();

        // Upstream runs this in the `it`, one transaction before `add`. `asEuint64` grants only a
        // TRANSIENT allowance, cleared when that transaction ends — which is what makes `add` revert.
        // A forge test body is a single transaction, so the init lives here: forge resets between
        // `setUp` and the test, restoring the two-transaction shape the assertion depends on.
        vm.prank(alice);
        testErrors.initCypherTextUint64NoAllow(123);
    }

    /// hardhat: 'Test ACL error permissions'
    function test_aclErrorPermissions() public {
        vm.expectPartialRevert(ACL_NOT_ALLOWED);
        vm.prank(alice);
        testErrors.add(456);
    }
}
