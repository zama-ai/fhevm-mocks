// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {euint8, externalEuint8} from "encrypted-types/EncryptedTypes.sol";

import {ICleartextACL} from "../../pkg/src/_host/FhevmCleartextDeploy.sol";
import {ACL_ADDRESS} from "../../pkg/src/_host/FhevmCleartextDeploy.sol";
import {ICleartextKMSVerifier} from "../../pkg/src/_host/_internal/interfaces/ICleartextKMSVerifier.sol";

import {TestFhevm, SignedDecryptionPermit, TransportKeypair, EncryptedInput} from "../../pkg/src/TestFhevm.sol";
import {PERMIT_VERSION_V1} from "../../pkg/src/StdFhevmDecrypt.sol";

/// Holds an `euint8` readable by ONE user — `allow`, not `makePubliclyDecryptable`, which is the
/// whole difference between user decryption and public decryption.
contract Safe is ZamaEthereumConfig {
    euint8 public secret;

    function store(externalEuint8 v, bytes calldata proof, address reader) external {
        secret = FHE.fromExternal(v, proof);
        FHE.allowThis(secret);
        FHE.allow(secret, reader);
    }
}

/// The user-decryption round trip: sign a permit once, then read a handle with it.
contract DecryptUint8Test is TestFhevm {
    Safe internal safe;
    address internal alice;
    uint256 internal aliceKey;
    TransportKeypair internal keypair;
    address[] internal contracts;

    function setUp() public override {
        super.setUp();
        safe = new Safe();
        (alice, aliceKey) = makeAddrAndKey("alice");
        keypair = generateTransportKeypair();
        contracts.push(address(safe));

        EncryptedInput memory e = encryptValues(asUint8(42), address(safe), alice);
        vm.prank(alice);
        safe.store(e.externalEuint8At(0), e.inputProof(), alice);
    }

    function _permit() private view returns (SignedDecryptionPermit memory) {
        return signLegacyDecryptionPermit(aliceKey, keypair, contracts, block.timestamp, 7 days);
    }

    /// The value goes in encrypted and comes back out under the permit.
    function test_theUserReadsTheirOwnValue() public view {
        assertEq(decrypt(safe.secret(), address(safe), keypair, _permit()), 42);
    }

    /// The same permit serves more than one call — that is the point of signing one.
    function test_onePermitServesRepeatedReads() public view {
        SignedDecryptionPermit memory permit = _permit();

        assertEq(decrypt(safe.secret(), address(safe), keypair, permit), 42);
        assertEq(decrypt(safe.secret(), address(safe), keypair, permit), 42);
    }

    /// A user the handle was never allowed for cannot read it, permit or not.
    function test_anotherUserIsRejected() public {
        (address bob, uint256 bobKey) = makeAddrAndKey("bob");
        SignedDecryptionPermit memory bobsPermit =
            signLegacyDecryptionPermit(bobKey, keypair, contracts, block.timestamp, 7 days);

        // `safe.secret()` is itself an external call, so read it BEFORE arming `expectRevert`.
        euint8 value = safe.secret();

        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextKMSVerifier.CleartextErrorUserNotAuthorizedForDecrypt.selector, euint8.unwrap(value), bob
            )
        );
        this.decryptExternally(value, address(safe), keypair, bobsPermit);
    }

    /// The permit records the format it was signed in, and only that format is accepted.
    function test_anUnknownPermitVersionIsRefused() public {
        SignedDecryptionPermit memory permit = _permit();
        assertEq(permit.version, PERMIT_VERSION_V1, "what this library signs today");

        permit.version = 2;
        euint8 value = safe.secret();

        vm.expectRevert("StdFhevm: unsupported decryption permit version");
        this.decryptExternally(value, address(safe), keypair, permit);
    }

    /// The permit names the key it was signed for; another pair would unmask to garbage, so it fails.
    function test_aMismatchedTransportKeypairIsRefused() public {
        SignedDecryptionPermit memory permit = _permit();
        TransportKeypair memory other = generateTransportKeypair();
        euint8 value = safe.secret();

        vm.expectRevert("StdFhevm: transport keypair does not match the permit");
        this.decryptExternally(value, address(safe), other, permit);
    }

    // -- Delegated: BOB signs, ALICE's access is exercised ----------------------------

    /// A delegated permit routes to `delegatedUserDecryptV1`, chosen by `permit.delegatorAddress`.
    function test_aDelegateReadsTheDelegatorsValue() public {
        (address bob, uint256 bobKey) = makeAddrAndKey("bob");

        vm.prank(alice);
        ICleartextACL(ACL_ADDRESS).delegateForUserDecryption(bob, address(safe), uint64(block.timestamp + 1 days));

        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit(bobKey, keypair, contracts, block.timestamp, 7 days, alice);

        assertEq(permit.delegatorAddress, alice, "the permit records who it is delegated from");
        assertEq(decrypt(safe.secret(), address(safe), keypair, permit), 42);
    }

    /// Without the delegation the same permit is refused: signing one is not authorisation.
    function test_aDelegateWithoutADelegationIsRejected() public {
        (, uint256 bobKey) = makeAddrAndKey("bob");
        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit(bobKey, keypair, contracts, block.timestamp, 7 days, alice);
        euint8 value = safe.secret();

        vm.expectRevert();
        this.decryptExternally(value, address(safe), keypair, permit);
    }

    /// A delegated permit is a DIFFERENT EIP-712 struct, so it does not verify as a plain one.
    function test_aDelegatedPermitIsNotAPlainPermit() public view {
        SignedDecryptionPermit memory delegated =
            signLegacyDecryptionPermit(aliceKey, keypair, contracts, block.timestamp, 7 days, address(0xD00D));
        SignedDecryptionPermit memory plain = _permit();

        assertNotEq(keccak256(delegated.signature), keccak256(plain.signature));
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function decryptExternally(
        euint8 v,
        address contractAddress,
        TransportKeypair memory kp,
        SignedDecryptionPermit memory permit
    ) external view returns (uint8) {
        return decrypt(v, contractAddress, kp, permit);
    }
}
