// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {externalEuint8} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {APlusB} from "./contracts/AplusB.sol";

/// Port of hardhat/v3/e2e/test/internal/AplusB.ts.
/// `fhevm.assertCoprocessorInitialized` has no TestFhevm counterpart and is omitted.
contract APlusBTest is TestFhevm {
    APlusB internal aplusb;
    address internal alice;
    uint256 internal aliceKey;

    function setUp() public override {
        super.setUp();
        (alice, aliceKey) = makeAddrAndKey("alice");
        vm.prank(alice);
        aplusb = new APlusB();
    }

    /// hardhat: 'uint8: add 80 to 123 should equal 203'
    function test_uint8Add80To123Equals203() public {
        (externalEuint8 a, bytes memory proofA) = encryptUint8(80, address(aplusb), alice);
        vm.prank(alice);
        aplusb.setA(a, proofA);

        (externalEuint8 b, bytes memory proofB) = encryptUint8(123, address(aplusb), alice);
        vm.prank(alice);
        aplusb.setB(b, proofB);

        vm.prank(alice);
        aplusb.computeAPlusB();

        assertEq(decrypt(aplusb.aplusb(), address(aplusb), aliceKey), 80 + 123);
    }
}
