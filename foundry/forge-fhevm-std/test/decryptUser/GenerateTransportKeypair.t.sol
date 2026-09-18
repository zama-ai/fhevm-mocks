// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {VmSafe} from "forge-std/Vm.sol";

import {TestFhevm, SignedDecryptionPermit, TransportKeypair} from "../../pkg/src/TestFhevm.sol";
import {LibTransportKeypair} from "../../pkg/src/LibTransportKeypair.sol";

/// The transport keypair a test hands to `signLegacyDecryptionPermit` and `userDecrypt`.
///
/// The bytes must match what the js-sdk's cleartext mock produces — see the notes on
/// `generateTransportKeypair` — so these tests pin the ENCODING, not just the shape.
///
/// The derivation itself is private, so compatibility is pinned in two links that chain:
///   1. forge's `createWallet` + `0x04 || X || Y` reproduces ethers' `computePublicKey` (fixed vector);
///   2. `generateTransportKeypair` produces exactly that, for its own random key.
contract GenerateTransportKeypairTest is TestFhevm {
    /// What the SDK's ethers build returns for this key:
    ///   SigningKey.computePublicKey("0x1111...11", false)
    uint256 internal constant REF_PRIVATE_KEY = 0x1111111111111111111111111111111111111111111111111111111111111111;
    bytes internal constant REF_PUBLIC_KEY =
        hex"044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1";
    /// The first 32 bytes of `REF_PUBLIC_KEY` — the prefix byte, then 31 bytes of X.
    bytes32 internal constant REF_MASK = 0x044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871;

    uint256 internal constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    // -- Compatibility with the js-sdk ----------------------------------------

    /// LINK 1: forge's `createWallet`, encoded uncompressed, is ethers' `computePublicKey`.
    function test_forgesCurveMathMatchesTheSdk() public {
        assertEq(_uncompressed(REF_PRIVATE_KEY), REF_PUBLIC_KEY);
    }

    /// LINK 2: whatever key it draws, `generateTransportKeypair` emits exactly that encoding.
    function test_theKeypairUsesThatSameEncoding() public {
        TransportKeypair memory kp = generateTransportKeypair();
        assertEq(kp.publicKey, _uncompressed(kp.privateKey));
    }

    /// The mask is the FIRST 32 bytes — `0x04` then 31 bytes of X, not X itself. Getting the encoding
    /// wrong would still mask, just with different bytes, so this is pinned explicitly.
    function test_theMaskIsThePrefixByteThenPartOfX() public {
        TransportKeypair memory kp =
            TransportKeypair({publicKey: _uncompressed(REF_PRIVATE_KEY), privateKey: REF_PRIVATE_KEY});

        assertEq(kp.mask(), REF_MASK);
    }

    /// `mask()` is the first 32 bytes of the public key, whatever the key.
    function test_maskIsTheFirst32BytesOfThePublicKey() public {
        TransportKeypair memory kp = generateTransportKeypair();

        bytes memory publicKey = kp.publicKey;
        bytes32 expected;
        assembly {
            expected := mload(add(publicKey, 32))
        }
        assertEq(kp.mask(), expected);
    }

    /// A key too short to mask with is rejected rather than read out of bounds.
    function test_maskRejectsAShortPublicKey() public {
        vm.expectRevert(abi.encodeWithSelector(LibTransportKeypair.PublicKeyTooShort.selector, 4));
        this.maskOf(TransportKeypair({publicKey: hex"01020304", privateKey: 1}));
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function maskOf(TransportKeypair memory kp) external pure returns (bytes32) {
        return kp.mask();
    }

    /// The uncompressed secp256k1 public key for `privateKey`, derived independently of the library.
    function _uncompressed(uint256 privateKey) private returns (bytes memory) {
        VmSafe.Wallet memory w = vm.createWallet(privateKey);
        return abi.encodePacked(bytes1(0x04), w.publicKeyX, w.publicKeyY);
    }

    /// Uncompressed secp256k1: 65 bytes, `0x04 || X || Y`.
    function test_thePublicKeyIsUncompressed() public {
        TransportKeypair memory kp = generateTransportKeypair();

        assertEq(kp.publicKey.length, 65);
        assertEq(uint8(kp.publicKey[0]), 0x04);
    }

    // -- Randomness -----------------------------------------------------------

    /// Random, like `secp256k1.utils.randomPrivateKey()` — NOT seeded, so two calls differ.
    function test_everyCallGivesAFreshPair() public {
        TransportKeypair memory a = generateTransportKeypair();
        TransportKeypair memory b = generateTransportKeypair();

        assertNotEq(a.privateKey, b.privateKey);
        assertNotEq(keccak256(a.publicKey), keccak256(b.publicKey));
    }

    /// Every draw is a valid scalar: in `[1, N-1]`, never `0` and never at or above the curve order.
    /// The range is forced branchlessly, so this holds for every draw rather than almost all of them.
    function test_theKeyIsAlwaysAValidScalar() public {
        for (uint256 i = 0; i < 64; i++) {
            TransportKeypair memory kp = generateTransportKeypair();
            assertGt(kp.privateKey, 0);
            assertLt(kp.privateKey, SECP256K1_N);
        }
    }

    /// The forcing must not depend on luck: `2**255 - 1` is the largest value `>> 1` can produce, and
    /// it has to be below the curve order for the shift alone to guarantee a valid scalar.
    function test_theShiftAloneBoundsTheKeyBelowTheCurveOrder() public pure {
        assertLt(type(uint256).max >> 1, SECP256K1_N);
    }

    // -- The pair is real -----------------------------------------------------

    /// The public key really belongs to the private key: both reach the same address.
    function test_thePairIsAnActualSecp256k1Pair() public {
        TransportKeypair memory kp = generateTransportKeypair();

        // The address is the last 20 bytes of keccak(X || Y) — the 0x04 prefix is not hashed.
        bytes memory xy = new bytes(64);
        for (uint256 i = 0; i < 64; i++) {
            xy[i] = kp.publicKey[i + 1];
        }
        assertEq(address(uint160(uint256(keccak256(xy)))), vm.addr(kp.privateKey));
    }

    /// It drops straight into `signLegacyDecryptionPermit`, which is the point.
    function test_itFeedsSignLegacyDecryptionPermit() public {
        (, uint256 aliceKey) = makeAddrAndKey("alice");
        TransportKeypair memory kp = generateTransportKeypair();

        address[] memory contracts = new address[](1);
        contracts[0] = address(0xDA99);

        SignedDecryptionPermit memory p = signLegacyDecryptionPermit(aliceKey, kp, contracts, 1000, 7 days);
        assertEq(p.transportPublicKey, kp.publicKey);
    }
}
