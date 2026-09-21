// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm, EncryptedInput, TransportKeypair, SignedDecryptionPermit} from "../../pkg/src/TestFhevm.sol";

import {UserVault} from "./UserVault.sol";

/// Naming the reader instead of holding its key. A name is DERIVED, not looked up.
contract DecryptByLabelTest is TestFhevm {
    UserVault internal vault;
    address internal alice;
    uint256 internal aliceKey;

    function setUp() public override {
        super.setUp();
        vault = new UserVault();
        (alice, aliceKey) = makeAddrAndKey("alice");
    }

    function _store(uint32 v) private {
        EncryptedInput memory e = encryptValues(tvUint32(v), address(vault), alice);
        vm.prank(alice);
        vault.setEUint32(e.externalEuint32At(0), e.inputProof(), alice);
    }

    function test_aNameReadsTheValue() public {
        _store(70_000);
        assertEq(decrypt(vault.eUint32(), address(vault), "alice"), 70_000);
    }

    /// The name means the same account `makeAddrAndKey` names — the two derivations agree, which is
    /// the only reason a bare string can stand in for a key.
    function test_theNameIsTheSameAccountAsMakeAddrAndKey() public {
        _store(70_000);

        assertEq(decrypt(vault.eUint32(), address(vault), "alice"), decrypt(vault.eUint32(), address(vault), aliceKey));
    }

    /// Repeating a name is stable: `createWallet` derives, it does not generate.
    function test_theSameNameAlwaysReadsTheSameAccount() public {
        _store(70_000);

        assertEq(decrypt(vault.eUint32(), address(vault), "alice"), 70_000);
        assertEq(decrypt(vault.eUint32(), address(vault), "alice"), 70_000);
    }

    /// The sharp edge of deriving rather than looking up: a mistyped name is a VALID account, just one
    /// with no access. It fails as an authorisation error, not as an unknown name.
    function test_aMistypedNameIsAValidAccountWithNoAccess() public {
        _store(70_000);
        euint32 value = vault.eUint32();

        vm.expectRevert();
        this.decryptAs(value, "alicce");
    }

    // -- Signing a permit by name ---------------------------------------------

    /// The permit overload takes the same name, and the permit it signs names that account back.
    function test_aNameSignsAPermit() public {
        _store(70_000);

        TransportKeypair memory keypair = generateTransportKeypair();
        address[] memory contracts = new address[](1);
        contracts[0] = address(vault);

        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit("alice", keypair, contracts, block.timestamp, 7 days);

        assertEq(permit.signerAddress, alice, "the permit names the account the label derives");
        assertEq(decrypt(vault.eUint32(), address(vault), keypair, permit), 70_000);
    }

    /// Signing by name and by key produce the same signature, so the two forms are interchangeable.
    function test_signingByNameMatchesSigningByKey() public {
        TransportKeypair memory keypair = generateTransportKeypair();
        address[] memory contracts = new address[](1);
        contracts[0] = address(vault);

        SignedDecryptionPermit memory byName = signLegacyDecryptionPermit("alice", keypair, contracts, 1000, 7 days);
        SignedDecryptionPermit memory byKey = signLegacyDecryptionPermit(aliceKey, keypair, contracts, 1000, 7 days);

        assertEq(keccak256(byName.signature), keccak256(byKey.signature));
    }

    /// The delegated form takes a name too — the NAMED account is the delegate.
    function test_aNameSignsADelegatedPermit() public {
        TransportKeypair memory keypair = generateTransportKeypair();
        address[] memory contracts = new address[](1);
        contracts[0] = address(vault);

        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit("alice", keypair, contracts, block.timestamp, 7 days, address(0xD00D));

        assertEq(permit.signerAddress, alice, "the delegate is the named account");
        assertEq(permit.delegatorAddress, address(0xD00D));
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function decryptAs(euint32 v, string memory label) external returns (uint32) {
        return decrypt(v, address(vault), label);
    }
}
