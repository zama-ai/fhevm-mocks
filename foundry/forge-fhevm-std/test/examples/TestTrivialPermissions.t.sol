// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {TestTrivialPermissions} from "./contracts/TestTrivialPermissions.sol";

/// Port of hardhat/v3/e2e/test/internal/TestTrivialPermissions.test.ts.
/// See TestErrors.t.sol for why `ACLNotAllowed` is a computed selector.
contract TestTrivialPermissionsTest is TestFhevm {
    bytes4 internal constant ACL_NOT_ALLOWED = bytes4(keccak256("ACLNotAllowed(bytes32,address)"));

    TestTrivialPermissions internal trivial;
    address internal carol;

    function setUp() public override {
        super.setUp();
        vm.prank(makeAddr("alice"));
        trivial = new TestTrivialPermissions();
        carol = makeAddr("carol");
    }

    /// hardhat: 'should fail because missing ACL permission'
    function test_failsWithoutAclPermission() public {
        vm.expectPartialRevert(ACL_NOT_ALLOWED);
        vm.prank(carol);
        trivial.computeFheAdd();
    }
}
