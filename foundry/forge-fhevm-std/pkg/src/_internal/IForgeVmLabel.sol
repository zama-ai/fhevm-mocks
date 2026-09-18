// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm} from "../_host/IForgeVm.sol";

/// ----------------------------------------------------------------------------
///   ⚠️ Private Interface:
///     - Should not be exposed to the public
///     - not maintained
///     - can change at any time
/// ----------------------------------------------------------------------------

/// @notice The by-label `createWallet`, which `IForgeVm` does not declare.
///
/// @dev `IForgeVm` lives under `_host/`, which is generated from the host payload, and it carries
///      only what that payload needs — the by-key overload. Deriving a wallet from a NAME is
///      forge-fhevm-std's own convenience, so it is declared here instead.
///
///      The derivation is `keccak256(abi.encodePacked(label))`, byte-identical to forge-std's
///      `makeAddrAndKey`, so the two name the same account. Going through the cheatcode rather than
///      recomputing it keeps that true even if forge-std changes: there is one derivation, not a copy.
///      It also labels the account, so traces print the name instead of the address.
interface IForgeVmLabel {
    /// @dev Declared `view` where forge-std declares it mutating, so callers can stay `view`. The
    ///      cheatcode is reached by STATICCALL and still works — verified, labelling included — because
    ///      what it touches is forge's own bookkeeping, not EVM state.
    function createWallet(string calldata walletLabel) external view returns (IForgeVm.Wallet memory wallet);
}
