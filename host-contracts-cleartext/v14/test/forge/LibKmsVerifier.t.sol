// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {KMS_VERIFIER_ADDRESS, ACL_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextKMSVerifier} from "../../pkg/forge/src/_internal/interfaces/ICleartextKMSVerifier.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {FHEVM_EXECUTOR_ADDRESS} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {LibKmsVerifier} from "../../pkg/forge/src/shared/LibKmsVerifier.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";

/// The fallback only earns its place if it agrees with the contract it stands in for. The cleartext
/// verifier has BOTH — `publicDecrypt()` and the public surface this library reads — so the two can be
/// run side by side and compared.
contract LibKmsVerifierTest is Test, ForgeFhevmDeploy {
    ICleartextFHEVMExecutor internal executor;

    function setUp() public {
        deployLocalFhevm();
        executor = ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS);
    }

    function _publiclyDecryptable(uint256 value, FheType fheType) private returns (bytes32 handle) {
        handle = executor.trivialEncrypt(value, fheType);
        (bool ok,) = ACL_ADDRESS.call(abi.encodeWithSignature("allowForDecryption(bytes32[])", _one(handle)));
        require(ok, "allowForDecryption");
    }

    function _one(bytes32 handle) private pure returns (bytes32[] memory out) {
        out = new bytes32[](1);
        out[0] = handle;
    }

    /// THE CLAIM: given the same values, the rebuilt proof is the one the verifier would have produced.
    function test_agreesWithTheCleartextVerifier() public {
        bytes32[] memory handles = _one(_publiclyDecryptable(42, FheType.Uint32));

        (bytes memory values, bytes32 digest, address[] memory signers, uint256 threshold, bytes memory extraData) =
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).publicDecrypt(handles);

        (bytes32 digest2, address[] memory signers2, uint256 threshold2, bytes memory extraData2) =
            LibKmsVerifier.publicDecryptProofDigest(KMS_VERIFIER_ADDRESS, handles, values);

        assertEq(digest2, digest, "digest");
        assertEq(threshold2, threshold, "threshold");
        assertEq(extraData2, extraData, "extraData");
        assertEq(signers2.length, signers.length, "signer count");
        for (uint256 i = 0; i < signers.length; i++) {
            assertEq(signers2[i], signers[i], "signer");
        }
    }

    /// And it tracks its inputs, so the agreement above is not a constant.
    function test_theDigestTracksTheValues() public {
        bytes32[] memory handles = _one(_publiclyDecryptable(42, FheType.Uint32));

        (bytes32 a,,,) = LibKmsVerifier.publicDecryptProofDigest(KMS_VERIFIER_ADDRESS, handles, abi.encode(uint256(42)));
        (bytes32 b,,,) = LibKmsVerifier.publicDecryptProofDigest(KMS_VERIFIER_ADDRESS, handles, abi.encode(uint256(43)));

        assertTrue(a != b, "a different claimed value must sign a different digest");
    }

    /// extraData is read from the verifier, not assumed: format byte then the live KMS context id.
    function test_extraDataCarriesTheLiveContextId() public view {
        bytes memory extraData = LibKmsVerifier.currentExtraData(KMS_VERIFIER_ADDRESS);

        assertEq(extraData.length, 33);
        assertEq(uint8(extraData[0]), 1, "format byte");
        assertEq(
            uint256(bytes32(_tail(extraData))),
            ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS).getCurrentKmsContextId(),
            "the verifier's own context id"
        );
    }

    /// The mask is the one part of the user-decrypt payload that is pure arithmetic, so it can be
    /// checked against the rule it mirrors: the FIRST 32 bytes of the key, not X.
    function test_theMaskIsTheKeysFirstWord() public pure {
        bytes memory key = new bytes(65);
        key[0] = 0x04;
        for (uint256 i = 1; i < 65; i++) {
            key[i] = bytes1(uint8(i));
        }

        uint256[] memory values = new uint256[](2);
        values[0] = 123;
        values[1] = type(uint256).max;

        bytes32 expected;
        assembly {
            expected := mload(add(key, 32))
        }

        uint256[] memory masked = LibKmsVerifier.maskWithPublicKey(key, values);

        assertEq(masked[0], 123 ^ uint256(expected));
        assertEq(masked[1], type(uint256).max ^ uint256(expected));
        assertEq(masked[0] ^ uint256(expected), 123, "and it is its own inverse");
    }

    /// A key too short to take a word from is refused, not read past.
    function test_aShortKeyIsRefused() public {
        vm.expectRevert(abi.encodeWithSelector(LibKmsVerifier.PublicKeyTooShort.selector, uint256(31)));
        this.maskWith(new bytes(31));
    }

    function maskWith(bytes calldata key) external pure {
        LibKmsVerifier.maskWithPublicKey(key, new uint256[](1));
    }

    function _tail(bytes memory data) private pure returns (bytes memory out) {
        out = new bytes(32);
        for (uint256 i = 0; i < 32; i++) {
            out[i] = data[i + 1];
        }
    }
}
