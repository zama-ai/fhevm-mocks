// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {ShrDapp} from "./fixtures/ShrDapp.sol";

// FHE.shr against test/data/shr.amount-mod-width. See OpVectorTest for what
// is asserted.
//
// Two data sets exist for shr, differing only when the amount is >= the value
// width: tfhe-rs >= 1.7 returns 0 ("overshift"), tfhe-rs <= 1.6 reduces the
// amount mod the width. The cleartext stack implements the latter -
// CleartextArithmetic.shr is `a >> (b % bitWidth)` - so this test runs the
// amount-mod-width set. Against the tfhe-rs 1.7 set, every `*_by_w` row fails
// (0x80 >> 8 on an euint8 gives 0x80, not 0).
contract FHETestShr is BinaryOpVectorTest {
    ShrDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new ShrDapp();
        vm.label(address(dapp), "ShrDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "shr";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    // FHE.shr takes an 8-bit amount, encrypted or clear, for every value width;
    // there is no clear-value form.
    function hasScalarPair(uint256, uint256 rhsBits) internal pure override returns (bool) {
        return rhsBits == 8;
    }

    function hasClearEnc() internal pure override returns (bool) {
        return false;
    }

    function test_shr_256_normal() public {
        runPart("../../operators-data/data/shr.amount-mod-width/256.normal.json");
    }

    function test_shr_256_edge() public {
        runPart("../../operators-data/data/shr.amount-mod-width/256.edge.json");
    }

    function test_shr_128_normal() public {
        runPart("../../operators-data/data/shr.amount-mod-width/128.normal.json");
    }

    function test_shr_128_edge() public {
        runPart("../../operators-data/data/shr.amount-mod-width/128.edge.json");
    }

    function test_shr_64_normal() public {
        runPart("../../operators-data/data/shr.amount-mod-width/64.normal.json");
    }

    function test_shr_64_edge() public {
        runPart("../../operators-data/data/shr.amount-mod-width/64.edge.json");
    }

    function test_shr_32_normal() public {
        runPart("../../operators-data/data/shr.amount-mod-width/32.normal.json");
    }

    function test_shr_32_edge() public {
        runPart("../../operators-data/data/shr.amount-mod-width/32.edge.json");
    }

    function test_shr_16_normal() public {
        runPart("../../operators-data/data/shr.amount-mod-width/16.normal.json");
    }

    function test_shr_16_edge() public {
        runPart("../../operators-data/data/shr.amount-mod-width/16.edge.json");
    }

    function test_shr_8_normal() public {
        runPart("../../operators-data/data/shr.amount-mod-width/8.normal.json");
    }

    function test_shr_8_edge() public {
        runPart("../../operators-data/data/shr.amount-mod-width/8.edge.json");
    }
}
