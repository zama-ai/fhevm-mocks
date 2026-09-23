// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {LocalHostVersions} from "./_host/_internal/LocalHostVersions.sol";

/**
 * @title LibFhevmVersion
 * @notice The protocol versions this SDK accepts on a fork: EVERY release of the fhevm line it vendors,
 *         not only the one it was generated from.
 *
 * @dev WHY A RANGE. A host contract reports `"<Name> vMAJOR.MINOR.PATCH"` from `getVersion()`, and a
 *      protocol line (fhevm 0.14.x) moves those numbers as it patches: on the 0.13 line `FHEVMExecutor` was
 *      `v0.4.0` from 0.13.0 to 0.13.5 and `v0.5.0` from 0.13.6. The chains do not all upgrade the same day —
 *      Sepolia ran `v0.4.0` after the 0.13 SDK vendored 0.13.6 — so an exact match against the vendored version
 *      would refuse a stack whose ABI this SDK speaks perfectly well. What must never pass is another
 *      LINE: 0.13.x (`ACL v0.4.0`) is a different ABI, and a devnet running the next line (`ACL v0.6.0`)
 *      is one this SDK has not seen.
 *
 * @dev THE FLOOR IS HAND-WRITTEN, THE CEILING IS GENERATED. `LocalHostVersions` (regenerated from the
 *      vendored contracts by v14's `generate:contract-versions`) is what the line reports at the commit
 *      this SDK vendors — the newest it knows, hence the ceiling. The floor is what the line reported at
 *      its FIRST release, read off the tags of `zama-ai/fhevm` at v0.14.0 (`host-contracts/contracts`),
 *      and it moves only when this SDK moves to another line. `LibFhevmVersion.t.sol` pins both ends.
 */
/**
 * @notice Which protocol line a stack's version strings identify.
 * @dev `Previous` is the one case this SDK can do anything about beyond refusing: it is the line the
 *      current generation knows how to upgrade FROM, so a fork of such a chain can be brought forward
 *      in memory rather than turned away. Anything older, or anything newer, is `Unknown`.
 */
enum FhevmGeneration {
    Unknown,
    Previous,
    Current
}

/**
 * @notice One `getVersion()` reading per host contract, as the chain reports them.
 * @dev AN EMPTY STRING MEANS THE CONTRACT IS NOT DEPLOYED, and that is a reading in its own right, not
 *      a missing value: `ProtocolConfig` and `KMSGeneration` arrived with the 0.13 line, so their
 *      absence is what tells an older stack apart from one this SDK could upgrade. A caller that cannot
 *      reach a contract passes "" rather than reverting.
 */
struct HostVersions {
    string acl;
    string fhevmExecutor;
    string kmsVerifier;
    string inputVerifier;
    string hcuLimit;
    string protocolConfig;
    string kmsGeneration;
}

