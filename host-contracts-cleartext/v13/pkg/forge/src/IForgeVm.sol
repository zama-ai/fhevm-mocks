// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title IForgeVm
 * @notice The subset of forge's cheatcode interface `FhevmDeploy.sol` calls.
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
/// @dev Cheat code address: `address(uint160(uint256(keccak256("hevm cheat code"))))`. File-level so a
///      library can bind it too — `ForgeVmBase` is for contracts, which inherit `fvm` from it instead.
address constant FORGE_VM_ADDRESS = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D;

interface IForgeVm {
    // Reads. `view` here because forge-std declares them `view`.

    /// @notice Nonce of `account`.
    function getNonce(address account) external view returns (uint64 nonce);
    /// @notice A pseudo-random word. `view` in forge-std even though it advances forge's own state, which
    ///         is what lets a `view` caller use it.
    function randomUint() external view returns (uint256);
    /// @notice Raw storage `slot` of `target`, used to read the ERC-1967 implementation pointer.
    function load(address target, bytes32 slot) external view returns (bytes32 data);

    // Keys and signatures, for building input proofs. `pure` here because forge-std declares them `pure`,
    // even though `deriveKey` reads the caller's mnemonic — matching it keeps a `view` caller working.

    /// @notice Address for a private key.
    function addr(uint256 privateKey) external pure returns (address);
    /// @notice Signs `digest` with `privateKey`, returning a split ECDSA signature.
    function sign(uint256 privateKey, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);
    /// @notice Derives a private key from `mnemonic` at `derivationPath` + `index`. The protocol's signer
    ///         pools do NOT sit on the default HD path, so this overload is the one that matters.
    function deriveKey(string calldata mnemonic, string calldata derivationPath, uint32 index)
        external
        pure
        returns (uint256 privateKey);

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

    // Gas metering. Plain `external`, so a caller cannot be `view`: the price of keeping the emulation
    // libraries out of a test's gas figure.

    /// @notice Stops counting gas until `resumeGasMetering`. Not nested: a caller already paused resumes
    ///         early when the callee resumes, so the libraries that use this must not be called from a
    ///         paused region.
    function pauseGasMetering() external;
    /// @notice Resumes counting gas after `pauseGasMetering`.
    function resumeGasMetering() external;
}
