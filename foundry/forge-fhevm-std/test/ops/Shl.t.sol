// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {ShlDapp} from "./fixtures/ShlDapp.sol";

// FHE.shl against test/data/shl.amount-mod-width. See OpVectorTest for what
// is asserted.
//
// Two data sets exist for shl, differing only when the amount is >= the value
// width: tfhe-rs >= 1.7 returns 0 ("overshift"), tfhe-rs <= 1.6 reduces the
// amount mod the width. The cleartext stack implements the latter -
// CleartextArithmetic.shl is `a << (b % bitWidth)` - so this test runs the
// amount-mod-width set. Against the tfhe-rs 1.7 set, every `*_by_w` row fails
// (1 << 8 on an euint8 gives 1, not 0).
contract FHETestShl is BinaryOpVectorTest {
    ShlDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new ShlDapp();
        vm.label(address(dapp), "ShlDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "shl";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    // FHE.shl takes an 8-bit amount, encrypted or clear, for every value width;
    // there is no clear-value form.
    function hasScalarPair(uint256, uint256 rhsBits) internal pure override returns (bool) {
        return rhsBits == 8;
    }

    function hasClearEnc() internal pure override returns (bool) {
        return false;
    }

    function test_shl_256_normal() public {
        runPart("../../operators-data/data/shl.amount-mod-width/256.normal.json");
    }

    function test_shl_256_edge() public {
        runPart("../../operators-data/data/shl.amount-mod-width/256.edge.json");
    }

    function test_shl_128_normal() public {
        runPart("../../operators-data/data/shl.amount-mod-width/128.normal.json");
    }

    function test_shl_128_edge() public {
        runPart("../../operators-data/data/shl.amount-mod-width/128.edge.json");
    }

    function test_shl_64_normal() public {
        runPart("../../operators-data/data/shl.amount-mod-width/64.normal.json");
    }

    function test_shl_64_edge() public {
        runPart("../../operators-data/data/shl.amount-mod-width/64.edge.json");
    }

    function test_shl_32_normal() public {
        runPart("../../operators-data/data/shl.amount-mod-width/32.normal.json");
    }

    function test_shl_32_edge() public {
        runPart("../../operators-data/data/shl.amount-mod-width/32.edge.json");
    }

    function test_shl_16_normal() public {
        runPart("../../operators-data/data/shl.amount-mod-width/16.normal.json");
    }

    function test_shl_16_edge() public {
        runPart("../../operators-data/data/shl.amount-mod-width/16.edge.json");
    }

    function test_shl_8_normal() public {
        runPart("../../operators-data/data/shl.amount-mod-width/8.normal.json");
    }

    function test_shl_8_edge() public {
        runPart("../../operators-data/data/shl.amount-mod-width/8.edge.json");
    }
}
