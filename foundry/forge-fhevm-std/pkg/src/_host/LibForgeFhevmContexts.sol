// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {IACL} from "./_internal/interfaces/IACL.sol";
import {IInputVerifier} from "./_internal/interfaces/IInputVerifier.sol";
import {IKMSVerifier} from "./_internal/interfaces/IKMSVerifier.sol";
import {IProtocolConfig} from "./_internal/interfaces/IProtocolConfig.sol";
import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";

/**
 * @title LibForgeFhevmContexts
 * @dev "Context" here is the HOST CONTRACTS' word — a registered signer set with an id — not an execution
 *      context (in-memory chain or fork) in forge-fhevm-std's sense. This library is what the SDK runs on
 *      any non-cleartext stack it points at, forked or deployed in memory alike.
 * @notice Re-registers a production host's signer sets — its coprocessor CONTEXT and its KMS CONTEXT, in
 *         the host contracts' own vocabulary (`defineNewContext`, `defineNewKmsContext`) — as the
 *         cleartext ones, so that proofs
 *         can be signed locally with keys this project derives.
 *
 * @dev WHY THIS IS NEEDED. A production stack verifies input proofs against the coprocessor signers it
 *      has registered, and nobody outside Zama holds those private keys. `LibForgeFhevmSigners` can
 *      only sign as the cleartext signers, so on a fork the two sets have to be made the same set. The
 *      direction is fixed: the chain is changed to match the keys, never the reverse.
 *
 * @dev WHY NO STORAGE PATCHING. `InputVerifier.defineNewContext` is `onlyACLOwner`, and `onlyACLOwner`
 *      is `msg.sender == Ownable2StepUpgradeable(acl).owner()` — so a prank is the whole of it. Going
 *      through the contract's own setter keeps its invariants (the `isSigner` map, the threshold
 *      bounds) rather than writing slots behind its back, and survives a layout change.
 *
 * @dev LOCAL ONLY. `prank` is a cheatcode and the write never leaves the machine: the forked chain is
 *      untouched. This is the same reasoning as every other write in a fork test.
 *
 * @dev THE TWO HALVES LIVE ON DIFFERENT CONTRACTS. Coprocessor signers belong to `InputVerifier`
 *      itself; KMS signers do not belong to `KMSVerifier` at all — it forwards every read to
 *      `ProtocolConfig`, so that is what the KMS half rewrites. Both are gated the same way, by the
 *      ACL owner, which is why one prank serves for either.
 */
