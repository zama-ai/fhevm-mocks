// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint32, externalEuint32} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm, TransportKeypair, SignedDecryptionPermit} from "../../pkg/src/TestFhevm.sol";

import {FHECounterUserDecrypt} from "./contracts/FHECounterUserDecrypt.sol";

/// Port of hardhat/v3/e2e/test/internal/FHECounterUserDecrypt.ts.
///
///   fhevm.helpers.decryptUint32({euint32, contractAddress, userAddress}) -> decrypt(h, addr, key)
///   fhevm.client.generateTransportKeyPair()                               -> generateTransportKeypair()
///   fhevm.client.signLegacyDecryptionPermit({...})                        -> signLegacyDecryptionPermit(...)
///   fhevm.client.decryptValuesFromPairs({pairs, transportKeyPair, permit}) -> decrypt(h, addr, kp, permit)
contract FHECounterUserDecryptTest is TestFhevm {
    FHECounterUserDecrypt internal counter;
    address internal alice;
    uint256 internal aliceKey;

    function setUp() public override {
        super.setUp();
        (alice, aliceKey) = makeAddrAndKey("alice");
        counter = new FHECounterUserDecrypt();
    }

    /// hardhat: 'increment the counter by 1 multiple times - userDecrypt multiple values'
    function test_incrementMultipleTimesAndUserDecryptMultipleValues() public {
        (externalEuint32 one, bytes memory proof) = encryptUint32(1, address(counter), alice);

        vm.prank(alice);
        counter.increment(one, proof);
        euint32 after1 = counter.getCount();

        vm.prank(alice);
        counter.increment(one, proof);
        euint32 after2 = counter.getCount();

        // The one-shot helpers, as `fhevm.helpers.decryptUint32` does.
        assertEq(decrypt(after1, address(counter), aliceKey), 1);
        assertEq(decrypt(after2, address(counter), aliceKey), 2);

        // Then one permit reused across both reads, as `decryptValuesFromPairs` does.
        TransportKeypair memory keypair = generateTransportKeypair();
        address[] memory contracts = new address[](1);
        contracts[0] = address(counter);

        // The legacy API measured validity in days; here it is seconds — 365 days, as upstream.
        SignedDecryptionPermit memory permit =
            signLegacyDecryptionPermit(aliceKey, keypair, contracts, block.timestamp, 365 days);

        assertEq(decrypt(after1, address(counter), keypair, permit), 1);
        assertEq(decrypt(after2, address(counter), keypair, permit), 2);
    }
}
