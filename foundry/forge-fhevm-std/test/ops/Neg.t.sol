// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {UnaryOpVectorTest} from "./shared/UnaryOpVectorTest.sol";
import {NegDapp} from "./fixtures/NegDapp.sol";

// FHE.neg against test/data/neg. See OpVectorTest for what is asserted.
contract FHETestNeg is UnaryOpVectorTest {
    NegDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new NegDapp();
        vm.label(address(dapp), "NegDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "neg";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function test_neg_256_normal() public {
        runPart("../../operators-data/data/neg/256.normal.json");
    }

    function test_neg_256_edge() public {
        runPart("../../operators-data/data/neg/256.edge.json");
    }

    function test_neg_128_normal() public {
        runPart("../../operators-data/data/neg/128.normal.json");
    }

    function test_neg_128_edge() public {
        runPart("../../operators-data/data/neg/128.edge.json");
    }

    function test_neg_64_normal() public {
        runPart("../../operators-data/data/neg/64.normal.json");
    }

    function test_neg_64_edge() public {
        runPart("../../operators-data/data/neg/64.edge.json");
    }

    function test_neg_32_normal() public {
        runPart("../../operators-data/data/neg/32.normal.json");
    }

    function test_neg_32_edge() public {
        runPart("../../operators-data/data/neg/32.edge.json");
    }

    function test_neg_16_normal() public {
        runPart("../../operators-data/data/neg/16.normal.json");
    }

    function test_neg_16_edge() public {
        runPart("../../operators-data/data/neg/16.edge.json");
    }

    function test_neg_8_normal() public {
        runPart("../../operators-data/data/neg/8.normal.json");
    }

    function test_neg_8_edge() public {
        runPart("../../operators-data/data/neg/8.edge.json");
    }
}