library LibForgeFhevmContexts {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    // ---------------------------------------------------------------------------------------------
    // The cleartext side: what this project can sign as
    // ---------------------------------------------------------------------------------------------

    /// @notice The coprocessor signers a cleartext deployment registers.
    /// @dev Exposed so a caller never has to reach into `_internal` to learn what it is comparing
    ///      against. Same source as `ForgeFhevmDeploy`, so the two cannot drift.
    function cleartextCoprocessorSigners() internal pure returns (address[] memory) {
        return LocalHostBootstrap.coprocessorSigners();
    }

    /// @notice The threshold a cleartext deployment registers alongside them.
    function cleartextCoprocessorThreshold() internal pure returns (uint256) {
        return LocalHostBootstrap.COPROCESSOR_THRESHOLD;
    }

    // ---------------------------------------------------------------------------------------------
    // The forked side: reading and rewriting it
    // ---------------------------------------------------------------------------------------------

    /// @notice The address `onlyACLOwner` compares `msg.sender` against.
    function aclOwner(address acl) internal view returns (address) {
        return IACL(acl).owner();
    }

    /**
     * @notice Registers the cleartext coprocessor signers on a forked `InputVerifier`.
     *
     * @dev Replaces the set wholesale — `defineNewContext` is not additive — so afterwards the ONLY
     *      accepted signers are the cleartext ones. That is deliberate: a set mixing real and derived
     *      signers would let a proof pass for reasons the test did not intend.
     */
    function defineCleartextCoprocessorContext(address inputVerifier, address acl) internal {
        address[] memory signers = cleartextCoprocessorSigners();
        uint256 threshold = cleartextCoprocessorThreshold();

        fvm.prank(aclOwner(acl));
        IInputVerifier(inputVerifier).defineNewContext(signers, threshold);
    }

    // ---------------------------------------------------------------------------------------------
    // The KMS half
    // ---------------------------------------------------------------------------------------------

    /// @notice The KMS nodes a cleartext deployment registers.
    /// @dev The same four lists `ForgeFhevmDeploy` seeds `ProtocolConfig` with at genesis, so a
    ///      forked host ends up carrying the context a local one is born with.
    function cleartextKmsNodes() internal pure returns (IProtocolConfig.KmsNode[] memory nodes) {
        address[] memory signers = LocalHostBootstrap.kmsSigners();
        address[] memory txSenders = LocalHostBootstrap.kmsTxSenders();
        string[] memory ips = LocalHostBootstrap.kmsIpAddresses();
        string[] memory urls = LocalHostBootstrap.kmsStorageUrls();

        nodes = new IProtocolConfig.KmsNode[](LocalHostBootstrap.KMS_NODE_COUNT);
        for (uint256 i = 0; i < nodes.length; i++) {
            nodes[i] = IProtocolConfig.KmsNode({
                txSenderAddress: txSenders[i], signerAddress: signers[i], ipAddress: ips[i], storageUrl: urls[i]
            });
        }
    }

    /// @notice The thresholds that go with them: every one is the node count.
    function cleartextKmsThresholds() internal pure returns (IProtocolConfig.KmsThresholds memory) {
        uint256 count = LocalHostBootstrap.KMS_NODE_COUNT;
        return
            IProtocolConfig.KmsThresholds({publicDecryption: count, userDecryption: count, kmsGen: count, mpc: count});
    }

    /**
     * @notice Registers the cleartext KMS nodes on a forked `ProtocolConfig`.
     *
     * @dev ONE CALL IS ENOUGH because `defineNewKmsContext` activates what it creates — the new id is
     *      `++currentKmsContextId` — so the verifier's `getKmsSigners`, `getThreshold` and
     *      `getCurrentKmsContextId` all move together, and the `extraData` a proof carries names the
     *      new context without anything else being told.
     *
     * @dev THE ADDRESS IS A PARAMETER, unlike the local `protocolConfigAdd` constant: each deployment
     *      has its own `ProtocolConfig`, and mainnet's is not Sepolia's.
     */
    function defineCleartextKmsContext(address protocolConfig, address acl) internal {
        IProtocolConfig.KmsNode[] memory nodes = cleartextKmsNodes();
        IProtocolConfig.KmsThresholds memory thresholds = cleartextKmsThresholds();

        fvm.prank(aclOwner(acl));
        IProtocolConfig(protocolConfig).defineNewKmsContext(nodes, thresholds);
    }

    /**
     * @notice Whether `kmsVerifier` now answers with exactly the cleartext KMS context.
     *
     * @dev Asked of the VERIFIER rather than of `ProtocolConfig`, because the verifier is what a
     *      prover reads — and the forwarding is precisely what could be wrong.
     */
    function hasCleartextKmsContext(address kmsVerifier) internal view returns (bool) {
        if (IKMSVerifier(kmsVerifier).getThreshold() != cleartextKmsThresholds().publicDecryption) return false;

        address[] memory expected = LocalHostBootstrap.kmsSigners();
        address[] memory actual = IKMSVerifier(kmsVerifier).getKmsSigners();
        if (actual.length != expected.length) return false;

        for (uint256 i = 0; i < expected.length; i++) {
            if (actual[i] != expected[i]) return false;
        }
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // Both at once
    // ---------------------------------------------------------------------------------------------

    /// @notice Rewrites both signer sets, which is what a fork needs before any proof can be built.
    /// @dev Both or neither: a host with only one half swapped accepts inputs it cannot decrypt, or
    ///      the reverse, and the failure surfaces far from the cause.
    function defineCleartextContexts(address inputVerifier, address protocolConfig, address acl) internal {
        defineCleartextCoprocessorContext(inputVerifier, acl);
        defineCleartextKmsContext(protocolConfig, acl);
    }

    /**
     * @notice Whether `inputVerifier` currently registers exactly the cleartext context.
     *
     * @dev Order matters and is checked: `defineNewContext` stores the array as given, and a set that
     *      merely contains the same addresses is not the same context — `randomCoprocessorSignatures`
     *      picks by index.
     */
    function hasCleartextCoprocessorContext(address inputVerifier) internal view returns (bool) {
        if (IInputVerifier(inputVerifier).getThreshold() != cleartextCoprocessorThreshold()) return false;

        address[] memory expected = cleartextCoprocessorSigners();
        address[] memory actual = IInputVerifier(inputVerifier).getCoprocessorSigners();
        if (actual.length != expected.length) return false;

        for (uint256 i = 0; i < expected.length; i++) {
            if (actual[i] != expected[i]) return false;
        }
        return true;
    }
}
