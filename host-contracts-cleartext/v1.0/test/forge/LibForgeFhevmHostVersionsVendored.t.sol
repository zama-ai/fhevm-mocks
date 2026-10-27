// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {
    ACL_ADDRESS,
    CLEARTEXT_ARITHMETIC_ADDRESS,
    CLEARTEXT_DB_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    HCU_LIMIT_ADDRESS,
    INPUT_VERIFIER_ADDRESS,
    KMS_GENERATION_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    PAUSER_SET_ADDRESS,
    PROTOCOL_CONFIG_ADDRESS
} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {LocalHostVersions} from "../../pkg/forge/src/_internal/LocalHostVersions.sol";
import {
    FhevmGeneration,
    HostVersions,
    LibForgeFhevmHostVersions
} from "../../pkg/forge/src/LibForgeFhevmHostVersions.sol";

/**
 * @notice `LibForgeFhevmHostVersions` against a stack that EXISTS, rather than against strings.
 *
 * @dev WHY THIS FILE IS SEPARATE FROM `LibForgeFhevmHostVersions.t.sol`. That one is a parser and
 *      classifier test: it feeds the library version strings written by hand and checks what it makes of
 *      them. Every assertion in it would still pass if the contracts this package vendors reported
 *      something else entirely -- a renamed contract, a `getVersion` that reverts, a version the floors
 *      do not admit. Nothing there reads a deployed contract, so nothing there can notice.
 *
 *      This file closes that gap from the other end. It deploys the vendored stack and asks the library
 *      the same questions the SDK asks it on a fork: `versionOf` each address, `read` all seven at once,
 *      `accepts` against the floors and the generated ceilings, and `classify` the result. If the
 *      vendored contracts and the hand-written floors ever disagree, this is where it shows.
 */
