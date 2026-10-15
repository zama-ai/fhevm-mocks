// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {OpVectorTest} from "./shared/OpVectorTest.sol";
import {SumDapp} from "./fixtures/SumDapp.sol";

// FHE.sum against operators-data/data/sum. See OpVectorTest for what is asserted.
//
// A case's only operand is `values`, a list of one width that may be empty. Every element is encrypted
// in ONE proof and passed to `sum_e<N>(bytes32[],bytes)`. The width comes from the result, since an
// empty list carries none. The cases include the upstream fhevm e2e ones (ids with `e2e_`) and every
// collection edge: empty, single, duplicates, wrap-around, and 100 (8..32 bits) or 60 (64, 128 bits)
// elements, the executor's maximum.
contract FHETestSum is OpVectorTest {
    SumDapp internal dapp;

    function setUp() public override {
        setUpCaller();
        dapp = new SumDapp();
        vm.label(address(dapp), "SumDapp");
    }

    function opName() internal pure override returns (string memory) {
        return "sum";
    }

    function dappAddress() internal view override returns (address) {
        return address(dapp);
    }

    function runCase(Case memory c) internal override {
        uint256 w = c.resultBits;
        require(c.values.length == 0 || c.valuesBits == w, string.concat(c.id, ": values are not result-wide"));
        (bytes32[] memory h, bytes memory proof) = encryptList(fheType(w), c.values);
        string memory sig = string.concat("sum_e", vm.toString(w), "(bytes32[],bytes)");
        check(c, "enc[]", callDapp(c, sig, abi.encode(h, proof)));
    }

    function test_sum_8_normal() public {
        runPart("../../operators-data/data/sum/8.normal.json");
    }

    function test_sum_8_edge() public {
        runPart("../../operators-data/data/sum/8.edge.json");
    }

    function test_sum_16_normal() public {
        runPart("../../operators-data/data/sum/16.normal.json");
    }

    function test_sum_16_edge() public {
        runPart("../../operators-data/data/sum/16.edge.json");
    }

    function test_sum_32_normal() public {
        runPart("../../operators-data/data/sum/32.normal.json");
    }

    function test_sum_32_edge() public {
        runPart("../../operators-data/data/sum/32.edge.json");
    }

    function test_sum_64_normal() public {
        runPart("../../operators-data/data/sum/64.normal.json");
    }

    function test_sum_64_edge() public {
        runPart("../../operators-data/data/sum/64.edge.json");
    }

    function test_sum_128_normal() public {
        runPart("../../operators-data/data/sum/128.normal.json");
    }

    function test_sum_128_edge() public {
        runPart("../../operators-data/data/sum/128.edge.json");
    }
}
