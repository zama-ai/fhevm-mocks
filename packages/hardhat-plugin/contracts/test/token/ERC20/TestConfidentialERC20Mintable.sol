// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { ConfidentialERC20Mintable } from "../../../token/ERC20/extensions/ConfidentialERC20Mintable.sol";
import { SepoliaFHEVMConfig } from "@fhevm/solidity/config/FHEVMConfig.sol";

contract TestConfidentialERC20Mintable is SepoliaFHEVMConfig, ConfidentialERC20Mintable {
    constructor(
        string memory name_,
        string memory symbol_,
        address owner_
    ) ConfidentialERC20Mintable(name_, symbol_, owner_) {}
}
