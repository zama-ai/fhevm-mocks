// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {VmSafe} from "forge-std/Vm.sol";

import {StdFhevmVersion} from "./StdFhevmVersion.sol";

/**
 * @title LibFhevmFail
 * @notice Every SETUP failure of forge-fhevm-std goes through here (rules.md 2.11): what happened, why it
 *         is refused, and the exact line that fixes it, in an ASCII box that forge prints verbatim.
 *
 * @dev WHY A STRING AND NOT A CUSTOM ERROR. A custom error reaches the user as a selector and ABI words;
 *      a revert string reaches them as text. For a failure whose cause is the test's own setup — the wrong
 *      fork cheat, the wrong stack, the wrong version — text is the only payload that lets a developer who
 *      has never read this package paste the message and know what to type next. Typed errors stay for
 *      what a test asserts on programmatically (an ACL refusal, an unknown handle).
 *
 * @dev ONE BUILDER PER FAILURE, used by the code that reverts AND by the test that expects it
 *      (`vm.expectRevert(bytes(LibFhevmFail.forkDrift(a, b)))`), so a reworded line changes one place.
 *      ASCII only: solc refuses non-ASCII in plain string literals, and terminals disagree on box-drawing.
 */
library LibFhevmFail {
    // forge-lint: disable-next-line(screaming-snake-case-const)
    VmSafe private constant vm = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    // -- The renderer -----------------------------------------------------------------------------------

    string private constant RULE = "+==============================================================================";
    string private constant THIN = "+------------------------------------------------------------------------------";

    /// @notice The box: a title bar, the `what` lines, a blank, the `fix` lines. Ragged right on purpose —
    ///         padding every line to a fixed width would truncate or wrap the one line the user needs whole.
    function render(string memory title, string[] memory what, string[] memory fix)
        internal
        pure
        returns (string memory out)
    {
        out = string.concat(
            "\n", RULE, "\n|  forge-fhevm-std ", StdFhevmVersion.VERSION, "  -  ", title, "\n", THIN, "\n"
        );
        for (uint256 i = 0; i < what.length; i++) {
            out = string.concat(out, "|  ", what[i], "\n");
        }
        out = string.concat(out, "|\n");
        for (uint256 i = 0; i < fix.length; i++) {
            out = string.concat(out, i == 0 ? "|  FIX  " : "|       ", fix[i], "\n");
        }
        out = string.concat(out, RULE, "\n");
    }

    /// @notice Renders and reverts.
    function setupError(string memory title, string[] memory what, string[] memory fix) internal pure {
        revert(render(title, what, fix));
    }

    // -- The failures -------------------------------------------------------------------------------------

    /// @notice The active fork is not the one `fhevm` switched to.
    function forkDrift(uint256 activeForkId, uint256 expectedForkId) internal pure returns (string memory) {
        string[] memory what = new string[](4);
        what[0] =
            string.concat("The active fork (id ", _forkId(activeForkId), ") was entered or selected through `vm`,");
        what[1] = string.concat("not `fhevm` (which last switched to ", _forkId(expectedForkId), ").");
        what[2] = "Its FHE events were not drained and its stack was never named, so the SDK";
        what[3] = "cannot know what to encrypt against or decrypt from.";
        string[] memory fix = new string[](3);
        fix[0] = "replace  vm.createSelectFork(url, block)";
        fix[1] = "with     fhevm.createSelectFork(getFhevmChain(\"testnet\", \"sepolia\"), block)";
        fix[2] = "and      vm.selectFork(id)  with  fhevm.selectFork(id)";
        return render("FORK DRIFT", what, fix);
    }

    /// @notice The chain is served by several FHEVM groups and no dApp was named to pick one.
    function ambiguousGroup(uint256 chainId, string[] memory groups) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "Chain ",
            vm.toString(chainId),
            " carries ",
            vm.toString(groups.length),
            " FHEVM stacks: ",
            _join(groups),
            "."
        );
        what[1] = "The fork was entered with a URL only, and the first SDK call named no dApp,";
        what[2] = "so nothing says which stack this test is on.";
        string[] memory fix = new string[](3);
        fix[0] = string.concat(
            "fork with the chain form:  fhevm.createSelectFork(getFhevmChain(\"", groups[0], "\", alias), block)"
        );
        fix[1] = "or make the first SDK call one that names the dApp:";
        fix[2] = "         encryptUint32(value, address(dapp), user)  -- its config picks the stack";
        return render("AMBIGUOUS FHEVM GROUP", what, fix);
    }

    /// @notice The chain is not in the chain table and no dApp was named.
    function unknownChain(uint256 chainId) internal pure returns (string memory) {
        string[] memory what = new string[](2);
        what[0] =
            string.concat("Chain ", vm.toString(chainId), " is not in the FHEVM chain table, and no dApp was named.");
        what[1] = "The SDK has no addresses to prepare this fork with.";
        string[] memory fix = new string[](3);
        fix[0] =
            "declare it once:  setFhevmChain(\"my_chain\", FhevmChainData({fhevmGroup: ..., chainId: ..., acl: ..., ...}))";
        fix[1] = "then fork with:   fhevm.createSelectFork(getFhevmChain(group, \"my_chain\"), block)";
        fix[2] = "or make the first SDK call one that names the dApp (its config holds the addresses)";
        return render("UNKNOWN FHEVM CHAIN", what, fix);
    }

    /// @notice The stack runs a protocol version this SDK does not vendor.
    function versionMismatch(
        string memory fhevmGroup,
        string memory chainAlias,
        string memory contractName,
        string memory floor,
        string memory ceiling,
        string memory actual
    ) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] =
            string.concat("The ", fhevmGroup, "/", chainAlias, " stack's ", contractName, " reports  \"", actual, "\"");
        what[1] = string.concat("this forge-fhevm-std accepts  \"", floor, "\"  up to  \"", ceiling, "\"");
        what[2] = "Proofs and digests would be built for the wrong ABI and fail far from here.";
        string[] memory fix = new string[](2);
        fix[0] = "upgrade forge-fhevm-std to a release that vendors this protocol version,";
        fix[1] = "or point the test at a group whose stack matches (getFhevmChain(\"testnet\", ...) / \"mainnet\")";
        return render("UNSUPPORTED PROTOCOL VERSION", what, fix);
    }

    /// @notice `registerFork` named a fork that is not the active one.
    function registeredForkNotActive(uint256 forkId, uint256 activeForkId) internal pure returns (string memory) {
        string[] memory what = new string[](2);
        what[0] = string.concat(
            "fhevm.registerFork(",
            _forkId(forkId),
            ", ...) was called while fork ",
            _forkId(activeForkId),
            " is active."
        );
        what[1] = "Preparing a stack means calling its contracts, which only exist on the active fork.";
        string[] memory fix = new string[](2);
        fix[0] = "fhevm.selectFork(id) first, or register right after vm.createSelectFork(...) returns,";
        fix[1] = "or skip both:  fhevm.createSelectFork(getFhevmChain(group, alias), block)";
        return render("REGISTERED FORK IS NOT ACTIVE", what, fix);
    }

    /// @notice A `FhevmChain` with no RPC URL was handed to `createSelectFork`.
    function noRpcUrl(string memory fhevmGroup, string memory chainAlias) internal pure returns (string memory) {
        string[] memory what = new string[](2);
        what[0] = string.concat("The FhevmChain for ", fhevmGroup, "/", chainAlias, " has an empty rpcUrl.");
        what[1] = "getFhevmChain(...) always fills one in; a struct built by hand may not.";
        string[] memory fix = new string[](3);
        fix[0] = string.concat("set  ", vm.toUppercase(chainAlias), "_RPC_URL=https://...  in the environment, or");
        fix[1] = string.concat("add  [rpc_endpoints] ", chainAlias, " = \"https://...\"  to foundry.toml, or");
        fix[2] = "pass a chain from getFhevmChain(group, alias) rather than a hand-built one";
        return render("NO RPC URL", what, fix);
    }

    /// @notice No RPC URL could be found for an alias: not in `foundry.toml`, not in the environment, and no
    ///         built-in default (a chain the SDK does not know, or one it deliberately gives no default for).
    function rpcUrlMissing(string memory chainAlias, string memory envName) internal pure returns (string memory) {
        string[] memory what = new string[](2);
        what[0] = string.concat("No RPC URL for chain alias \"", chainAlias, "\".");
        what[1] =
            string.concat("Not in [rpc_endpoints] of foundry.toml, ", envName, " is not set, and there is no default.");
        string[] memory fix = new string[](2);
        fix[0] = string.concat("add  [rpc_endpoints] ", chainAlias, " = \"https://...\"  to foundry.toml, or");
        fix[1] = string.concat("set  ", envName, "=https://...  in .env (forge loads it) or in the environment");
        return render("NO RPC URL FOR ALIAS", what, fix);
    }

    /// @notice `foundry.toml` declares the alias, but forge could not read it — typically an `${ENV_VAR}` in
    ///         the entry that is not set. Forge-std's rule, kept: a configured alias that cannot be read is a
    ///         misconfiguration to fix, never something to paper over with a default endpoint.
    function rpcUrlUnreadable(string memory chainAlias, string memory envName, string memory forgeError)
        internal
        pure
        returns (string memory)
    {
        string[] memory what = new string[](3);
        what[0] = string.concat("[rpc_endpoints] ", chainAlias, " is declared in foundry.toml but cannot be read:");
        what[1] = string.concat("  ", forgeError);
        what[2] = "A declared alias is never replaced by a default: fix the declaration, or drop it.";
        string[] memory fix = new string[](2);
        fix[0] = "set the variable the entry names, in .env (forge loads it) or in the environment, or";
        fix[1] = string.concat(
            "remove the entry and set  ", envName, "=https://...  (or rely on the SDK default, when there is one)"
        );
        return render("RPC ALIAS DECLARED BUT UNREADABLE", what, fix);
    }

    /// @notice `forkUnknown*` on a stack that knows every value.
    function notAFork(address executor) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "forkUnknown / forkUnknownDefault was called against the cleartext executor ", vm.toString(executor), "."
        );
        what[1] = "On a cleartext stack every value is known; there is nothing to state,";
        what[2] = "and stating one would hide a test that is confused about which stack it is on.";
        string[] memory fix = new string[](2);
        fix[0] = "read the value instead:  plaintextOf(value)";
        fix[1] = "or fork a real chain first:  fhevm.createSelectFork(getFhevmChain(\"testnet\", \"sepolia\"), block)";
        return render("NOT A FORK", what, fix);
    }

    /// @notice The local stack cannot be deployed because the deployer's nonce has moved.
    function localStackCannotDeploy(address deployer, uint64 expectedNonce, uint64 actualNonce)
        internal
        pure
        returns (string memory)
    {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "The local cleartext stack deploys from ",
            vm.toString(deployer),
            " at nonce ",
            vm.toString(expectedNonce),
            ","
        );
        what[1] = string.concat(
            "because every address is derived from that sequence; its nonce here is ", vm.toString(actualNonce), "."
        );
        what[2] = "This EVM already used that account: a reused anvil, or a chain with history.";
        string[] memory fix = new string[](3);
        fix[0] = "on anvil: restart it (or `anvil --state` from a clean snapshot),";
        fix[1] = "on a chain that already has the stack: fork it with fhevm.createSelectFork(getFhevmChain(...)),";
        fix[2] = "in a plain forge test: nothing should have touched that account before setUp";
        return render("LOCAL STACK CANNOT DEPLOY HERE", what, fix);
    }

    /// @notice The fork's executor address holds no code and the entry's addresses are not the canonical local
    ///         ones, so the SDK has nothing to deploy there: the cleartext stack only knows its own addresses.
    function stackMissing(string memory fhevmGroup, string memory chainAlias, address executor)
        internal
        pure
        returns (string memory)
    {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "No FHEVM stack at ", fhevmGroup, "/", chainAlias, ": the executor ", vm.toString(executor), " has no code."
        );
        what[1] = "The SDK deploys the cleartext stack only at its canonical local addresses; this entry names";
        what[2] = "others, so either the chain is not what the entry says, or the entry is wrong.";
        string[] memory fix = new string[](3);
        fix[0] = "check the FhevmChain you passed: its addresses may belong to another chain,";
        fix[1] = "or fork a chain that has the stack (getFhevmChain(\"testnet\", \"sepolia\"), \"mainnet\"),";
        fix[2] = "or, for a chain with no FHEVM protocol, name it with the local entry to get a cleartext stack";
        return render("NO FHEVM STACK ON THIS CHAIN", what, fix);
    }

    /// @notice The fork's executor holds no code, but the chain table says this chain HAS the protocol: the
    ///         cleartext stack must not be put where a live one belongs.
    function liveStackExists(uint256 chainId, string memory fhevmGroup, string memory chainAlias)
        internal
        pure
        returns (string memory)
    {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "Chain ", vm.toString(chainId), " carries the FHEVM protocol (", fhevmGroup, "/", chainAlias, "),"
        );
        what[1] = "yet the executor of the entry you forked with has no code. The SDK will not deploy the";
        what[2] = "cleartext stack on a chain that has a live one: the mock must never shadow the protocol.";
        string[] memory fix = new string[](3);
        fix[0] = string.concat(
            "fork the real stack:  fhevm.createSelectFork(getFhevmChain(\"", fhevmGroup, "\", \"", chainAlias, "\"))"
        );
        fix[1] = "if the executor is empty there too, the RPC is pruned or points at another chain,";
        fix[2] = "and for a cleartext stack over real DeFi, use a chain that has no FHEVM protocol, or anvil";
        return render("LIVE FHEVM STACK ON THIS CHAIN", what, fix);
    }

    /// @notice The stack was deployed into the anvil fork but did not appear on the node.
    function anvilMirrorFailed(address acl) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "The cleartext stack was deployed into the fork, but the node still has no code at ", vm.toString(acl), "."
        );
        what[1] = "The SDK writes the stack onto an anvil node with anvil_setCode / anvil_setStorageAt /";
        what[2] = "anvil_setNonce; one of them was refused, or the node is not anvil after all.";
        string[] memory fix = new string[](3);
        fix[0] = "run a plain `anvil` (no --no-storage-caching quirks, no proxy in front of it),";
        fix[1] = "or keep the stack in the fork only:  fhevm.setAnvilMirror(false)  before forking,";
        fix[2] = "or deploy onto the node yourself:  host-contracts-cleartext/v13/scripts/anvil.sh";
        return render("ANVIL MIRROR FAILED", what, fix);
    }

    /// @notice `fhevm.revertToState` was given a snapshot `fhevm.snapshotState` did not take.
    function unknownSnapshot(uint256 snapshotId) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] = string.concat("Snapshot ", vm.toString(snapshotId), " was not taken by fhevm.snapshotState().");
        what[1] = "Reverting a snapshot moves the test between execution contexts, and the SDK has to know";
        what[2] = "which one it lands in: forge's own fork pointer goes stale across such a revert.";
        string[] memory fix = new string[](2);
        fix[0] = "take it with  uint256 id = fhevm.snapshotState();  and revert with  fhevm.revertToState(id)";
        fix[1] = "(vm.snapshotState() / vm.revertToState() are the raw pair, and leave the SDK guessing)";
        return render("UNKNOWN SNAPSHOT", what, fix);
    }

    /**
     * @notice A revert would have taken the test back across the start of a fork, to the in-memory chain.
     *         Forge cannot restore that, so the SDK stops before the revert rather than after it.
     * @dev    Measured against raw forge, with none of this SDK involved: a revert to a pre-fork snapshot
     *         restores only the storage SLOTS the test happened to read before taking it. Everything
     *         else -- a contract deployed in a constructor, an implementation behind a proxy, a signer
     *         set nobody read -- comes back EMPTY, while `vm.activeFork()` still names the old fork and
     *         any fork created afterwards holds none of its chain's state. There is nothing to reconcile:
     *         the chain that comes back is not the one that was captured.
     */
    function cannotRevertPastFork(uint256 snapshotId) internal pure returns (string memory) {
        string[] memory what = new string[](4);
        what[0] =
            string.concat("Snapshot ", vm.toString(snapshotId), " was taken before this test forked, so reverting to");
        what[1] = "it would mean going back to the in-memory chain. Forge does not restore that: the local";
        what[2] = "stack would come back missing most of itself, and the tests that followed would run";
        what[3] = "against a chain that only looks right.";
        string[] memory fix = new string[](3);
        fix[0] = "put the in-memory work and the fork work in SEPARATE tests -- each starts fresh,";
        fix[1] = "and the local stack is there again at the top of the next one;";
        fix[2] = "snapshots taken ON a fork are restored correctly, including from another fork";
        return render("CANNOT REVERT PAST A FORK", what, fix);
    }

    /// @notice A stack was asked for and none is current.
    function noCurrentStack() internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] = "No FHEVM stack is current. This happens after fhevm.createSelectFork(url, ...) -- a URL";
        what[1] = "only -- and before the first SDK call resolved which stack the fork is on; or in a";
        what[2] = "contract that inherits no forge-fhevm-std mixin.";
        string[] memory fix = new string[](3);
        fix[0] = "fork with the chain form:  fhevm.createSelectFork(getFhevmChain(group, alias), block)";
        fix[1] = "or make an SDK call that names the dApp before reading the config,";
        fix[2] = "or inherit TestFhevm (local tests) so the local cleartext stack is current by default";
        return render("NO CURRENT STACK", what, fix);
    }

    /// @notice A decryption was asked of a stack that holds no cleartexts and has no replay yet.
    function noPlaintextsSource(address executor) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] = string.concat("The executor ", vm.toString(executor), " is not a cleartext one, so it holds no");
        what[1] = "cleartexts, and this context has no replay to rebuild them from: nothing can say what a";
        what[2] = "handle is worth here.";
        string[] memory fix = new string[](2);
        fix[0] = "point at the stack through fhevm:  fhevm.createSelectFork(getFhevmChain(group, alias), block)";
        fix[1] = "or  fhevm.useStack(chain)  for the active context";
        return render("NO PLAINTEXT SOURCE", what, fix);
    }

    /// @notice Nothing is etched at the `fhevm` address.
    function handleMissing() internal pure returns (string memory) {
        string[] memory what = new string[](2);
        what[0] = "Nothing is at the `fhevm` address: this contract inherits no forge-fhevm-std mixin,";
        what[1] = "so the constructor that puts the handle in place never ran.";
        string[] memory fix = new string[](2);
        fix[0] = "inherit TestFhevm (or a StdFhevm* mixin) in the contract that calls the SDK:";
        fix[1] = "its constructor puts the handle in place before any setUp or test runs";
        return render("FHEVM HANDLE MISSING", what, fix);
    }

    // -- Formatting, through forge's own cheats ------------------------------------------------------------
    //
    // `toString` and `toUppercase` are `pure` in forge-std's declarations, so a `pure` renderer may call
    // them: no hand-rolled digit loops, and an address comes out checksummed, the way every other tool
    // prints it.

    function _forkId(uint256 id) private pure returns (string memory) {
        return id == type(uint256).max ? "NO_FORK" : vm.toString(id);
    }

    function _join(string[] memory parts) private pure returns (string memory out) {
        for (uint256 i = 0; i < parts.length; i++) {
            out = string.concat(out, i == 0 ? "" : ", ", parts[i]);
        }
    }
}
