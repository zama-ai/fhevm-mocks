// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {ForgeFhevmDeploy} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {
    ACL_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    PADDED_INPUTTER_ADDRESS,
    PROTOCOL_CONFIG_ADDRESS
} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextACL, ICleartextFHEVMExecutor} from "../../pkg/forge/src/ForgeFhevmDeploy.sol";
import {ICleartextPaddedInputter} from "../../pkg/forge/src/_internal/interfaces/ICleartextPaddedInputter.sol";
import {IProtocolConfig} from "../../pkg/forge/src/_internal/interfaces/IProtocolConfig.sol";
import {LibForgeFhevmSigners} from "../../pkg/forge/src/LibForgeFhevmSigners.sol";
import {LibCleartextPad} from "../../pkg/forge/src/shared/LibCleartextPad.sol";
import {LibFhevmCleartextConfig} from "../../pkg/forge/src/shared/LibFhevmCleartextConfig.sol";
import {LibKmsVerifier} from "../../pkg/forge/src/shared/LibKmsVerifier.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";

/**
 * RFC-030 pad-based inputs, end to end on the local stack: the pad decryption mock
 * (`CleartextPaddedInputter.getCleartextPadSharesMaterial`) and the input side (`FHEVMExecutor.verifyInput` →
 * `PaddedInputter` → `CleartextArithmetic`), which must agree on the pad, the label and the PRF registry.
 *
 * Every expectation is built HERE, from the RFC's encodings, never through the contracts under test: the label
 * from `LibCleartextPad.padLabel` checked against the package `PaddedInputter` hashes itself, the response digests
 * from the type strings and the configured gateway domain, the permit digest from the connector's type string.
 * `_sign` reads `eip712Domain()`, and `vm.expectRevert` binds to the next external call: every refusing test signs
 * first.
 */
