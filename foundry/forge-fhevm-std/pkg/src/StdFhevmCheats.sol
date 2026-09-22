// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {StdFhevmBase} from "./StdFhevmBase.sol";
import {fhevm} from "./FhevmVm.sol";
import {
    ebool,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    eaddress
} from "encrypted-types/EncryptedTypes.sol";
import {CoprocessorConfig} from "./_host/shared/LibFhevmCoprocessorConfig.sol";
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

    function forkUnknownDefault(uint256 clear) internal unmetered {
        fhevm.useFixedUnknownHandles(clear);
    }

    function forkUnknownDefault(bool clear) internal unmetered {
        fhevm.useFixedUnknownHandles(clear ? 1 : 0);
    }

    function forkUnknownDefault(address clear) internal unmetered {
        fhevm.useFixedUnknownHandles(uint256(uint160(clear)));
    }

    function forkUnknownDeterministic() internal unmetered {
        fhevm.useDeterministicUnknownHandles();
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
}
