// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { ConfidentialWETH } from "../../../token/ERC20/ConfidentialWETH.sol";
import { FHE } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { SepoliaZamaOracleAddress } from "@zama-fhe/oracle-solidity/address/ZamaOracleAddress.sol";

contract TestConfidentialWETH is SepoliaConfig, ConfidentialWETH {
    constructor(uint256 maxDecryptionDelay_) ConfidentialWETH(maxDecryptionDelay_) {
        FHE.setDecryptionOracle(SepoliaZamaOracleAddress);
    }
}
