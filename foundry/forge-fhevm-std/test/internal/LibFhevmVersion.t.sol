// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FhevmGeneration, HostVersions, LibFhevmVersion} from "../../pkg/src/LibFhevmVersion.sol";
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

    // ---------------------------------------------------------------------------------------------
    // Which line is this?
    //
    // `classify` is what lets a fork of a chain one generation behind be upgraded in memory instead of
    // refused. Getting it wrong in the permissive direction runs the wrong upgrade against a live
    // stack, so every case below is a real release of a real line, spelled out.
    // ---------------------------------------------------------------------------------------------

    /// fhevm v0.13.0, the first release of the previous line.
    function _previousLineFirstRelease() private pure returns (HostVersions memory) {
        return HostVersions({
            acl: "ACL v0.4.0",
            fhevmExecutor: "FHEVMExecutor v0.4.0",
            kmsVerifier: "KMSVerifier v0.3.0",
            inputVerifier: "InputVerifier v0.2.0",
            hcuLimit: "HCULimit v0.3.0",
            protocolConfig: "ProtocolConfig v0.1.0",
            kmsGeneration: "KMSGeneration v0.1.0"
        });
    }

    /// fhevm v0.13.6, the last one: only the executor moved, v0.4.0 -> v0.5.0.
    function _previousLineLastRelease() private pure returns (HostVersions memory versions) {
        versions = _previousLineFirstRelease();
        versions.fhevmExecutor = "FHEVMExecutor v0.5.0";
    }

    /// fhevm v0.14.0.
    function _currentLineFirstRelease() private pure returns (HostVersions memory) {
        return HostVersions({
            acl: "ACL v0.5.0",
            fhevmExecutor: "FHEVMExecutor v0.5.0",
            kmsVerifier: "KMSVerifier v0.4.0",
            inputVerifier: "InputVerifier v0.2.0",
            hcuLimit: "HCULimit v0.4.0",
            protocolConfig: "ProtocolConfig v0.2.0",
            kmsGeneration: "KMSGeneration v0.2.0"
        });
    }

    /// What this SDK vendors right now, read from the generated ceilings rather than restated.
    function _currentLineVendoredRelease() private pure returns (HostVersions memory) {
        return HostVersions({
            acl: LibFhevmVersion.aclCeiling(),
            fhevmExecutor: LibFhevmVersion.fhevmExecutorCeiling(),
            kmsVerifier: LibFhevmVersion.kmsVerifierCeiling(),
            inputVerifier: LibFhevmVersion.inputVerifierCeiling(),
            hcuLimit: "HCULimit v0.4.0",
            protocolConfig: LibFhevmVersion.protocolConfigCeiling(),
            kmsGeneration: "KMSGeneration v0.2.0"
        });
    }

    function test_everyReleaseOfThePreviousLineIsRecognised() public pure {
        assertEq(
            uint8(LibFhevmVersion.classify(_previousLineFirstRelease())), uint8(FhevmGeneration.Previous), "0.13.0"
        );
        assertEq(uint8(LibFhevmVersion.classify(_previousLineLastRelease())), uint8(FhevmGeneration.Previous), "0.13.6");
    }

    function test_everyReleaseOfThisLineIsRecognised() public pure {
        assertEq(uint8(LibFhevmVersion.classify(_currentLineFirstRelease())), uint8(FhevmGeneration.Current), "0.14.0");
        assertEq(
            uint8(LibFhevmVersion.classify(_currentLineVendoredRelease())),
            uint8(FhevmGeneration.Current),
            "the vendored one"
        );
    }

    /// A patch release moves no minor, so it must land on the same line.
    function test_aPatchReleaseChangesNothing() public pure {
        HostVersions memory patched = _previousLineLastRelease();
        patched.acl = "ACL v0.4.7";
        patched.kmsVerifier = "KMSVerifier v0.3.99";
        assertEq(uint8(LibFhevmVersion.classify(patched)), uint8(FhevmGeneration.Previous), "still 0.13");
    }

    /// The line before the previous one: no ProtocolConfig, no KMSGeneration, and older everything else.
    /// Refused without this file knowing a single thing about 0.12.
    function test_theLineBeforeTheLastIsUnknown() public pure {
        HostVersions memory v12 = HostVersions({
            acl: "ACL v0.3.0",
            fhevmExecutor: "FHEVMExecutor v0.3.0",
            kmsVerifier: "KMSVerifier v0.2.0",
            inputVerifier: "InputVerifier v0.1.0",
            hcuLimit: "HCULimit v0.2.0",
            protocolConfig: "",
            kmsGeneration: ""
        });
        assertEq(uint8(LibFhevmVersion.classify(v12)), uint8(FhevmGeneration.Unknown), "0.12");
    }

    /// A line this SDK has not seen. Newer is refused exactly like older: it cannot know the ABI.
    function test_theNextLineIsUnknown() public pure {
        HostVersions memory next = _currentLineFirstRelease();
        next.acl = "ACL v0.6.0";
        next.kmsVerifier = "KMSVerifier v0.5.0";
        next.hcuLimit = "HCULimit v0.5.0";
        next.protocolConfig = "ProtocolConfig v0.3.0";
        next.kmsGeneration = "KMSGeneration v0.3.0";
        assertEq(uint8(LibFhevmVersion.classify(next)), uint8(FhevmGeneration.Unknown), "0.15");
    }

    /// One contract missing is enough to refuse: a half-read stack is not a stack we can classify.
    function test_anAbsentContractIsUnknown() public pure {
        HostVersions memory missing = _previousLineLastRelease();
        missing.kmsGeneration = "";
        assertEq(uint8(LibFhevmVersion.classify(missing)), uint8(FhevmGeneration.Unknown), "absent");
    }

    /// A stack mid-upgrade, half on each line, belongs to neither.
    function test_aMixedStackIsUnknown() public pure {
        HostVersions memory mixed = _previousLineLastRelease();
        mixed.acl = "ACL v0.5.0";
        assertEq(uint8(LibFhevmVersion.classify(mixed)), uint8(FhevmGeneration.Unknown), "half upgraded");
    }

    /// Garbage in every field, and one field at a time, is never a line.
    function test_unparseableReadingsAreUnknown() public pure {
        HostVersions memory nothing;
        assertEq(uint8(LibFhevmVersion.classify(nothing)), uint8(FhevmGeneration.Unknown), "all empty");

        HostVersions memory oneBad = _previousLineLastRelease();
        oneBad.hcuLimit = "HCULimit 0.3.0";
        assertEq(uint8(LibFhevmVersion.classify(oneBad)), uint8(FhevmGeneration.Unknown), "missing the v");
    }

    /// The overlap is real, and the conjunction is what resolves it: neither of the two contracts that
    /// span both lines can decide alone.
    function test_theContractsThatOverlapCannotDecideAlone() public pure {
        assertTrue(
            LibFhevmVersion.acceptsLine(
                "FHEVMExecutor v0.5.0",
                LibFhevmVersion.PREVIOUS_FHEVM_EXECUTOR_FLOOR,
                LibFhevmVersion.PREVIOUS_FHEVM_EXECUTOR_CEILING
            ),
            "the executor at v0.5.0 fits the previous line"
        );
        assertTrue(
            LibFhevmVersion.acceptsLine(
                "FHEVMExecutor v0.5.0", LibFhevmVersion.FHEVM_EXECUTOR_FLOOR, LibFhevmVersion.fhevmExecutorCeiling()
            ),
            "and this one"
        );
        assertTrue(
            LibFhevmVersion.acceptsLine(
                "InputVerifier v0.2.0",
                LibFhevmVersion.PREVIOUS_INPUT_VERIFIER_FLOOR,
                LibFhevmVersion.PREVIOUS_INPUT_VERIFIER_CEILING
            ),
            "the input verifier never moved at all"
        );
    }

    /// `acceptsLine` ignores the patch; `accepts` does not. Two questions, two comparisons.
    function test_acceptsLineIgnoresThePatchAndAcceptsDoesNot() public pure {
        assertTrue(LibFhevmVersion.acceptsLine("ACL v0.4.9", "ACL v0.4.0", "ACL v0.4.0"), "line: patch ignored");
        assertFalse(LibFhevmVersion.accepts("ACL v0.4.9", "ACL v0.4.0", "ACL v0.4.0"), "gate: patch counts");
    }

    /// The floors this file states are the ones the library ships, so a line change cannot move one
    /// without moving the other.
    function test_thePreviousLineFloorsAreTheOnesRecorded() public pure {
        HostVersions memory floors = _previousLineFirstRelease();
        assertEq(floors.acl, LibFhevmVersion.PREVIOUS_ACL_FLOOR, "acl");
        assertEq(floors.fhevmExecutor, LibFhevmVersion.PREVIOUS_FHEVM_EXECUTOR_FLOOR, "executor");
        assertEq(floors.kmsVerifier, LibFhevmVersion.PREVIOUS_KMS_VERIFIER_FLOOR, "kmsVerifier");
        assertEq(floors.inputVerifier, LibFhevmVersion.PREVIOUS_INPUT_VERIFIER_FLOOR, "inputVerifier");
        assertEq(floors.hcuLimit, LibFhevmVersion.PREVIOUS_HCU_LIMIT_FLOOR, "hcuLimit");
        assertEq(floors.protocolConfig, LibFhevmVersion.PREVIOUS_PROTOCOL_CONFIG_FLOOR, "protocolConfig");
        assertEq(floors.kmsGeneration, LibFhevmVersion.PREVIOUS_KMS_GENERATION_FLOOR, "kmsGeneration");
    }
}
