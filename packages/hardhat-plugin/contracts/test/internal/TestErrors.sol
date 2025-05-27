// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import { SepoliaFHEVMConfig } from "@fhevm/solidity/config/FHEVMConfig.sol";
import { SepoliaZamaOracleAddress } from "@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol";

contract TestErrors is SepoliaFHEVMConfig {
    euint64 private _aCypherTextUint64;
    uint64 private _aClearTextUint64;
    euint64 private _bCypherTextUint64;
    uint64 private _bClearTextUint64;

    constructor() {
        FHE.setDecryptionOracle(SepoliaZamaOracleAddress);
    }

    function initCypherTextUint64NoAllow(uint64 value) public {
        _aCypherTextUint64 = FHE.asEuint64(value);
    }

    function initCypherTextUint64WithAllow(uint64 value) public {
        _aCypherTextUint64 = FHE.asEuint64(value);
        FHE.allowThis(_aCypherTextUint64);
    }

    function add(uint64 value) public {
        _bCypherTextUint64 = FHE.add(_aCypherTextUint64, value);
    }
}
