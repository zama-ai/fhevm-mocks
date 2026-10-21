// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {
    LocalHostVersions as PreviousHostVersions
} from "@fhevm/host-contracts-cleartext-v13-dev/pkg/forge/src/_internal/LocalHostVersions.sol";
import {
    FhevmGeneration,
    HostVersions,
    LibForgeFhevmHostVersions
} from "../../pkg/forge/src/LibForgeFhevmHostVersions.sol";

/**
 * @title PreviousLineCeilingsTest
 * @notice The previous line's hand-written ceilings in `LibForgeFhevmHostVersions` are the versions the
 *         previous generation's package vendors, read from ITS generated `LocalHostVersions`.
 *
 * The library is published, and the previous generation's package does not ship with it, so the ceilings
 * cannot be imported there: they are written down, and checked here. A patch release of the previous
 * generation that moves a contract's version fails this test until the ceiling follows it.
 *
 * Its own file because it belongs to the cross-generation lane: it reads the previous generation through
 * its remapping (`remappings.txt`), and goes with `test/upgrade/` when the pair rotates.
 */
contract PreviousLineCeilingsTest is Test {
    function test_theCeilingsAreThePreviousGenerationsVendoredVersions() public pure {
        assertEq(LibForgeFhevmHostVersions.PREVIOUS_ACL_CEILING, PreviousHostVersions.ACL, "acl");
        assertEq(
            LibForgeFhevmHostVersions.PREVIOUS_FHEVM_EXECUTOR_CEILING, PreviousHostVersions.FHEVM_EXECUTOR, "executor"
        );
        assertEq(
            LibForgeFhevmHostVersions.PREVIOUS_KMS_VERIFIER_CEILING, PreviousHostVersions.KMS_VERIFIER, "kmsVerifier"
        );
        assertEq(
            LibForgeFhevmHostVersions.PREVIOUS_INPUT_VERIFIER_CEILING,
            PreviousHostVersions.INPUT_VERIFIER,
            "inputVerifier"
        );
        assertEq(LibForgeFhevmHostVersions.PREVIOUS_HCU_LIMIT_CEILING, PreviousHostVersions.HCU_LIMIT, "hcuLimit");
        assertEq(
            LibForgeFhevmHostVersions.PREVIOUS_PROTOCOL_CONFIG_CEILING,
            PreviousHostVersions.PROTOCOL_CONFIG,
            "protocolConfig"
        );
        assertEq(
            LibForgeFhevmHostVersions.PREVIOUS_KMS_GENERATION_CEILING,
            PreviousHostVersions.KMS_GENERATION,
            "kmsGeneration"
        );
    }

    /// And a stack of the previous generation's vendored contracts is classified as the previous line.
    function test_thePreviousGenerationsVendoredStackIsThePreviousLine() public pure {
        HostVersions memory previous = HostVersions({
            acl: PreviousHostVersions.ACL,
            fhevmExecutor: PreviousHostVersions.FHEVM_EXECUTOR,
            kmsVerifier: PreviousHostVersions.KMS_VERIFIER,
            inputVerifier: PreviousHostVersions.INPUT_VERIFIER,
            hcuLimit: PreviousHostVersions.HCU_LIMIT,
            protocolConfig: PreviousHostVersions.PROTOCOL_CONFIG,
            kmsGeneration: PreviousHostVersions.KMS_GENERATION
        });
        assertEq(uint8(LibForgeFhevmHostVersions.classify(previous)), uint8(FhevmGeneration.Previous));
    }
}
