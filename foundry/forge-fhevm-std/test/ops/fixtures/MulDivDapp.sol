// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

// HAND-WRITTEN, in the style of the generated fixtures: scripts/gen-op-dapp.py only knows unary and
// binary operators. There is also no FHE.mulDiv to call: see below.

import {FHE, euint8, euint16, euint32, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {Impl} from "@fhevm/solidity/lib/Impl.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHEext} from "../utils/FHEext.sol";

// The v14 executor entry point. @fhevm/solidity 0.13.3, the newest on npm and the one these fixtures
// compile against, has no FHE.mulDiv and its IFHEVMExecutor has no fheMulDiv.
interface IFHEVMExecutorMulDiv {
    function fheMulDiv(bytes32 factor1, bytes32 factor2, bytes32 divisor, bytes1 scalarByte)
        external
        returns (bytes32 result);
}

// FHE.mulDiv for the operator vector tests, as upstream's library defines it (zama-ai/fhevm
// library-solidity lib/FHE.sol and Impl.mulDiv at 1515d36df): (a * b) / divisor with a widened product,
// a clear divisor, and a second factor that is either encrypted (scalar byte 0x01) or clear (0x03).
// Each wrapper does what the matching FHE.mulDiv overload does, through the same executor call; the
// executor grants the result transiently to this contract, which then grants it like any other result.
contract MulDivDapp is ZamaEthereumConfig {
    bytes1 private constant FACTOR2_ENCRYPTED = 0x01;
    bytes1 private constant FACTOR2_SCALAR = 0x03;

    function _mulDiv(bytes32 a, bytes32 b, uint256 divisor, bytes1 scalarByte) private returns (bytes32) {
        address executor = Impl.getCoprocessorConfig().CoprocessorAddress;
        return IFHEVMExecutorMulDiv(executor).fheMulDiv(a, b, bytes32(divisor), scalarByte);
    }

    function mulDiv_e8_e8_u8(bytes32 a, bytes32 b, uint8 divisor, bytes calldata proof) external returns (bytes32) {
        bytes32 fa = FHE.toBytes32(FHEext.fromExternalEuint8(a, proof));
        bytes32 fb = FHE.toBytes32(FHEext.fromExternalEuint8(b, proof));
        return FHEext.allowToBytes32(euint8.wrap(_mulDiv(fa, fb, divisor, FACTOR2_ENCRYPTED)));
    }

    function mulDiv_e8_u8_u8(bytes32 a, uint8 b, uint8 divisor, bytes calldata proof) external returns (bytes32) {
        bytes32 fa = FHE.toBytes32(FHEext.fromExternalEuint8(a, proof));
        return FHEext.allowToBytes32(euint8.wrap(_mulDiv(fa, bytes32(uint256(b)), divisor, FACTOR2_SCALAR)));
    }

    function mulDiv_e16_e16_u16(bytes32 a, bytes32 b, uint16 divisor, bytes calldata proof) external returns (bytes32) {
        bytes32 fa = FHE.toBytes32(FHEext.fromExternalEuint16(a, proof));
        bytes32 fb = FHE.toBytes32(FHEext.fromExternalEuint16(b, proof));
        return FHEext.allowToBytes32(euint16.wrap(_mulDiv(fa, fb, divisor, FACTOR2_ENCRYPTED)));
    }

    function mulDiv_e16_u16_u16(bytes32 a, uint16 b, uint16 divisor, bytes calldata proof) external returns (bytes32) {
        bytes32 fa = FHE.toBytes32(FHEext.fromExternalEuint16(a, proof));
        return FHEext.allowToBytes32(euint16.wrap(_mulDiv(fa, bytes32(uint256(b)), divisor, FACTOR2_SCALAR)));
    }

    function mulDiv_e32_e32_u32(bytes32 a, bytes32 b, uint32 divisor, bytes calldata proof) external returns (bytes32) {
        bytes32 fa = FHE.toBytes32(FHEext.fromExternalEuint32(a, proof));
        bytes32 fb = FHE.toBytes32(FHEext.fromExternalEuint32(b, proof));
        return FHEext.allowToBytes32(euint32.wrap(_mulDiv(fa, fb, divisor, FACTOR2_ENCRYPTED)));
    }

    function mulDiv_e32_u32_u32(bytes32 a, uint32 b, uint32 divisor, bytes calldata proof) external returns (bytes32) {
        bytes32 fa = FHE.toBytes32(FHEext.fromExternalEuint32(a, proof));
        return FHEext.allowToBytes32(euint32.wrap(_mulDiv(fa, bytes32(uint256(b)), divisor, FACTOR2_SCALAR)));
    }

    function mulDiv_e64_e64_u64(bytes32 a, bytes32 b, uint64 divisor, bytes calldata proof) external returns (bytes32) {
        bytes32 fa = FHE.toBytes32(FHEext.fromExternalEuint64(a, proof));
        bytes32 fb = FHE.toBytes32(FHEext.fromExternalEuint64(b, proof));
        return FHEext.allowToBytes32(euint64.wrap(_mulDiv(fa, fb, divisor, FACTOR2_ENCRYPTED)));
    }

    function mulDiv_e64_u64_u64(bytes32 a, uint64 b, uint64 divisor, bytes calldata proof) external returns (bytes32) {
        bytes32 fa = FHE.toBytes32(FHEext.fromExternalEuint64(a, proof));
        return FHEext.allowToBytes32(euint64.wrap(_mulDiv(fa, bytes32(uint256(b)), divisor, FACTOR2_SCALAR)));
    }
}