contract LibForgeFhevmHostVersionsVendoredTest is Test, ForgeFhevmDeploy {
    function setUp() public {
        deployLocalFhevm();
    }

    // -- versionOf, one address at a time ------------------------------------------------------------

    /// Every contract that HAS a `getVersion` answers, and answers what the generated table says.
    function test_versionOfEveryVendoredContract() public view {
        assertEq(LibForgeFhevmHostVersions.versionOf(ACL_ADDRESS), LocalHostVersions.ACL, "acl");
        assertEq(
            LibForgeFhevmHostVersions.versionOf(FHEVM_EXECUTOR_ADDRESS), LocalHostVersions.FHEVM_EXECUTOR, "executor"
        );
        assertEq(
            LibForgeFhevmHostVersions.versionOf(KMS_VERIFIER_ADDRESS), LocalHostVersions.KMS_VERIFIER, "kmsVerifier"
        );
        assertEq(
            LibForgeFhevmHostVersions.versionOf(INPUT_VERIFIER_ADDRESS),
            LocalHostVersions.INPUT_VERIFIER,
            "inputVerifier"
        );
        assertEq(LibForgeFhevmHostVersions.versionOf(HCU_LIMIT_ADDRESS), LocalHostVersions.HCU_LIMIT, "hcuLimit");
        assertEq(
            LibForgeFhevmHostVersions.versionOf(PROTOCOL_CONFIG_ADDRESS),
            LocalHostVersions.PROTOCOL_CONFIG,
            "protocolConfig"
        );
        assertEq(
            LibForgeFhevmHostVersions.versionOf(KMS_GENERATION_ADDRESS),
            LocalHostVersions.KMS_GENERATION,
            "kmsGeneration"
        );
        assertEq(LibForgeFhevmHostVersions.versionOf(PAUSER_SET_ADDRESS), LocalHostVersions.PAUSER_SET, "pauserSet");
        assertEq(
            LibForgeFhevmHostVersions.versionOf(CLEARTEXT_ARITHMETIC_ADDRESS),
            LocalHostVersions.CLEARTEXT_ARITHMETIC,
            "cleartextArithmetic"
        );
        assertEq(LibForgeFhevmHostVersions.versionOf(CLEARTEXT_DB_ADDRESS), LocalHostVersions.CLEARTEXT_DB, "db");
    }

    /**
     * THE CLEARTEXT VARIANTS REPORT THEIR BASE CONTRACT'S NAME, which is not a detail: the whole version
     * gate compares readings against floors named for the PRODUCTION contracts, and a cleartext stack
     * would fail every one of them if the subclasses renamed themselves.
     */
    function test_theCleartextVariantsInheritTheBaseName() public view {
        assertEq(LibForgeFhevmHostVersions.versionOf(ACL_ADDRESS), LocalHostVersions.ACL, "CleartextACL says ACL");
        assertEq(
            LibForgeFhevmHostVersions.versionOf(FHEVM_EXECUTOR_ADDRESS),
            LocalHostVersions.FHEVM_EXECUTOR,
            "CleartextForgeFHEVMExecutor says FHEVMExecutor"
        );
    }

    /// @dev An address with no code, and one whose code has no `getVersion`, both read as empty rather
    ///      than reverting -- which is what lets `read` be called on a stack before it is known to be one.
    function test_versionOfSomethingThatCannotAnswerIsEmpty() public view {
        assertEq(LibForgeFhevmHostVersions.versionOf(address(0xdead)), "", "no code");
        assertEq(LibForgeFhevmHostVersions.versionOf(address(this)), "", "code, but no getVersion");
    }

    // -- read, all seven at once ---------------------------------------------------------------------

    function test_readReturnsWhatEachContractReports() public view {
        HostVersions memory versions = _readVendored();

        assertEq(versions.acl, LocalHostVersions.ACL, "acl");
        assertEq(versions.fhevmExecutor, LocalHostVersions.FHEVM_EXECUTOR, "executor");
        assertEq(versions.kmsVerifier, LocalHostVersions.KMS_VERIFIER, "kmsVerifier");
        assertEq(versions.inputVerifier, LocalHostVersions.INPUT_VERIFIER, "inputVerifier");
        assertEq(versions.hcuLimit, LocalHostVersions.HCU_LIMIT, "hcuLimit");
        assertEq(versions.protocolConfig, LocalHostVersions.PROTOCOL_CONFIG, "protocolConfig");
        assertEq(versions.kmsGeneration, LocalHostVersions.KMS_GENERATION, "kmsGeneration");
    }

    // -- accepts, against the floors and the generated ceilings ---------------------------------------

    /**
     * THE READING THE STACK GIVES MUST PASS THE GATE THE SDK APPLIES. This is the assertion the
     * string-only suite cannot make: the floors are hand-written, the ceilings are generated from what
     * this package vendors, and the readings come from the contracts themselves. A floor raised past the
     * vendored release, or a contract whose version moved without the floor moving, fails here.
     */
    function test_everyVendoredReadingIsAcceptedByItsOwnBounds() public view {
        HostVersions memory versions = _readVendored();

        assertTrue(
            LibForgeFhevmHostVersions.accepts(
                versions.acl, LibForgeFhevmHostVersions.ACL_FLOOR, LibForgeFhevmHostVersions.aclCeiling()
            ),
            "acl"
        );
        assertTrue(
            LibForgeFhevmHostVersions.accepts(
                versions.fhevmExecutor,
                LibForgeFhevmHostVersions.FHEVM_EXECUTOR_FLOOR,
                LibForgeFhevmHostVersions.fhevmExecutorCeiling()
            ),
            "executor"
        );
        assertTrue(
            LibForgeFhevmHostVersions.accepts(
                versions.kmsVerifier,
                LibForgeFhevmHostVersions.KMS_VERIFIER_FLOOR,
                LibForgeFhevmHostVersions.kmsVerifierCeiling()
            ),
            "kmsVerifier"
        );
        assertTrue(
            LibForgeFhevmHostVersions.accepts(
                versions.inputVerifier,
                LibForgeFhevmHostVersions.INPUT_VERIFIER_FLOOR,
                LibForgeFhevmHostVersions.inputVerifierCeiling()
            ),
            "inputVerifier"
        );
        assertTrue(
            LibForgeFhevmHostVersions.accepts(
                versions.hcuLimit,
                LibForgeFhevmHostVersions.HCU_LIMIT_FLOOR,
                LibForgeFhevmHostVersions.hcuLimitCeiling()
            ),
            "hcuLimit"
        );
        assertTrue(
            LibForgeFhevmHostVersions.accepts(
                versions.protocolConfig,
                LibForgeFhevmHostVersions.PROTOCOL_CONFIG_FLOOR,
                LibForgeFhevmHostVersions.protocolConfigCeiling()
            ),
            "protocolConfig"
        );
        assertTrue(
            LibForgeFhevmHostVersions.accepts(
                versions.kmsGeneration,
                LibForgeFhevmHostVersions.KMS_GENERATION_FLOOR,
                LibForgeFhevmHostVersions.kmsGenerationCeiling()
            ),
            "kmsGeneration"
        );
    }

    /// The ceilings are generated from the same build this stack was deployed from, so each one IS the
    /// reading. Stated separately because it is what makes the ceilings trustworthy at all.
    function test_theGeneratedCeilingsAreTheVendoredReadings() public view {
        HostVersions memory versions = _readVendored();

        assertEq(versions.acl, LibForgeFhevmHostVersions.aclCeiling(), "acl");
        assertEq(versions.fhevmExecutor, LibForgeFhevmHostVersions.fhevmExecutorCeiling(), "executor");
        assertEq(versions.kmsVerifier, LibForgeFhevmHostVersions.kmsVerifierCeiling(), "kmsVerifier");
        assertEq(versions.inputVerifier, LibForgeFhevmHostVersions.inputVerifierCeiling(), "inputVerifier");
        assertEq(versions.hcuLimit, LibForgeFhevmHostVersions.hcuLimitCeiling(), "hcuLimit");
        assertEq(versions.protocolConfig, LibForgeFhevmHostVersions.protocolConfigCeiling(), "protocolConfig");
        assertEq(versions.kmsGeneration, LibForgeFhevmHostVersions.kmsGenerationCeiling(), "kmsGeneration");
    }

    // -- classify ------------------------------------------------------------------------------------

    /// THE QUESTION THE SDK ACTUALLY ASKS. Everything above is machinery; this is the answer that decides
    /// whether a fork is prepared or refused, taken from a stack rather than from a string.
    function test_theVendoredStackClassifiesAsThisGeneration() public view {
        assertEq(
            uint8(LibForgeFhevmHostVersions.classify(_readVendored())),
            uint8(FhevmGeneration.Current),
            "the stack this package vendors is this package's generation"
        );
    }

    /// And one contract moved off the line is enough to lose that, read from the stack and then edited --
    /// so the conjunction is doing work on real readings, not only on invented ones.
    function test_oneContractOffTheLineLosesIt() public view {
        HostVersions memory versions = _readVendored();
        versions.protocolConfig = "ProtocolConfig v9.0.0";

        assertEq(
            uint8(LibForgeFhevmHostVersions.classify(versions)), uint8(FhevmGeneration.Unknown), "no longer this line"
        );
    }

    function _readVendored() private view returns (HostVersions memory) {
        return LibForgeFhevmHostVersions.read(
            ACL_ADDRESS,
            FHEVM_EXECUTOR_ADDRESS,
            KMS_VERIFIER_ADDRESS,
            INPUT_VERIFIER_ADDRESS,
            HCU_LIMIT_ADDRESS,
            PROTOCOL_CONFIG_ADDRESS,
            KMS_GENERATION_ADDRESS
        );
    }
}
