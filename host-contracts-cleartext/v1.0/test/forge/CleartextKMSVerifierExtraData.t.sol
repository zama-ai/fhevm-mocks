// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {
    ACL_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    PROTOCOL_CONFIG_ADDRESS
} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextACL, ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {LibForgeFhevmEncrypt} from "../../pkg/forge/src/LibForgeFhevmEncrypt.sol";
import {LibForgeFhevmSigners} from "../../pkg/forge/src/LibForgeFhevmSigners.sol";
import {LibForgeFhevmStack} from "../../pkg/forge/src/LibForgeFhevmStack.sol";
import {ICleartextKMSVerifier} from "../../pkg/forge/src/_internal/interfaces/ICleartextKMSVerifier.sol";
import {IProtocolConfig} from "../../pkg/forge/src/_internal/interfaces/IProtocolConfig.sol";
import {LibKmsVerifier, UserDecryptRequestV1} from "../../pkg/forge/src/shared/LibKmsVerifier.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";

/**
 * The cleartext KMSVerifier serves the KMS extraData of BOTH sdk lines (golden rule 5: sdk v(N) works with
 * cleartext v(N)..v(N+2)): v1 (`0x01 | contextId`, what an sdk on protocol API 0.13 builds) and v2
 * (`0x02 | contextId | epochId`, what an sdk on protocol API 0.14 builds on a v14 chain).
 *
 * The extraData is part of every signed digest, and the sdk verifies the KMS signatures against ITS OWN
 * extraData. So:
 *   - `publicDecrypt(handles, extraData)` must sign over exactly the requested extraData, and the proof built from
 *     its answer must pass the on-chain KMSVerifier;
 *   - `userDecryptV1(pairs, permit, signature)` (the permit carries its extraData) must verify the permit over
 *     exactly the extraData the user signed, which may name a context that is no longer the current one (a permit
 *     is reusable until it expires);
 *   - the overloads WITHOUT extraData (sdk releases that do not pass it) can only guess: `publicDecrypt`
 *     signs v1, which those releases build, `userDecrypt` tries v2 then v1 for the current context and
 *     epoch, and refuses a permit signed before a KMS rotation.
 *
 * This generation's own file: the epochs and these overloads exist since v14.
 */
