// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";

import {Rand} from "./contracts/Rand.sol";

/// Port of hardhat/v3/e2e/test/internal/Rand.ts (which is the v2 file minus its skipped snapshot).
///
/// `fhevm.helpers.decryptPublicUintN({euintN})` -> `decryptPublic(euintN)`. Every case draws several
/// values and asserts (a) each is within the type or bound and (b) enough of them differ — the same
/// two properties upstream checks with `Set.size`. The "has-N-bit" flags are kept verbatim.
contract RandTest is TestFhevm {
    Rand internal rand;

    function setUp() public override {
        super.setUp();
        vm.prank(makeAddr("alice"));
        rand = new Rand();
    }

    /// Distinct entries in `values[0..n)`, standing in for `new Set(values).size`.
    function _distinct(uint256[] memory values) private pure returns (uint256 count) {
        for (uint256 i = 0; i < values.length; i++) {
            bool seen = false;
            for (uint256 j = 0; j < i; j++) {
                if (values[j] == values[i]) {
                    seen = true;
                    break;
                }
            }
            if (!seen) count++;
        }
    }

    /// hardhat: 'ebool generate and decrypt'
    function test_eboolGenerateAndDecrypt() public {
        uint256[] memory values = new uint256[](15);
        for (uint256 i = 0; i < 15; i++) {
            rand.generateBool();
            values[i] = decryptPublic(rand.valueb()) ? 1 : 0;
        }
        assertGe(_distinct(values), 2, "at least two different generated values");
    }

    /// hardhat: '8 bits generate and decrypt'
    function test_8BitsGenerateAndDecrypt() public {
        uint256[] memory values = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            rand.generate8();
            uint8 v = decryptPublic(rand.value8());
            assertLe(v, 0xff);
            values[i] = v;
        }
        assertGe(_distinct(values), 2);
    }

    /// hardhat: '8 bits generate with upper bound and decrypt'
    function test_8BitsUpperBound() public {
        uint256[] memory values = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            rand.generate8UpperBound(128);
            uint8 v = decryptPublic(rand.value8());
            assertLe(v, 127);
            values[i] = v;
        }
        assertGe(_distinct(values), 2);
    }

    /// hardhat: '16 bits generate and decrypt'
    function test_16BitsGenerateAndDecrypt() public {
        uint256[] memory values = new uint256[](5);
        bool has16bit;
        for (uint256 i = 0; i < 5; i++) {
            rand.generate16();
            uint16 v = decryptPublic(rand.value16());
            assertLe(v, 0xffff);
            if (v > 0xff) has16bit = true;
            values[i] = v;
        }
        assertTrue(has16bit, "we actually generate 16 bit integers");
        assertGe(_distinct(values), 2);
    }

    /// hardhat: '16 bits generate with upper bound and decrypt'
    function test_16BitsUpperBound() public {
        uint256[] memory values = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            rand.generate16UpperBound(8192);
            uint16 v = decryptPublic(rand.value16());
            assertLe(v, 8191);
            values[i] = v;
        }
        assertGe(_distinct(values), 2);
    }

    /// hardhat: '32 bits generate and decrypt'
    function test_32BitsGenerateAndDecrypt() public {
        uint256[] memory values = new uint256[](5);
        bool has32bit;
        for (uint256 i = 0; i < 5; i++) {
            rand.generate32();
            uint32 v = decryptPublic(rand.value32());
            assertLe(v, 0xffffffff);
            if (v > 0xffff) has32bit = true;
            values[i] = v;
        }
        assertTrue(has32bit, "we actually generate 32 bit integers");
        assertGe(_distinct(values), 2);
    }

    /// hardhat: '32 bits generate with upper bound and decrypt'
    function test_32BitsUpperBound() public {
        uint256[] memory values = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            rand.generate32UpperBound(262144);
            uint32 v = decryptPublic(rand.value32());
            assertLe(v, 262141); // upstream's bound, kept verbatim
            values[i] = v;
        }
        assertGe(_distinct(values), 2);
    }

    /// hardhat: '64 bits generate and decrypt'
    function test_64BitsGenerateAndDecrypt() public {
        uint256[] memory values = new uint256[](5);
        bool has64bit;
        for (uint256 i = 0; i < 5; i++) {
            rand.generate64();
            uint64 v = decryptPublic(rand.value64());
            assertLe(v, type(uint64).max);
            if (v > 0xffffffff) has64bit = true;
            // Upstream asserts inside the loop, after the first draw.
            assertTrue(has64bit, "we actually generate 64 bit integers");
            values[i] = v;
        }
        assertGe(_distinct(values), 2);
    }

    /// hardhat: '64 bits generate with upper bound and decrypt'
    function test_64BitsUpperBound() public {
        uint256[] memory values = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            rand.generate64UpperBound(262144);
            uint64 v = decryptPublic(rand.value64());
            assertLe(v, 262141);
            values[i] = v;
        }
        assertGe(_distinct(values), 2);
    }

    /// hardhat: '128 bits generate and decrypt'
    function test_128BitsGenerateAndDecrypt() public {
        uint256[] memory values = new uint256[](5);
        bool has128bit;
        for (uint256 i = 0; i < 5; i++) {
            rand.generate128();
            uint128 v = decryptPublic(rand.value128());
            assertLe(v, type(uint128).max);
            if (v > type(uint64).max) has128bit = true;
            values[i] = v;
            assertTrue(has128bit, "we actually generate 128 bit integers");
        }
        assertGe(_distinct(values), 4);
    }

    /// hardhat: '128 bits generate with upper bound and decrypt'
    function test_128BitsUpperBound() public {
        uint256[] memory values = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            rand.generate128UpperBound(uint128(2 ** 100));
            uint128 v = decryptPublic(rand.value128());
            assertLe(v, 2 ** 100);
            values[i] = v;
        }
        assertGe(_distinct(values), 4);
    }

    /// hardhat: '256 bits generate and decrypt'
    function test_256BitsGenerateAndDecrypt() public {
        uint256[] memory values = new uint256[](5);
        bool has256bit;
        for (uint256 i = 0; i < 5; i++) {
            rand.generate256();
            uint256 v = decryptPublic(rand.value256());
            if (v > type(uint128).max) has256bit = true;
            values[i] = v;
            assertTrue(has256bit, "we actually generate 256 bit integers");
        }
        assertGe(_distinct(values), 5);
    }

    /// hardhat: '256 bits generate with upper bound and decrypt'
    function test_256BitsUpperBound() public {
        uint256[] memory values = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            rand.generate256UpperBound(2 ** 200);
            uint256 v = decryptPublic(rand.value256());
            assertLe(v, 2 ** 200);
            values[i] = v;
        }
        assertGe(_distinct(values), 5);
    }

    /// hardhat: 'generating rand in reverting sub-call'
    function test_randInRevertingSubCall() public {
        rand.generate64Reverting();
        assertLt(decryptPublic(rand.value64Bounded()), 1024);
    }
}
