// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { ConfidentialVestingWallet } from "../../finance/ConfidentialVestingWallet.sol";
import { SepoliaFHEVMConfig } from "@fhevm/solidity/config/FHEVMConfig.sol";

contract TestConfidentialVestingWallet is SepoliaFHEVMConfig, ConfidentialVestingWallet {
    constructor(
        address beneficiary_,
        uint64 startTimestamp_,
        uint64 duration_
    ) ConfidentialVestingWallet(beneficiary_, startTimestamp_, duration_) {
        //
    }
}
