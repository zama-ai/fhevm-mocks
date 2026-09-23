// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title IForgeVm
 * @notice The subset of forge's cheatcode interface `ForgeFhevmDeploy.sol` calls.
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
    /// @notice The identifier of the fork currently selected.
    /// @dev    REVERTS when none is — which is the point: it is how a test tells an in-memory EVM from
    ///         a chain it forked. Call it through a low-level `staticcall` and read the success flag.
    function activeFork() external view returns (uint256 forkId);

    /// @notice `vm.envOr(name, defaultValue)` — the environment variable as a bool, or the default
    ///         when it is unset. Never reverts on absence, which is the point.
    function envOr(string calldata name, bool defaultValue) external view returns (bool value);
    /// @notice A pseudo-random word. `view` in forge-std even though it advances forge's own state, which
    ///         is what lets a `view` caller use it.
    function randomUint() external view returns (uint256);

    /// @dev Layout must match forge-std's `VmSafe.Wallet`.
    struct Wallet {
        address addr;
        uint256 publicKeyX;
        uint256 publicKeyY;
        uint256 privateKey;
    }

    /// @dev The only way to reach a secp256k1 PUBLIC key from Solidity: `addr` is a one-way hash of it.
    function createWallet(uint256 privateKey) external returns (Wallet memory wallet);
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

    // Forks and nodes, for `LibForgeFhevmAnvil`. `rpc` speaks to the endpoint behind the active fork.

    // Text, for building JSON-RPC parameters. `pure` here because forge-std declares them `pure`.

    function toString(address value) external pure returns (string memory stringifiedValue);
    function toString(bytes32 value) external pure returns (string memory stringifiedValue);
    function toString(bytes calldata value) external pure returns (string memory stringifiedValue);

    /// @notice Sets `block.number`. Used to move a fresh anvil off block 0, which the executor's
    ///         `blockhash(block.number - 1)` cannot survive.
    function roll(uint256 newHeight) external;

    /// @notice A raw JSON-RPC call to the active fork's provider. The result is the cheat's encoding of the
    ///         JSON value, so a bare `true` arrives as one word rather than as ABI `bytes` — call it
    ///         low-level and decode by what the method is known to answer.
    function rpc(string calldata method, string calldata params) external returns (bytes memory data);

    // -- State diffs, for mirroring a deploy onto a node ------------------------------------------------
    //
    // Layout must match forge-std's `VmSafe` field for field: the cheatcode ABI-encodes these, so a
    // divergence decodes into silent nonsense rather than a revert. Copied verbatim.

    enum AccountAccessKind {
        Call,
        DelegateCall,
        CallCode,
        StaticCall,
        Create,
        SelfDestruct,
        Resume,
        Balance,
        Extcodesize,
        Extcodehash,
        Extcodecopy
    }

    struct ChainInfo {
        uint256 forkId;
        uint256 chainId;
    }

    struct StorageAccess {
        address account;
        bytes32 slot;
        bool isWrite;
        bytes32 previousValue;
        bytes32 newValue;
        bool reverted;
    }

    struct AccountAccess {
        ChainInfo chainInfo;
        AccountAccessKind kind;
        address account;
        address accessor;
        bool initialized;
        uint256 oldBalance;
        uint256 newBalance;
        bytes deployedCode;
        uint256 value;
        bytes data;
        bool reverted;
        StorageAccess[] storageAccesses;
        uint64 depth;
        uint64 oldNonce;
        uint64 newNonce;
    }

    /// @notice Starts recording every account and storage access, so a deploy can be replayed elsewhere.
    function startStateDiffRecording() external;

    /// @notice Everything accessed since `startStateDiffRecording`, in order.
    function stopAndReturnStateDiff() external returns (AccountAccess[] memory accountAccesses);
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
