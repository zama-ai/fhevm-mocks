// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FhevmGeneration, HostVersions, LibForgeFhevmHostVersions, Version} from "./_host/LibForgeFhevmHostVersions.sol";

/**
 * @title LibFhevmVersion
 * @notice The SDK's name for the version logic, which lives in the payload.
 *
 * @dev WHY IT MOVED. Which generation a stack is on is a FACT ABOUT THE HOST CONTRACTS, and the code that
 *      acts on it -- `LibForgeFhevmUpgrade` -- lives with them. Keeping the answer here meant the payload
 *      could not ask it: `host-contracts-cleartext` cannot import from this package, so its own tests
 *      re-derived `classify` by hand and got the subtle part wrong (`InputVerifier`'s bytecode does not
 *      change between generations, so a stack fully on the previous line still reports THIS version for
 *      it). One implementation, in the package that owns the contracts, is the fix.
 *
 * @dev WHAT STAYED. Only the naming. What this SDK does about an answer -- accept, refuse, and what the
 *      refusal says -- is rule 2.15's business and remains here, in `FhevmVm._requireSupportedVersions`
 *      and `LibFhevmFail.versionMismatch`. The payload reports; this layer decides.
 *
 * @dev WHY A FORWARDER RATHER THAN AN IMPORT AT EVERY CALL SITE. `_host/**` is generated, and a test that
 *      reads `LibFhevmVersion.aclCeiling()` should not have to know that. The types are re-exported from
 *      the payload rather than redeclared: two declarations of `FhevmGeneration` would be two distinct
 *      types, and the compiler would refuse to pass one where the other is expected.
 */
library LibFhevmVersion {
    // -- The current line's floors, for the gate's message ----------------------

    string internal constant ACL_FLOOR = LibForgeFhevmHostVersions.ACL_FLOOR;
    string internal constant FHEVM_EXECUTOR_FLOOR = LibForgeFhevmHostVersions.FHEVM_EXECUTOR_FLOOR;
    string internal constant INPUT_VERIFIER_FLOOR = LibForgeFhevmHostVersions.INPUT_VERIFIER_FLOOR;
    string internal constant KMS_VERIFIER_FLOOR = LibForgeFhevmHostVersions.KMS_VERIFIER_FLOOR;
    string internal constant PROTOCOL_CONFIG_FLOOR = LibForgeFhevmHostVersions.PROTOCOL_CONFIG_FLOOR;
    string internal constant HCU_LIMIT_FLOOR = LibForgeFhevmHostVersions.HCU_LIMIT_FLOOR;
    string internal constant KMS_GENERATION_FLOOR = LibForgeFhevmHostVersions.KMS_GENERATION_FLOOR;

    // -- The ceilings: what this SDK vendors ------------------------------------

    function aclCeiling() internal pure returns (string memory) {
        return LibForgeFhevmHostVersions.aclCeiling();
    }

    function fhevmExecutorCeiling() internal pure returns (string memory) {
        return LibForgeFhevmHostVersions.fhevmExecutorCeiling();
    }

    function inputVerifierCeiling() internal pure returns (string memory) {
        return LibForgeFhevmHostVersions.inputVerifierCeiling();
    }

    function kmsVerifierCeiling() internal pure returns (string memory) {
        return LibForgeFhevmHostVersions.kmsVerifierCeiling();
    }

    function protocolConfigCeiling() internal pure returns (string memory) {
        return LibForgeFhevmHostVersions.protocolConfigCeiling();
    }

    function hcuLimitCeiling() internal pure returns (string memory) {
        return LibForgeFhevmHostVersions.hcuLimitCeiling();
    }

    function kmsGenerationCeiling() internal pure returns (string memory) {
        return LibForgeFhevmHostVersions.kmsGenerationCeiling();
    }

    // -- Asking ------------------------------------------------------------------

    function parse(string memory value) internal pure returns (Version memory) {
        return LibForgeFhevmHostVersions.parse(value);
    }

    function accepts(string memory actual, string memory floor, string memory ceiling) internal pure returns (bool) {
        return LibForgeFhevmHostVersions.accepts(actual, floor, ceiling);
    }

    function acceptsLine(string memory actual, string memory floor, string memory ceiling)
        internal
        pure
        returns (bool)
    {
        return LibForgeFhevmHostVersions.acceptsLine(actual, floor, ceiling);
    }

    function classify(HostVersions memory versions) internal pure returns (FhevmGeneration) {
        return LibForgeFhevmHostVersions.classify(versions);
    }

    /// @notice The seven `getVersion()` strings of the stack at these addresses; absent reads as `""`.
    function read(
        address acl,
        address fhevmExecutor,
        address kmsVerifier,
        address inputVerifier,
        address hcuLimit,
        address protocolConfig,
        address kmsGeneration
    ) internal view returns (HostVersions memory) {
        return LibForgeFhevmHostVersions.read(
            acl, fhevmExecutor, kmsVerifier, inputVerifier, hcuLimit, protocolConfig, kmsGeneration
        );
    }
}