contract CleartextKMSVerifierExtraDataTest is Test, ForgeFhevmDeploy {
    uint256 internal constant ALICE_PK = uint256(keccak256("alice"));
    uint256 internal constant BOB_PK = 0xB0B;

    address internal alice;
    address internal bob;
    bytes internal publicKey;
    address[] internal contractAddresses;

    ICleartextKMSVerifier internal kms;
    IProtocolConfig internal protocolConfig;

    function setUp() public {
        deployLocalFhevm();
        alice = vm.addr(ALICE_PK);
        bob = vm.addr(BOB_PK);
        (publicKey,) = LibForgeFhevmSigners.generateTransportKeypair();
        contractAddresses.push(address(this));
        kms = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS);
        protocolConfig = IProtocolConfig(PROTOCOL_CONFIG_ADDRESS);
    }

    // ---------------------------------------------------------------------------------------------
    // Public decryption
    // ---------------------------------------------------------------------------------------------

    /// The one-argument call signs v1: the sdk releases that call it (0.13.x) build v1 and verify against it.
    function test_publicDecryptWithoutExtraDataSignsV1ForTheCurrentContext() public {
        bytes32[] memory handles = _decryptable(4242);

        (bytes memory cleartexts, bytes32 digest, address[] memory signers,, bytes memory extraData) =
            kms.publicDecrypt(handles);

        assertEq(extraData, _v1(protocolConfig.getCurrentKmsContextId()), "default extraData is not v1");
        assertTrue(_verifiesOnChain(handles, cleartexts, digest, signers, extraData), "on-chain verifier refused");
    }

    function test_publicDecryptSignsTheRequestedV1() public {
        _assertServesRequestedVersion(_v1(protocolConfig.getCurrentKmsContextId()));
    }

    function test_publicDecryptSignsTheRequestedV2() public {
        _assertServesRequestedVersion(_currentV2());
    }

    /// v0 ("the current context") is signed as EMPTY bytes, never `0x00`, as the sdk signs it.
    function test_publicDecryptSignsARequestedV0AsEmptyBytes() public {
        bytes32[] memory handles = _decryptable(4242);

        (bytes memory cleartexts, bytes32 digest, address[] memory signers,, bytes memory signedExtraData) =
            kms.publicDecrypt(handles, hex"00");

        assertEq(signedExtraData.length, 0, "v0 must be signed as empty bytes");
        assertTrue(_verifiesOnChain(handles, cleartexts, digest, signers, signedExtraData), "on-chain verifier refused");
    }

    /// The versions are distinct digests: a signature over one cannot pass for another.
    function test_publicDecryptDigestsDifferPerVersion() public {
        bytes32[] memory handles = _decryptable(4242);
        (, bytes32 d1,,,) = kms.publicDecrypt(handles, _v1(protocolConfig.getCurrentKmsContextId()));
        (, bytes32 d2,,,) = kms.publicDecrypt(handles, _currentV2());
        assertTrue(d1 != d2, "v1 and v2 produced the same digest");
    }

    function test_publicDecryptRefusesAnUnsupportedVersion() public {
        bytes32[] memory handles = _decryptable(4242);
        vm.expectRevert(abi.encodeWithSignature("UnsupportedExtraDataVersion(uint8)", uint8(3)));
        kms.publicDecrypt(handles, abi.encodePacked(uint8(3), uint256(1)));
    }

    function test_publicDecryptRefusesAMalformedV1() public {
        bytes32[] memory handles = _decryptable(4242);
        bytes memory tooLong = bytes.concat(_v1(protocolConfig.getCurrentKmsContextId()), hex"00");
        vm.expectRevert(abi.encodeWithSignature("DeserializingExtraDataFail()"));
        kms.publicDecrypt(handles, tooLong);
    }

    function test_publicDecryptRefusesAnUnknownContext() public {
        bytes32[] memory handles = _decryptable(4242);
        vm.expectRevert(abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorInvalidKmsContext.selector, 999));
        kms.publicDecrypt(handles, _v1(999));
    }

    // ---------------------------------------------------------------------------------------------
    // User decryption
    // ---------------------------------------------------------------------------------------------

    /// sdk 13: a permit signed over v1, through the overload that guesses.
    function test_userDecryptWithoutExtraDataAcceptsAV1Permit() public {
        bytes32 handle = _grantedToAlice(7);
        bytes memory v1 = _v1(protocolConfig.getCurrentKmsContextId());

        (bytes memory payload,,, bytes memory extraData) = kms.userDecrypt(
            _pairs(handle), alice, publicKey, contractAddresses, block.timestamp, 1, _permit(ALICE_PK, v1)
        );

        assertEq(extraData, v1, "the guess did not settle on v1");
        assertEq(_unmask(payload), 7, "wrong cleartext");
    }

    /// sdk 14: a permit signed over v2 (current context and epoch), through the overload that guesses.
    function test_userDecryptWithoutExtraDataAcceptsAV2Permit() public {
        bytes32 handle = _grantedToAlice(7);
        bytes memory v2 = _currentV2();

        (bytes memory payload,,, bytes memory extraData) = kms.userDecrypt(
            _pairs(handle), alice, publicKey, contractAddresses, block.timestamp, 1, _permit(ALICE_PK, v2)
        );

        assertEq(extraData, v2, "the guess did not settle on v2");
        assertEq(_unmask(payload), 7, "wrong cleartext");
    }

    function test_userDecryptWithExtraDataAcceptsThePermitsOwnExtraData() public {
        bytes32 handle = _grantedToAlice(7);
        bytes memory v2 = _currentV2();

        (bytes memory payload, address[] memory signers, uint256 threshold, bytes memory signedExtraData) =
            kms.userDecryptV1(_pairs(handle), _v1Permit(alice, v2), _permit(ALICE_PK, v2));

        uint256 contextId = protocolConfig.getCurrentKmsContextId();
        assertEq(signedExtraData, v2, "the given extraData was not used verbatim");
        assertEq(_unmask(payload), 7, "wrong cleartext");
        assertEq(signers, protocolConfig.getKmsSignersForContext(contextId), "signers are not the context's");
        assertEq(threshold, protocolConfig.getPublicDecryptionThresholdForContext(contextId), "wrong threshold");
    }

    /// The given extraData must be the one the permit was signed over: no fallback, no guess.
    function test_userDecryptWithExtraDataRefusesAPermitSignedOverAnotherVersion() public {
        bytes32 handle = _grantedToAlice(7);
        bytes memory signedOverV1 = _permit(ALICE_PK, _v1(protocolConfig.getCurrentKmsContextId()));
        bytes memory v2 = _currentV2();

        // Arguments are computed above: `expectRevert` applies to the NEXT external call, and both helpers make one.
        vm.expectRevert(LibKmsVerifier.CleartextErrorInvalidUserDecryptSignature.selector);
        kms.userDecryptV1(_pairs(handle), _v1Permit(alice, v2), signedOverV1);
    }

    /// A permit signed before a KMS rotation names the previous context and epoch. The overload that takes the
    /// extraData serves it, with the previous context's signers; the overload that guesses cannot match it
    /// (its documented limitation).
    function test_aPermitSignedBeforeARotation() public {
        bytes32 handle = _grantedToAlice(7);
        uint256 previousContextId = protocolConfig.getCurrentKmsContextId();
        bytes memory signedBefore = _currentV2();
        bytes memory permit = _permit(ALICE_PK, signedBefore);

        LibForgeFhevmStack.defineCleartextKmsContext(PROTOCOL_CONFIG_ADDRESS, ACL_ADDRESS);
        assertTrue(protocolConfig.getCurrentKmsContextId() != previousContextId, "the rotation did not happen");
        assertTrue(protocolConfig.isValidKmsContext(previousContextId), "the previous context is no longer valid");

        (bytes memory payload, address[] memory signers,,) =
            kms.userDecryptV1(_pairs(handle), _v1Permit(alice, signedBefore), permit);
        assertEq(_unmask(payload), 7, "wrong cleartext");
        assertEq(signers, protocolConfig.getKmsSignersForContext(previousContextId), "not the previous signers");

        vm.expectRevert(LibKmsVerifier.CleartextErrorInvalidUserDecryptSignature.selector);
        kms.userDecrypt(_pairs(handle), alice, publicKey, contractAddresses, block.timestamp, 1, permit);
    }

    /// Delegation goes through the same two paths; one v2 case each.
    function test_delegatedUserDecryptServesAV2PermitThroughBothOverloads() public {
        bytes32 handle = _grantedToAlice(7);
        vm.prank(alice);
        ICleartextACL(ACL_ADDRESS).delegateForUserDecryption(bob, address(this), uint64(block.timestamp + 1 days));

        bytes memory v2 = _currentV2();
        bytes memory permit = _delegatedPermit(BOB_PK, alice, v2);

        (bytes memory guessed,,, bytes memory guessedExtraData) = kms.delegatedUserDecrypt(
            _pairs(handle), alice, bob, publicKey, contractAddresses, block.timestamp, 1, permit
        );
        assertEq(guessedExtraData, v2, "the guess did not settle on v2");
        assertEq(_unmask(guessed), 7, "wrong cleartext (guessing overload)");

        (bytes memory given,,, bytes memory givenExtraData) =
            kms.delegatedUserDecryptV1(_pairs(handle), _delegatedV1Permit(bob, alice, v2), permit);
        assertEq(givenExtraData, v2, "the given extraData was not used verbatim");
        assertEq(_unmask(given), 7, "wrong cleartext (extraData overload)");
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    /// @dev `publicDecrypt(handles, requested)` signs over exactly `requested`, and the proof verifies on chain.
    function _assertServesRequestedVersion(bytes memory requested) private {
        bytes32[] memory handles = _decryptable(4242);

        (bytes memory cleartexts, bytes32 digest, address[] memory signers,, bytes memory signedExtraData) =
            kms.publicDecrypt(handles, requested);

        assertEq(signedExtraData, requested, "the requested extraData was not signed verbatim");
        assertEq(abi.decode(cleartexts, (uint256)), 4242, "wrong cleartext");
        assertTrue(_verifiesOnChain(handles, cleartexts, digest, signers, signedExtraData), "on-chain verifier refused");
    }

    /// @dev Signs `digest` with every returned KMS signer and asks the real KMSVerifier to verify the proof
    ///      `numSigners | signatures | extraData` — what `FHE.checkSignatures` does in a dApp.
    function _verifiesOnChain(
        bytes32[] memory handles,
        bytes memory cleartexts,
        bytes32 digest,
        address[] memory signers,
        bytes memory extraData
    ) private returns (bool) {
        bytes memory signatures;
        for (uint256 i = 0; i < signers.length; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(LibForgeFhevmSigners.kmsNodeKeyFor(signers[i]), digest);
            signatures = bytes.concat(signatures, abi.encodePacked(r, s, v));
        }
        bytes memory proof = abi.encodePacked(uint8(signers.length), signatures, extraData);
        return kms.verifyDecryptionEIP712KMSSignatures(handles, cleartexts, proof);
    }

    function _v1(uint256 contextId) private pure returns (bytes memory) {
        return abi.encodePacked(uint8(0x01), contextId);
    }

    function _currentV2() private view returns (bytes memory) {
        (uint256 contextId, uint256 epochId) = protocolConfig.getCurrentKmsContextAndEpoch();
        return abi.encodePacked(uint8(0x02), contextId, epochId);
    }

    function _request() private view returns (UserDecryptRequestV1 memory) {
        return UserDecryptRequestV1({
            transportPublicKey: publicKey,
            contractAddresses: contractAddresses,
            startTimestamp: block.timestamp,
            durationDays: 1
        });
    }

    /// @dev The v1 permit `userDecryptV1` takes: `_request()`'s fields, its signer, and the extraData it was signed over.
    function _v1Permit(address user, bytes memory extraData)
        private
        view
        returns (ICleartextKMSVerifier.UserDecryptPermitV1 memory)
    {
        return ICleartextKMSVerifier.UserDecryptPermitV1({
            userAddress: user,
            publicKey: publicKey,
            contractAddresses: contractAddresses,
            startTimestamp: block.timestamp,
            durationDays: 1,
            extraData: extraData
        });
    }

    /// @dev The same, for `delegatedUserDecryptV1`: the delegate signs, naming the delegator.
    function _delegatedV1Permit(address delegate, address delegator, bytes memory extraData)
        private
        view
        returns (ICleartextKMSVerifier.DelegatedUserDecryptPermitV1 memory)
    {
        return ICleartextKMSVerifier.DelegatedUserDecryptPermitV1({
            delegateAddress: delegate,
            publicKey: publicKey,
            contractAddresses: contractAddresses,
            delegatorAddress: delegator,
            startTimestamp: block.timestamp,
            durationDays: 1,
            extraData: extraData
        });
    }

    /// @dev A user's permit signature over `extraData`, 65 bytes `r || s || v`.
    function _permit(uint256 pk, bytes memory extraData) private view returns (bytes memory) {
        bytes32 digest = LibKmsVerifier.userDecryptionDigestV1(
            LibKmsVerifier.hostDomainSeparator(KMS_VERIFIER_ADDRESS), _request(), extraData
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// @dev A delegate's permit signature over `extraData`.
    function _delegatedPermit(uint256 pk, address delegator, bytes memory extraData)
        private
        view
        returns (bytes memory)
    {
        bytes32 digest = LibKmsVerifier.delegatedUserDecryptionDigestV1(
            LibKmsVerifier.hostDomainSeparator(KMS_VERIFIER_ADDRESS), _request(), delegator, extraData
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _pairs(bytes32 handle) private view returns (ICleartextKMSVerifier.HandleContractPair[] memory pairs) {
        pairs = new ICleartextKMSVerifier.HandleContractPair[](1);
        pairs[0] = ICleartextKMSVerifier.HandleContractPair({handle: handle, contractAddress: address(this)});
    }

    /// @dev The payload is `abi.encode(masked, extraData)`, each value XORed with the transport public key.
    function _unmask(bytes memory payload) private view returns (uint256) {
        (uint256[] memory masked,) = abi.decode(payload, (uint256[], bytes));
        return masked[0] ^ uint256(bytes32(publicKey));
    }

    /// @dev A `Uint32` handle holding `value`, minted through `verifyInput` (which grants this contract transient
    ///      access) and then allowed persistently to this contract and to alice.
    function _grantedToAlice(uint256 value) private returns (bytes32 handle) {
        handle = _mint(value);
        ICleartextACL(ACL_ADDRESS).allow(handle, address(this));
        ICleartextACL(ACL_ADDRESS).allow(handle, alice);
    }

    /// @dev One `Uint32` handle holding `value`, marked publicly decryptable.
    function _decryptable(uint256 value) private returns (bytes32[] memory handles) {
        handles = new bytes32[](1);
        handles[0] = _mint(value);
        ICleartextACL(ACL_ADDRESS).allowForDecryption(handles);
    }

    function _mint(uint256 value) private returns (bytes32) {
        uint8[] memory typeIds = new uint8[](1);
        uint256[] memory values = new uint256[](1);
        typeIds[0] = uint8(FheType.Uint32);
        values[0] = value;
        (bytes32[] memory inputs, bytes memory proof) =
            LibForgeFhevmEncrypt.encrypt(typeIds, values, address(this), alice);
        return ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).verifyInput(inputs[0], alice, proof, FheType.Uint32);
    }
}
