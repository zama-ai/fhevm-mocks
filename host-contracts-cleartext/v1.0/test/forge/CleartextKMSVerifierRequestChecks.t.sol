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

/// @dev ERC-1271 wallets that never accept: a wrong magic value, a revert, a call that burns all its gas.
contract WrongMagicWallet {
    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        return 0xffffffff;
    }
}

contract RevertingWallet {
    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        revert("no");
    }
}

contract GasBurningWallet {
    function isValidSignature(bytes32, bytes memory) external view returns (bytes4) {
        uint256 i;
        while (gasleft() > 0) {
            ++i;
        }
        return bytes4(uint32(i));
    }
}

/**
 * The request checks the cleartext KMS verifier makes before it decrypts, on the legacy and v1 user, delegated and
 * public paths: the gateway's validity window and contract list, the handles' conformance, the KMS context and
 * epoch, the verifying contract; plus what `CleartextKMSVerifierUserDecryptV2.t.sol` leaves out of the v2 path.
 *
 * Most checks live in `LibKmsVerifier`'s payload functions, so one request is driven through the four v1 user
 * paths (legacy and `V1` entry point, direct and delegated) and must fail the same way on each.
 *
 * `vm.expectRevert` binds to the NEXT external call, and signing makes one (`hostDomainSeparator` reads
 * `eip712Domain()`): every signature is computed before the expectation.
 */
