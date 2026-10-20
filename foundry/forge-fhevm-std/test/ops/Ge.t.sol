// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {GeDapp} from "./fixtures/GeDapp.sol";

// FHE.ge against test/data/ge. See OpVectorTest for what is asserted.
contract FHETestGe is BinaryOpVectorTest {
    GeDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new GeDapp();
        vm.label(address(dapp), "GeDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "ge";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_ge_128_normal() public {
        runPart("../../operators-data/data/ge/128.normal.json");
    }

    function test_ge_128_edge() public {
        runPart("../../operators-data/data/ge/128.edge.json");
    }

    function test_ge_64_normal() public {
        runPart("../../operators-data/data/ge/64.normal.json");
    }

    function test_ge_64_edge() public {
        runPart("../../operators-data/data/ge/64.edge.json");
    }

    function test_ge_32_normal() public {
        runPart("../../operators-data/data/ge/32.normal.json");
    }

    function test_ge_32_edge() public {
        runPart("../../operators-data/data/ge/32.edge.json");
    }

    function test_ge_16_normal() public {
        runPart("../../operators-data/data/ge/16.normal.json");
    }

    function test_ge_16_edge() public {
        runPart("../../operators-data/data/ge/16.edge.json");
    }

    function test_ge_8_normal() public {
        runPart("../../operators-data/data/ge/8.normal.json");
    }

    function test_ge_8_edge() public {
        runPart("../../operators-data/data/ge/8.edge.json");
    }
}
