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
import {ICleartextKMSVerifier} from "../../pkg/forge/src/_internal/interfaces/ICleartextKMSVerifier.sol";
import {IProtocolConfig} from "../../pkg/forge/src/_internal/interfaces/IProtocolConfig.sol";
import {LibKmsVerifier} from "../../pkg/forge/src/shared/LibKmsVerifier.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";

/// @dev A smart account that accepts exactly one digest, as an ERC-1271 wallet would after its own checks.
contract MockErc1271Wallet {
    bytes32 public accepted;

    function accept(bytes32 digest) external {
        accepted = digest;
    }

    function isValidSignature(bytes32 hash, bytes memory) external view returns (bytes4) {
        return hash == accepted ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}

/**
 * The unified (RFC-016) user decryption, `userDecryptV2`: what the v14 gateway
 * (`userDecryptionRequest(HandleEntry[], ...)`) and kms-worker (`check_user_decryption_request_v2`) enforce. The
 * verifier checks its own (the KMS context, its verifying contract) and hands the rest to
 * `LibKmsVerifier.userDecryptPayloadV2`; this suite drives both through the verifier's ABI.
 *
 * The permit digest is built HERE, from the connector's type string, never through the verifier or the library, so
 * the two are checked against each other. `_sign` makes an external call itself (`hostDomainSeparator` reads
 * `eip712Domain()`), and `vm.expectRevert` binds to the next external call: every refusing test signs first.
 */
contract CleartextKMSVerifierUserDecryptV2Test is Test, ForgeFhevmDeploy {
    bytes32 internal constant TYPEHASH = keccak256(
        "UserDecryptRequestVerification(address userAddress,bytes publicKey,address[] allowedContracts,uint256 startTimestamp,uint256 durationSeconds,bytes extraData)"
    );

    uint256 internal constant ALICE_PK = uint256(keccak256("alice"));
    uint256 internal constant BOB_PK = 0xB0B;

    address internal alice;
    address internal bob;
    bytes internal publicKey;

    ICleartextKMSVerifier internal kms;
    IProtocolConfig internal protocolConfig;

    function setUp() public {
        deployLocalFhevm();
        vm.warp(1_000_000);
        alice = vm.addr(ALICE_PK);
        bob = vm.addr(BOB_PK);
        (publicKey,) = LibForgeFhevmSigners.generateTransportKeypair();
        kms = ICleartextKMSVerifier(KMS_VERIFIER_ADDRESS);
        protocolConfig = IProtocolConfig(PROTOCOL_CONFIG_ADDRESS);
    }

    // --- happy paths ---------------------------------------------------------------------------

    function test_eoaDirectDecrypts() public {
        bytes32 handle = _grantedTo(alice, 7);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, _self());

        (bytes memory payload,, uint256 threshold, bytes memory extraData) =
            kms.userDecryptV2(_entries(handle, alice), permit, _sign(ALICE_PK, permit));

        assertEq(_unmask(payload), 7, "wrong cleartext");
        assertEq(extraData, permit.extraData, "extraData not returned verbatim");
        assertEq(
            threshold,
            protocolConfig.getUserDecryptionThresholdForContext(protocolConfig.getCurrentKmsContextId()),
            "not the user-decryption threshold"
        );
    }

    /// Permissive mode: an empty `allowedContracts` skips the contract check entirely, and a direct handle is
    /// NOT checked against `entry.contractAddress` (kms-worker semantics).
    function test_permissiveModeNeedsOnlyTheUser() public {
        bytes32 handle = _mint(9);
        ICleartextACL(ACL_ADDRESS).allow(handle, alice); // the entry's contract is never allowed persistently
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, new address[](0));

        (bytes memory payload,,,) =
            kms.userDecryptV2(_entriesFor(handle, address(0xC0FFEE), alice), permit, _sign(ALICE_PK, permit));
        assertEq(_unmask(payload), 9);
    }

    function test_smartAccountViaErc1271() public {
        MockErc1271Wallet wallet = new MockErc1271Wallet();
        bytes32 handle = _grantedTo(address(wallet), 11);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(address(wallet), _self());
        wallet.accept(_digest(permit));

        (bytes memory payload,,,) = kms.userDecryptV2(_entries(handle, address(wallet)), permit, "");
        assertEq(_unmask(payload), 11);
    }

    function test_delegatedDecrypts() public {
        bytes32 handle = _grantedTo(alice, 13);
        vm.prank(alice);
        ICleartextACL(ACL_ADDRESS).delegateForUserDecryption(bob, address(this), uint64(block.timestamp + 1 days));
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(bob, _self());

        (bytes memory payload,,,) = kms.userDecryptV2(_entries(handle, alice), permit, _sign(BOB_PK, permit));
        assertEq(_unmask(payload), 13);
    }

    // --- gateway refusals ----------------------------------------------------------------------

    function test_refusesNoHandles() public {
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, _self());
        bytes memory sig = _sign(ALICE_PK, permit);
        vm.expectRevert(ICleartextKMSVerifier.CleartextErrorEmptyCtHandles.selector);
        kms.userDecryptV2(new ICleartextKMSVerifier.HandleEntry[](0), permit, sig);
    }

    function test_refusesZeroDuration() public {
        bytes32 handle = _grantedTo(alice, 1);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, _self());
        permit.durationSeconds = 0;
        bytes memory sig = _sign(ALICE_PK, permit);
        vm.expectRevert(ICleartextKMSVerifier.CleartextErrorInvalidNullDurationSeconds.selector);
        kms.userDecryptV2(_entries(handle, alice), permit, sig);
    }

    function test_refusesMoreThan365Days() public {
        bytes32 handle = _grantedTo(alice, 1);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, _self());
        permit.durationSeconds = 365 days + 1;
        bytes memory sig = _sign(ALICE_PK, permit);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorMaxDurationSecondsExceeded.selector, 365 days, 365 days + 1
            )
        );
        kms.userDecryptV2(_entries(handle, alice), permit, sig);
    }

    function test_refusesAnExpiredPermit() public {
        bytes32 handle = _grantedTo(alice, 1);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, _self());
        bytes memory sig = _sign(ALICE_PK, permit);
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorUserDecryptionRequestExpiredSeconds.selector,
                block.timestamp,
                permit.startTimestamp,
                permit.durationSeconds
            )
        );
        kms.userDecryptV2(_entries(handle, alice), permit, sig);
    }

    // --- kms-worker refusals -------------------------------------------------------------------

    function test_refusesUserInAllowedContracts() public {
        bytes32 handle = _grantedTo(alice, 1);
        address[] memory allowed = new address[](2);
        allowed[0] = address(this);
        allowed[1] = alice;
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, allowed);
        bytes memory sig = _sign(ALICE_PK, permit);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorUserAddressInAllowedContracts.selector, alice)
        );
        kms.userDecryptV2(_entries(handle, alice), permit, sig);
    }

    function test_refusesAnotherSigner() public {
        bytes32 handle = _grantedTo(alice, 1);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, _self());
        bytes memory sig = _sign(BOB_PK, permit);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorInvalidUserDecryptSignatureV2.selector, alice)
        );
        kms.userDecryptV2(_entries(handle, alice), permit, sig);
    }

    /// An EOA cannot use the empty signature: the ERC-1271 call returns no data.
    function test_refusesAnEmptySignatureFromAnEoa() public {
        bytes32 handle = _grantedTo(alice, 1);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, _self());
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorInvalidUserDecryptSignatureV2.selector, alice)
        );
        kms.userDecryptV2(_entries(handle, alice), permit, "");
    }

    function test_refusesAnInvalidatedPermit() public {
        bytes32 handle = _grantedTo(alice, 1);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, _self());
        permit.startTimestamp = block.timestamp - 10;
        bytes memory sig = _sign(ALICE_PK, permit);
        vm.prank(alice);
        ICleartextACL(ACL_ADDRESS).invalidateDecryptionSignaturesBefore(block.timestamp);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorUserDecryptSignatureInvalidated.selector,
                alice,
                permit.startTimestamp,
                block.timestamp
            )
        );
        kms.userDecryptV2(_entries(handle, alice), permit, sig);
    }

    function test_refusesAUserNotAllowed() public {
        bytes32 handle = _grantedTo(alice, 1);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(bob, _self());
        bytes memory sig = _sign(BOB_PK, permit);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorUserNotAllowed.selector, handle, bob)
        );
        kms.userDecryptV2(_entries(handle, bob), permit, sig);
    }

    function test_refusesAnUndelegatedUser() public {
        bytes32 handle = _grantedTo(alice, 1);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(bob, _self());
        bytes memory sig = _sign(BOB_PK, permit);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorUserNotDelegated.selector, handle, alice, bob, address(this)
            )
        );
        kms.userDecryptV2(_entries(handle, alice), permit, sig);
    }

    function test_refusesWhenNoAllowedContractHoldsTheHandle() public {
        bytes32 handle = _grantedTo(alice, 1);
        address[] memory allowed = new address[](1);
        allowed[0] = address(0xBEEF);
        ICleartextKMSVerifier.UserDecryptPermitV2 memory permit = _permit(alice, allowed);
        bytes memory sig = _sign(ALICE_PK, permit);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextKMSVerifier.CleartextErrorNoAllowedContractForHandle.selector, handle)
        );
        kms.userDecryptV2(_entries(handle, alice), permit, sig);
    }

    // --- helpers -------------------------------------------------------------------------------

    function _permit(address user, address[] memory allowed)
        private
        view
        returns (ICleartextKMSVerifier.UserDecryptPermitV2 memory)
    {
        (uint256 contextId, uint256 epochId) = protocolConfig.getCurrentKmsContextAndEpoch();
        return ICleartextKMSVerifier.UserDecryptPermitV2({
            userAddress: user,
            publicKey: publicKey,
            allowedContracts: allowed,
            startTimestamp: block.timestamp,
            durationSeconds: 1 days,
            extraData: abi.encodePacked(uint8(0x02), contextId, epochId)
        });
    }

    /// @dev Built here from the connector's type string, not from the verifier, so the two are checked
    ///      against each other.
    function _digest(ICleartextKMSVerifier.UserDecryptPermitV2 memory permit) private view returns (bytes32) {
        return LibKmsVerifier.toTypedDataHash(
            LibKmsVerifier.hostDomainSeparator(KMS_VERIFIER_ADDRESS),
            keccak256(
                abi.encode(
                    TYPEHASH,
                    permit.userAddress,
                    keccak256(permit.publicKey),
                    keccak256(abi.encodePacked(permit.allowedContracts)),
                    permit.startTimestamp,
                    permit.durationSeconds,
                    keccak256(permit.extraData)
                )
            )
        );
    }

    function _sign(uint256 pk, ICleartextKMSVerifier.UserDecryptPermitV2 memory permit)
        private
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(pk, _digest(permit));
        return abi.encodePacked(rr, s, v);
    }

    function _self() private view returns (address[] memory a) {
        a = new address[](1);
        a[0] = address(this);
    }

    function _entries(bytes32 handle, address owner) private view returns (ICleartextKMSVerifier.HandleEntry[] memory) {
        return _entriesFor(handle, address(this), owner);
    }

    function _entriesFor(bytes32 handle, address contractAddress, address owner)
        private
        pure
        returns (ICleartextKMSVerifier.HandleEntry[] memory e)
    {
        e = new ICleartextKMSVerifier.HandleEntry[](1);
        e[0] =
            ICleartextKMSVerifier.HandleEntry({handle: handle, contractAddress: contractAddress, ownerAddress: owner});
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
