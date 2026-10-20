// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {LtDapp} from "./fixtures/LtDapp.sol";

// FHE.lt against test/data/lt. See OpVectorTest for what is asserted.
contract FHETestLt is BinaryOpVectorTest {
    LtDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new LtDapp();
        vm.label(address(dapp), "LtDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "lt";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_lt_128_normal() public {
        runPart("../../operators-data/data/lt/128.normal.json");
    }

    function test_lt_128_edge() public {
        runPart("../../operators-data/data/lt/128.edge.json");
    }

    function test_lt_64_normal() public {
        runPart("../../operators-data/data/lt/64.normal.json");
    }

    function test_lt_64_edge() public {
        runPart("../../operators-data/data/lt/64.edge.json");
    }

    function test_lt_32_normal() public {
        runPart("../../operators-data/data/lt/32.normal.json");
    }

    function test_lt_32_edge() public {
        runPart("../../operators-data/data/lt/32.edge.json");
    }

    function test_lt_16_normal() public {
        runPart("../../operators-data/data/lt/16.normal.json");
    }

    function test_lt_16_edge() public {
        runPart("../../operators-data/data/lt/16.edge.json");
    }

    function test_lt_8_normal() public {
        runPart("../../operators-data/data/lt/8.normal.json");
    }

    function test_lt_8_edge() public {
        runPart("../../operators-data/data/lt/8.edge.json");
    }
}
