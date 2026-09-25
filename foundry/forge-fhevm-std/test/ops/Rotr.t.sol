// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {RotrDapp} from "./fixtures/RotrDapp.sol";

// FHE.rotr against test/data/rotr. See OpVectorTest for what is asserted.
contract FHETestRotr is BinaryOpVectorTest {
    RotrDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new RotrDapp();
        vm.label(address(dapp), "RotrDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "rotr";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    // FHE.rotr takes an 8-bit amount, encrypted or clear, for every value width;
    // there is no clear-value form.
    function hasScalarPair(uint256, uint256 rhsBits) internal pure override returns (bool) {
        return rhsBits == 8;
    }

    function hasClearEnc() internal pure override returns (bool) {
        return false;
    }

    function test_rotr_256_normal() public {
        runPart("../../operators-data/data/rotr/256.normal.json");
    }

    function test_rotr_256_edge() public {
        runPart("../../operators-data/data/rotr/256.edge.json");
    }

    function test_rotr_128_normal() public {
        runPart("../../operators-data/data/rotr/128.normal.json");
    }

    function test_rotr_128_edge() public {
        runPart("../../operators-data/data/rotr/128.edge.json");
    }

    function test_rotr_64_normal() public {
        runPart("../../operators-data/data/rotr/64.normal.json");
    }

    function test_rotr_64_edge() public {
        runPart("../../operators-data/data/rotr/64.edge.json");
    }

    function test_rotr_32_normal() public {
        runPart("../../operators-data/data/rotr/32.normal.json");
    }

    function test_rotr_32_edge() public {
        runPart("../../operators-data/data/rotr/32.edge.json");
    }

    function test_rotr_16_normal() public {
        runPart("../../operators-data/data/rotr/16.normal.json");
    }

    function test_rotr_16_edge() public {
        runPart("../../operators-data/data/rotr/16.edge.json");
    }

    function test_rotr_8_normal() public {
        runPart("../../operators-data/data/rotr/8.normal.json");
    }

    function test_rotr_8_edge() public {
        runPart("../../operators-data/data/rotr/8.edge.json");
    }
}
