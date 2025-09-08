// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { ConfidentialGovernorAlpha } from "../../governance/ConfidentialGovernorAlpha.sol";
import { FHE } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract TestConfidentialGovernorAlpha is SepoliaConfig, ConfidentialGovernorAlpha {
    constructor(
        address owner_,
        address timelock_,
        address confidentialERC20Votes_,
        uint256 votingPeriod_,
        uint256 maxDecryptionDelay_
    ) ConfidentialGovernorAlpha(owner_, timelock_, confidentialERC20Votes_, votingPeriod_, maxDecryptionDelay_) {
        //
    }
}
