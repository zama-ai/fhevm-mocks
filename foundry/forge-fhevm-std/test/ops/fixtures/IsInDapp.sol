// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.24;

// HAND-WRITTEN, in the style of the generated fixtures: scripts/gen-op-dapp.py only knows unary and
// binary operators. Edit this file by hand.

import {FHE, euint8, euint16, euint32, euint64, euint128, euint256, eaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHEext} from "../utils/FHEext.sol";

// FHE.isIn for the operator vector tests: one wrapper per overload FHE.sol declares (euint8..euint128,
// eaddress as e160, euint256), each calling exactly that overload. The value and every set element
// arrive as inputs under ONE proof. An empty set is a real case.
contract IsInDapp is ZamaEthereumConfig {
    function isIn_e8(bytes32 value, bytes32[] calldata set, bytes calldata proof) external returns (bytes32) {
        euint8[] memory s = new euint8[](set.length);
        for (uint256 i = 0; i < set.length; i++) {
            s[i] = FHEext.fromExternalEuint8(set[i], proof);
        }
        return FHEext.allowToBytes32(FHE.isIn(FHEext.fromExternalEuint8(value, proof), s));
    }

    function isIn_e16(bytes32 value, bytes32[] calldata set, bytes calldata proof) external returns (bytes32) {
        euint16[] memory s = new euint16[](set.length);
        for (uint256 i = 0; i < set.length; i++) {
            s[i] = FHEext.fromExternalEuint16(set[i], proof);
        }
        return FHEext.allowToBytes32(FHE.isIn(FHEext.fromExternalEuint16(value, proof), s));
    }

    function isIn_e32(bytes32 value, bytes32[] calldata set, bytes calldata proof) external returns (bytes32) {
        euint32[] memory s = new euint32[](set.length);
        for (uint256 i = 0; i < set.length; i++) {
            s[i] = FHEext.fromExternalEuint32(set[i], proof);
        }
        return FHEext.allowToBytes32(FHE.isIn(FHEext.fromExternalEuint32(value, proof), s));
    }

    function isIn_e64(bytes32 value, bytes32[] calldata set, bytes calldata proof) external returns (bytes32) {
        euint64[] memory s = new euint64[](set.length);
        for (uint256 i = 0; i < set.length; i++) {
            s[i] = FHEext.fromExternalEuint64(set[i], proof);
        }
        return FHEext.allowToBytes32(FHE.isIn(FHEext.fromExternalEuint64(value, proof), s));
    }

    function isIn_e128(bytes32 value, bytes32[] calldata set, bytes calldata proof) external returns (bytes32) {
        euint128[] memory s = new euint128[](set.length);
        for (uint256 i = 0; i < set.length; i++) {
            s[i] = FHEext.fromExternalEuint128(set[i], proof);
        }
        return FHEext.allowToBytes32(FHE.isIn(FHEext.fromExternalEuint128(value, proof), s));
    }

    function isIn_e160(bytes32 value, bytes32[] calldata set, bytes calldata proof) external returns (bytes32) {
        eaddress[] memory s = new eaddress[](set.length);
        for (uint256 i = 0; i < set.length; i++) {
            s[i] = FHEext.fromExternalEaddress(set[i], proof);
        }
        return FHEext.allowToBytes32(FHE.isIn(FHEext.fromExternalEaddress(value, proof), s));
    }

    function isIn_e256(bytes32 value, bytes32[] calldata set, bytes calldata proof) external returns (bytes32) {
        euint256[] memory s = new euint256[](set.length);
        for (uint256 i = 0; i < set.length; i++) {
            s[i] = FHEext.fromExternalEuint256(set[i], proof);
        }
        return FHEext.allowToBytes32(FHE.isIn(FHEext.fromExternalEuint256(value, proof), s));
    }
}
