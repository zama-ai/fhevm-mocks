// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedSetter is ZamaEthereumConfig {
    euint64 public encryptedResult;

    function setEncryptedValue(externalEuint64 inputHandle, bytes memory inputProof) external {
        euint64 encryptedInput = FHE.fromExternal(inputHandle, inputProof);
        encryptedResult = FHE.add(encryptedInput, 42); // simulate some computation
        FHE.allowThis(encryptedResult);
        FHE.allow(encryptedResult, msg.sender);
    }
}
