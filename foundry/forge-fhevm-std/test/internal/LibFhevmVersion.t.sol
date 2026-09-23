// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibFhevmVersion} from "../../pkg/src/LibFhevmVersion.sol";
import {LocalHostVersions} from "../../pkg/src/_host/_internal/LocalHostVersions.sol";

/// The version gate accepts a LINE, not a release: floor (fhevm v0.14.0) to ceiling (the vendored release).
/// `FLOOR` and `CEILING` below are a hypothetical line, so the boundaries can be exercised on both sides.
contract LibFhevmVersionTest is Test {
    string internal constant FLOOR = "FHEVMExecutor v0.4.0";
    string internal constant CEILING = "FHEVMExecutor v0.5.0";

    function test_parsesNameAndThreeNumbers() public pure {
        LibFhevmVersion.Version memory v = LibFhevmVersion.parse("FHEVMExecutor v0.5.12");
        assertTrue(v.ok);
        assertEq(v.nameHash, keccak256("FHEVMExecutor"));
        assertEq(v.major, 0);
        assertEq(v.minor, 5);
        assertEq(v.patch, 12);
    }

    function test_anythingElseDoesNotParse() public pure {
        assertFalse(LibFhevmVersion.parse("").ok, "empty");
        assertFalse(LibFhevmVersion.parse("FHEVMExecutor").ok, "no version");
        assertFalse(LibFhevmVersion.parse("FHEVMExecutor 0.5.0").ok, "no v");
        assertFalse(LibFhevmVersion.parse("FHEVMExecutor v0.5").ok, "two numbers");
        assertFalse(LibFhevmVersion.parse("FHEVMExecutor v0.5.0-rc1").ok, "trailing");
        assertFalse(LibFhevmVersion.parse(" v0.5.0").ok, "no name");
    }

    /// Both ends and the middle are in; the two neighbouring lines are out.
    function test_theWholeLineIsAcceptedAndNothingElse() public pure {
        assertTrue(LibFhevmVersion.accepts("FHEVMExecutor v0.4.0", FLOOR, CEILING), "floor");
        assertTrue(LibFhevmVersion.accepts("FHEVMExecutor v0.4.7", FLOOR, CEILING), "a patch in between");
        assertTrue(LibFhevmVersion.accepts("FHEVMExecutor v0.5.0", FLOOR, CEILING), "ceiling");

        assertFalse(LibFhevmVersion.accepts("FHEVMExecutor v0.3.0", FLOOR, CEILING), "the previous line");
        assertFalse(LibFhevmVersion.accepts("FHEVMExecutor v0.3.9", FLOOR, CEILING), "just below the floor");
        assertFalse(LibFhevmVersion.accepts("FHEVMExecutor v0.5.1", FLOOR, CEILING), "just above the ceiling");
        assertFalse(LibFhevmVersion.accepts("FHEVMExecutor v0.6.0", FLOOR, CEILING), "the next line");
        assertFalse(LibFhevmVersion.accepts("FHEVMExecutor v1.4.0", FLOOR, CEILING), "another major");
        assertFalse(LibFhevmVersion.accepts("ACL v0.4.0", FLOOR, CEILING), "another contract");
        assertFalse(LibFhevmVersion.accepts("", FLOOR, CEILING), "no answer at all");
    }

    /// The floors are the 0.14.0 tag, and every generated ceiling lies on or above its floor: a regeneration
    /// from another line, or a floor left behind by a line change, is caught here rather than on a fork.
    function test_theFloorsAndCeilingsDescribeOneLine() public pure {
        _line(LibFhevmVersion.ACL_FLOOR, "ACL v0.5.0", LocalHostVersions.ACL);
        _line(LibFhevmVersion.FHEVM_EXECUTOR_FLOOR, "FHEVMExecutor v0.5.0", LocalHostVersions.FHEVM_EXECUTOR);
        _line(LibFhevmVersion.INPUT_VERIFIER_FLOOR, "InputVerifier v0.2.0", LocalHostVersions.INPUT_VERIFIER);
        _line(LibFhevmVersion.KMS_VERIFIER_FLOOR, "KMSVerifier v0.4.0", LocalHostVersions.KMS_VERIFIER);
        _line(LibFhevmVersion.PROTOCOL_CONFIG_FLOOR, "ProtocolConfig v0.2.0", LocalHostVersions.PROTOCOL_CONFIG);
    }

    function _line(string memory floor, string memory expectedFloor, string memory ceiling) private pure {
        assertEq(floor, expectedFloor);
        assertTrue(LibFhevmVersion.accepts(floor, floor, ceiling), string.concat(floor, ": floor within its own line"));
        assertTrue(
            LibFhevmVersion.accepts(ceiling, floor, ceiling), string.concat(ceiling, ": ceiling within its own line")
        );
    }
}
