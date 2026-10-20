// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {LeDapp} from "./fixtures/LeDapp.sol";

// FHE.le against test/data/le. See OpVectorTest for what is asserted.
contract FHETestLe is BinaryOpVectorTest {
    LeDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new LeDapp();
        vm.label(address(dapp), "LeDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "le";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_le_128_normal() public {
        runPart("../../operators-data/data/le/128.normal.json");
    }

    function test_le_128_edge() public {
        runPart("../../operators-data/data/le/128.edge.json");
    }

    function test_le_64_normal() public {
        runPart("../../operators-data/data/le/64.normal.json");
    }

    function test_le_64_edge() public {
        runPart("../../operators-data/data/le/64.edge.json");
    }

    function test_le_32_normal() public {
        runPart("../../operators-data/data/le/32.normal.json");
    }

    function test_le_32_edge() public {
        runPart("../../operators-data/data/le/32.edge.json");
    }

    function test_le_16_normal() public {
        runPart("../../operators-data/data/le/16.normal.json");
    }

    function test_le_16_edge() public {
        runPart("../../operators-data/data/le/16.edge.json");
    }

    function test_le_8_normal() public {
        runPart("../../operators-data/data/le/8.normal.json");
    }

    function test_le_8_edge() public {
        runPart("../../operators-data/data/le/8.edge.json");
    }
}
