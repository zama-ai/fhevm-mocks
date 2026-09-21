// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {LocalHostVersions} from "./_host/_internal/LocalHostVersions.sol";

/**
 * @title LibFhevmVersion
 * @notice The protocol versions this SDK accepts on a fork: EVERY release of the fhevm line it vendors,
 *         not only the one it was generated from.
 *
 * @dev WHY A RANGE. A host contract reports `"<Name> vMAJOR.MINOR.PATCH"` from `getVersion()`, and a
 *      protocol line (fhevm 0.13.x) moves those numbers as it patches: `FHEVMExecutor` was `v0.4.0` from
 *      0.13.0 to 0.13.5 and is `v0.5.0` from 0.13.6. The chains do not all upgrade the same day — Sepolia
 *      ran `v0.4.0` after this SDK vendored 0.13.6 — so an exact match against the vendored version
 *      would refuse a stack whose ABI this SDK speaks perfectly well. What must never pass is another
 *      LINE: 0.12.x (`ACL v0.3.0`) is a different ABI, and a devnet running the next line (`ACL v0.5.0`)
 *      is one this SDK has not seen.
 *
 * @dev THE FLOOR IS HAND-WRITTEN, THE CEILING IS GENERATED. `LocalHostVersions` (regenerated from the
 *      vendored contracts by v13's `generate:contract-versions`) is what the line reports at the commit
 *      this SDK vendors — the newest it knows, hence the ceiling. The floor is what the line reported at
 *      its FIRST release, read off the tags of `zama-ai/fhevm` at v0.13.0 (`host-contracts/contracts`),
 *      and it moves only when this SDK moves to another line. `LibFhevmVersion.t.sol` pins both ends.
 */
library LibFhevmVersion {
    // -- The floor: fhevm v0.13.0 -------------------------------------------

    string internal constant ACL_FLOOR = "ACL v0.4.0";
    string internal constant FHEVM_EXECUTOR_FLOOR = "FHEVMExecutor v0.4.0";
    string internal constant INPUT_VERIFIER_FLOOR = "InputVerifier v0.2.0";
    string internal constant KMS_VERIFIER_FLOOR = "KMSVerifier v0.3.0";
    string internal constant PROTOCOL_CONFIG_FLOOR = "ProtocolConfig v0.1.0";

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
