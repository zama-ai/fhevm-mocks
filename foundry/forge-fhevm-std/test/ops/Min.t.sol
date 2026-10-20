// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {MinDapp} from "./fixtures/MinDapp.sol";

// FHE.min against test/data/min. See OpVectorTest for what is asserted.
contract FHETestMin is BinaryOpVectorTest {
    MinDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new MinDapp();
        vm.label(address(dapp), "MinDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "min";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_min_128_normal() public {
        runPart("../../operators-data/data/min/128.normal.json");
    }

    function test_min_128_edge() public {
        runPart("../../operators-data/data/min/128.edge.json");
    }

    function test_min_64_normal() public {
        runPart("../../operators-data/data/min/64.normal.json");
    }

    function test_min_64_edge() public {
        runPart("../../operators-data/data/min/64.edge.json");
    }

    function test_min_32_normal() public {
        runPart("../../operators-data/data/min/32.normal.json");
    }

    function test_min_32_edge() public {
        runPart("../../operators-data/data/min/32.edge.json");
    }

    function test_min_16_normal() public {
        runPart("../../operators-data/data/min/16.normal.json");
    }

    function test_min_16_edge() public {
        runPart("../../operators-data/data/min/16.edge.json");
    }

    function test_min_8_normal() public {
        runPart("../../operators-data/data/min/8.normal.json");
    }

    function test_min_8_edge() public {
        runPart("../../operators-data/data/min/8.edge.json");
    }
}
