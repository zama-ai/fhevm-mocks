// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {FHECounterPublicDecrypt} from "./contracts/FHECounterPublicDecrypt.sol";

/// Port of hardhat/v3/e2e/test/internal/FHECounterPublicDecrypt.ts.
///
///   fhevm.helpers.decryptPublicUint32({euint32})              -> decryptPublic(euint32)
///   fhevm.helpers.decryptPublicUint32WithSignatures({euint32}) -> decryptPublicWithSignatures(bytes)
///   fhevm.client.decryptPublicValues({encryptedValues:[a,b]}) -> decryptPublic(abi.encode(a, b))
///
/// `fhevm.isCleartext` guards have no counterpart: a forge test is always on the cleartext host.
contract FHECounterPublicDecryptTest is TestFhevm {
    FHECounterPublicDecrypt internal counter;
    address internal alice;

    function setUp() public override {
        super.setUp();
        alice = makeAddr("alice");
        counter = new FHECounterPublicDecrypt();
    }

    function _encryptOne32(uint32 value) private returns (externalEuint32, bytes memory) {
        return encryptUint32(value, address(counter), alice);
    }

    /// hardhat: 'encrypted count should be uninitialized after deployment'
    function test_countIsUninitializedAfterDeployment() public view {
        assertEq(euint32.unwrap(counter.getCount()), bytes32(0));
    }

    /// hardhat: 'increment the counter by 123 and verify public decrypt'
    function test_incrementBy123AndVerify() public {
        assertEq(euint32.unwrap(counter.getCount()), bytes32(0));

        (externalEuint32 v, bytes memory proof) = _encryptOne32(123);
        vm.prank(alice);
        counter.increment(v, proof);

        euint32 count = counter.getCount();
        (bytes memory cleartexts, bytes memory decryptionProof) = decryptPublicWithSignatures(abi.encode(count));
        assertEq(abi.decode(cleartexts, (uint32)), 123);

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint32.unwrap(count);
        counter.verify(handles, cleartexts, decryptionProof);
    }

    /// hardhat: 'increment the counter by 1'
    function test_incrementBy1() public {
        assertEq(euint32.unwrap(counter.getCount()), bytes32(0));

        (externalEuint32 one, bytes memory proof) = _encryptOne32(1);
        vm.prank(alice);
        counter.increment(one, proof);

        assertEq(decryptPublic(counter.getCount()), 1);
    }

    /// hardhat: 'increment the counter by 1 multiple times'
    function test_incrementBy1MultipleTimes() public {
        assertEq(euint32.unwrap(counter.getCount()), bytes32(0));

        (externalEuint32 one, bytes memory proof) = _encryptOne32(1);

        vm.prank(alice);
        counter.increment(one, proof);
        euint32 after1 = counter.getCount();

        vm.prank(alice);
        counter.increment(one, proof);
        euint32 after2 = counter.getCount();

        // Two handles at once; the answer is positional, one per handle in the order passed.
        (uint32 c1, uint32 c2) = abi.decode(decryptPublic(abi.encode(after1, after2)), (uint32, uint32));
        assertEq(c1, 1);
        assertEq(c2, 2);
    }

    /// hardhat: 'decrement the counter by 1'
    function test_decrementBy1() public {
        (externalEuint32 one, bytes memory proof) = _encryptOne32(1);

        vm.prank(alice);
        counter.increment(one, proof);
        vm.prank(alice);
        counter.decrement(one, proof);

        assertEq(decryptPublic(counter.getCount()), 0);
    }

    /// hardhat: 'increment the counter by 1 not decryptable'
    function test_incrementBy1NotDecryptable() public {
        assertEq(euint32.unwrap(counter.getCount()), bytes32(0));

        (externalEuint32 one, bytes memory proof) = _encryptOne32(1);
        vm.prank(alice);
        counter.incrementNotPubliclyDecryptable(one, proof);

        // `counter.getCount()` is itself an external call, so read it BEFORE arming `expectRevert`.
        euint32 count = counter.getCount();

        vm.expectRevert();
        this.decryptPublicExternally(count);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function decryptPublicExternally(euint32 value) external view returns (uint32) {
        return decryptPublic(value);
    }
}
