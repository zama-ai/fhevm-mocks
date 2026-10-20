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
    PROTOCOL_CONFIG_ADDRESS
} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";

/**
 * @notice The two questions the probe answers, against a real in-process stack: "is this a cleartext mock"
 *         and "is this the forge-only variant of one". The second is strictly narrower, and it is the only
 *         way to ask it — `getVersion()` reports the same string for both variants of a contract.
 */
contract LibCleartextProbeTest is Test, ForgeFhevmDeploy {
    address private constant NOT_A_CONTRACT = address(0xDEAD);

    function setUp() public {
        deployLocalFhevm();
    }

    /// Every substitution answers the cleartext marker; the two vendored contracts do not, and neither does
    /// an address with no code.
    function test_isCleartextAnswersForTheSubstitutionsOnly() public view {
        assertTrue(LibCleartextProbe.isCleartext(ACL_ADDRESS), "acl");
        assertTrue(LibCleartextProbe.isCleartext(FHEVM_EXECUTOR_ADDRESS), "executor");
        assertTrue(LibCleartextProbe.isCleartext(KMS_VERIFIER_ADDRESS), "kms verifier");
        assertTrue(LibCleartextProbe.isCleartext(INPUT_VERIFIER_ADDRESS), "input verifier");
        assertTrue(LibCleartextProbe.isCleartext(HCU_LIMIT_ADDRESS), "hcu limit");
        assertTrue(LibCleartextProbe.isCleartext(CLEARTEXT_ARITHMETIC_ADDRESS), "arithmetic");
        assertTrue(LibCleartextProbe.isCleartext(CLEARTEXT_DB_ADDRESS), "db");

        assertFalse(LibCleartextProbe.isCleartext(PROTOCOL_CONFIG_ADDRESS), "vendored, no marker");
        assertFalse(LibCleartextProbe.isCleartext(KMS_GENERATION_ADDRESS), "vendored, no marker");
        assertFalse(LibCleartextProbe.isCleartext(NOT_A_CONTRACT), "no code at all");
    }

    /// The forge variants, and only them. A cleartext contract without one answers false, which is what
    /// makes this a real question rather than a second spelling of `isCleartext`.
    function test_isForgeAnswersForTheForgeVariantsOnly() public view {
        assertTrue(LibCleartextProbe.isForge(ACL_ADDRESS), "acl");
        assertTrue(LibCleartextProbe.isForge(FHEVM_EXECUTOR_ADDRESS), "executor");
        assertTrue(LibCleartextProbe.isForge(HCU_LIMIT_ADDRESS), "hcu limit");
        assertTrue(LibCleartextProbe.isForge(CLEARTEXT_ARITHMETIC_ADDRESS), "arithmetic");

        // Cleartext, but deployed from the same blob on every path: no forge variant exists for these.
        assertFalse(LibCleartextProbe.isForge(KMS_VERIFIER_ADDRESS), "kms verifier has no forge variant");
        assertFalse(LibCleartextProbe.isForge(INPUT_VERIFIER_ADDRESS), "input verifier has no forge variant");
        assertFalse(LibCleartextProbe.isForge(CLEARTEXT_DB_ADDRESS), "db has no forge variant");

        assertFalse(LibCleartextProbe.isForge(PROTOCOL_CONFIG_ADDRESS), "vendored");
        assertFalse(LibCleartextProbe.isForge(NOT_A_CONTRACT), "no code at all");
    }

    /// `isForge` implies `isCleartext`: the forge variants extend the cleartext ones.
    function test_everyForgeVariantIsAlsoCleartext() public view {
        address[9] memory stack = [
            ACL_ADDRESS,
            FHEVM_EXECUTOR_ADDRESS,
            KMS_VERIFIER_ADDRESS,
            INPUT_VERIFIER_ADDRESS,
            HCU_LIMIT_ADDRESS,
            CLEARTEXT_ARITHMETIC_ADDRESS,
            CLEARTEXT_DB_ADDRESS,
            PROTOCOL_CONFIG_ADDRESS,
            KMS_GENERATION_ADDRESS
        ];
        for (uint256 i = 0; i < stack.length; i++) {
            if (LibCleartextProbe.isForge(stack[i])) {
                assertTrue(
                    LibCleartextProbe.isCleartext(stack[i]),
                    string.concat("forge but not cleartext: ", vm.toString(stack[i]))
                );
            }
        }
    }
}
