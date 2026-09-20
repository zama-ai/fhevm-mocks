// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {EqDapp} from "./fixtures/EqDapp.sol";

// FHE.eq against test/data/eq. See OpVectorTest for what is asserted.
contract FHETestEq is BinaryOpVectorTest {
    EqDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new EqDapp();
        vm.label(address(dapp), "EqDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "eq";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_eq_256_normal() public {
        runPart("../../operators-data/data/eq/256.normal.json");
    }

    function test_eq_256_edge() public {
        runPart("../../operators-data/data/eq/256.edge.json");
    }

    function test_eq_160_normal() public {
        runPart("../../operators-data/data/eq/160.normal.json");
    }

    function test_eq_160_edge() public {
        runPart("../../operators-data/data/eq/160.edge.json");
    }

    function test_eq_128_normal() public {
        runPart("../../operators-data/data/eq/128.normal.json");
    }

    function test_eq_128_edge() public {
        runPart("../../operators-data/data/eq/128.edge.json");
    }

    function test_eq_64_normal() public {
        runPart("../../operators-data/data/eq/64.normal.json");
    }

    function test_eq_64_edge() public {
        runPart("../../operators-data/data/eq/64.edge.json");
    }

    function test_eq_32_normal() public {
        runPart("../../operators-data/data/eq/32.normal.json");
    }

    function test_eq_32_edge() public {
        runPart("../../operators-data/data/eq/32.edge.json");
    }

    function test_eq_16_normal() public {
        runPart("../../operators-data/data/eq/16.normal.json");
    }

    function test_eq_16_edge() public {
        runPart("../../operators-data/data/eq/16.edge.json");
    }

    function test_eq_8_normal() public {
        runPart("../../operators-data/data/eq/8.normal.json");
    }

    function test_eq_8_edge() public {
        runPart("../../operators-data/data/eq/8.edge.json");
    }

    function test_eq_1_edge() public {
        runPart("../../operators-data/data/eq/1.edge.json");
    }
}
