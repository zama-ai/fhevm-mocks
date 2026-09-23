// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

import {ConfidentialERC20Mintable} from "./ERC20/extensions/ConfidentialERC20Mintable.sol";

/// @dev The fixture the hardhat suite deploys, copied verbatim so the ported tests exercise the same
///      contract. See `hardhat/v3/e2e/contracts/test/token/ERC20/TestConfidentialERC20Mintable.sol`.
contract TestConfidentialERC20Mintable is ZamaEthereumConfig, ConfidentialERC20Mintable {
    constructor(string memory name_, string memory symbol_, address owner_)
        ConfidentialERC20Mintable(name_, symbol_, owner_)
    {}
}
