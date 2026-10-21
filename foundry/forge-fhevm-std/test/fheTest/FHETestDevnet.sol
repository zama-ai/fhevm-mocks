// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig} from "@fhevm/solidity/lib/Impl.sol";
import {FHETest} from "./FHETest.sol";

/// @title FHETest, wired to the DEVNET stack of a chain that also carries the testnet one.
/// @notice Devnet and testnet share Sepolia's chain id, and `ZamaEthereumConfig` (inherited through `FHETest`)
///         picks a stack from `block.chainid` alone -- so on Sepolia it always picks TESTNET's. This variant
///         re-points the coprocessor config at construction, after the parent constructor has run, to the
///         stack it is given. Nothing else differs: every operation is `FHETest`'s.
/// @dev The addresses are constructor arguments, not constants: they come from the chain table at deploy
///      time (`deploy-sepolia.sh --group devnet`), which also reads them back off the deployed contract before
///      seeding. `confidentialProtocolId()` is still the parent's chain-id answer; the fork suites do not use it.
contract FHETestDevnet is FHETest {
    /// @notice Which stack this deployment is wired to. `CONTRACT_NAME` is the parent's constant and cannot be
    ///         overridden; `getCoprocessorConfig()` is the authoritative answer.
    string public constant STACK = "devnet";

    constructor(CoprocessorConfig memory config) {
        FHE.setCoprocessor(config);
    }
}
