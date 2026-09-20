// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// 💬 ABOUT
// Forge Fhevm Std's default Test.

// 🧩 MODULES
import {ForgeFhevmDeploy} from "./_host/ForgeFhevmDeploy.sol";
import {ForgeVmBase} from "./_host/ForgeVmBase.sol";
import {StdFhevmBase} from "./StdFhevmBase.sol";
import {StdFhevmChains} from "./StdFhevmChains.sol";
import {fhevm} from "./FhevmVm.sol";
import {ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS} from "./_host/ForgeFhevmDeploy.sol";
import {DEPLOYER_ADDRESS, DEPLOYER_START_NONCE} from "./_host/_internal/LocalHostAddresses.sol";
import {LibFhevmFail} from "./LibFhevmFail.sol";
import {StdFhevmEncrypt} from "./StdFhevmEncrypt.sol";
import {StdFhevmDecryptPublic} from "./StdFhevmDecryptPublic.sol";
import {StdFhevmCheatsSafe} from "./StdFhevmCheats.sol";
import {StdFhevmDecrypt} from "./StdFhevmDecrypt.sol";
import {LibFhevmProtocol} from "./LibFhevmProtocol.sol";

// 🧩 HELPERS - re-export — load-bearing, do not remove as "unused".
// forge-lint: disable-start(unused-import)
import {EncryptedInput} from "./LibEncryptedInput.sol";
import {Plaintexts} from "./LibPlaintexts.sol";
import {SignedDecryptionPermit} from "./StdFhevmDecrypt.sol";
import {TransportKeypair} from "./StdFhevmDecrypt.sol";
import {TypedValue} from "./TypedValue.sol";

abstract contract StdFhevm is
    ForgeFhevmDeploy,
    StdFhevmChains,
    StdFhevmEncrypt,
    StdFhevmDecryptPublic,
    StdFhevmDecrypt,
    StdFhevmCheatsSafe
{
    /**
     * @dev THE JOIN POINT of two inheritance paths to `ForgeVmBase`: `ForgeFhevmDeploy` (generated, keeps
     *      the payload's transient counter) and the `StdFhevm*` mixins (through `StdFhevmBase`, the
     *      counter in `fhevm`). Solc requires the contract that joins them to name the winner; it is
     *      `StdFhevmBase`, always — one counter (rules.md §2.3).
     */
    function _enterUnmetered() internal override(ForgeVmBase, StdFhevmBase) {
        StdFhevmBase._enterUnmetered();
    }

    function _exitUnmetered() internal override(ForgeVmBase, StdFhevmBase) returns (bool wasOutermost) {
        return StdFhevmBase._exitUnmetered();
    }

    /**
     * @notice THE DEFAULT STACK: the local cleartext one, deployed and declared here, at construction.
     *
     * @dev The default is always this stack, and a fork operation on `fhevm` is what moves the test off
     *      it. Deployed in the constructor rather than `setUp` so that a test which forks in its own
     *      `setUp` and never calls `super.setUp()` still starts from a defined stack, and so that the
     *      fork's stack is a CHANGE from something, not a first assignment. A fork test pays the local
     *      deploy once per test contract, in the pre-fork state it then leaves.
     */
    constructor() {
        // The chain table is this contract's (RPC URLs, overrides); `fhevm` gets a copy of the addresses so
        // it can resolve a fork's stack on its own. Refreshed after every `setFhevmChain`.
        fhevm.setChainTable(fhevmChains());

        // BORN ON A FORK — `forge test --fork-url <url>` — the chain is a real one: deploy nothing, point
        // nothing. The stack is resolved at the first SDK entry like any URL-only fork's (from the dApp the
        // entry names, else the chain table), and anvil behind `--fork-url` is provisioned like any anvil
        // fork. Deploying the local cleartext stack here would put a mock on a real chain's fork, at
        // addresses a dApp compiled for that chain never calls.
        if (fhevm.isForked()) return;

        // IN MEMORY: the local cleartext stack is the default. Said HERE, with the fix, rather than by the
        // deploy's own `require` one call deeper: the deployer's nonce is where every local address comes
        // from, and a moved nonce means this EVM has history.
        uint64 nonce = fvm.getNonce(DEPLOYER_ADDRESS);
        if (nonce != DEPLOYER_START_NONCE) {
            revert(LibFhevmFail.localStackCannotDeploy(DEPLOYER_ADDRESS, DEPLOYER_START_NONCE, nonce));
        }
        deployLocalFhevm();
        LibFhevmProtocol.setProtocol(ACL_ADDRESS, FHEVM_EXECUTOR_ADDRESS, KMS_VERIFIER_ADDRESS);
    }

    /// @dev Keeps `fhevm`'s copy of the table in step with an override.
    function setFhevmChain(string memory chainAlias, FhevmChainData memory chain) internal virtual override {
        super.setFhevmChain(chainAlias, chain);
        fhevm.setChainTable(fhevmChains());
    }
}
