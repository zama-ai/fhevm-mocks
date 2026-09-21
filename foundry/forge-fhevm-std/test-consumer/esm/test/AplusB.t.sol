// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {externalEuint8} from "encrypted-types/EncryptedTypes.sol";

import {TestFhevm} from "@fhevm/forge-std/TestFhevm.sol";

import {APlusB} from "../src/AplusB.sol";

/// What the installed forge-fhevm-std npm package must let a user do, resolved through remappings into
/// node_modules and nothing else: inherit `TestFhevm`, encrypt inputs for a dApp, run it, and decrypt as
/// the user it allowed.
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

    function _compute(uint8 a, uint8 b) private {
        (externalEuint8 ea, bytes memory proofA) = encryptUint8(a, address(aplusb), alice);
        vm.prank(alice);
        aplusb.setA(ea, proofA);

        (externalEuint8 eb, bytes memory proofB) = encryptUint8(b, address(aplusb), alice);
        vm.prank(alice);
        aplusb.setB(eb, proofB);

        vm.prank(alice);
        aplusb.computeAPlusB();
    }

    /// The Hardhat example, verbatim: 80 + 123 = 203, read back by the user the contract allowed.
    function test_uint8Add80To123Equals203() public {
        _compute(80, 123);
        assertEq(decrypt(aplusb.aplusb(), address(aplusb), aliceKey), 203);
    }

    /// FHE arithmetic is modular, like the real coprocessor: 200 + 100 wraps to 44 in a euint8.
    function test_uint8AdditionWraps() public {
        _compute(200, 100);
        assertEq(decrypt(aplusb.aplusb(), address(aplusb), aliceKey), 44);
    }

    /// The cheat reads the value without a permit — for assertions on arithmetic, not on access.
    function test_plaintextOfAgreesWithTheUserDecryption() public {
        _compute(1, 2);
        assertEq(plaintextOf(aplusb.aplusb()), 3);
        assertEq(decrypt(aplusb.aplusb(), address(aplusb), aliceKey), 3);
    }
}
