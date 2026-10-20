// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm, TransportKeypair, SignedDecryptionPermit} from "../../pkg/src/TestFhevm.sol";

import {TestConfidentialERC20Mintable} from "../token/TestConfidentialERC20Mintable.sol";
import {SmartWalletWithDelegation} from "./contracts/SmartWalletWithDelegation.sol";

/// Port of hardhat/v3/e2e/test/internal/delegatedUserDecryptionERC20.ts — the same delegation scenario
/// on a ConfidentialERC20 balance held by a smart wallet. The token fixture is the one already ported
/// under test/token.
///
/// Upstream remaps its signers (deployer=alice, alice=bob, bob=carol, carol=dave); the roles below use
/// the remapped names, so "alice" here is the token owner and "bob" the wallet owner, as in its body.
contract DelegatedUserDecryptionERC20Test is TestFhevm {
    TestConfidentialERC20Mintable internal token;
    SmartWalletWithDelegation internal smartWallet;

    address internal alice;
    address internal bob;
    uint256 internal bobKey;
    address internal carol;
    uint256 internal carolKey;

    function setUp() public override {
        super.setUp();
        alice = makeAddr("alice");
        (bob, bobKey) = makeAddrAndKey("bob");
        (carol, carolKey) = makeAddrAndKey("carol");

        vm.prank(alice);
        token = new TestConfidentialERC20Mintable("Zama Confidential Token", "ZAMA", alice);

        vm.prank(bob);
        smartWallet = new SmartWalletWithDelegation(bob);

        // Alice mints to herself, then moves half to the wallet.
        vm.prank(alice);
        token.mint(alice, 1_000_000);

        (externalEuint64 amount, bytes memory proof) = encryptUint64(500_000, address(token), alice);
        vm.prank(alice);
        token.transfer(address(smartWallet), amount, proof);
    }

    function _delegate(address delegateAddress) private {
        vm.prank(bob);
        smartWallet.delegateUserDecryption(delegateAddress, address(token), uint64(block.timestamp + 100 + 86400));
    }

    /// `delegatedUserDecryptSingleHandle`: a per-request transport key, a 10-day permit signed by the
    /// DELEGATE naming the wallet as delegator, one read.
    function _delegatedRead(euint64 value, uint256 delegateKey) private returns (uint64) {
        TransportKeypair memory keypair = generateTransportKeypair();
        address[] memory contracts = new address[](1);
        contracts[0] = address(token);
        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit(delegateKey, keypair, contracts, block.timestamp, 10 days, address(smartWallet));
        return decrypt(value, address(token), keypair, permit);
    }

    /// hardhat: '... smartWallet owner delegates his own EOA to decrypt the smartWallet balance'
    function test_ownerDelegatesHisOwnEoa() public {
        _delegate(bob);
        assertEq(_delegatedRead(token.balanceOf(address(smartWallet)), bobKey), 500_000);
    }

    /// hardhat: '... smartWallet owner delegates a third EOA to decrypt the smartWallet balance'
    function test_ownerDelegatesAThirdEoa() public {
        _delegate(carol);
        assertEq(_delegatedRead(token.balanceOf(address(smartWallet)), carolKey), 500_000);
    }

    /// hardhat: '... smartWallet can execute transference of funds to a third EOA'
    function test_walletTransfersToAThirdEoa() public {
        _delegate(bob);
        uint64 before = _delegatedRead(token.balanceOf(address(smartWallet)), bobKey);

        // The input is encrypted for the WALLET, the future msg.sender.
        (externalEuint64 amount, bytes memory proof) = encryptUint64(100_000, address(token), address(smartWallet));
        // `transfer` is overloaded, so the full signature is spelled out — as upstream's
        // `encodeFunctionData('transfer(address,bytes32,bytes)', ...)` does for the same reason.
        bytes memory data = abi.encodeWithSignature("transfer(address,bytes32,bytes)", carol, amount, proof);

        vm.prank(bob);
        smartWallet.proposeTx(address(token), data);
        uint256 txId = smartWallet.txCounter();
        vm.prank(bob);
        smartWallet.executeTx(txId);

        uint64 after_ = _delegatedRead(token.balanceOf(address(smartWallet)), bobKey);
        assertEq(before - after_, 100_000);
    }

    /// hardhat: '... smartWallet revokes the delegation of user decryption to an EOA'
    function test_revokedDelegationCannotRead() public {
        _delegate(bob);

        // Upstream's delegate and revoke are separate transactions, hence separate blocks; a forge
        // test body is one block, and the ACL refuses to delegate and revoke in the same one.
        vm.roll(block.number + 1);

        vm.prank(bob);
        smartWallet.revokeUserDecryptionDelegation(bob, address(token));

        // "Wait for 15 blocks to ensure revocation is propagated by the coprocessor."
        vm.roll(block.number + 15);

        euint64 balance = token.balanceOf(address(smartWallet));
        vm.expectRevert();
        this.delegatedRead(balance, bobKey);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function delegatedRead(euint64 value, uint256 delegateKey) external returns (uint64) {
        return _delegatedRead(value, delegateKey);
    }
}
