// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm, TransportKeypair, SignedDecryptionPermit} from "../../pkg/src/TestFhevm.sol";

import {FHECounterUserDecrypt} from "./contracts/FHECounterUserDecrypt.sol";
import {SmartWalletWithDelegation} from "./contracts/SmartWalletWithDelegation.sol";

/// Port of hardhat/v3/e2e/test/internal/delegatedUserDecryption.ts.
///
/// The smart wallet increments the counter through its OWN transaction, so `FHE.allow(_count,
/// msg.sender)` grants the wallet; an EOA can only read the count once the wallet delegates to it.
///
///   fhevm.helpers.decryptUint32({..., options:{delegatorAddress}})
///     -> signLegacyDecryptionPermit(delegateKey, kp, [counter], now, 1 day, delegator)
///        + decrypt(value, counter, kp, permit)
///   waitNBlocks(connection, 15)  -> vm.roll(block.number + 15)
contract DelegatedUserDecryptionTest is TestFhevm {
    FHECounterUserDecrypt internal counter;
    SmartWalletWithDelegation internal smartWallet;

    address internal bob;
    uint256 internal bobKey;
    address internal carol;
    uint256 internal carolKey;

    function setUp() public override {
        super.setUp();
        (bob, bobKey) = makeAddrAndKey("bob");
        (carol, carolKey) = makeAddrAndKey("carol");

        counter = new FHECounterUserDecrypt();

        vm.prank(bob);
        smartWallet = new SmartWalletWithDelegation(bob);

        _incrementThroughWallet(7);
    }

    /// The input is encrypted for the WALLET, the future msg.sender.
    function _incrementThroughWallet(uint32 value) private {
        (externalEuint32 handle, bytes memory proof) = encryptUint32(value, address(counter), address(smartWallet));
        bytes memory data = abi.encodeCall(FHECounterUserDecrypt.increment, (handle, proof));

        vm.prank(bob);
        smartWallet.proposeTx(address(counter), data);
        uint256 txId = smartWallet.txCounter();
        vm.prank(bob);
        smartWallet.executeTx(txId);
    }

    /// `timestampNowAdjusted() + 86400`: the latest block's timestamp, plus 100, plus a day.
    function _delegate(address delegateAddress) private {
        vm.prank(bob);
        smartWallet.delegateUserDecryption(delegateAddress, address(counter), uint64(block.timestamp + 100 + 86400));
    }

    /// The delegate signs a permit naming the wallet as delegator, then reads through it.
    function _readAsDelegate(euint32 value, uint256 delegateKey) private returns (uint32) {
        TransportKeypair memory keypair = generateTransportKeypair();
        address[] memory contracts = new address[](1);
        contracts[0] = address(counter);
        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit(delegateKey, keypair, contracts, block.timestamp, 1 days, address(smartWallet));
        return decrypt(value, address(counter), keypair, permit);
    }

    /// hardhat: 'smartWallet owner delegates his own EOA to decrypt the smartWallet count'
    function test_ownerDelegatesHisOwnEoa() public {
        _delegate(bob);
        assertEq(_readAsDelegate(counter.getCount(), bobKey), 7);
    }

    /// hardhat: 'smartWallet owner delegates a third EOA to decrypt the smartWallet count'
    function test_ownerDelegatesAThirdEoa() public {
        _delegate(carol);
        assertEq(_readAsDelegate(counter.getCount(), carolKey), 7);
    }

    /// hardhat: 'smartWallet can execute another increment and the delegate reads the new count'
    function test_anotherIncrementIsReadByTheDelegate() public {
        _delegate(bob);
        _incrementThroughWallet(5);
        assertEq(_readAsDelegate(counter.getCount(), bobKey), 12);
    }

    /// hardhat: 'an EOA without delegation cannot decrypt the smartWallet count'
    function test_anEoaWithoutDelegationCannotRead() public {
        euint32 count = counter.getCount();
        vm.expectRevert();
        this.readAsDelegate(count, bobKey);
    }

    /// hardhat: 'smartWallet revokes the delegation of user decryption to an EOA'
    function test_revokedDelegationCannotRead() public {
        _delegate(bob);

        // Upstream's delegate and revoke are separate transactions, hence separate blocks; a forge
        // test body is one block, and the ACL refuses to delegate and revoke in the same one.
        vm.roll(block.number + 1);

        vm.prank(bob);
        smartWallet.revokeUserDecryptionDelegation(bob, address(counter));

        // "Wait for 15 blocks to ensure revocation is propagated by the coprocessor."
        vm.roll(block.number + 15);

        euint32 count = counter.getCount();
        vm.expectRevert();
        this.readAsDelegate(count, bobKey);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function readAsDelegate(euint32 value, uint256 delegateKey) external returns (uint32) {
        return _readAsDelegate(value, delegateKey);
    }
}
