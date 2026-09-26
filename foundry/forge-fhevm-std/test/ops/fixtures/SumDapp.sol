// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

// HAND-WRITTEN, in the style of the generated fixtures: scripts/gen-op-dapp.py only knows unary and
// binary operators. Edit this file by hand.

import {FHE, euint8, euint16, euint32, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHEext} from "../utils/FHEext.sol";

// FHE.sum for the operator vector tests: one wrapper per overload FHE.sol declares (euint8..euint128),
// each calling exactly that overload. Every element arrives as an input, all under ONE proof, the way a
// dApp taking an array of inputs receives them. An empty array is a real case and needs no proof.
contract SumDapp is ZamaEthereumConfig {
    function sum_e8(bytes32[] calldata values, bytes calldata proof) external returns (bytes32) {
        euint8[] memory v = new euint8[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            v[i] = FHEext.fromExternalEuint8(values[i], proof);
        }
        return FHEext.allowToBytes32(FHE.sum(v));
    }

    function sum_e16(bytes32[] calldata values, bytes calldata proof) external returns (bytes32) {
        euint16[] memory v = new euint16[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            v[i] = FHEext.fromExternalEuint16(values[i], proof);
        }
        return FHEext.allowToBytes32(FHE.sum(v));
    }

    function sum_e32(bytes32[] calldata values, bytes calldata proof) external returns (bytes32) {
        euint32[] memory v = new euint32[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            v[i] = FHEext.fromExternalEuint32(values[i], proof);
        }
        return FHEext.allowToBytes32(FHE.sum(v));
    }

    function sum_e64(bytes32[] calldata values, bytes calldata proof) external returns (bytes32) {
        euint64[] memory v = new euint64[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            v[i] = FHEext.fromExternalEuint64(values[i], proof);
        }
        return FHEext.allowToBytes32(FHE.sum(v));
    }

    function sum_e128(bytes32[] calldata values, bytes calldata proof) external returns (bytes32) {
        euint128[] memory v = new euint128[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            v[i] = FHEext.fromExternalEuint128(values[i], proof);
        }
        return FHEext.allowToBytes32(FHE.sum(v));
    }
}
