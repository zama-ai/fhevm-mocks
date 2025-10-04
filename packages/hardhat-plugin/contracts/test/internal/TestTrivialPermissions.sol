// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract TestTrivialPermissions is SepoliaConfig {
    euint32 private _xEuint32;

    constructor() {
        _xEuint32 = FHE.asEuint32(123);
    }

    function getXEuint32() public view returns (euint32) {
        return _xEuint32;
    }

    function computeFheAdd() public {
        _xEuint32 = FHE.add(_xEuint32, 42);
        FHE.allowThis(_xEuint32);
    }
}
