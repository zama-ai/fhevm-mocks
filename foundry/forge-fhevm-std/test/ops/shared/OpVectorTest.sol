// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    ebool,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    eaddress,
    externalEbool,
    externalEuint8,
    externalEuint16,
    externalEuint32,
    externalEuint64,
    externalEuint128,
    externalEuint256,
    externalEaddress
} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../../pkg/src/TestFhevm.sol";
import {EncryptedInput} from "../../../pkg/src/LibEncryptedInput.sol";
import {FheType} from "../../../pkg/src/_host/shared/FheType.sol";
import {IACL} from "../../../pkg/src/_host/_internal/interfaces/IACL.sol";
import {ICleartextHCULimit} from "../../../pkg/src/_host/_internal/interfaces/ICleartextHCULimit.sol";
import {ACL_ADDRESS, HCU_LIMIT_ADDRESS} from "../../../pkg/src/_host/_internal/LocalHostAddresses.sol";
import {FHEext} from "../utils/FHEext.sol";

/**
 * @notice Shared machinery for the operator vector tests in `test/ops/`.
 *
 * @dev A vector part file (`operators-data/data/<op>/<width>.<kind>.json`, at the repository root) is a list of cases, each with typed
 *      operands and the expected result, VALIDATED AGAINST tfhe-rs upstream (the checker records its
 *      release in `verified`). This base walks such a file and hands every case to the derived contract,
 *      which knows the FHE.sol overload families for its operator and its operand pair. The `edge` parts
 *      are the point: every width's zero, one, max, max-1, wrap-around and sign-bit values, through every
 *      overload, against the cleartext stack's arithmetic.
 *
 *      Two things are asserted per result: the value, read through the SDK's `plaintextOf`, and the ACL
 *      grants a real dApp needs for the caller to user-decrypt it — which a value check alone never catches.
 *
 * @dev PORTED from the standalone forge-fhevm-std project (rules.md: port the tests, not the API). What
 *      changed: the base is `TestFhevm`, so forge-std's `vm` replaces the hand-declared cheat interfaces
 *      (`Strings`, `IForgeVmJson`); the raw-handle `decryptRaw` became `_plaintextOfBits`, a switch over the
 *      typed `plaintextOf` overloads, since the public API speaks in encrypted types (rules.md 2.8); and
 *      `encrypt(bytes, …)` became `encryptValues(bytes, …)` returning an `EncryptedInput`.
 */
