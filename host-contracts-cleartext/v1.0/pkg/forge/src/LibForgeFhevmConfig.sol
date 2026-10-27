// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {CoprocessorConfig, LibFhevmCoprocessorConfig} from "./shared/LibFhevmCoprocessorConfig.sol";

/**
 * @title LibForgeFhevmConfig
 * @notice Reads the FHEVM config out of ANOTHER contract's storage.
 *
 * @dev WHY THIS NEEDS THE FORGE VM. `FHE` is an internal library: every call reads the three addresses
 *      from the CALLER's own storage, so a dApp's config is in the dApp, not in some registry. The EVM
 *      offers no way to read another account's storage from Solidity, which is why the caller-side
 *      getter can live in `shared/` and this one cannot.
 *
 * @dev WHAT IT IS FOR. A dApp compiled against `ZamaEthereumConfig` talks to mainnet's contracts
 *      whatever stack the test believes it is driving. Asking the dApp which addresses it actually
 *      holds turns that mismatch from a puzzling failure deep in `fromExternal` into one assertion.
 */
library LibForgeFhevmConfig {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    /// @notice The FHEVM config stored at `contractAddress`.
    /// @dev Zero addresses mean the contract was never configured — it inherits no config contract and
    ///      nothing called `setCoprocessor` on it. That is a finding, not an error, so it is returned
    ///      rather than rejected.
    function getCoprocessorConfig(address contractAddress) internal view returns (CoprocessorConfig memory config) {
        uint256 slot = uint256(LibFhevmCoprocessorConfig.COPROCESSOR_CONFIG_LOCATION);

        config = CoprocessorConfig({
            ACLAddress: _addressAt(contractAddress, slot),
            CoprocessorAddress: _addressAt(contractAddress, slot + 1),
            KMSVerifierAddress: _addressAt(contractAddress, slot + 2)
        });
    }

    /// @notice Whether `contractAddress` holds any config at all.
    function hasCoprocessorConfig(address contractAddress) internal view returns (bool) {
        return getCoprocessorConfig(contractAddress).CoprocessorAddress != address(0);
    }

    function _addressAt(address contractAddress, uint256 slot) private view returns (address) {
        return address(uint160(uint256(fvm.load(contractAddress, bytes32(slot)))));
    }
}
