// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";

/// @notice The deployed addresses of `fhevm-chains.config.json`, at the workspace root. A fork test reads them here
///         instead of pinning them, so that a redeploy moves the test with the config (see NR-91). foundry.toml
///         grants the read.
library FhevmChainsConfig {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @dev Relative to the project root, where forge resolves every file cheatcode path.
    string internal constant PATH = "../../fhevm-chains.config.json";

    /// @notice The address of the host contract `name` on the host chain `host` of the network group `group`, as
    ///         the config spells the three keys: `hostContract("devnet", "ethereum_sepolia", "acl")`. Reverts when
    ///         the config has no such key.
    function hostContract(string memory group, string memory host, string memory name) internal view returns (address) {
        string memory key = string.concat(".networks.", group, ".hosts.", host, ".contracts.", name, ".address");
        return VM.parseJsonAddress(VM.readFile(PATH), key);
    }
}
