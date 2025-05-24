// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { ConfidentialERC20Wrapped } from "../../../token/ERC20/ConfidentialERC20Wrapped.sol";
import { FHE } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaFHEVMConfig } from "@fhevm/solidity/config/FHEVMConfig.sol";
import { SepoliaZamaOracleAddress } from "@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol";

contract TestConfidentialERC20Wrapped is SepoliaFHEVMConfig, ConfidentialERC20Wrapped {
    constructor(address erc20_, uint256 maxDecryptionDelay_) ConfidentialERC20Wrapped(erc20_, maxDecryptionDelay_) {
        FHE.setDecryptionOracle(SepoliaZamaOracleAddress);
    }
}
