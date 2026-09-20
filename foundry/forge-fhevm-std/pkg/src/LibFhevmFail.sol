// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

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
            "Chain ", _uint(chainId), " carries ", _uint(groups.length), " FHEVM stacks: ", _join(groups), "."
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
        what[0] = string.concat("Chain ", _uint(chainId), " is not in the FHEVM chain table, and no dApp was named.");
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
        string memory expected,
        string memory actual
    ) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] =
            string.concat("The ", fhevmGroup, "/", chainAlias, " stack's ", contractName, " reports  \"", actual, "\"");
        what[1] = string.concat("this forge-fhevm-std is built against  \"", expected, "\"");
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
        fix[0] = string.concat("set  ", _upper(chainAlias), "_RPC_URL=https://...  in the environment, or");
        fix[1] = string.concat("add  [rpc_endpoints] ", chainAlias, " = \"https://...\"  to foundry.toml, or");
        fix[2] = "pass a chain from getFhevmChain(group, alias) rather than a hand-built one";
        return render("NO RPC URL", what, fix);
    }

    /// @notice `forkUnknown*` on a stack that knows every value.
    function notAFork(address executor) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "forkUnknown / forkUnknownDefault was called against the cleartext executor ", _addr(executor), "."
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
            "The local cleartext stack deploys from ", _addr(deployer), " at nonce ", _uint(expectedNonce), ","
        );
        what[1] = string.concat(
            "because every address is derived from that sequence; its nonce here is ", _uint(actualNonce), "."
        );
        what[2] = "This EVM already used that account: a reused anvil, or a chain with history.";
        string[] memory fix = new string[](3);
        fix[0] = "on anvil: restart it (or `anvil --state` from a clean snapshot),";
        fix[1] = "on a chain that already has the stack: fork it with fhevm.createSelectFork(getFhevmChain(...)),";
        fix[2] = "in a plain forge test: nothing should have touched that account before setUp";
        return render("LOCAL STACK CANNOT DEPLOY HERE", what, fix);
    }

    /// @notice The fork's executor address holds no code and the node is not anvil, so nothing can be deployed.
    function stackMissing(string memory fhevmGroup, string memory chainAlias, address executor)
        internal
        pure
        returns (string memory)
    {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "No FHEVM stack at ", fhevmGroup, "/", chainAlias, ": the executor ", _addr(executor), " has no code."
        );
        what[1] = "On an anvil node the SDK deploys the cleartext stack itself; this node did not answer";
        what[2] = "anvil_nodeInfo, so it is not anvil, and the SDK cannot put a stack on a chain it does not own.";
        string[] memory fix = new string[](3);
        fix[0] =
            "start a local node:  anvil        then fork it:  fhevm.createSelectFork(getFhevmChain(\"local\", \"anvil\"))";
        fix[1] = "or fork a chain that has the stack (getFhevmChain(\"testnet\", \"sepolia\"), \"mainnet\"),";
        fix[2] = "or check the FhevmChain you passed: its addresses may belong to another chain";
        return render("NO FHEVM STACK ON THIS CHAIN", what, fix);
    }

    /// @notice The stack was deployed into the anvil fork but did not appear on the node.
    function anvilMirrorFailed(address acl) internal pure returns (string memory) {
        string[] memory what = new string[](3);
        what[0] = string.concat(
            "The cleartext stack was deployed into the fork, but the node still has no code at ", _addr(acl), "."
        );
        what[1] = "The SDK writes the stack onto an anvil node with anvil_setCode / anvil_setStorageAt /";
        what[2] = "anvil_setNonce; one of them was refused, or the node is not anvil after all.";
        string[] memory fix = new string[](3);
        fix[0] = "run a plain `anvil` (no --no-storage-caching quirks, no proxy in front of it),";
        fix[1] = "or keep the stack in the fork only:  fhevm.setAnvilMirror(false)  before forking,";
        fix[2] = "or deploy onto the node yourself:  host-contracts-cleartext/v13/scripts/anvil.sh";
        return render("ANVIL MIRROR FAILED", what, fix);
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

    // -- Formatting helpers (no forge cheat here: this must render from any context, `pure`) ---------------

    function _forkId(uint256 id) private pure returns (string memory) {
        return id == type(uint256).max ? "NO_FORK" : _uint(id);
    }

    function _uint(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 n = v;
        uint256 len;
        while (n != 0) {
            len++;
            n /= 10;
        }
        bytes memory b = new bytes(len);
        while (v != 0) {
            b[--len] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(b);
    }

    function _addr(address a) private pure returns (string memory) {
        bytes16 hexChars = "0123456789abcdef";
        bytes memory b = new bytes(42);
        b[0] = "0";
        b[1] = "x";
        uint160 v = uint160(a);
        for (uint256 i = 41; i > 1; i--) {
            b[i] = hexChars[v & 0xf];
            v >>= 4;
        }
        return string(b);
    }

    function _upper(string memory str) private pure returns (string memory) {
        bytes memory b = bytes(str);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x61 && b[i] <= 0x7A) b[i] = bytes1(uint8(b[i]) - 32);
        }
        return string(b);
    }

    function _join(string[] memory parts) private pure returns (string memory out) {
        for (uint256 i = 0; i < parts.length; i++) {
            out = string.concat(out, i == 0 ? "" : ", ", parts[i]);
        }
    }
}
