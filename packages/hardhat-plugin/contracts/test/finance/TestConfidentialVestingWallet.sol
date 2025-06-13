// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { ConfidentialVestingWallet } from "../../finance/ConfidentialVestingWallet.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract TestConfidentialVestingWallet is SepoliaConfig, ConfidentialVestingWallet {
    constructor(
        address beneficiary_,
        uint64 startTimestamp_,
        uint64 duration_
    ) ConfidentialVestingWallet(beneficiary_, startTimestamp_, duration_) {
        //
    }
}
