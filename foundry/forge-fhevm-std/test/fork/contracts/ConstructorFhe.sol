// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @notice A dApp whose FHE work happens in its CONSTRUCTOR, so a processor armed after deployment
///         would never see it.
contract ConstructorFhe is ZamaEthereumConfig {
    euint8 private _value;

    constructor(uint8 initial) {
        _value = FHE.asEuint8(initial);
        FHE.allowThis(_value);
    }

    function value() external view returns (euint8) {
        return _value;
    }
}
