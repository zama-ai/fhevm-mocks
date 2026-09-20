// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {FHEEvents} from "../../pkg/src/contracts/FHEEvents.sol";
import {
    FheAdd as SharedFheAdd,
    FheSub as SharedFheSub,
    FheMul as SharedFheMul,
    FheDiv as SharedFheDiv,
    FheRem as SharedFheRem,
    FheBitAnd as SharedFheBitAnd,
    FheBitOr as SharedFheBitOr,
    FheBitXor as SharedFheBitXor,
    FheShl as SharedFheShl,
    FheShr as SharedFheShr,
    FheRotl as SharedFheRotl,
    FheRotr as SharedFheRotr,
    FheEq as SharedFheEq,
    FheNe as SharedFheNe,
    FheGe as SharedFheGe,
    FheGt as SharedFheGt,
    FheLe as SharedFheLe,
    FheLt as SharedFheLt,
    FheMin as SharedFheMin,
    FheMax as SharedFheMax,
    FheNeg as SharedFheNeg,
    FheNot as SharedFheNot,
    VerifyInput as SharedVerifyInput,
    Cast as SharedCast,
    TrivialEncrypt as SharedTrivialEncrypt,
    FheIfThenElse as SharedFheIfThenElse,
    FheRand as SharedFheRand,
    FheRandBounded as SharedFheRandBounded,
    FheSum as SharedFheSum,
    FheIsIn as SharedFheIsIn
} from "../../pkg/src/cleartext/shared/FhevmEvents.sol";

/// `cleartext/shared/FhevmEvents.sol` re-declares the vendored executor's events so a log reader need
/// not inherit the executor. The two are the same event only while their topic0 agree, and topic0 is
/// `keccak256` of the full signature — so a renamed parameter TYPE, a reordered argument or a changed
/// `indexed` all break the match. Nothing would fail to compile: `ForgeFhevmEventProcessor` would
/// simply recognise none of the stream and replay nothing, which looks exactly like a test that did no
/// FHE work. This suite is what turns that into a red build.
contract FhevmEventsTest is Test {
    function test_everyEventHasTheSameTopic() public pure {
        assertEq(SharedFheAdd.selector, FHEEvents.FheAdd.selector, "FheAdd");
        assertEq(SharedFheSub.selector, FHEEvents.FheSub.selector, "FheSub");
        assertEq(SharedFheMul.selector, FHEEvents.FheMul.selector, "FheMul");
        assertEq(SharedFheDiv.selector, FHEEvents.FheDiv.selector, "FheDiv");
        assertEq(SharedFheRem.selector, FHEEvents.FheRem.selector, "FheRem");
        assertEq(SharedFheBitAnd.selector, FHEEvents.FheBitAnd.selector, "FheBitAnd");
        assertEq(SharedFheBitOr.selector, FHEEvents.FheBitOr.selector, "FheBitOr");
        assertEq(SharedFheBitXor.selector, FHEEvents.FheBitXor.selector, "FheBitXor");
        assertEq(SharedFheShl.selector, FHEEvents.FheShl.selector, "FheShl");
        assertEq(SharedFheShr.selector, FHEEvents.FheShr.selector, "FheShr");
        assertEq(SharedFheRotl.selector, FHEEvents.FheRotl.selector, "FheRotl");
        assertEq(SharedFheRotr.selector, FHEEvents.FheRotr.selector, "FheRotr");
        assertEq(SharedFheEq.selector, FHEEvents.FheEq.selector, "FheEq");
        assertEq(SharedFheNe.selector, FHEEvents.FheNe.selector, "FheNe");
        assertEq(SharedFheGe.selector, FHEEvents.FheGe.selector, "FheGe");
        assertEq(SharedFheGt.selector, FHEEvents.FheGt.selector, "FheGt");
        assertEq(SharedFheLe.selector, FHEEvents.FheLe.selector, "FheLe");
        assertEq(SharedFheLt.selector, FHEEvents.FheLt.selector, "FheLt");
        assertEq(SharedFheMin.selector, FHEEvents.FheMin.selector, "FheMin");
        assertEq(SharedFheMax.selector, FHEEvents.FheMax.selector, "FheMax");
        assertEq(SharedFheNeg.selector, FHEEvents.FheNeg.selector, "FheNeg");
        assertEq(SharedFheNot.selector, FHEEvents.FheNot.selector, "FheNot");
        assertEq(SharedVerifyInput.selector, FHEEvents.VerifyInput.selector, "VerifyInput");
        assertEq(SharedCast.selector, FHEEvents.Cast.selector, "Cast");
        assertEq(SharedTrivialEncrypt.selector, FHEEvents.TrivialEncrypt.selector, "TrivialEncrypt");
        assertEq(SharedFheIfThenElse.selector, FHEEvents.FheIfThenElse.selector, "FheIfThenElse");
        assertEq(SharedFheRand.selector, FHEEvents.FheRand.selector, "FheRand");
        assertEq(SharedFheRandBounded.selector, FHEEvents.FheRandBounded.selector, "FheRandBounded");
        assertEq(SharedFheSum.selector, FHEEvents.FheSum.selector, "FheSum");
        assertEq(SharedFheIsIn.selector, FHEEvents.FheIsIn.selector, "FheIsIn");
    }
}
