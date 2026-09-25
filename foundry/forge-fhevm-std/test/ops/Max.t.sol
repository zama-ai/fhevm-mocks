// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {MaxDapp} from "./fixtures/MaxDapp.sol";

// FHE.max against test/data/max. See OpVectorTest for what is asserted.
contract FHETestMax is BinaryOpVectorTest {
    MaxDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new MaxDapp();
        vm.label(address(dapp), "MaxDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "max";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_max_128_normal() public {
        runPart("../../operators-data/data/max/128.normal.json");
    }

    function test_max_128_edge() public {
        runPart("../../operators-data/data/max/128.edge.json");
    }

    function test_max_64_normal() public {
        runPart("../../operators-data/data/max/64.normal.json");
    }

    function test_max_64_edge() public {
        runPart("../../operators-data/data/max/64.edge.json");
    }

    function test_max_32_normal() public {
        runPart("../../operators-data/data/max/32.normal.json");
    }

    function test_max_32_edge() public {
        runPart("../../operators-data/data/max/32.edge.json");
    }

    function test_max_16_normal() public {
        runPart("../../operators-data/data/max/16.normal.json");
    }

    function test_max_16_edge() public {
        runPart("../../operators-data/data/max/16.edge.json");
    }

    function test_max_8_normal() public {
        runPart("../../operators-data/data/max/8.normal.json");
    }

    function test_max_8_edge() public {
        runPart("../../operators-data/data/max/8.edge.json");
    }
}
