// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {
    FhevmGeneration,
    HostVersions,
    LibForgeFhevmHostVersions,
    Version
} from "../../pkg/forge/src/LibForgeFhevmHostVersions.sol";
import {LocalHostVersions} from "../../pkg/forge/src/_internal/LocalHostVersions.sol";

/// The version gate accepts a LINE, not a release: floor (fhevm v0.14.0) to ceiling (the vendored release).
/// `FLOOR` and `CEILING` below are a hypothetical line, so the boundaries can be exercised on both sides.
contract LibForgeFhevmHostVersionsTest is Test {
    string internal constant FLOOR = "FHEVMExecutor v0.4.0";
    string internal constant CEILING = "FHEVMExecutor v0.5.0";

    function test_parsesNameAndThreeNumbers() public pure {
        Version memory v = LibForgeFhevmHostVersions.parse("FHEVMExecutor v0.5.12");
        assertTrue(v.ok);
        assertEq(v.name, "FHEVMExecutor");
        assertEq(v.major, 0);
        assertEq(v.minor, 5);
        assertEq(v.patch, 12);
    }

    /**
     * The shapes the cheatcode parser has to refuse, which a character scanner never met.
     *
     * `vm.split` and `vm.parseUint` are doing the work now, and each brings its own way of being too
     * generous: `replace` would have deleted a stray `v` anywhere in the tag and read what was left as
     * valid, and `parseUint` accepts things a version number should not contain. Splitting on `v` and
     * demanding exactly two parts is what closes the first; the second is closed by `parseUint` itself
     * reverting, which is caught rather than propagated.
     */
    function test_theCheatcodeParserRefusesTheseToo() public pure {
        assertFalse(LibForgeFhevmHostVersions.parse("ACL vv0.4.0").ok, "a doubled v");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0.4.0v").ok, "a trailing v");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0.4v.0").ok, "a v inside the numbers");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0.4.0 extra").ok, "a third word");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL  v0.4.0").ok, "two spaces");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v-1.4.0").ok, "a negative number");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0x4.4.0").ok, "a hex number");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0X4.4.0").ok, "an upper-case hex number");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0.1e3.0").ok, "scientific notation");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0.4 .0").ok, "a trailing space inside a number");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0.4.").ok, "a missing patch");
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0..0").ok, "a missing minor");
    }

    /// A name that CONTAINS a v is ordinary and must still parse — the split is on the tag, not the name.
    function test_aNameContainingAVStillParses() public pure {
        Version memory v = LibForgeFhevmHostVersions.parse("KMSVerifier v0.4.0");
        assertTrue(v.ok, "parsed");
        assertEq(v.name, "KMSVerifier", "name kept whole");
        assertEq(v.minor, 4, "minor");
    }

    /// Zero padding goes the same way, and for the same reason: `toString(4)` is "4", not "04". Stricter
    /// than the parser this replaced, which read "04" as four. No release has ever published one —
    /// upstream renders these from integer constants — and a version gate should not be the lenient one.
    function test_aZeroPaddedNumberIsRefused() public pure {
        assertFalse(LibForgeFhevmHostVersions.parse("ACL v0.04.0").ok, "zero padded");
        assertTrue(LibForgeFhevmHostVersions.parse("ACL v0.4.0").ok, "but the canonical form is fine");
    }

    function test_anythingElseDoesNotParse() public pure {
        assertFalse(LibForgeFhevmHostVersions.parse("").ok, "empty");
        assertFalse(LibForgeFhevmHostVersions.parse("FHEVMExecutor").ok, "no version");
        assertFalse(LibForgeFhevmHostVersions.parse("FHEVMExecutor 0.5.0").ok, "no v");
        assertFalse(LibForgeFhevmHostVersions.parse("FHEVMExecutor v0.5").ok, "two numbers");
        assertFalse(LibForgeFhevmHostVersions.parse("FHEVMExecutor v0.5.0-rc1").ok, "trailing");
        assertFalse(LibForgeFhevmHostVersions.parse(" v0.5.0").ok, "no name");
    }

    /// Both ends and the middle are in; the two neighbouring lines are out.
    function test_theWholeLineIsAcceptedAndNothingElse() public pure {
        assertTrue(LibForgeFhevmHostVersions.accepts("FHEVMExecutor v0.4.0", FLOOR, CEILING), "floor");
        assertTrue(LibForgeFhevmHostVersions.accepts("FHEVMExecutor v0.4.7", FLOOR, CEILING), "a patch in between");
        assertTrue(LibForgeFhevmHostVersions.accepts("FHEVMExecutor v0.5.0", FLOOR, CEILING), "ceiling");

        assertFalse(LibForgeFhevmHostVersions.accepts("FHEVMExecutor v0.3.0", FLOOR, CEILING), "the previous line");
        assertFalse(LibForgeFhevmHostVersions.accepts("FHEVMExecutor v0.3.9", FLOOR, CEILING), "just below the floor");
        assertFalse(LibForgeFhevmHostVersions.accepts("FHEVMExecutor v0.5.1", FLOOR, CEILING), "just above the ceiling");
        assertFalse(LibForgeFhevmHostVersions.accepts("FHEVMExecutor v0.6.0", FLOOR, CEILING), "the next line");
        assertFalse(LibForgeFhevmHostVersions.accepts("FHEVMExecutor v1.4.0", FLOOR, CEILING), "another major");
        assertFalse(LibForgeFhevmHostVersions.accepts("ACL v0.4.0", FLOOR, CEILING), "another contract");
        assertFalse(LibForgeFhevmHostVersions.accepts("", FLOOR, CEILING), "no answer at all");
    }

    /// The floors are the 0.14.0 tag, and every generated ceiling lies on or above its floor: a regeneration
    /// from another line, or a floor left behind by a line change, is caught here rather than on a fork.
    function test_theFloorsAndCeilingsDescribeOneLine() public pure {
        _line(LibForgeFhevmHostVersions.ACL_FLOOR, "ACL v0.4.0", LocalHostVersions.ACL);
        _line(LibForgeFhevmHostVersions.FHEVM_EXECUTOR_FLOOR, "FHEVMExecutor v0.4.0", LocalHostVersions.FHEVM_EXECUTOR);
        _line(LibForgeFhevmHostVersions.INPUT_VERIFIER_FLOOR, "InputVerifier v0.2.0", LocalHostVersions.INPUT_VERIFIER);
        _line(LibForgeFhevmHostVersions.KMS_VERIFIER_FLOOR, "KMSVerifier v0.3.0", LocalHostVersions.KMS_VERIFIER);
        _line(
            LibForgeFhevmHostVersions.PROTOCOL_CONFIG_FLOOR, "ProtocolConfig v0.1.0", LocalHostVersions.PROTOCOL_CONFIG
        );
    }

    function _line(string memory floor, string memory expectedFloor, string memory ceiling) private pure {
        assertEq(floor, expectedFloor);
        assertTrue(
            LibForgeFhevmHostVersions.accepts(floor, floor, ceiling),
            string.concat(floor, ": floor within its own line")
        );
        assertTrue(
            LibForgeFhevmHostVersions.accepts(ceiling, floor, ceiling),
            string.concat(ceiling, ": ceiling within its own line")
        );
    }

    // ---------------------------------------------------------------------------------------------
    // Which line is this?
    //
    // `classify` is what lets a fork of a chain one generation behind be upgraded in memory instead of
    // refused. Getting it wrong in the permissive direction runs the wrong upgrade against a live
    // stack, so every case below is a real release of a real line, spelled out.
    // ---------------------------------------------------------------------------------------------

    /// fhevm v0.13.0, the first release of THIS line.
    function _currentLineFirstRelease() private pure returns (HostVersions memory) {
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
    function _currentLineLastRelease() private pure returns (HostVersions memory versions) {
        versions = _currentLineFirstRelease();
        versions.fhevmExecutor = "FHEVMExecutor v0.5.0";
    }

    /// fhevm v0.14.0 -- the line ABOVE this one, which this SDK cannot speak.
    function _nextLineFirstRelease() private pure returns (HostVersions memory) {
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
            acl: LibForgeFhevmHostVersions.aclCeiling(),
            fhevmExecutor: LibForgeFhevmHostVersions.fhevmExecutorCeiling(),
            kmsVerifier: LibForgeFhevmHostVersions.kmsVerifierCeiling(),
            inputVerifier: LibForgeFhevmHostVersions.inputVerifierCeiling(),
            hcuLimit: LibForgeFhevmHostVersions.hcuLimitCeiling(),
            protocolConfig: LibForgeFhevmHostVersions.protocolConfigCeiling(),
            kmsGeneration: LibForgeFhevmHostVersions.kmsGenerationCeiling()
        });
    }

    /// NOTHING BELOW THIS LINE IS RECOGNISED, and that is the whole difference from the generation
    /// above. There, a stack one line back is classified `Previous` and upgraded in memory; here there
    /// is no such chain in production, so the bounds do not exist and the answer is `Unknown` -- which
    /// the SDK refuses by name. `test_theLineBelowIsUnknown` is the case that proves it.
    function test_noStackIsEverClassifiedPrevious() public pure {
        assertEq(
            uint8(LibForgeFhevmHostVersions.classify(_currentLineFirstRelease())),
            uint8(FhevmGeneration.Current),
            "this line is Current"
        );
        assertEq(
            uint8(LibForgeFhevmHostVersions.classify(_nextLineFirstRelease())),
            uint8(FhevmGeneration.Unknown),
            "the line above is Unknown, not Previous"
        );
    }

    function test_everyReleaseOfThisLineIsRecognised() public pure {
        assertEq(
            uint8(LibForgeFhevmHostVersions.classify(_currentLineFirstRelease())),
            uint8(FhevmGeneration.Current),
            "0.14.0"
        );
        assertEq(
            uint8(LibForgeFhevmHostVersions.classify(_currentLineVendoredRelease())),
            uint8(FhevmGeneration.Current),
            "the vendored one"
        );
    }

    /// A patch release moves no minor, so it must land on the same line.
    function test_aPatchReleaseChangesNothing() public pure {
        HostVersions memory patched = _currentLineLastRelease();
        patched.acl = "ACL v0.4.7";
        patched.kmsVerifier = "KMSVerifier v0.3.99";
        assertEq(uint8(LibForgeFhevmHostVersions.classify(patched)), uint8(FhevmGeneration.Current), "still 0.13");
    }

    /// The line below: no ProtocolConfig, no KMSGeneration, and older everything else. Refused without
    /// this file knowing a single thing about 0.12 -- and refused rather than upgraded, because no chain
    /// in production runs it.
    function test_theLineBelowIsUnknown() public pure {
        HostVersions memory v12 = HostVersions({
            acl: "ACL v0.3.0",
            fhevmExecutor: "FHEVMExecutor v0.3.0",
            kmsVerifier: "KMSVerifier v0.2.0",
            inputVerifier: "InputVerifier v0.1.0",
            hcuLimit: "HCULimit v0.2.0",
            protocolConfig: "",
            kmsGeneration: ""
        });
        assertEq(uint8(LibForgeFhevmHostVersions.classify(v12)), uint8(FhevmGeneration.Unknown), "0.12");
    }

    /// A line this SDK has not seen. Newer is refused exactly like older: it cannot know the ABI.
    function test_theNextLineIsUnknown() public pure {
        assertEq(
            uint8(LibForgeFhevmHostVersions.classify(_nextLineFirstRelease())), uint8(FhevmGeneration.Unknown), "0.14"
        );
    }

    /// One contract missing is enough to refuse: a half-read stack is not a stack we can classify.
    function test_anAbsentContractIsUnknown() public pure {
        HostVersions memory missing = _currentLineLastRelease();
        missing.kmsGeneration = "";
        assertEq(uint8(LibForgeFhevmHostVersions.classify(missing)), uint8(FhevmGeneration.Unknown), "absent");
    }

    /// A stack mid-upgrade, half on each line, belongs to neither.
    function test_aMixedStackIsUnknown() public pure {
        HostVersions memory mixed = _currentLineLastRelease();
        mixed.acl = "ACL v0.5.0";
        assertEq(uint8(LibForgeFhevmHostVersions.classify(mixed)), uint8(FhevmGeneration.Unknown), "half upgraded");
    }

    /// Garbage in every field, and one field at a time, is never a line.
    function test_unparseableReadingsAreUnknown() public pure {
        HostVersions memory nothing;
        assertEq(uint8(LibForgeFhevmHostVersions.classify(nothing)), uint8(FhevmGeneration.Unknown), "all empty");

        HostVersions memory oneBad = _currentLineLastRelease();
        oneBad.hcuLimit = "HCULimit 0.3.0";
        assertEq(uint8(LibForgeFhevmHostVersions.classify(oneBad)), uint8(FhevmGeneration.Unknown), "missing the v");
    }

    /// The executor spans two lines -- v0.5.0 is both this line's last release and the next line's
    /// first -- so it cannot decide alone. The conjunction over all seven is what resolves it.
    function test_theContractThatOverlapsCannotDecideAlone() public pure {
        assertTrue(
            LibForgeFhevmHostVersions.acceptsLine(
                "FHEVMExecutor v0.5.0",
                LibForgeFhevmHostVersions.FHEVM_EXECUTOR_FLOOR,
                LibForgeFhevmHostVersions.fhevmExecutorCeiling()
            ),
            "the executor at v0.5.0 fits this line"
        );
        HostVersions memory next = _nextLineFirstRelease();
        assertEq(next.fhevmExecutor, "FHEVMExecutor v0.5.0", "and the next line opens with the same reading");
        assertEq(
            uint8(LibForgeFhevmHostVersions.classify(next)),
            uint8(FhevmGeneration.Unknown),
            "which the other six outvote"
        );
    }

    /// `acceptsLine` ignores the patch; `accepts` does not. Two questions, two comparisons.
    function test_acceptsLineIgnoresThePatchAndAcceptsDoesNot() public pure {
        assertTrue(
            LibForgeFhevmHostVersions.acceptsLine("ACL v0.4.9", "ACL v0.4.0", "ACL v0.4.0"), "line: patch ignored"
        );
        assertFalse(LibForgeFhevmHostVersions.accepts("ACL v0.4.9", "ACL v0.4.0", "ACL v0.4.0"), "gate: patch counts");
    }

    /// The floors this file states are the ones the library ships, so a line change cannot move one
    /// without moving the other.
    function test_thisLineFloorsAreTheOnesRecorded() public pure {
        HostVersions memory floors = _currentLineFirstRelease();
        assertEq(floors.acl, LibForgeFhevmHostVersions.ACL_FLOOR, "acl");
        assertEq(floors.fhevmExecutor, LibForgeFhevmHostVersions.FHEVM_EXECUTOR_FLOOR, "executor");
        assertEq(floors.kmsVerifier, LibForgeFhevmHostVersions.KMS_VERIFIER_FLOOR, "kmsVerifier");
        assertEq(floors.inputVerifier, LibForgeFhevmHostVersions.INPUT_VERIFIER_FLOOR, "inputVerifier");
        assertEq(floors.hcuLimit, LibForgeFhevmHostVersions.HCU_LIMIT_FLOOR, "hcuLimit");
        assertEq(floors.protocolConfig, LibForgeFhevmHostVersions.PROTOCOL_CONFIG_FLOOR, "protocolConfig");
        assertEq(floors.kmsGeneration, LibForgeFhevmHostVersions.KMS_GENERATION_FLOOR, "kmsGeneration");
    }
}
