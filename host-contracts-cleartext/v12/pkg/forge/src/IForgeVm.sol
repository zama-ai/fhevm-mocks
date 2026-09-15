// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title IForgeVm
 * @notice The subset of forge's cheatcode interface `FhevmCleartextDeploy.sol` calls.
 * @dev Vendored so `pkg/forge/src` has NO forge-std dependency, and modeled on forge-fhevm-std's
 *      `src/forge/IForgeVm.sol`. Hand-written and committed, so it sits here rather than under
 *      `_internal/`: nothing generates or re-derives it. Mirrored from `forge-std/Vm.sol`, so re-check it
 *      against that file when bumping the supported forge version.
 *
 *      This costs nothing in protection. forge-std's `Vm.sol` is declarations only, so it never shielded
 *      anyone from binary drift either, and a consumer's own `lib/forge-std` wins the remapping globally.
 *      Vendoring is the only way the payload uses declarations it controls.
 *
 *      Signatures and state mutability are copied from forge-std verbatim. Selectors ignore mutability, so
 *      this never changes dispatch, but matching it keeps a caller's `view` context working the same way.
 */
interface IForgeVm {
    // Reads. `view` here because forge-std declares them `view`.

    /// @notice Nonce of `account`.
    function getNonce(address account) external view returns (uint64 nonce);
    /// @notice Raw storage `slot` of `target`, used to read the ERC-1967 implementation pointer.
    function load(address target, bytes32 slot) external view returns (bytes32 data);

    // Mutating. `Vm`, not `VmSafe`: standing the stack up needs these.

    /// @notice Installs `newRuntimeBytecode` at `target` without running a constructor.
    function etch(address target, bytes calldata newRuntimeBytecode) external;
    /// @notice Sets `account`'s nonce, so a deploy sequence lands on its canonical addresses.
    function setNonce(address account, uint64 newNonce) external;
    /// @notice Sets `msg.sender` for the next call only.
    function prank(address msgSender) external;
    /// @notice Sets `msg.sender` for every call until `stopPrank`.
    function startPrank(address msgSender) external;
    /// @notice Ends the prank started by `startPrank`.
    function stopPrank() external;
}
