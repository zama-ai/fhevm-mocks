// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IMultiSig {
    function getOwners() external view returns (address[] memory);
}

contract MultiSigHelper is ZamaEthereumConfig {
    IMultiSig public immutable multiSig;

    constructor(address _multiSig) {
        multiSig = IMultiSig(_multiSig);
    }

    function allowForMultiSig(externalEuint64 inputHandle, bytes memory inputProof) external {
        euint64 handle = FHE.fromExternal(inputHandle, inputProof);
        FHE.allow(handle, address(multiSig));
        address[] memory owners = getMultiSigOwners();
        uint256 numOwners = owners.length;
        for (uint256 i; i < numOwners; i++) {
            FHE.allow(handle, owners[i]);
        }
    }

    function getMultiSigOwners() internal view returns (address[] memory) {
        return multiSig.getOwners();
    }
}
