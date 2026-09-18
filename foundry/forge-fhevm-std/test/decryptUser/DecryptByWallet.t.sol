// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

import {euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm, EncryptedInput, TransportKeypair, SignedDecryptionPermit} from "../../pkg/src/TestFhevm.sol";

import {UserVault} from "./UserVault.sol";

/// Driving a read from a forge `Wallet`.
///
/// `vm.createWallet(name)` hands back the address AND the signing key in one object, which is what a
/// user decryption needs on both sides: the address grants the ACL and sends the transaction, the key
/// signs the permit. `makeAddrAndKey` returns the same pair loose; a `Wallet` keeps them together so
/// they cannot drift apart in a longer test.
contract DecryptByWalletTest is TestFhevm {
    UserVault internal vault;
    Vm.Wallet internal alice;

    function setUp() public override {
        super.setUp();
        vault = new UserVault();
        alice = vm.createWallet("alice");
    }

    function _store(uint32 v) private {
        EncryptedInput memory e = encryptValues(asUint32(v), address(vault), alice.addr);
        vm.prank(alice.addr);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof, alice.addr);
    }

    /// The wallet's two halves, each doing its job: `addr` to store and grant, `privateKey` to read.
    function test_aWalletDrivesBothSidesOfTheRead() public {
        _store(70_000);

        assertEq(decrypt(vault.eUint32(), address(vault), alice.privateKey), 70_000);
    }

    /// A `Wallet` is just the pair `makeAddrAndKey` gives, so both name the same account.
    function test_aWalletIsTheSameAccountAsMakeAddrAndKey() public {
        (address addr, uint256 key) = makeAddrAndKey("alice");

        assertEq(alice.addr, addr);
        assertEq(alice.privateKey, key);
    }

    /// And the same account the by-name form reaches, so the three forms are interchangeable.
    function test_theWalletAndTheNameAgree() public {
        _store(70_000);

        assertEq(
            decrypt(vault.eUint32(), address(vault), alice.privateKey),
            decrypt(vault.eUint32(), address(vault), "alice")
        );
    }

    /// The long form too: a permit signed with the wallet's key reads under the wallet's access.
    function test_aWalletSignsAPermitForTheLongForm() public {
        _store(70_000);

        TransportKeypair memory keypair = generateTransportKeypair();
        address[] memory contracts = new address[](1);
        contracts[0] = address(vault);

        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit(alice.privateKey, keypair, contracts, block.timestamp, 7 days);

        assertEq(permit.signerAddress, alice.addr, "the permit names the wallet that signed it");
        assertEq(decrypt(vault.eUint32(), address(vault), keypair, permit), 70_000);
    }

    /// A second wallet is a different account, with no access to alice's value.
    function test_anotherWalletHasNoAccess() public {
        _store(70_000);
        Vm.Wallet memory bob = vm.createWallet("bob");
        euint32 handle = vault.eUint32();

        vm.expectRevert();
        this.decryptAs(handle, bob.privateKey);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function decryptAs(euint32 v, uint256 privateKey) external returns (uint32) {
        return decrypt(v, address(vault), privateKey);
    }
}
