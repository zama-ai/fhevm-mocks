// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {StdFhevmBase} from "./StdFhevmBase.sol";
import {fhevm, FhevmHCUMeter} from "./FhevmVm.sol";
import {
    ebool,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    eaddress,
    externalEbool,
    externalEuint8,
    externalEuint16,
    externalEuint32,
    externalEuint64,
    externalEuint128,
    externalEuint256,
    externalEaddress
} from "encrypted-types/EncryptedTypes.sol";
import {CoprocessorConfig} from "./_host/shared/LibFhevmCoprocessorConfig.sol";
import {FheType} from "./_host/shared/FheType.sol";
import {LibFhevmHandle} from "./_host/shared/LibFhevmHandle.sol";
import {LibFhevmFail} from "./LibFhevmFail.sol";
import {LibForgeFhevmConfig} from "./_host/LibForgeFhevmConfig.sol";

abstract contract StdFhevmCheatsSafe is StdFhevmBase {
    // -- Read coprocessor config ----------------------------------------------

    function getCoprocessorConfig(address contractAddress) internal view returns (CoprocessorConfig memory config) {
        config = LibForgeFhevmConfig.getCoprocessorConfig(contractAddress);
    }

    // -- Get plaintext or revert ----------------------------------------------

    function plaintextOf(ebool value) internal unmetered returns (bool clear) {
        clear = fhevm.plaintextOf(ebool.unwrap(value)) != 0;
    }

    function plaintextOf(euint8 value) internal unmetered returns (uint8 clear) {
        clear = uint8(fhevm.plaintextOf(euint8.unwrap(value)));
    }

    function plaintextOf(euint16 value) internal unmetered returns (uint16 clear) {
        clear = uint16(fhevm.plaintextOf(euint16.unwrap(value)));
    }

    function plaintextOf(euint32 value) internal unmetered returns (uint32 clear) {
        clear = uint32(fhevm.plaintextOf(euint32.unwrap(value)));
    }

    function plaintextOf(euint64 value) internal unmetered returns (uint64 clear) {
        clear = uint64(fhevm.plaintextOf(euint64.unwrap(value)));
    }

    function plaintextOf(euint128 value) internal unmetered returns (uint128 clear) {
        clear = uint128(fhevm.plaintextOf(euint128.unwrap(value)));
    }

    function plaintextOf(euint256 value) internal unmetered returns (uint256 clear) {
        clear = fhevm.plaintextOf(euint256.unwrap(value));
    }

    function plaintextOf(eaddress value) internal unmetered returns (address clear) {
        clear = address(uint160(fhevm.plaintextOf(eaddress.unwrap(value))));
    }

    /// @dev Byte 21 of a handle the executor computed. `FHEVMExecutor._appendMetadataToPrehandle` writes
    ///      it on every result; an input handle carries its position in its batch instead, which cannot
    ///      reach 255.
    uint8 private constant COMPUTED_HANDLE_INDEX = 0xff;

    // -- A raw handle, as the type it says it is ------------------------------
    //
    // A `bytes32` off the chain -- read from a dApp's storage, decoded from an event, pasted from a trace
    // -- is not yet a value this SDK will accept. These turn one into a typed handle, and REFUSE rather
    // than wrap when it is not what the caller asked for.
    //
    // WHAT IS CHECKED, AND WHY EACH. A handle carries its own metadata: an uninitialized one is the zero
    // word, byte 30 is the type the executor minted it for, and bytes 22..29 are the chain it was minted
    // on. Wrapping without looking would hand back a value that reads as a different width, or that names
    // a slot in THIS chain's store belonging to some unrelated handle -- both answer plausibly and wrongly.
    // The chain and zero checks are the cleartext stack's own (`LibFhevmHandle.checkChainId`), so a handle
    // these accept is one the stack will too.

    function toEbool(bytes32 handle) internal view returns (ebool) {
        _requireHandleIs(handle, FheType.Bool, "ebool", true);
        return ebool.wrap(handle);
    }

    function toEuint8(bytes32 handle) internal view returns (euint8) {
        _requireHandleIs(handle, FheType.Uint8, "euint8", true);
        return euint8.wrap(handle);
    }

    function toEuint16(bytes32 handle) internal view returns (euint16) {
        _requireHandleIs(handle, FheType.Uint16, "euint16", true);
        return euint16.wrap(handle);
    }

    function toEuint32(bytes32 handle) internal view returns (euint32) {
        _requireHandleIs(handle, FheType.Uint32, "euint32", true);
        return euint32.wrap(handle);
    }

    function toEuint64(bytes32 handle) internal view returns (euint64) {
        _requireHandleIs(handle, FheType.Uint64, "euint64", true);
        return euint64.wrap(handle);
    }

    function toEuint128(bytes32 handle) internal view returns (euint128) {
        _requireHandleIs(handle, FheType.Uint128, "euint128", true);
        return euint128.wrap(handle);
    }

    function toEuint256(bytes32 handle) internal view returns (euint256) {
        _requireHandleIs(handle, FheType.Uint256, "euint256", true);
        return euint256.wrap(handle);
    }

    function toEaddress(bytes32 handle) internal view returns (eaddress) {
        _requireHandleIs(handle, FheType.Uint160, "eaddress", true);
        return eaddress.wrap(handle);
    }

    // -- A raw handle, as the INPUT it says it is -----------------------------
    //
    // The other kind. An input handle is what `encrypt*` produces and a dApp passes to `FHE.fromExternal`:
    // it was never computed by the executor, so it carries its POSITION in the batch it arrived with where
    // a computed handle carries `0xff`. These wrap one as the `external*` type a dApp's parameter expects.

    function toExternalEbool(bytes32 handle) internal view returns (externalEbool) {
        _requireHandleIs(handle, FheType.Bool, "ebool", false);
        return externalEbool.wrap(handle);
    }

    function toExternalEuint8(bytes32 handle) internal view returns (externalEuint8) {
        _requireHandleIs(handle, FheType.Uint8, "euint8", false);
        return externalEuint8.wrap(handle);
    }

    function toExternalEuint16(bytes32 handle) internal view returns (externalEuint16) {
        _requireHandleIs(handle, FheType.Uint16, "euint16", false);
        return externalEuint16.wrap(handle);
    }

    function toExternalEuint32(bytes32 handle) internal view returns (externalEuint32) {
        _requireHandleIs(handle, FheType.Uint32, "euint32", false);
        return externalEuint32.wrap(handle);
    }

    function toExternalEuint64(bytes32 handle) internal view returns (externalEuint64) {
        _requireHandleIs(handle, FheType.Uint64, "euint64", false);
        return externalEuint64.wrap(handle);
    }

    function toExternalEuint128(bytes32 handle) internal view returns (externalEuint128) {
        _requireHandleIs(handle, FheType.Uint128, "euint128", false);
        return externalEuint128.wrap(handle);
    }

    function toExternalEuint256(bytes32 handle) internal view returns (externalEuint256) {
        _requireHandleIs(handle, FheType.Uint256, "euint256", false);
        return externalEuint256.wrap(handle);
    }

    function toExternalEaddress(bytes32 handle) internal view returns (externalEaddress) {
        _requireHandleIs(handle, FheType.Uint160, "eaddress", false);
        return externalEaddress.wrap(handle);
    }

    /// @dev Everything the sixteen share, in the order that makes the message name the FIRST thing wrong:
    ///      the stack's own acceptance rules, then the type asked for, then the kind. Kind last because a
    ///      handle of the right type but the wrong kind is the one case where the advice is "use the other
    ///      family", which only makes sense once the type is known to match.
    function _requireHandleIs(bytes32 handle, FheType wanted, string memory wantedName, bool wantComputed)
        private
        view
    {
        LibFhevmHandle.checkChainId(handle); // zero word, then the chain it was minted on

        FheType actual = LibFhevmHandle.typeOf(handle);
        if (actual != wanted) {
            revert(LibFhevmFail.handleTypeMismatch(handle, wantedName, _typeName(actual)));
        }

        // Byte 21: `0xff` on everything the executor computes, a batch position (0..254) on an input.
        uint8 index = LibFhevmHandle.indexOf(handle);
        if (wantComputed != (index == COMPUTED_HANDLE_INDEX)) {
            revert(LibFhevmFail.handleWrongKind(handle, wantComputed, index));
        }
    }

    /// @dev The encrypted type a handle's byte 30 names, for the message. Only the types these
    ///      conversions produce are spelled out; anything else is reported by its enum position, which
    ///      is what a reader would look up anyway.
    function _typeName(FheType fheType) private pure returns (string memory) {
        if (fheType == FheType.Bool) return "ebool";
        if (fheType == FheType.Uint8) return "euint8";
        if (fheType == FheType.Uint16) return "euint16";
        if (fheType == FheType.Uint32) return "euint32";
        if (fheType == FheType.Uint64) return "euint64";
        if (fheType == FheType.Uint128) return "euint128";
        if (fheType == FheType.Uint160) return "eaddress";
        if (fheType == FheType.Uint256) return "euint256";
        return string.concat("FheType(", fvm.toString(bytes32(uint256(uint8(fheType)))), ")");
    }

    // -- Has plaintext? -------------------------------------------------------

    function hasPlaintext(ebool value) internal unmetered returns (bool) {
        return fhevm.hasPlaintext(ebool.unwrap(value));
    }

    function hasPlaintext(euint8 value) internal unmetered returns (bool) {
        return fhevm.hasPlaintext(euint8.unwrap(value));
    }

    function hasPlaintext(euint16 value) internal unmetered returns (bool) {
        return fhevm.hasPlaintext(euint16.unwrap(value));
    }

    function hasPlaintext(euint32 value) internal unmetered returns (bool) {
        return fhevm.hasPlaintext(euint32.unwrap(value));
    }

    function hasPlaintext(euint64 value) internal unmetered returns (bool) {
        return fhevm.hasPlaintext(euint64.unwrap(value));
    }

    function hasPlaintext(euint128 value) internal unmetered returns (bool) {
        return fhevm.hasPlaintext(euint128.unwrap(value));
    }

    function hasPlaintext(euint256 value) internal unmetered returns (bool) {
        return fhevm.hasPlaintext(euint256.unwrap(value));
    }

    function hasPlaintext(eaddress value) internal unmetered returns (bool) {
        return fhevm.hasPlaintext(eaddress.unwrap(value));
    }

    // -- Try plaintext of -----------------------------------------------------

    // forge-lint: disable-start(unsafe-typecast)
    function tryPlaintextOf(ebool value) internal unmetered returns (bool exists, bool clear) {
        (bool found, uint256 word) = fhevm.tryPlaintextOf(ebool.unwrap(value));
        exists = found;
        clear = word != 0;
    }

    function tryPlaintextOf(euint8 value) internal unmetered returns (bool exists, uint8 clear) {
        (bool found, uint256 word) = fhevm.tryPlaintextOf(euint8.unwrap(value));
        exists = found;
        clear = uint8(word);
    }

    function tryPlaintextOf(euint16 value) internal unmetered returns (bool exists, uint16 clear) {
        (bool found, uint256 word) = fhevm.tryPlaintextOf(euint16.unwrap(value));
        exists = found;
        clear = uint16(word);
    }

    function tryPlaintextOf(euint32 value) internal unmetered returns (bool exists, uint32 clear) {
        (bool found, uint256 word) = fhevm.tryPlaintextOf(euint32.unwrap(value));
        exists = found;
        clear = uint32(word);
    }

    function tryPlaintextOf(euint64 value) internal unmetered returns (bool exists, uint64 clear) {
        (bool found, uint256 word) = fhevm.tryPlaintextOf(euint64.unwrap(value));
        exists = found;
        clear = uint64(word);
    }

    function tryPlaintextOf(euint128 value) internal unmetered returns (bool exists, uint128 clear) {
        (bool found, uint256 word) = fhevm.tryPlaintextOf(euint128.unwrap(value));
        exists = found;
        clear = uint128(word);
    }

    function tryPlaintextOf(euint256 value) internal unmetered returns (bool exists, uint256 clear) {
        (bool found, uint256 word) = fhevm.tryPlaintextOf(euint256.unwrap(value));
        exists = found;
        clear = word;
    }

    function tryPlaintextOf(eaddress value) internal unmetered returns (bool exists, address clear) {
        (bool found, uint256 word) = fhevm.tryPlaintextOf(eaddress.unwrap(value));
        exists = found;
        clear = address(uint160(word));
    }
    // forge-lint: disable-end(unsafe-typecast)

    // -- forkUnknown ----------------------------------------------------------

    function forkUnknown(ebool value, bool clear) internal unmetered {
        fhevm.seedCleartext(ebool.unwrap(value), clear ? 1 : 0);
    }

    function forkUnknown(euint8 value, uint8 clear) internal unmetered {
        fhevm.seedCleartext(euint8.unwrap(value), clear);
    }

    function forkUnknown(euint16 value, uint16 clear) internal unmetered {
        fhevm.seedCleartext(euint16.unwrap(value), clear);
    }

    function forkUnknown(euint32 value, uint32 clear) internal unmetered {
        fhevm.seedCleartext(euint32.unwrap(value), clear);
    }

    function forkUnknown(euint64 value, uint64 clear) internal unmetered {
        fhevm.seedCleartext(euint64.unwrap(value), clear);
    }

    function forkUnknown(euint128 value, uint128 clear) internal unmetered {
        fhevm.seedCleartext(euint128.unwrap(value), clear);
    }

    function forkUnknown(euint256 value, uint256 clear) internal unmetered {
        fhevm.seedCleartext(euint256.unwrap(value), clear);
    }

    function forkUnknown(eaddress value, address clear) internal unmetered {
        fhevm.seedCleartext(eaddress.unwrap(value), uint256(uint160(clear)));
    }

    // THE INVERSE OF `forkUnknown`, and overloads work here where they could not for the defaults:
    // these key on the handle, so the type is never ambiguous. After it, the handle is unknown again and
    // the TYPE's policy answers for it -- a fixed value, a derived one, or a refusal.
    //
    // NOT FOR A HANDLE THIS STACK COMPUTED. The store is consulted first, then the HCU meter: forgetting
    // something this stack minted reports `CleartextErrorUnrecordedResult` rather than falling through
    // to the policy, because the stack made that value and losing it is a fault, not a question. These
    // are for the handles a fork inherited, which is what `forkUnknown` is for too.
    function resetForkUnknown(ebool value) internal unmetered {
        fhevm.unsetCleartext(ebool.unwrap(value));
    }

    function resetForkUnknown(euint8 value) internal unmetered {
        fhevm.unsetCleartext(euint8.unwrap(value));
    }

    function resetForkUnknown(euint16 value) internal unmetered {
        fhevm.unsetCleartext(euint16.unwrap(value));
    }

    function resetForkUnknown(euint32 value) internal unmetered {
        fhevm.unsetCleartext(euint32.unwrap(value));
    }

    function resetForkUnknown(euint64 value) internal unmetered {
        fhevm.unsetCleartext(euint64.unwrap(value));
    }

    function resetForkUnknown(euint128 value) internal unmetered {
        fhevm.unsetCleartext(euint128.unwrap(value));
    }

    function resetForkUnknown(euint256 value) internal unmetered {
        fhevm.unsetCleartext(euint256.unwrap(value));
    }

    function resetForkUnknown(eaddress value) internal unmetered {
        fhevm.unsetCleartext(eaddress.unwrap(value));
    }

    // ONE PER TYPE, and named for it, because a default is a property OF a type. The single
    // `forkUnknownDefault(value)` this replaces set the default for every type the number happened to
    // fit and silently skipped the rest, so `forkUnknownDefault(1000)` left `ebool` and `euint8` still
    // refusing and the failure surfaced far away. Overloads cannot do the job either: with no handle to
    // key on, `forkUnknownDefault(5)` is ambiguous between the integer widths and will not compile.
    function forkUnknownDefaultEbool(bool clear) internal unmetered {
        fhevm.useFixedUnknownHandle(uint8(FheType.Bool), clear ? 1 : 0);
    }

    function forkUnknownDefaultEuint8(uint8 clear) internal unmetered {
        fhevm.useFixedUnknownHandle(uint8(FheType.Uint8), clear);
    }

    function forkUnknownDefaultEuint16(uint16 clear) internal unmetered {
        fhevm.useFixedUnknownHandle(uint8(FheType.Uint16), clear);
    }

    function forkUnknownDefaultEuint32(uint32 clear) internal unmetered {
        fhevm.useFixedUnknownHandle(uint8(FheType.Uint32), clear);
    }

    function forkUnknownDefaultEuint64(uint64 clear) internal unmetered {
        fhevm.useFixedUnknownHandle(uint8(FheType.Uint64), clear);
    }

    function forkUnknownDefaultEuint128(uint128 clear) internal unmetered {
        fhevm.useFixedUnknownHandle(uint8(FheType.Uint128), clear);
    }

    function forkUnknownDefaultEuint256(uint256 clear) internal unmetered {
        fhevm.useFixedUnknownHandle(uint8(FheType.Uint256), clear);
    }

    function forkUnknownDefaultEaddress(address clear) internal unmetered {
        fhevm.useFixedUnknownHandle(uint8(FheType.Uint160), uint256(uint160(clear)));
    }

    // BACK TO REFUSING, one type at a time -- the third policy, and the only way back to where every
    // type starts. Named for the state it leaves behind rather than for what it undoes, because a
    // reader should not have to know whether the type was answering a fixed value or a derived one:
    // both clear to the same place, and `Revert` is that place.
    //
    // IT CLEARS THE POLICY, NOT THE STORE. A value stated with `forkUnknown(value, clear)` still wins,
    // and a handle this stack minted but failed to record still reports itself -- both are settled
    // before any policy is consulted.
    function forkUnknownRefuseEbool() internal unmetered {
        fhevm.clearUnknownHandlePolicy(uint8(FheType.Bool));
    }

    function forkUnknownRefuseEuint8() internal unmetered {
        fhevm.clearUnknownHandlePolicy(uint8(FheType.Uint8));
    }

    function forkUnknownRefuseEuint16() internal unmetered {
        fhevm.clearUnknownHandlePolicy(uint8(FheType.Uint16));
    }

    function forkUnknownRefuseEuint32() internal unmetered {
        fhevm.clearUnknownHandlePolicy(uint8(FheType.Uint32));
    }

    function forkUnknownRefuseEuint64() internal unmetered {
        fhevm.clearUnknownHandlePolicy(uint8(FheType.Uint64));
    }

    function forkUnknownRefuseEuint128() internal unmetered {
        fhevm.clearUnknownHandlePolicy(uint8(FheType.Uint128));
    }

    function forkUnknownRefuseEuint256() internal unmetered {
        fhevm.clearUnknownHandlePolicy(uint8(FheType.Uint256));
    }

    function forkUnknownRefuseEaddress() internal unmetered {
        fhevm.clearUnknownHandlePolicy(uint8(FheType.Uint160));
    }

    /// Every type at once -- the counterpart of `forkUnknownDeterministic`, and honest for the same
    /// reason: refusing has no width to fit, so no type is silently skipped.
    function forkUnknownRefuse() internal unmetered {
        fhevm.clearAllUnknownHandlePolicies();
    }

    function forkUnknownDeterministic() internal unmetered {
        fhevm.useDeterministicUnknownHandles();
    }

    // -- What did this value cost? --------------------------------------------
    //
    // `getHCU(value)` is what one handle cost when this stack computed it -- a per-handle reading that
    // outlives its transaction, where `lastHCU()` is the running total the host contract keeps transiently
    // and drops at the end of one. So a test may price a single value after the fact, without resetting
    // the meter around the call that made it.
    //
    // ZERO MEANS "NOT FROM HERE", never "free": every metered operation costs something, so the absence
    // of a reading marks a handle this stack inherited from the chain it forked rather than computed. On
    // a fork that is the useful question -- it separates what the test produced from what was already
    // there.

    // forge-lint: disable-next-line(mixed-case-function)
    function getHCU(ebool value) internal unmetered returns (uint256) {
        return fhevm.hcuOf(ebool.unwrap(value));
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function getHCU(euint8 value) internal unmetered returns (uint256) {
        return fhevm.hcuOf(euint8.unwrap(value));
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function getHCU(euint16 value) internal unmetered returns (uint256) {
        return fhevm.hcuOf(euint16.unwrap(value));
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function getHCU(euint32 value) internal unmetered returns (uint256) {
        return fhevm.hcuOf(euint32.unwrap(value));
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function getHCU(euint64 value) internal unmetered returns (uint256) {
        return fhevm.hcuOf(euint64.unwrap(value));
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function getHCU(euint128 value) internal unmetered returns (uint256) {
        return fhevm.hcuOf(euint128.unwrap(value));
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function getHCU(euint256 value) internal unmetered returns (uint256) {
        return fhevm.hcuOf(euint256.unwrap(value));
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function getHCU(eaddress value) internal unmetered returns (uint256) {
        return fhevm.hcuOf(eaddress.unwrap(value));
    }

    // -- HCU limit ------------------------------------------------------------

    // forge-lint: disable-next-line(mixed-case-function)
    function disableHCUDepthLimit() internal unmetered {
        fhevm.disableHCUDepthLimit();
    }

    // forge-lint: disable-next-line(mixed-case-function)
    function disableHCULimits() internal unmetered {
        fhevm.disableHCULimits();
    }

    /**
     * @notice Zeroes the HCU meter, so the next FHE call is measured on its own.
     * @dev A forge test is ONE transaction, so the meter clears once and then accumulates across the
     *      test's later calls. Reset, call, then `lastHCU()`.
     */
    // forge-lint: disable-next-line(mixed-case-function)
    function resetHCU() internal unmetered {
        fhevm.resetHCU();
    }

    /**
     * @notice What the last transaction spent, in HCU: `.transaction` is the total, `.maxHandle` the
     *         deepest single handle chain within it — the number the depth cap is applied to.
     *
     * @dev Reads the stack this library deployed; a stack from anywhere else, and every real network,
     *      keeps no meter and is refused by name. A forge test is ONE transaction, so the readings clear
     *      once and then accumulate across its later calls: `resetHCU()` first to measure a single one.
     */
    // forge-lint: disable-next-line(mixed-case-function)
    function lastHCU() internal unmetered returns (FhevmHCUMeter memory) {
        return fhevm.lastHCU();
    }
}