contract CleartextPadDecryptionTest is Test, ForgeFhevmDeploy {
    bytes32 internal constant PERMIT_TYPEHASH = keccak256(
        "UserDecryptRequestVerification(address userAddress,bytes publicKey,address[] allowedContracts,uint256 startTimestamp,uint256 durationSeconds,bytes extraData)"
    );
    bytes32 internal constant SHARE_VERIFICATION_TYPEHASH = keccak256(
        "PadShareVerification(bytes32 label,bytes rawShares,uint32 partyId,uint32 degree,bytes32 contextId,bytes16 sessionId,bytes extraData)"
    );
    bytes32 internal constant RESPONSE_VERIFICATION_TYPEHASH =
        keccak256("PadDecryptResponseVerification(bytes32 requestId,bytes encryptedPayload)");

    uint256 internal constant ALICE_PK = uint256(keccak256("alice"));
    uint256 internal constant BOB_PK = 0xB0B;

    uint16 internal constant PRF = LibFhevmCleartextConfig.CLEARTEXT_PAD_PRF_INSTANCE;

    address internal alice;
    address internal bob;
    bytes internal publicKey;

    ICleartextPaddedInputter internal inputter;
    IProtocolConfig internal protocolConfig;

    function setUp() public {
        deployLocalFhevm();
        vm.warp(1_000_000);
        alice = vm.addr(ALICE_PK);
        bob = vm.addr(BOB_PK);
        (publicKey,) = LibForgeFhevmSigners.generateTransportKeypair();
        inputter = ICleartextPaddedInputter(PADDED_INPUTTER_ADDRESS);
        protocolConfig = IProtocolConfig(PROTOCOL_CONFIG_ADDRESS);
    }

    // --- the registry ---------------------------------------------------------------------------

    function test_theDefaultInstanceIsRegisteredAtDeploy() public view {
        assertTrue(inputter.isSupportedPrfInstance(PRF), "the default instance is live");
        assertFalse(inputter.isSupportedPrfInstance(0), "0 is never an instance");
    }

    function test_zeroCannotBeAdded() public {
        vm.prank(fhevmACLOwner());
        vm.expectRevert(ICleartextPaddedInputter.PadZeroPrfInstance.selector);
        inputter.addPrfInstance(0);
    }

    // --- the round trip -------------------------------------------------------------------------

    /**
     * The whole flow: alice obtains the pad of a fresh label, masks a value with it, and submits the package;
     * the executor routes it to `PaddedInputter`, and `CleartextArithmetic` unmasks it with the pad it derives on
     * its own. Equal plaintexts prove both halves derive the same pad, and the package passing `PaddedInputter`'s
     * label check proves its label hashing agrees with `LibCleartextPad.padLabel`.
     */
    function test_roundTrip() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.CleartextPadSharesMaterial memory m = _material(_request(alice, ALICE_PK, w));

        uint32 value = 0xDEADBEEF;
        bytes memory pad = _pad(m.shares[0].rawShares);
        (bytes32 handle, bytes memory package) = _package(w, FheType.Uint32, _le(value, 4), pad);

        bytes32 result = _verifyInput(handle, alice, package, FheType.Uint32);
        assertEq(ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).plaintexts(result), value, "unmasked value");
        assertEq(uint8(result[21]), 0xff, "a pad-based compute handle");
    }

    /**
     * RFC-030 seeds block `i` with `label ‖ i`, `i` a LITTLE-endian 32-bit index (tech-spec#553). Block 0 seeds alike
     * in either byte order, so the round trip above cannot tell them apart: the seed bytes are spelled out here.
     */
    function test_theBlockIndexIsLittleEndian() public pure {
        bytes32 label = keccak256("label");
        bytes8 tag = "FHE_cpad";
        assertEq(
            LibCleartextPad.cleartextPrfBlock(PRF, label, 1),
            keccak256(abi.encodePacked(tag, PRF, label, hex"01000000"))
        );
        assertEq(
            LibCleartextPad.cleartextPrfBlock(PRF, label, 0x01020304),
            keccak256(abi.encodePacked(tag, PRF, label, hex"04030201"))
        );

        bytes memory pad = LibCleartextPad.cleartextPrfBlocks(PRF, label, 257);
        assertEq(pad.length, 64, "257 bits round up to two blocks");
        bytes32 second;
        assembly {
            second := mload(add(pad, 64))
        }
        assertEq(second, keccak256(abi.encodePacked(tag, PRF, label, hex"01000000")), "the stream's second block");
    }

    // --- the external handle must name the package it is presented with -------------------------

    /**
     * The handle's bytes [0..28] must equal the package's own digest: an index and type that happen to fit
     * some other package is not enough. Without this check, a handle built for package A could be replayed
     * against any package B whose parts share A's index and type, unmasking B's ciphertext under A's handle.
     */
    function test_refusesAHandleForAnotherPackage() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.CleartextPadSharesMaterial memory m = _material(_request(alice, ALICE_PK, w));
        bytes memory pad = _pad(m.shares[0].rawShares);
        (bytes32 handle, bytes memory package) = _package(w, FheType.Uint32, _le(0xDEADBEEF, 4), pad);

        bytes32 packageDigest = keccak256(abi.encodePacked(bytes8("FHE_padp"), package));
        // Flips a bit within bytes [0..28] only, leaving inputIndex, type and version untouched.
        bytes32 foreignHandle = bytes32(uint256(handle) ^ (uint256(1) << 255));

        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextPaddedInputter.PadHandleDigestMismatch.selector, foreignHandle, packageDigest
            )
        );
        _verifyInput(foreignHandle, alice, package, FheType.Uint32);
    }

    /// The handle's version byte (31) must equal `HANDLE_VERSION`, distinct from `witnessVersion`.
    function test_refusesAWrongHandleVersion() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.CleartextPadSharesMaterial memory m = _material(_request(alice, ALICE_PK, w));
        bytes memory pad = _pad(m.shares[0].rawShares);
        (bytes32 handle, bytes memory package) = _package(w, FheType.Uint32, _le(0xDEADBEEF, 4), pad);

        bytes32 badVersionHandle = handle | bytes32(uint256(1));
        vm.expectRevert(abi.encodeWithSelector(ICleartextPaddedInputter.PadHandleVersionMismatch.selector, uint8(1)));
        _verifyInput(badVersionHandle, alice, package, FheType.Uint32);
    }

    /// What every node signs for every share, rebuilt here from the RFC's encodings and the configured gateway domain.
    function test_materialIsReadyToSign() public view {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 300);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        ICleartextPaddedInputter.CleartextPadSharesMaterial memory m = _material(r);

        uint256 contextId = protocolConfig.getCurrentKmsContextId();
        address[] memory signers = protocolConfig.getKmsSignersForContext(contextId);
        assertEq(m.signers, signers, "the context's signers");
        assertEq(m.threshold, protocolConfig.getUserDecryptionThresholdForContext(contextId), "threshold");
        assertEq(m.requestId, keccak256(abi.encodePacked(w.label, r.auth.extraData, r.signature)), "requestId");

        assertEq(m.shares.length, 1);
        ICleartextPaddedInputter.PadShare memory share = m.shares[0];
        assertEq(share.label, w.label);
        assertEq(uint8(share.rawShares[0]), 0x00, "rawShares version 0");
        assertEq(share.rawShares.length, 1 + 64, "version byte, then 300 bits rounded up to two 256-bit blocks");
        assertEq(share.degree, (signers.length - 1) / 3, "degree");
        assertEq(share.contextId, bytes32(contextId), "the context the request names");
        assertEq(share.sessionId, bytes16(keccak256(abi.encodePacked(bytes8("FHE_csid"), PRF, w.label))));
        assertEq(share.extraData, hex"00", "version 0, no metadata");
        assertEq(share.partyId, 0, "set per node");
        assertEq(share.signature.length, 0, "signed off-chain");

        assertEq(m.partyIds.length, signers.length);
        assertEq(m.shareDigests.length, signers.length);
        for (uint256 i; i < signers.length; ++i) {
            assertEq(m.partyIds[i], i + 1, "1-based party ids");
            assertEq(m.shareDigests[i].length, 1, "one digest per share");
            assertEq(m.shareDigests[i][0], _shareDigest(share, uint32(i + 1)), "share digest");
        }
    }

    /**
     * A node's whole response, as the SDK assembles it from the material: each share signed with the node's key, the
     * payload encrypted under the request's public key, and the transport signature over the request id and that
     * ciphertext. The client then checks the transport signature first, decrypts, and checks each share's.
     */
    function test_aNodeResponseVerifiesAtBothLayers() public view {
        ICleartextPaddedInputter.PadWitness[] memory ws = new ICleartextPaddedInputter.PadWitness[](2);
        ws[0] = _witness(alice, new address[](0), 32);
        ws[1] = _witness(alice, new address[](0), 600);
        ICleartextPaddedInputter.CleartextPadSharesMaterial memory m =
            _material(_requestFor(alice, ALICE_PK, ws, _self()));
        uint256 node = m.signers.length - 1;

        (bytes memory encryptedPayload, bytes memory transportSignature) = _nodeResponse(m, node);

        // Client side: the transport signature first, before anything is decrypted.
        bytes32 transportDigest = keccak256(
            abi.encodePacked(
                hex"1901",
                _responseDomain(),
                keccak256(abi.encode(RESPONSE_VERIFICATION_TYPEHASH, m.requestId, keccak256(encryptedPayload)))
            )
        );
        assertEq(_recover(transportDigest, transportSignature), m.signers[node], "transport signer");

        ICleartextPaddedInputter.PadDecryptResponsePayload memory received =
            abi.decode(_xorMask(encryptedPayload), (ICleartextPaddedInputter.PadDecryptResponsePayload));
        assertEq(received.shares.length, 2);
        for (uint256 j; j < received.shares.length; ++j) {
            ICleartextPaddedInputter.PadShare memory share = received.shares[j];
            assertEq(share.label, ws[j].label, "shares keyed by label");
            assertEq(share.partyId, node + 1, "registered under its party id");
            assertEq(_recover(_shareDigest(share, share.partyId), share.signature), m.signers[node], "share signer");
        }
        assertEq(received.shares[1].rawShares.length, 1 + 3 * 32, "600 bits round up to three blocks");
    }

    /// Node `node`'s response, as the SDK builds it from the material with that node's key.
    function _nodeResponse(ICleartextPaddedInputter.CleartextPadSharesMaterial memory m, uint256 node)
        private
        view
        returns (bytes memory encryptedPayload, bytes memory transportSignature)
    {
        uint256 nodeKey = LibForgeFhevmSigners.kmsNodeKeyFor(m.signers[node]);
        ICleartextPaddedInputter.PadDecryptResponsePayload memory payload;
        payload.shares = m.shares;
        for (uint256 j; j < payload.shares.length; ++j) {
            payload.shares[j].partyId = m.partyIds[node];
            payload.shares[j].signature = _signDigest(nodeKey, m.shareDigests[node][j]);
        }
        encryptedPayload = inputter.cleartextEncryptPadPayload(payload, publicKey);
        transportSignature = _signDigest(nodeKey, inputter.padDecryptResponseDigest(m.requestId, encryptedPayload));
    }

    function _signDigest(uint256 key, bytes32 digest) private pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _recover(bytes32 digest, bytes memory signature) private pure returns (address) {
        (bytes32 r, bytes32 s) = abi.decode(signature, (bytes32, bytes32));
        return ecrecover(digest, uint8(signature[64]), r, s);
    }

    /// The EIP-712 digest of `share`'s `PadShareVerification` as node `partyId` signs it.
    function _shareDigest(ICleartextPaddedInputter.PadShare memory share, uint32 partyId)
        private
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                hex"1901",
                _responseDomain(),
                keccak256(
                    abi.encode(
                        SHARE_VERIFICATION_TYPEHASH,
                        share.label,
                        keccak256(share.rawShares),
                        partyId,
                        share.degree,
                        share.contextId,
                        share.sessionId,
                        keccak256(share.extraData)
                    )
                )
            )
        );
    }

    // --- who may obtain a pad -------------------------------------------------------------------

    function test_aListedDecryptorObtainsThePad() public view {
        address[] memory decryptors = new address[](1);
        decryptors[0] = bob;
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, decryptors, 32);
        assertEq(_material(_request(bob, BOB_PK, w)).shares[0].label, w.label);
    }

    function test_aDelegateObtainsThePad() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        vm.prank(alice);
        ICleartextACL(ACL_ADDRESS).delegateForUserDecryption(bob, address(this), uint64(block.timestamp + 1 days));
        assertEq(_material(_request(bob, BOB_PK, w)).shares[0].label, w.label);
    }

    function test_refusesAnUnauthorizedUser() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(bob, BOB_PK, w);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextPaddedInputter.PadDecryptUserNotAuthorized.selector, w.label, bob)
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    function test_refusesAConsumerOutsideAllowedContracts() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        address[] memory allowed = new address[](1);
        allowed[0] = address(0xC0FFEE);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _requestAllowing(alice, ALICE_PK, w, allowed);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextPaddedInputter.PadDecryptConsumerNotAllowed.selector, w.label, address(this)
            )
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    // --- the PRF registry, on both sides --------------------------------------------------------

    function test_refusesAnUnknownInstance() public {
        ICleartextPaddedInputter.PadWitness memory w = _witnessUnder(2, alice, new address[](0), 32);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        r.payload.prf = 2;
        vm.expectRevert(abi.encodeWithSelector(ICleartextPaddedInputter.PadUnsupportedPrf.selector, uint16(2)));
        inputter.getCleartextPadSharesMaterial(r);
    }

    /// A retired instance is refused at decryption and at submission alike: the KMS and `fromExternal` read
    /// the same registry.
    function test_aRetiredInstanceIsRefusedOnBothSides() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        bytes memory pad = _pad(_material(r).shares[0].rawShares);
        (bytes32 handle, bytes memory package) = _package(w, FheType.Uint32, _le(7, 4), pad);

        vm.prank(fhevmACLOwner());
        inputter.retirePrfInstance(PRF);

        vm.expectRevert(abi.encodeWithSelector(ICleartextPaddedInputter.PadUnsupportedPrf.selector, PRF));
        inputter.getCleartextPadSharesMaterial(r);
        vm.expectRevert(abi.encodeWithSelector(ICleartextPaddedInputter.PadUnsupportedPrf.selector, PRF));
        _verifyInput(handle, alice, package, FheType.Uint32);
    }

    // --- the permit: held to userDecryptV2's rules ----------------------------------------------

    function test_refusesAnotherSigner() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, BOB_PK, w);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextPaddedInputter.CleartextErrorInvalidUserDecryptSignatureV2.selector, alice)
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    function test_refusesAStartInTheFuture() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        r.auth.startTimestamp = block.timestamp + 1;
        r.signature = _sign(ALICE_PK, r.auth);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextPaddedInputter.CleartextErrorStartTimestampInFuture.selector,
                block.timestamp,
                block.timestamp + 1
            )
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    function test_refusesTheUserInItsAllowedContracts() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        address[] memory allowed = new address[](2);
        allowed[0] = address(this);
        allowed[1] = alice;
        ICleartextPaddedInputter.PadDecryptRequest memory r = _requestAllowing(alice, ALICE_PK, w, allowed);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextPaddedInputter.CleartextErrorUserAddressInAllowedContracts.selector, alice)
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    function test_refusesAnExpiredPermit() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        w.expirationTimestamp = uint64(block.timestamp + 10 days);
        w.label = _label(PRF, w);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextPaddedInputter.CleartextErrorUserDecryptionRequestExpiredSeconds.selector,
                block.timestamp,
                r.auth.startTimestamp,
                r.auth.durationSeconds
            )
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    // --- the witnesses --------------------------------------------------------------------------

    function test_refusesALabelThatIsNotTheWitnessHash() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        bytes32 expected = w.label;
        w.label = keccak256("forged");
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        vm.expectRevert(abi.encodeWithSelector(ICleartextPaddedInputter.PadLabelMismatch.selector, w.label, expected));
        inputter.getCleartextPadSharesMaterial(r);
    }

    function test_refusesAnExpiredWitness() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        w.expirationTimestamp = uint64(block.timestamp);
        w.label = _label(PRF, w);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        vm.expectRevert(
            abi.encodeWithSelector(
                ICleartextPaddedInputter.PadDecryptWitnessExpired.selector, w.label, w.expirationTimestamp
            )
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    function test_refusesADuplicateLabel() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.PadWitness[] memory ws = new ICleartextPaddedInputter.PadWitness[](2);
        ws[0] = w;
        ws[1] = w;
        ICleartextPaddedInputter.PadDecryptRequest memory r = _requestFor(alice, ALICE_PK, ws, _self());
        vm.expectRevert(abi.encodeWithSelector(ICleartextPaddedInputter.PadDecryptDuplicateLabel.selector, w.label));
        inputter.getCleartextPadSharesMaterial(r);
    }

    function test_refusesAZeroPadLength() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 0);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextPaddedInputter.PadDecryptInvalidPadLength.selector, w.label, uint16(0))
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    function test_refusesAnotherChain() public {
        ICleartextPaddedInputter.PadWitness memory w = _witness(alice, new address[](0), 32);
        ICleartextPaddedInputter.PadDecryptRequest memory r = _request(alice, ALICE_PK, w);
        r.payload.chainId = uint64(block.chainid + 1);
        vm.expectRevert(
            abi.encodeWithSelector(ICleartextPaddedInputter.PadInvalidChainId.selector, uint64(block.chainid + 1))
        );
        inputter.getCleartextPadSharesMaterial(r);
    }

    // --- helpers --------------------------------------------------------------------------------

    function _material(ICleartextPaddedInputter.PadDecryptRequest memory r)
        private
        view
        returns (ICleartextPaddedInputter.CleartextPadSharesMaterial memory)
    {
        return inputter.getCleartextPadSharesMaterial(r);
    }

    function _witness(address submitter, address[] memory decryptors, uint16 padLength)
        private
        view
        returns (ICleartextPaddedInputter.PadWitness memory)
    {
        return _witnessUnder(PRF, submitter, decryptors, padLength);
    }

    /// A fresh witness consumed by this contract, labelled under `prf` with `LibCleartextPad.padLabel`.
    function _witnessUnder(uint16 prf, address submitter, address[] memory decryptors, uint16 padLength)
        private
        view
        returns (ICleartextPaddedInputter.PadWitness memory w)
    {
        w = ICleartextPaddedInputter.PadWitness({
            submitter: submitter,
            consumer: address(this),
            expirationTimestamp: uint64(block.timestamp + 1 days),
            decryptors: decryptors,
            nonce: bytes16(keccak256(abi.encode(submitter, padLength, decryptors.length))),
            label: bytes32(0),
            padLength: padLength
        });
        w.label = _label(prf, w);
    }

    function _label(uint16 prf, ICleartextPaddedInputter.PadWitness memory w) private view returns (bytes32) {
        return LibCleartextPad.padLabel(
            0x00, prf, uint64(block.chainid), w.submitter, w.consumer, w.expirationTimestamp, w.decryptors, w.nonce
        );
    }

    function _request(address user, uint256 signerPk, ICleartextPaddedInputter.PadWitness memory w)
        private
        view
        returns (ICleartextPaddedInputter.PadDecryptRequest memory)
    {
        return _requestAllowing(user, signerPk, w, _self());
    }

    function _requestAllowing(
        address user,
        uint256 signerPk,
        ICleartextPaddedInputter.PadWitness memory w,
        address[] memory allowed
    ) private view returns (ICleartextPaddedInputter.PadDecryptRequest memory) {
        ICleartextPaddedInputter.PadWitness[] memory ws = new ICleartextPaddedInputter.PadWitness[](1);
        ws[0] = w;
        return _requestFor(user, signerPk, ws, allowed);
    }

    function _requestFor(
        address user,
        uint256 signerPk,
        ICleartextPaddedInputter.PadWitness[] memory ws,
        address[] memory allowed
    ) private view returns (ICleartextPaddedInputter.PadDecryptRequest memory r) {
        (uint256 contextId, uint256 epochId) = protocolConfig.getCurrentKmsContextAndEpoch();
        r.auth = ICleartextPaddedInputter.UserDecryptPermitV2({
            userAddress: user,
            publicKey: publicKey,
            allowedContracts: allowed,
            startTimestamp: block.timestamp,
            durationSeconds: 1 days,
            extraData: abi.encodePacked(uint8(0x02), contextId, epochId)
        });
        r.signature = _sign(signerPk, r.auth);
        r.payload = ICleartextPaddedInputter.PadDecryptRequestPayload({
            witnessVersion: 0x00, prf: PRF, chainId: uint64(block.chainid), witnesses: ws
        });
    }

    /// The RFC-016 permit, signed under the KMS `Decryption` domain with the host chain id, from the connector's
    /// type string.
    function _sign(uint256 pk, ICleartextPaddedInputter.UserDecryptPermitV2 memory p)
        private
        view
        returns (bytes memory)
    {
        bytes32 digest = LibKmsVerifier.toTypedDataHash(
            LibKmsVerifier.hostDomainSeparator(KMS_VERIFIER_ADDRESS),
            keccak256(
                abi.encode(
                    PERMIT_TYPEHASH,
                    p.userAddress,
                    keccak256(p.publicKey),
                    keccak256(abi.encodePacked(p.allowedContracts)),
                    p.startTimestamp,
                    p.durationSeconds,
                    keccak256(p.extraData)
                )
            )
        );
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(rr, s, v);
    }

    /// The released pad: the share XORed back with the first 32 bytes of the public key.
    /// The pad in a cleartext `rawShares`: everything after its version byte, which must be 0.
    function _pad(bytes memory rawShares) private pure returns (bytes memory pad) {
        assertEq(uint8(rawShares[0]), 0x00, "rawShares version 0");
        pad = new bytes(rawShares.length - 1);
        for (uint256 i; i < pad.length; ++i) {
            pad[i] = rawShares[i + 1];
        }
    }

    /// The cleartext payload encryption, undone: the first 32 bytes of the public key, repeated.
    function _xorMask(bytes memory data) private view returns (bytes memory out) {
        bytes32 mask = bytes32(publicKey);
        out = new bytes(data.length);
        for (uint256 i; i < data.length; ++i) {
            out[i] = data[i] ^ mask[i % 32];
        }
    }

    /// The domain KMS responses are signed under: `Decryption`, version 1, the configured gateway chain.
    function _responseDomain() private pure returns (bytes32) {
        return LibKmsVerifier.domainSeparatorFrom(
            "Decryption",
            "1",
            LibFhevmCleartextConfig.CLEARTEXT_GATEWAY_CHAIN_ID,
            LibFhevmCleartextConfig.CLEARTEXT_DECRYPTION_ADDRESS
        );
    }

    /**
     * A one-part package (RFC-030 layout), masked with `pad`, and its external handle:
     *   packageType 1 | witnessVersion 1 | prf 2 | chainId 8 | submitter 20 | consumer 20 | expirationTimestamp 8 |
     *   decryptorCount 1 | decryptors 20×n | nonce 16 | label 32 | partCount 1 | parts | ciphertext
     */
    function _package(
        ICleartextPaddedInputter.PadWitness memory w,
        FheType partType,
        bytes memory plaintext,
        bytes memory pad
    ) private view returns (bytes32 handle, bytes memory package) {
        bytes memory decryptors;
        for (uint256 i; i < w.decryptors.length; ++i) {
            decryptors = abi.encodePacked(decryptors, w.decryptors[i]);
        }
        bytes memory ciphertext = new bytes(plaintext.length);
        for (uint256 i; i < plaintext.length; ++i) {
            ciphertext[i] = plaintext[i] ^ pad[i];
        }
        package = abi.encodePacked(
            abi.encodePacked(
                uint8(0x00),
                uint8(0x00),
                PRF,
                uint64(block.chainid),
                w.submitter,
                w.consumer,
                w.expirationTimestamp,
                uint8(w.decryptors.length)
            ),
            decryptors,
            w.nonce,
            w.label,
            uint8(1),
            uint8(partType),
            ciphertext
        );
        bytes32 digest = keccak256(abi.encodePacked(bytes8("FHE_padp"), package));
        // packageDigest[0..28] | inputIndex 0 | type | version 0
        handle = (digest & ~bytes32(uint256(type(uint24).max))) | bytes32(uint256(uint8(partType)) << 8);
    }

    /// `n` little-endian bytes of `value`: a part is packed least significant byte first.
    function _le(uint256 value, uint256 n) private pure returns (bytes memory b) {
        b = new bytes(n);
        for (uint256 i; i < n; ++i) {
            b[i] = bytes1(uint8(value >> (8 * i)));
        }
    }

    function _verifyInput(bytes32 handle, address user, bytes memory package, FheType t) private returns (bytes32) {
        return ICleartextFHEVMExecutor(FHEVM_EXECUTOR_ADDRESS).verifyInput(handle, user, package, t);
    }

    function _self() private view returns (address[] memory a) {
        a = new address[](1);
        a[0] = address(this);
    }
}
