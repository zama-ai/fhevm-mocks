// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FHEEvents} from "../../pkg/src/contracts/FHEEvents.sol";
import {LibFhevmEvents} from "../../pkg/src/cleartext/shared/FhevmEvents.sol";

/// `cleartext/shared/FhevmEvents.sol` re-declares the vendored executor's events so a log reader need
/// not inherit the executor. The two are the same event only while their topic0 agree, and topic0 is
/// `keccak256` of the full signature — so a renamed parameter TYPE, a reordered argument or a changed
/// `indexed` all break the match. Nothing would fail to compile: `ForgeFhevmEventProcessor` would
/// simply recognise none of the stream and replay nothing, which looks exactly like a test that did no
/// FHE work. This suite is what turns that into a red build.
contract FhevmEventsTest is Test {
    function test_everyEventHasTheSameTopic() public pure {
        assertEq(LibFhevmEvents.FheAdd.selector, FHEEvents.FheAdd.selector, "FheAdd");
        assertEq(LibFhevmEvents.FheSub.selector, FHEEvents.FheSub.selector, "FheSub");
        assertEq(LibFhevmEvents.FheMul.selector, FHEEvents.FheMul.selector, "FheMul");
        assertEq(LibFhevmEvents.FheDiv.selector, FHEEvents.FheDiv.selector, "FheDiv");
        assertEq(LibFhevmEvents.FheRem.selector, FHEEvents.FheRem.selector, "FheRem");
        assertEq(LibFhevmEvents.FheBitAnd.selector, FHEEvents.FheBitAnd.selector, "FheBitAnd");
        assertEq(LibFhevmEvents.FheBitOr.selector, FHEEvents.FheBitOr.selector, "FheBitOr");
        assertEq(LibFhevmEvents.FheBitXor.selector, FHEEvents.FheBitXor.selector, "FheBitXor");
        assertEq(LibFhevmEvents.FheShl.selector, FHEEvents.FheShl.selector, "FheShl");
        assertEq(LibFhevmEvents.FheShr.selector, FHEEvents.FheShr.selector, "FheShr");
        assertEq(LibFhevmEvents.FheRotl.selector, FHEEvents.FheRotl.selector, "FheRotl");
        assertEq(LibFhevmEvents.FheRotr.selector, FHEEvents.FheRotr.selector, "FheRotr");
        assertEq(LibFhevmEvents.FheEq.selector, FHEEvents.FheEq.selector, "FheEq");
        assertEq(LibFhevmEvents.FheNe.selector, FHEEvents.FheNe.selector, "FheNe");
        assertEq(LibFhevmEvents.FheGe.selector, FHEEvents.FheGe.selector, "FheGe");
        assertEq(LibFhevmEvents.FheGt.selector, FHEEvents.FheGt.selector, "FheGt");
        assertEq(LibFhevmEvents.FheLe.selector, FHEEvents.FheLe.selector, "FheLe");
        assertEq(LibFhevmEvents.FheLt.selector, FHEEvents.FheLt.selector, "FheLt");
        assertEq(LibFhevmEvents.FheMin.selector, FHEEvents.FheMin.selector, "FheMin");
        assertEq(LibFhevmEvents.FheMax.selector, FHEEvents.FheMax.selector, "FheMax");
        assertEq(LibFhevmEvents.FheNeg.selector, FHEEvents.FheNeg.selector, "FheNeg");
        assertEq(LibFhevmEvents.FheNot.selector, FHEEvents.FheNot.selector, "FheNot");
        assertEq(LibFhevmEvents.VerifyInput.selector, FHEEvents.VerifyInput.selector, "VerifyInput");
        assertEq(LibFhevmEvents.Cast.selector, FHEEvents.Cast.selector, "Cast");
        assertEq(LibFhevmEvents.TrivialEncrypt.selector, FHEEvents.TrivialEncrypt.selector, "TrivialEncrypt");
        assertEq(LibFhevmEvents.FheIfThenElse.selector, FHEEvents.FheIfThenElse.selector, "FheIfThenElse");
        assertEq(LibFhevmEvents.FheRand.selector, FHEEvents.FheRand.selector, "FheRand");
        assertEq(LibFhevmEvents.FheRandBounded.selector, FHEEvents.FheRandBounded.selector, "FheRandBounded");
        assertEq(LibFhevmEvents.FheSum.selector, FHEEvents.FheSum.selector, "FheSum");
        assertEq(LibFhevmEvents.FheIsIn.selector, FHEEvents.FheIsIn.selector, "FheIsIn");
    }
}
