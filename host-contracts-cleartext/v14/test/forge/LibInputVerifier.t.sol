// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {INPUT_VERIFIER_ADDRESS, ACL_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextInputVerifier} from "../../pkg/forge/src/_internal/interfaces/ICleartextInputVerifier.sol";
import {LibInputVerifier} from "../../pkg/forge/src/shared/LibInputVerifier.sol";

/// The fallback only earns its place if it agrees with the contract it stands in for. The cleartext
/// verifier has BOTH — `inputProof()` and the public surface the library reads — so the two can be run
/// side by side and compared byte for byte.
contract LibInputVerifierTest is Test, ForgeFhevmDeploy {
    address internal alice;
    address internal dapp;

    function setUp() public {
        deployLocalFhevm();
        alice = makeAddr("alice");
        dapp = makeAddr("dapp");
    }

    function _handles(uint256 n) private pure returns (bytes32[] memory out) {
        out = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = keccak256(abi.encodePacked("handle", i));
        }
    }

    function _assertAgrees(bytes32[] memory handles, bytes memory extraData) private view {
        (bytes32 d1, address[] memory s1, uint256 t1) =
            ICleartextInputVerifier(INPUT_VERIFIER_ADDRESS).inputProof(handles, alice, dapp, extraData);
        (bytes32 d2, address[] memory s2, uint256 t2) =
            LibInputVerifier.inputProof(INPUT_VERIFIER_ADDRESS, handles, alice, dapp, extraData);

        assertEq(d2, d1, "digest");
        assertEq(t2, t1, "threshold");
        assertEq(s2.length, s1.length, "signer count");
        for (uint256 i = 0; i < s1.length; i++) {
            assertEq(s2[i], s1[i], "signer");
        }
    }

    function test_agreesOnASingleHandle() public view {
        _assertAgrees(_handles(1), hex"00");
    }

    function test_agreesOnManyHandles() public view {
        _assertAgrees(_handles(8), hex"00");
    }

    function test_agreesOnAnEmptyExtraData() public view {
        _assertAgrees(_handles(2), "");
    }

    /// extraData is hashed into the digest, so a different tail must give a different digest — proving
    /// the comparison above is not passing on a value that ignores its inputs.
    function test_theDigestTracksItsInputs() public view {
        bytes32[] memory h = _handles(2);

        (bytes32 a,,) = LibInputVerifier.inputProof(INPUT_VERIFIER_ADDRESS, h, alice, dapp, hex"00");
        (bytes32 b,,) = LibInputVerifier.inputProof(INPUT_VERIFIER_ADDRESS, h, alice, dapp, hex"01");
        (bytes32 c,,) = LibInputVerifier.inputProof(INPUT_VERIFIER_ADDRESS, h, dapp, dapp, hex"00");
        (bytes32 d,,) = LibInputVerifier.inputProof(INPUT_VERIFIER_ADDRESS, _handles(3), alice, dapp, hex"00");

        assertTrue(a != b, "extraData");
        assertTrue(a != c, "userAddress");
        assertTrue(a != d, "handles");
    }

    /// The probe is what picks the path, so it has to be right about every shape of callee. Note that
    /// `IS_CLEARTEXT` marks the whole cleartext stack, not just the verifier — the ACL answers it too.
    function test_theCleartextProbeDiscriminates() public view {
        assertTrue(LibInputVerifier.isCleartextVerifier(INPUT_VERIFIER_ADDRESS), "the cleartext verifier");
        assertTrue(LibInputVerifier.isCleartextVerifier(ACL_ADDRESS), "the rest of the cleartext stack");

        // A production verifier REVERTS on the selector rather than returning false, which is why the
        // probe is a low-level call. These stand in for that: code without the function, and no code.
        assertFalse(LibInputVerifier.isCleartextVerifier(address(this)), "code, but no such function");
        assertFalse(LibInputVerifier.isCleartextVerifier(address(0xDEAD)), "no code at all");
    }
}