library LibFhevmVersion {
    // -- The floor: fhevm v0.14.0 -------------------------------------------

    string internal constant ACL_FLOOR = "ACL v0.5.0";
    string internal constant FHEVM_EXECUTOR_FLOOR = "FHEVMExecutor v0.5.0";
    string internal constant INPUT_VERIFIER_FLOOR = "InputVerifier v0.2.0";
    string internal constant KMS_VERIFIER_FLOOR = "KMSVerifier v0.4.0";
    string internal constant PROTOCOL_CONFIG_FLOOR = "ProtocolConfig v0.2.0";

    // The two the fork gate does not check, because five contracts are enough to recognise a wrong
    // line. `classify` uses all seven: the more of them, the less any single contract's history can
    // make two lines look alike.
    string internal constant HCU_LIMIT_FLOOR = "HCULimit v0.4.0";
    string internal constant KMS_GENERATION_FLOOR = "KMSGeneration v0.2.0";

    // -- The previous line: fhevm 0.13 --------------------------------------
    //
    // BOTH ENDS ARE HAND-WRITTEN, unlike the current line's generated ceiling, and they can be: the
    // 0.13 line is closed. Its generation lives on here as V(N-1) and rule 3.4.6 forbids editing it, so
    // nothing about it can move again. The numbers are the tags of `zama-ai/fhevm`: v0.13.0 for the
    // floors, and the last 0.13 release for the ceilings — only `FHEVMExecutor` moved across the line,
    // from v0.4.0 to v0.5.0 at 0.13.6.

    string internal constant PREVIOUS_ACL_FLOOR = "ACL v0.4.0";
    string internal constant PREVIOUS_ACL_CEILING = "ACL v0.4.0";
    string internal constant PREVIOUS_FHEVM_EXECUTOR_FLOOR = "FHEVMExecutor v0.4.0";
    string internal constant PREVIOUS_FHEVM_EXECUTOR_CEILING = "FHEVMExecutor v0.5.0";
    string internal constant PREVIOUS_KMS_VERIFIER_FLOOR = "KMSVerifier v0.3.0";
    string internal constant PREVIOUS_KMS_VERIFIER_CEILING = "KMSVerifier v0.3.0";
    string internal constant PREVIOUS_INPUT_VERIFIER_FLOOR = "InputVerifier v0.2.0";
    string internal constant PREVIOUS_INPUT_VERIFIER_CEILING = "InputVerifier v0.2.0";
    string internal constant PREVIOUS_HCU_LIMIT_FLOOR = "HCULimit v0.3.0";
    string internal constant PREVIOUS_HCU_LIMIT_CEILING = "HCULimit v0.3.0";
    string internal constant PREVIOUS_PROTOCOL_CONFIG_FLOOR = "ProtocolConfig v0.1.0";
    string internal constant PREVIOUS_PROTOCOL_CONFIG_CEILING = "ProtocolConfig v0.1.0";
    string internal constant PREVIOUS_KMS_GENERATION_FLOOR = "KMSGeneration v0.1.0";
    string internal constant PREVIOUS_KMS_GENERATION_CEILING = "KMSGeneration v0.1.0";

    // -- The ceiling: the vendored release --------------------------------------

    function aclCeiling() internal pure returns (string memory) {
        return LocalHostVersions.ACL;
    }

    function fhevmExecutorCeiling() internal pure returns (string memory) {
        return LocalHostVersions.FHEVM_EXECUTOR;
    }

    function inputVerifierCeiling() internal pure returns (string memory) {
        return LocalHostVersions.INPUT_VERIFIER;
    }

    function kmsVerifierCeiling() internal pure returns (string memory) {
        return LocalHostVersions.KMS_VERIFIER;
    }

    function protocolConfigCeiling() internal pure returns (string memory) {
        return LocalHostVersions.PROTOCOL_CONFIG;
    }

    // -- The rule -------------------------------------------------------------

    /// @notice A parsed `"<Name> vMAJOR.MINOR.PATCH"`. `ok` is false when the string is not of that shape.
    struct Version {
        bool ok;
        bytes32 nameHash;
        uint256 major;
        uint256 minor;
        uint256 patch;
    }

    /**
     * @notice Whether `actual` is a version this SDK accepts for a contract whose line runs from `floor`
     *         to `ceiling` inclusive: same name, same major, and `floor <= actual <= ceiling` on
     *         (minor, patch). Anything that does not parse is refused.
     */
    function accepts(string memory actual, string memory floor, string memory ceiling) internal pure returns (bool) {
        Version memory a = parse(actual);
        Version memory lo = parse(floor);
        Version memory hi = parse(ceiling);
        if (!a.ok || !lo.ok || !hi.ok) return false;
        if (a.nameHash != lo.nameHash || a.nameHash != hi.nameHash) return false;
        if (a.major != lo.major || a.major != hi.major) return false;
        return !_less(a, lo) && !_less(hi, a);
    }

    // -- Which line is this? --------------------------------------------------

    /**
     * @notice The line `versions` belongs to, or `Unknown`.
     *
     * @dev BY CONJUNCTION, never by one contract. The two lines overlap: `FHEVMExecutor` spans v0.4.0
     *      to v0.5.0 on the 0.13 line and v0.5.0 upward on this one, so a reading of v0.5.0 is
     *      compatible with both, and `InputVerifier` is v0.2.0 on both and never discriminates at all.
     *      Only the whole set decides. Today `ACL` alone would separate them, and relying on that would
     *      be relying on an accident of this particular pair.
     *
     * @dev MAJOR AND MINOR ONLY. A patch release does not change the ABI this SDK speaks, and chains do
     *      not all take one on the same day.
     *
     * @dev AMBIGUITY IS `Unknown`. If a reading somehow satisfies both lines, the honest answer is that
     *      we cannot tell, and the caller must refuse rather than guess which upgrade to run.
     */
    function classify(HostVersions memory versions) internal pure returns (FhevmGeneration) {
        bool previous = _isPreviousLine(versions);
        bool current = _isCurrentLine(versions);

        if (previous == current) return FhevmGeneration.Unknown;
        return previous ? FhevmGeneration.Previous : FhevmGeneration.Current;
    }

    /// @dev Every contract must be present and in range. An absent one fails the line, which is how a
    ///      pre-0.13 stack — no `ProtocolConfig`, no `KMSGeneration` — is rejected without this file
    ///      needing to know anything about it.
    function _isPreviousLine(HostVersions memory versions) private pure returns (bool) {
        return acceptsLine(versions.acl, PREVIOUS_ACL_FLOOR, PREVIOUS_ACL_CEILING)
            && acceptsLine(versions.fhevmExecutor, PREVIOUS_FHEVM_EXECUTOR_FLOOR, PREVIOUS_FHEVM_EXECUTOR_CEILING)
            && acceptsLine(versions.kmsVerifier, PREVIOUS_KMS_VERIFIER_FLOOR, PREVIOUS_KMS_VERIFIER_CEILING)
            && acceptsLine(versions.inputVerifier, PREVIOUS_INPUT_VERIFIER_FLOOR, PREVIOUS_INPUT_VERIFIER_CEILING)
            && acceptsLine(versions.hcuLimit, PREVIOUS_HCU_LIMIT_FLOOR, PREVIOUS_HCU_LIMIT_CEILING)
            && acceptsLine(versions.protocolConfig, PREVIOUS_PROTOCOL_CONFIG_FLOOR, PREVIOUS_PROTOCOL_CONFIG_CEILING)
            && acceptsLine(versions.kmsGeneration, PREVIOUS_KMS_GENERATION_FLOOR, PREVIOUS_KMS_GENERATION_CEILING);
    }

    /// @dev The ceilings are generated, so this line's upper end follows the vendored release.
    function _isCurrentLine(HostVersions memory versions) private pure returns (bool) {
        return acceptsLine(versions.acl, ACL_FLOOR, aclCeiling())
            && acceptsLine(versions.fhevmExecutor, FHEVM_EXECUTOR_FLOOR, fhevmExecutorCeiling())
            && acceptsLine(versions.kmsVerifier, KMS_VERIFIER_FLOOR, kmsVerifierCeiling())
            && acceptsLine(versions.inputVerifier, INPUT_VERIFIER_FLOOR, inputVerifierCeiling())
            && acceptsLine(versions.hcuLimit, HCU_LIMIT_FLOOR, LocalHostVersions.HCU_LIMIT)
            && acceptsLine(versions.protocolConfig, PROTOCOL_CONFIG_FLOOR, protocolConfigCeiling())
            && acceptsLine(versions.kmsGeneration, KMS_GENERATION_FLOOR, LocalHostVersions.KMS_GENERATION);
    }

    /**
     * @notice Like `accepts`, but on major and minor only.
     * @dev `accepts` is the FORK GATE's rule, and there the patch matters: it refuses a release newer
     *      than the one this SDK vendors. Identifying a LINE is a different question — every patch of a
     *      line speaks the same ABI — so the two must not share a comparison.
     */
    function acceptsLine(string memory actual, string memory floor, string memory ceiling)
        internal
        pure
        returns (bool)
    {
        Version memory a = parse(actual);
        Version memory lo = parse(floor);
        Version memory hi = parse(ceiling);
        if (!a.ok || !lo.ok || !hi.ok) return false;
        if (a.nameHash != lo.nameHash || a.nameHash != hi.nameHash) return false;
        if (a.major != lo.major || a.major != hi.major) return false;
        return a.minor >= lo.minor && a.minor <= hi.minor;
    }

    /// @notice `"ACL v0.4.0"` → (ok, keccak("ACL"), 0, 4, 0). Tolerates nothing else: one space, a `v`, three dot-separated decimals.
    function parse(string memory s) internal pure returns (Version memory v) {
        bytes memory b = bytes(s);
        uint256 space = _indexOf(b, 0x20, 0);
        if (space == type(uint256).max || space == 0 || space + 1 >= b.length || b[space + 1] != "v") return v;
        v.nameHash = keccak256(_slice(b, 0, space));

        uint256 i = space + 2;
        bool ok;
        (v.major, i, ok) = _number(b, i);
        if (!ok || i >= b.length || b[i] != ".") return v;
        (v.minor, i, ok) = _number(b, i + 1);
        if (!ok || i >= b.length || b[i] != ".") return v;
        (v.patch, i, ok) = _number(b, i + 1);
        if (!ok || i != b.length) return v;
        v.ok = true;
    }

    /// @dev (minor, patch) strict order; names and majors are compared by the caller.
    function _less(Version memory a, Version memory b) private pure returns (bool) {
        if (a.minor != b.minor) return a.minor < b.minor;
        return a.patch < b.patch;
    }

    /// @dev Decimal digits from `from`; `ok` is false when there is no digit there.
    function _number(bytes memory b, uint256 from) private pure returns (uint256 value, uint256 next, bool ok) {
        next = from;
        while (next < b.length && b[next] >= "0" && b[next] <= "9") {
            value = value * 10 + (uint8(b[next]) - 48);
            next++;
        }
        ok = next > from;
    }

    function _indexOf(bytes memory b, bytes1 c, uint256 from) private pure returns (uint256) {
        for (uint256 i = from; i < b.length; i++) {
            if (b[i] == c) return i;
        }
        return type(uint256).max;
    }

    function _slice(bytes memory b, uint256 from, uint256 to) private pure returns (bytes memory out) {
        out = new bytes(to - from);
        for (uint256 i = from; i < to; i++) {
            out[i - from] = b[i];
        }
    }
}