abstract contract OpVectorTest is TestFhevm {
    /// The account that calls the dApp. Every input is bound to it and every result must be granted to it.
    address internal alice;

    struct Case {
        string id;
        uint256 lhsBits;
        uint256 lhs;
        // Zero for unary operators (the file has no `rhs`).
        uint256 rhsBits;
        uint256 rhs;
        uint256 resultBits;
        uint256 expected;
    }

    // -- What a derived test provides -----------------------------------------------------------------

    /// The `op` the vector file must declare, e.g. "add".
    function opName() internal pure virtual returns (string memory);

    /// The dApp under test: inputs are bound to it and results must be allowed for it.
    function dappAddress() internal view virtual returns (address);

    /// Runs one case through every overload family FHE.sol offers for its operand pair, calling `check`
    /// for each result. Revert for a pair that has no family wired yet: silence would look like coverage.
    function runCase(Case memory c) internal virtual;

    // -- Setup ------------------------------------------------------------------------------------------

    function setUpCaller() internal {
        alice = makeAddr("alice");
        _liftHcuLimit();
    }

    /// A forge test is ONE transaction, and a vector part packs hundreds of independent FHE operations into
    /// it — far beyond any real transaction, so the protocol's per-tx HCU budget trips on the wide edge
    /// parts. The budget is not what these tests measure; raise it to the type's maximum, as the host
    /// owner, for the duration of the test. The per-block cap and the depth limit are left alone.
    function _liftHcuLimit() private {
        vm.prank(fhevmACLOwner());
        ICleartextHCULimit(HCU_LIMIT_ADDRESS).setMaxHCUPerTx(type(uint48).max);
    }

    // -- Vector plumbing ----------------------------------------------------------------------------------

    function runPart(string memory path) internal {
        string memory doc = vm.readFile(path);
        string memory op = vm.parseJsonString(doc, ".op");
        if (keccak256(bytes(op)) != keccak256(bytes(opName()))) {
            revert(string.concat(path, ": declares op ", op, ", this test runs ", opName()));
        }
        // Only data tfhe-rs has confirmed may drive these tests: the upstream checker records its release
        // in `verified`, and the generator clears it the moment the cases change.
        if (!vm.keyExistsJson(doc, ".verified[0]")) {
            revert(string.concat(path, ": not verified against tfhe-rs"));
        }
        // `.cases[*].id` would collapse to a scalar when there is exactly one case, so the array is walked
        // until the index stops existing.
        uint256 n;
        while (vm.keyExistsJson(doc, string.concat(".cases[", vm.toString(n), "]"))) {
            runCase(_readCase(doc, n));
            n++;
        }
        require(n > 0, "empty vector file");
    }

    function _readCase(string memory doc, uint256 i) private view returns (Case memory c) {
        string memory p = string.concat(".cases[", vm.toString(i), "]");
        c.id = vm.parseJsonString(doc, string.concat(p, ".id"));
        c.lhsBits = vm.parseJsonUint(doc, string.concat(p, ".lhs.bits"));
        c.lhs = vm.parseJsonUint(doc, string.concat(p, ".lhs.value"));
        if (vm.keyExistsJson(doc, string.concat(p, ".rhs"))) {
            c.rhsBits = vm.parseJsonUint(doc, string.concat(p, ".rhs.bits"));
            c.rhs = vm.parseJsonUint(doc, string.concat(p, ".rhs.value"));
        }
        c.resultBits = vm.parseJsonUint(doc, string.concat(p, ".result.bits"));
        c.expected = vm.parseJsonUint(doc, string.concat(p, ".result.value"));
    }

    function check(Case memory c, string memory family, bytes32 handle) internal {
        // The handle carries its type: this is where "result width = wider operand" is actually asserted,
        // independently of the value.
        if (FHEext.isExternalHandle(handle)) {
            revert(string.concat(c.id, " (", family, "): result is an input handle, not a computed one"));
        }
        if (FHEext.chainIdOf(handle) != block.chainid) {
            revert(string.concat(c.id, " (", family, "): result handle carries another chain id"));
        }
        if (FHEext.fheTypeOf(handle) != fheType(c.resultBits)) {
            revert(
                string.concat(c.id, " (", family, "): result handle is not a ", vm.toString(c.resultBits), "-bit type")
            );
        }
        uint256 got = _plaintextOfBits(handle, c.resultBits);
        if (got != c.expected) {
            revert(
                string.concat(c.id, " (", family, "): got ", vm.toString(got), ", expected ", vm.toString(c.expected))
            );
        }
        IACL acl = IACL(ACL_ADDRESS);
        if (!acl.isAllowed(handle, alice)) {
            revert(string.concat(c.id, " (", family, "): result not user-decryptable by the caller"));
        }
        if (!acl.isAllowed(handle, dappAddress())) {
            revert(string.concat(c.id, " (", family, "): result not allowed for the dApp itself"));
        }
    }

    /// Calls the fixture wrapper `sig` (computed by the derived test from the case's widths) as alice, and
    /// returns the result handle. A wrapper that does not exist reverts without data, reported as such.
    ///
    /// `abi.encode(uint256)` produces the same word as `abi.encode` of a uintN, bool or address holding that
    /// value, so the clear operand is passed as uint256 against the typed signature.
    function callDapp(Case memory c, string memory sig, bytes memory args) internal returns (bytes32) {
        vm.prank(alice);
        (bool ok, bytes memory ret) = dappAddress().call(bytes.concat(bytes4(keccak256(bytes(sig))), args));
        if (!ok) {
            if (ret.length == 0) {
                revert(string.concat(c.id, ": ", sig, " reverted without data - no such overload wired?"));
            }
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return abi.decode(ret, (bytes32));
    }

    function unsupportedPair(Case memory c) internal pure {
        revert(
            string.concat(c.id, ": no overload family wired for ", vm.toString(c.lhsBits), "/", vm.toString(c.rhsBits))
        );
    }

    // -- Encryption helpers. A pair rides in ONE proof, as a dApp taking two inputs receives them. ------------

    function encryptPair(FheType ta, uint256 a, FheType tb, uint256 b)
        internal
        returns (bytes32[] memory handles, bytes memory proof)
    {
        EncryptedInput memory e = encryptValues(abi.encode(ta, a, tb, b), dappAddress(), alice);
        handles = new bytes32[](2);
        handles[0] = _handleAt(e, 0, ta);
        handles[1] = _handleAt(e, 1, tb);
        proof = e.inputProof();
    }

    function encryptOne(FheType t, uint256 v) internal returns (bytes32 handle, bytes memory proof) {
        EncryptedInput memory e = encryptValues(abi.encode(t, v), dappAddress(), alice);
        handle = _handleAt(e, 0, t);
        require(FHEext.isExternalHandle(handle), "input handle not recognised as external");
        proof = e.inputProof();
    }

    function fheType(uint256 bits) internal pure returns (FheType) {
        if (bits == 1) return FheType.Bool;
        if (bits == 8) return FheType.Uint8;
        if (bits == 16) return FheType.Uint16;
        if (bits == 32) return FheType.Uint32;
        if (bits == 64) return FheType.Uint64;
        if (bits == 128) return FheType.Uint128;
        if (bits == 160) return FheType.Uint160;
        if (bits == 256) return FheType.Uint256;
        revert(string.concat("no FheType for ", vm.toString(bits), " bits"));
    }

    // -- Typed API, addressed by width: the public API speaks in encrypted types, these tests in bits. --------

    /// The raw external handle at `index`, through the typed accessor for `t` (which also checks the type).
    function _handleAt(EncryptedInput memory e, uint256 index, FheType t) private pure returns (bytes32) {
        if (t == FheType.Bool) return externalEbool.unwrap(e.externalEboolAt(index));
        if (t == FheType.Uint8) return externalEuint8.unwrap(e.externalEuint8At(index));
        if (t == FheType.Uint16) return externalEuint16.unwrap(e.externalEuint16At(index));
        if (t == FheType.Uint32) return externalEuint32.unwrap(e.externalEuint32At(index));
        if (t == FheType.Uint64) return externalEuint64.unwrap(e.externalEuint64At(index));
        if (t == FheType.Uint128) return externalEuint128.unwrap(e.externalEuint128At(index));
        if (t == FheType.Uint160) return externalEaddress.unwrap(e.externalEaddressAt(index));
        return externalEuint256.unwrap(e.externalEuint256At(index));
    }

    /// `plaintextOf` for a handle whose width is only known at run time, widened to uint256.
    function _plaintextOfBits(bytes32 handle, uint256 bits) private returns (uint256) {
        if (bits == 1) return plaintextOf(ebool.wrap(handle)) ? 1 : 0;
        if (bits == 8) return plaintextOf(euint8.wrap(handle));
        if (bits == 16) return plaintextOf(euint16.wrap(handle));
        if (bits == 32) return plaintextOf(euint32.wrap(handle));
        if (bits == 64) return plaintextOf(euint64.wrap(handle));
        if (bits == 128) return plaintextOf(euint128.wrap(handle));
        if (bits == 160) return uint256(uint160(plaintextOf(eaddress.wrap(handle))));
        return plaintextOf(euint256.wrap(handle));
    }
}