contract CleartextKMSVerifierRequestChecksTest is Test, ForgeFhevmDeploy {
    uint256 internal constant ALICE_PK = uint256(keccak256("alice"));
    uint256 internal constant BOB_PK = 0xB0B;

    address internal alice;
    address internal bob;
    bytes internal publicKey;

    ICleartextKMSVerifier internal kms;
    IProtocolConfig internal protocolConfig;

    function setUp() public {
        deployLocalFhevm();
        vm.warp(1_000_000); // so a past start is expressible
        alice = vm.addr(ALICE_PK);
        bob = vm.addr(BOB_PK);
        (publicKey,) = LibForgeFhevmSigners.generateTransportKeypair();
        kms = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS);
        protocolConfig = IProtocolConfig(PROTOCOL_CONFIG_ADDRESS);
    }

    // ---------------------------------------------------------------------------------------------
    // Validity window (GW `_checkUserDecryptionRequestValidity`)
    // ---------------------------------------------------------------------------------------------

    function test_aZeroDurationIsRefused() public {
        _refusedOnEveryUserPath(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorInvalidNullDurationDays.selector),
            _pairs(_grantedTo(alice, 1)),
            _request(_self(), block.timestamp, 0)
        );
    }

    function test_moreThan365DaysIsRefused() public {
        _refusedOnEveryUserPath(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorMaxDurationDaysExceeded.selector, 365, 366),
            _pairs(_grantedTo(alice, 1)),
            _request(_self(), block.timestamp, 366)
        );
    }

    function test_aStartInTheFutureIsRefused() public {
        _refusedOnEveryUserPath(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorStartTimestampInFuture.selector,
                block.timestamp,
                block.timestamp + 1
            ),
            _pairs(_grantedTo(alice, 1)),
            _request(_self(), block.timestamp + 1, 1)
        );
    }

    function test_anExpiredRequestIsRefused() public {
        uint256 start = block.timestamp - 1 days - 1;
        _refusedOnEveryUserPath(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorUserDecryptionRequestExpired.selector, block.timestamp, start, 1
            ),
            _pairs(_grantedTo(alice, 1)),
            _request(_self(), start, 1)
        );
    }

    /// `start + days * 1 day == now` is still inside the window, as the gateway's `<` says.
    function test_theLastSecondOfTheWindowPasses() public {
        bytes32 handle = _grantedTo(alice, 7);
        UserDecryptRequestV1 memory request = _request(_self(), block.timestamp - 1 days, 1);
        bytes memory signature = _sign(ALICE_PK, request, _currentV1());

        (bytes memory payload,,,) = _legacyUser(_pairs(handle), request, signature);
        assertEq(_unmask(payload), 7);
    }

    // ---------------------------------------------------------------------------------------------
    // Contract list (GW)
    // ---------------------------------------------------------------------------------------------

    function test_anEmptyContractListIsRefused() public {
        _refusedOnEveryUserPath(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorEmptyContractAddresses.selector),
            _pairs(_grantedTo(alice, 1)),
            _request(new address[](0), block.timestamp, 1)
        );
    }

    function test_elevenContractsAreRefused() public {
        address[] memory eleven = new address[](11);
        for (uint256 i = 0; i < 11; ++i) {
            eleven[i] = address(uint160(0x1000 + i));
        }
        eleven[0] = address(this);
        _refusedOnEveryUserPath(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorContractAddressesMaxLengthExceeded.selector, 10, 11
            ),
            _pairs(_grantedTo(alice, 1)),
            _request(eleven, block.timestamp, 1)
        );
    }

    /// The user may not list itself, even on no pair; on the delegated paths the gateway checks the DELEGATOR,
    /// alice here too.
    function test_theAccountInTheContractListIsRefused() public {
        address[] memory withAlice = new address[](2);
        withAlice[0] = address(this);
        withAlice[1] = alice;
        _refusedOnEveryUserPath(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorAccountInContractAddresses.selector, alice),
            _pairs(_grantedTo(alice, 1)),
            _request(withAlice, block.timestamp, 1)
        );
    }

    // ---------------------------------------------------------------------------------------------
    // Verifying contract (KMS core)
    // ---------------------------------------------------------------------------------------------

    function test_aUserEqualToTheVerifyingContractIsRefused() public {
        (,,,, address verifyingContract,,) = kms.eip712Domain();
        bytes32 handle = _grantedTo(alice, 1);
        UserDecryptRequestV1 memory request = _request(_self(), block.timestamp, 1);
        bytes memory anySignature = new bytes(65);
        bytes memory v1 = _currentV1();
        bytes memory expected = abi.encodeWithSelector(
            ICleartextKMSVerifier.CleartextErrorUserAddressIsVerifyingContract.selector, verifyingContract
        );

        vm.expectRevert(expected);
        kms.userDecrypt(
            _pairs(handle),
            verifyingContract,
            request.transportPublicKey,
            request.contractAddresses,
            request.startTimestamp,
            request.durationDays,
            anySignature
        );
        vm.expectRevert(expected);
        kms.userDecryptV1(_pairs(handle), _v1Permit(verifyingContract, request, v1), anySignature);
        vm.expectRevert(expected);
        kms.delegatedUserDecryptV1(
            _pairs(handle), _delegatedV1Permit(verifyingContract, alice, request, v1), anySignature
        );
    }

    // ---------------------------------------------------------------------------------------------
    // Handle conformance (GW), on the user, delegated and public paths
    // ---------------------------------------------------------------------------------------------

    function test_noHandlesAreRefused() public {
        bytes memory expected = abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorEmptyCtHandles.selector);
        _refusedOnEveryUserPath(
            expected, new ICleartextKMSVerifier.HandleContractPair[](0), _request(_self(), block.timestamp, 1)
        );
        _refusedOnBothPublicPaths(expected, new bytes32[](0));
    }

    function test_theZeroHandleIsRefused() public {
        bytes memory expected =
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorHandleUninitialized.selector, bytes32(0));
        _refusedOnEveryUserPath(expected, _pairs(bytes32(0)), _request(_self(), block.timestamp, 1));
        _refusedOnBothPublicPaths(expected, _one(bytes32(0)));
    }

    function test_aHandleOfAnotherChainIsRefused() public {
        uint64 otherChain = uint64(block.chainid) + 1;
        bytes32 foreign = _withChainId(_mint(1), otherChain);
        bytes memory expected = abi.encodeWithSelector(
            ICleartextKMSVerifier.CleartextErrorHandleChainIdMismatch.selector,
            foreign,
            otherChain,
            uint64(block.chainid)
        );
        _refusedOnEveryUserPath(expected, _pairs(foreign), _request(_self(), block.timestamp, 1));
        _refusedOnBothPublicPaths(expected, _one(foreign));
    }

    /// Only Bool and Uint8..Uint256 decrypt; an enum member outside them, or a byte outside the enum, is refused
    /// with the same named error (the type is read from the raw byte, never converted to the enum).
    function test_anUnsupportedTypeIsRefused() public {
        bytes32 minted = _mint(1);
        uint8[2] memory types = [uint8(FheType.Uint4), uint8(0xFF)];
        for (uint256 i = 0; i < types.length; ++i) {
            bytes32 handle = _withType(minted, types[i]);
            bytes memory expected = abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorUnsupportedFheType.selector, handle, types[i]
            );
            _refusedOnEveryUserPath(expected, _pairs(handle), _request(_self(), block.timestamp, 1));
            _refusedOnBothPublicPaths(expected, _one(handle));
        }
    }

    /// Nine Uint256 handles are 2304 bits, past the gateway's 2048.
    function test_moreThan2048BitsAreRefused() public {
        bytes32 big = _withType(_mint(1), uint8(FheType.Uint256));
        bytes32[] memory handles = new bytes32[](9);
        ICleartextKMSVerifier.HandleContractPair[] memory pairs = new ICleartextKMSVerifier.HandleContractPair[](9);
        for (uint256 i = 0; i < 9; ++i) {
            handles[i] = big;
            pairs[i] = ICleartextKMSVerifier.HandleContractPair({handle: big, contractAddress: address(this)});
        }
        bytes memory expected = abi.encodeWithSelector(
            ICleartextKMSVerifier.CleartextErrorMaxDecryptionRequestBitSizeExceeded.selector, 2048, 2304
        );
        _refusedOnEveryUserPath(expected, pairs, _request(_self(), block.timestamp, 1));
        _refusedOnBothPublicPaths(expected, handles);
    }

    /// A well-formed handle this stack never minted passes conformance (existence is not checked: on a fork, older
    /// handles exist that the fresh store does not hold) and is refused by the ACL walk, since nothing can be
    /// allowed on it.
    function test_aNeverMintedHandleIsRefusedByTheAclWalk() public {
        bytes32 neverMinted = _withType(_mint(1) ^ bytes32(uint256(1) << 200), uint8(FheType.Uint32));
        UserDecryptRequestV1 memory request = _request(_self(), block.timestamp, 1);
        bytes memory v1 = _currentV1();
        bytes memory signature = _sign(ALICE_PK, request, v1);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorUserNotAuthorizedForDecrypt.selector, neverMinted, alice
            )
        );
        _legacyUser(_pairs(neverMinted), request, signature);

        _refusedOnBothPublicPaths(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorHandleNotAllowedForPublicDecryption.selector, neverMinted
            ),
            _one(neverMinted)
        );
    }

    // ---------------------------------------------------------------------------------------------
    // KMS epoch (KW `isValidEpochForContext`), on the v1, v2 and public paths
    // ---------------------------------------------------------------------------------------------

    function test_aV2ExtraDataNamingAnInactiveEpochIsRefused() public {
        (uint256 contextId, uint256 epochId) = protocolConfig.getCurrentKmsContextAndEpoch();
        bytes memory inactive = abi.encodePacked(uint8(0x02), contextId, epochId + 1);
        bytes32 handle = _grantedTo(alice, 1);
        UserDecryptRequestV1 memory request = _request(_self(), block.timestamp, 1);
        bytes memory signature = _sign(ALICE_PK, request, inactive);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory v2Permit = _v2Permit(alice, _self(), inactive);
        bytes memory v2Signature = _signV2(ALICE_PK, v2Permit);
        bytes32[] memory publicHandles = _decryptable(1);
        bytes memory expected = abi.encodeWithSelector(
            ICleartextKMSVerifier.CleartextErrorInvalidKmsEpoch.selector, contextId, epochId + 1
        );

        vm.expectRevert(expected);
        kms.userDecryptV1(_pairs(handle), _v1Permit(alice, request, inactive), signature);
        vm.expectRevert(expected);
        kms.userDecryptV2(_entries(handle, alice), v2Permit, v2Signature);
        vm.expectRevert(expected);
        kms.publicDecrypt(publicHandles, inactive);
    }

    // ---------------------------------------------------------------------------------------------
    // Thresholds: a user decryption answers with the context's USER-decryption threshold
    // ---------------------------------------------------------------------------------------------

    function test_userDecryptionAnswersWithTheUserThreshold() public {
        uint256 contextId = protocolConfig.getCurrentKmsContextId();
        uint256 publicThreshold = protocolConfig.getPublicDecryptionThresholdForContext(contextId);
        uint256 signerCount = protocolConfig.getKmsSignersForContext(contextId).length;
        vm.skip(signerCount < 2);
        uint256 userThreshold = publicThreshold == 1 ? 2 : 1;
        // A context's thresholds are fixed since v1.0 (no `update*ThresholdForContext`), so the user
        // threshold moves by rotating to a context that carries it, the public one kept as it was.
        LibForgeFhevmStack.defineCleartextKmsContext(
            PROTOCOL_CONFIG_ADDRESS,
            ACL_ADDRESS,
            IProtocolConfig.KmsThresholds({
                publicDecryption: publicThreshold,
                userDecryption: userThreshold,
                kmsGen: protocolConfig.getKmsGenThresholdForContext(contextId),
                mpc: protocolConfig.getMpcThresholdForContext(contextId)
            })
        );
        assertEq(
            protocolConfig.getUserDecryptionThresholdForContext(protocolConfig.getCurrentKmsContextId()),
            userThreshold,
            "the new context carries the user threshold"
        );

        bytes32 handle = _grantedTo(alice, 7);
        UserDecryptRequestV1 memory request = _request(_self(), block.timestamp, 1);
        bytes memory v1 = _currentV1();
        bytes memory signature = _sign(ALICE_PK, request, v1);

        (,, uint256 legacyThreshold,) = _legacyUser(_pairs(handle), request, signature);
        (,, uint256 v1Threshold,) = kms.userDecryptV1(_pairs(handle), _v1Permit(alice, request, v1), signature);
        (,,, uint256 publicDecryptThreshold,) = kms.publicDecrypt(_decryptable(1));

        assertEq(legacyThreshold, userThreshold, "legacy userDecrypt: not the user threshold");
        assertEq(v1Threshold, userThreshold, "userDecryptV1: not the user threshold");
        assertEq(publicDecryptThreshold, publicThreshold, "publicDecrypt: not the public threshold");
    }

    // ---------------------------------------------------------------------------------------------
    // The legacy extraData guess never reverts: it cannot report a bad signature ahead of the request checks
    // ---------------------------------------------------------------------------------------------

    function test_aMalformedSignatureDoesNotHideAnExpiredWindow() public {
        bytes32 handle = _grantedTo(alice, 1);
        uint256 start = block.timestamp - 1 days - 1;
        UserDecryptRequestV1 memory request = _request(_self(), start, 1);
        bytes memory malformed = new bytes(64);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorUserDecryptionRequestExpired.selector, block.timestamp, start, 1
            )
        );
        _legacyUser(_pairs(handle), request, malformed);
    }

    function test_aMalformedSignatureIsStillRefused() public {
        bytes32 handle = _grantedTo(alice, 1);
        UserDecryptRequestV1 memory request = _request(_self(), block.timestamp, 1);
        bytes memory malformed = new bytes(64);

        vm.expectRevert(ICleartextKMSVerifier.MalformedSignature.selector);
        _legacyUser(_pairs(handle), request, malformed);
    }

    // ---------------------------------------------------------------------------------------------
    // userDecryptV2: what its own suite leaves out
    // ---------------------------------------------------------------------------------------------

    function test_v2MoreThanTenAllowedContractsAreRefused() public {
        bytes32 handle = _grantedTo(alice, 1);
        address[] memory eleven = new address[](11);
        for (uint256 i = 0; i < 11; ++i) {
            eleven[i] = address(uint160(0x1000 + i));
        }
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _v2Permit(alice, eleven, _currentV2());

        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorContractAddressesMaxLengthExceeded.selector, 10, 11
            )
        );
        kms.userDecryptV2(_entries(handle, alice), permit, "");
    }

    /// The gateway accepts a v1 extraData on the unified path too.
    function test_v2AcceptsAV1ExtraData() public {
        bytes32 handle = _grantedTo(alice, 7);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _v2Permit(alice, _self(), _currentV1());
        bytes memory signature = _signV2(ALICE_PK, permit);

        (bytes memory payload,,, bytes memory extraData) = kms.userDecryptV2(_entries(handle, alice), permit, signature);
        assertEq(_unmask(payload), 7);
        assertEq(extraData, permit.extraData);
    }

    /// One request, a direct entry and a delegated one.
    function test_v2DecryptsMixedDirectAndDelegatedEntries() public {
        bytes32 own = _grantedTo(alice, 5);
        bytes32 bobs = _grantedTo(bob, 6);
        vm.prank(bob);
        ICleartextACL(ACL_ADDRESS).delegateForUserDecryption(alice, address(this), uint64(block.timestamp + 1 days));
        ICleartextKMSVerifier.HandleEntry[] memory entries = new ICleartextKMSVerifier.HandleEntry[](2);
        entries[0] =
            ICleartextKMSVerifier.HandleEntry({handle: own, contractAddress: address(this), ownerAddress: alice});
        entries[1] =
            ICleartextKMSVerifier.HandleEntry({handle: bobs, contractAddress: address(this), ownerAddress: bob});
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _v2Permit(alice, _self(), _currentV2());
        bytes memory signature = _signV2(ALICE_PK, permit);

        (bytes memory payload,,,) = kms.userDecryptV2(entries, permit, signature);
        (uint256[] memory masked,) = abi.decode(payload, (uint256[], bytes));
        assertEq(masked[0] ^ uint256(bytes32(publicKey)), 5, "the direct entry");
        assertEq(masked[1] ^ uint256(bytes32(publicKey)), 6, "the delegated entry");
    }

    /// A smart account whose `isValidSignature` answers the wrong magic, reverts, or burns more than the 250k gas
    /// cap is refused, never hangs the request.
    function test_v2RefusesErc1271WalletsThatDoNotAccept() public {
        address[3] memory wallets =
            [address(new WrongMagicWallet()), address(new RevertingWallet()), address(new GasBurningWallet())];
        for (uint256 i = 0; i < wallets.length; ++i) {
            bytes32 handle = _grantedTo(wallets[i], 1);
            ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _v2Permit(wallets[i], _self(), _currentV2());
            vm.expectRevert(
                abi.encodeWithSelector(
                    ICleartextKMSVerifier.CleartextErrorInvalidUserDecryptSignatureV2.selector, wallets[i]
                )
            );
            kms.userDecryptV2(_entries(handle, wallets[i]), permit, "");
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    /// @dev `request` through the four v1 user paths — alice direct, and bob as alice's delegate — each refused
    ///      with `expected`. The delegated paths need no delegation: every check here comes before it.
    function _refusedOnEveryUserPath(
        bytes memory expected,
        ICleartextKMSVerifier.HandleContractPair[] memory pairs,
        UserDecryptRequestV1 memory request
    ) private {
        bytes memory v1 = _currentV1();
        bytes memory signature = _sign(ALICE_PK, request, v1);
        bytes memory delegateSignature = _signDelegated(BOB_PK, request, alice, v1);

        vm.expectRevert(expected);
        _legacyUser(pairs, request, signature);
        vm.expectRevert(expected);
        kms.userDecryptV1(pairs, _v1Permit(alice, request, v1), signature);
        vm.expectRevert(expected);
        kms.delegatedUserDecrypt(
            pairs,
            alice,
            bob,
            request.transportPublicKey,
            request.contractAddresses,
            request.startTimestamp,
            request.durationDays,
            delegateSignature
        );
        vm.expectRevert(expected);
        kms.delegatedUserDecryptV1(pairs, _delegatedV1Permit(bob, alice, request, v1), delegateSignature);
    }

    /// @dev `handles` through both public paths (the current context, and a requested v1), each refused with
    ///      `expected`.
    function _refusedOnBothPublicPaths(bytes memory expected, bytes32[] memory handles) private {
        bytes memory v1 = _currentV1();
        vm.expectRevert(expected);
        kms.publicDecrypt(handles);
        vm.expectRevert(expected);
        kms.publicDecrypt(handles, v1);
    }

    function _legacyUser(
        ICleartextKMSVerifier.HandleContractPair[] memory pairs,
        UserDecryptRequestV1 memory request,
        bytes memory signature
    ) private view returns (bytes memory, address[] memory, uint256, bytes memory) {
        return kms.userDecrypt(
            pairs,
            alice,
            request.transportPublicKey,
            request.contractAddresses,
            request.startTimestamp,
            request.durationDays,
            signature
        );
    }

    function _request(address[] memory contracts, uint256 start, uint256 durationDays)
        private
        view
        returns (UserDecryptRequestV1 memory)
    {
        return UserDecryptRequestV1({
            transportPublicKey: publicKey,
            contractAddresses: contracts,
            startTimestamp: start,
            durationDays: durationDays
        });
    }

    function _v1Permit(address user, UserDecryptRequestV1 memory request, bytes memory extraData)
        private
        pure
        returns (ICleartextKMSVerifier.UserDecryptPermitV1 memory)
    {
        return ICleartextKMSVerifier.UserDecryptPermitV1({
            userAddress: user,
            publicKey: request.transportPublicKey,
            contractAddresses: request.contractAddresses,
            startTimestamp: request.startTimestamp,
            durationDays: request.durationDays,
            extraData: extraData
        });
    }

    function _delegatedV1Permit(
        address delegate,
        address delegator,
        UserDecryptRequestV1 memory request,
        bytes memory extraData
    ) private pure returns (ICleartextKMSVerifier.DelegatedUserDecryptPermitV1 memory) {
        return ICleartextKMSVerifier.DelegatedUserDecryptPermitV1({
                delegateAddress: delegate,
                publicKey: request.transportPublicKey,
                contractAddresses: request.contractAddresses,
                delegatorAddress: delegator,
                startTimestamp: request.startTimestamp,
                durationDays: request.durationDays,
                extraData: extraData
            });
    }

    function _v2Permit(address user, address[] memory allowed, bytes memory extraData)
        private
        view
        returns (ICleartextKMSVerifier.UserDecryptPermitV2 memory)
    {
        return ICleartextKMSVerifier.UserDecryptPermitV2({
            userAddress: user,
            publicKey: publicKey,
            allowedContracts: allowed,
            startTimestamp: block.timestamp,
            durationSeconds: 1 days,
            extraData: extraData
        });
    }

    function _sign(uint256 pk, UserDecryptRequestV1 memory request, bytes memory extraData)
        private
        view
        returns (bytes memory)
    {
        bytes32 digest = LibKmsVerifier.userDecryptionDigestV1(
            LibKmsVerifier.hostDomainSeparator(KMS_VERIFIER_ADDRESS), request, extraData
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signDelegated(uint256 pk, UserDecryptRequestV1 memory request, address delegator, bytes memory extraData)
        private
        view
        returns (bytes memory)
    {
        bytes32 digest = LibKmsVerifier.delegatedUserDecryptionDigestV1(
            LibKmsVerifier.hostDomainSeparator(KMS_VERIFIER_ADDRESS), request, delegator, extraData
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signV2(uint256 pk, ICleartextKMSVerifier.UserDecryptPermitV2 memory permit)
        private
        view
        returns (bytes memory)
    {
        bytes32 digest = LibKmsVerifier.toTypedDataHash(
            LibKmsVerifier.hostDomainSeparator(KMS_VERIFIER_ADDRESS),
            keccak256(
                abi.encode(
                    LibKmsVerifier.USER_DECRYPT_REQUEST_V2_TYPEHASH,
                    permit.userAddress,
                    keccak256(permit.publicKey),
                    keccak256(abi.encodePacked(permit.allowedContracts)),
                    permit.startTimestamp,
                    permit.durationSeconds,
                    keccak256(permit.extraData)
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _currentV1() private view returns (bytes memory) {
        return abi.encodePacked(uint8(0x01), protocolConfig.getCurrentKmsContextId());
    }

    function _currentV2() private view returns (bytes memory) {
        (uint256 contextId, uint256 epochId) = protocolConfig.getCurrentKmsContextAndEpoch();
        return abi.encodePacked(uint8(0x02), contextId, epochId);
    }

    function _self() private view returns (address[] memory a) {
        a = new address[](1);
        a[0] = address(this);
    }

    function _one(bytes32 handle) private pure returns (bytes32[] memory handles) {
        handles = new bytes32[](1);
        handles[0] = handle;
    }

    function _pairs(bytes32 handle) private view returns (ICleartextKMSVerifier.HandleContractPair[] memory pairs) {
        pairs = new ICleartextKMSVerifier.HandleContractPair[](1);
        pairs[0] = ICleartextKMSVerifier.HandleContractPair({handle: handle, contractAddress: address(this)});
    }

    function _entries(bytes32 handle, address owner)
        private
        view
        returns (ICleartextKMSVerifier.HandleEntry[] memory e)
    {
        e = new ICleartextKMSVerifier.HandleEntry[](1);
        e[0] = ICleartextKMSVerifier.HandleEntry({handle: handle, contractAddress: address(this), ownerAddress: owner});
    }

    /// @dev `handle` with byte 30 (the FHE type) replaced.
    function _withType(bytes32 handle, uint8 fheType) private pure returns (bytes32) {
        return bytes32((uint256(handle) & ~(uint256(0xff) << 8)) | (uint256(fheType) << 8));
    }

    /// @dev `handle` with bytes 22..29 (the chain id) replaced.
    function _withChainId(bytes32 handle, uint64 chainId) private pure returns (bytes32) {
        return bytes32((uint256(handle) & ~(uint256(type(uint64).max) << 16)) | (uint256(chainId) << 16));
    }

    function _unmask(bytes memory payload) private view returns (uint256) {
        (uint256[] memory masked,) = abi.decode(payload, (uint256[], bytes));
        return masked[0] ^ uint256(bytes32(publicKey));
    }

    function _grantedTo(address user, uint256 value) private returns (bytes32 handle) {
        handle = _mint(value);
        ICleartextACL(ACL_ADDRESS).allow(handle, address(this));
        ICleartextACL(ACL_ADDRESS).allow(handle, user);
    }

    function _decryptable(uint256 value) private returns (bytes32[] memory handles) {
        handles = _one(_mint(value));
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
