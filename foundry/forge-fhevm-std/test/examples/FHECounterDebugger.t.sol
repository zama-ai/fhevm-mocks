// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {FHECounterPublicDecrypt} from "./contracts/FHECounterPublicDecrypt.sol";

/// Port of hardhat/v3/e2e/test/internal/FHECounterDebugger.ts.
///
///   fhevm.cleartextDb.readUint32({euint32}) -> read(euint32)
///
/// The count is stored WITHOUT `makePubliclyDecryptable`, so `decryptPublic` is refused — and `read`
/// still returns it, because it is a debug view into the mock's DB and consults nothing.
contract FHECounterDebuggerTest is TestFhevm {
    FHECounterPublicDecrypt internal counter;
    address internal alice;

    function setUp() public override {
        super.setUp();
        alice = makeAddr("alice");
        counter = new FHECounterPublicDecrypt();
    }

    /// hardhat: 'reads a count nobody is allowed to decrypt'
    function test_readsACountNobodyIsAllowedToDecrypt() public {
        (externalEuint32 five, bytes memory proof) = encryptUint32(5, address(counter), alice);
        vm.prank(alice);
        counter.incrementNotPubliclyDecryptable(five, proof);

        // `counter.getCount()` is itself an external call, so read it BEFORE arming `expectRevert`.
        euint32 count = counter.getCount();

        vm.expectRevert();
        this.decryptPublicExternally(count);

        assertEq(read(count), 5);
    }

    /// External so that `vm.expectRevert` has a call frame to catch.
    function decryptPublicExternally(euint32 value) external view returns (uint32) {
        return decryptPublic(value);
    }
}
