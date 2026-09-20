// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm, SignedDecryptionPermit, TransportKeypair} from "../../pkg/src/TestFhevm.sol";

/// Signing a permit: the fields it carries, and the three duration rules it enforces up front.
contract SignDecryptionPermitTest is TestFhevm {
    address internal alice;
    uint256 internal aliceKey;
    address[] internal contracts;
    TransportKeypair internal keypair;

    function setUp() public override {
        super.setUp();
        (alice, aliceKey) = makeAddrAndKey("alice");
        contracts.push(address(0xDA99));
        keypair = generateTransportKeypair();
    }

    function test_thePermitCarriesWhatWasSigned() public {
        SignedDecryptionPermit memory p = signLegacyDecryptionPermit(aliceKey, keypair, contracts, 1000, 7 days);

        assertEq(p.transportPublicKey, keypair.publicKey);
        assertEq(p.contractAddresses.length, 1);
        assertEq(p.startTimestamp, 1000);
        assertEq(p.durationSeconds, 7 days);
        assertEq(p.signature.length, 65, "r || s || v");
    }

    /// The window and the contract list are recorded as asked for, so a caller can check them.
    function test_thePermitRecordsItsWindowAndContracts() public {
        SignedDecryptionPermit memory p = signLegacyDecryptionPermit(aliceKey, keypair, contracts, 1000, 7 days);

        assertEq(p.startTimestamp + p.durationSeconds, 1000 + 7 days, "the window it closes at");
        assertEq(p.contractAddresses.length, 1);
        assertEq(p.contractAddresses[0], address(0xDA99));
    }

    /// Two different users signing the same request produce different signatures.
    function test_theSignatureIsBoundToTheSigner() public {
        (, uint256 bobKey) = makeAddrAndKey("bob");

        SignedDecryptionPermit memory a = signLegacyDecryptionPermit(aliceKey, keypair, contracts, 1000, 7 days);
        SignedDecryptionPermit memory b = signLegacyDecryptionPermit(bobKey, keypair, contracts, 1000, 7 days);

        assertNotEq(keccak256(a.signature), keccak256(b.signature));
    }

    // -- The three duration rules, mirroring the js-sdk ------------------------

    function test_aPartialDayIsRejected() public {
        vm.expectRevert("StdFhevm: durationSeconds must be a whole number of days");
        this.sign(1 days + 1);
    }

    function test_aZeroDurationIsRejected() public {
        vm.expectRevert("StdFhevm: durationSeconds must be at least one day");
        this.sign(0);
    }

    function test_aDurationOverTheMaximumIsRejected() public {
        vm.expectRevert("StdFhevm: durationSeconds is above the maximum duration");
        this.sign((MAX_USER_DECRYPT_DURATION_DAYS + 1) * 1 days);
    }

    function test_theMaximumItselfIsAccepted() public {
        SignedDecryptionPermit memory p =
            signLegacyDecryptionPermit(aliceKey, keypair, contracts, 1000, MAX_USER_DECRYPT_DURATION_DAYS * 1 days);
        assertEq(p.durationSeconds, 365 days);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function sign(uint256 durationSeconds) external returns (SignedDecryptionPermit memory) {
        return signLegacyDecryptionPermit(aliceKey, keypair, contracts, 1000, durationSeconds);
    }
}
