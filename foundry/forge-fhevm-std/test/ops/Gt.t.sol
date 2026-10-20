// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {BinaryOpVectorTest} from "./shared/BinaryOpVectorTest.sol";
import {GtDapp} from "./fixtures/GtDapp.sol";

// FHE.gt against test/data/gt. See OpVectorTest for what is asserted.
contract FHETestGt is BinaryOpVectorTest {
    GtDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new GtDapp();
        vm.label(address(dapp), "GtDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "gt";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_gt_128_normal() public {
        runPart("../../operators-data/data/gt/128.normal.json");
    }

    function test_gt_128_edge() public {
        runPart("../../operators-data/data/gt/128.edge.json");
    }

    function test_gt_64_normal() public {
        runPart("../../operators-data/data/gt/64.normal.json");
    }

    function test_gt_64_edge() public {
        runPart("../../operators-data/data/gt/64.edge.json");
    }

    function test_gt_32_normal() public {
        runPart("../../operators-data/data/gt/32.normal.json");
    }

    function test_gt_32_edge() public {
        runPart("../../operators-data/data/gt/32.edge.json");
    }

    function test_gt_16_normal() public {
        runPart("../../operators-data/data/gt/16.normal.json");
    }

    function test_gt_16_edge() public {
        runPart("../../operators-data/data/gt/16.edge.json");
    }

    function test_gt_8_normal() public {
        runPart("../../operators-data/data/gt/8.normal.json");
    }

    function test_gt_8_edge() public {
        runPart("../../operators-data/data/gt/8.edge.json");
    }
}
