// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {console} from "forge-std/Script.sol";
import {FhevmUpgradeChecks} from "./FhevmUpgradeChecks.s.sol";
import {IVersioned, IWiredInputVerifier, IWiredProtocolConfig} from "./Interfaces.sol";
import {IProtocolConfig} from "../../pkg/src/contracts/interfaces/IProtocolConfig.sol";

/**
 * @title  FhevmVerifyUpgrade
 * @notice The terminal conditions of an upgrade — the Solidity half.
 *
 * Read-only, no broadcast, no key.
 *
 * A deploy's verify asks "did this stack come into existence correctly". This asks a strictly harder
 * question: **did an existing stack change in exactly the intended ways, and in no others.** The second
 * half is what makes it hard, and it is why this shares no code with `FhevmVerify` — only the reporting
 * primitives in `FhevmVerifyBase`, and the upgrade's own checks in `FhevmUpgradeChecks`, which the gate
 * before materialize runs too.
 *
 * Two examples of how differently the same-looking check reads here:
 *
 *   - `FhevmVerify` DERIVES the signer sets from the published mnemonic, because a fresh deploy is
 *     supposed to hold exactly the keys that mnemonic produces. An upgrade cannot require that — a
 *     testnet stack need not have been deployed with our defaults — so it compares against the set
 *     `compute` snapshotted off the live chain instead. Deriving here would turn a survival check into an
 *     assertion about how the stack was born.
 *   - `FhevmVerify` checks `ACLOwner.owner() == cfg.admin`, i.e. the admin accepted. Here the invariant is
 *     that ownership did not MOVE, so the comparison is against the snapshot, not the config. Comparing
 *     to config would pass an upgrade that had quietly re-pointed ownership at the configured admin.
 *
 * ## The manifest fields this requires
 *
 * `FhevmComputeUpgradeAddresses.s.sol` and the coordinator seal these; this reads them and nothing else:
 *
 *   .address.<role>                  the 9 supplied live roles, and `IMPL_<role>` for each of the 7
 *                                    upgraded proxies
 *   .preUpgrade.admin                `ACLOwner.owner()` as it was BEFORE
 *   .preUpgrade.implementation.<r>   the ERC-1967 slot of each live proxy as it was before
 *   .preUpgrade.kmsSigners / .kmsThresholds.<name> / .migration.existingContextId
 *                                    `ProtocolConfig`'s, which the upgrade must carry through unchanged
 *   .preUpgrade.coprocessorSigners / .coprocessorThreshold
 *                                    `InputVerifier`'s, which the upgrade does not touch at all
 *
 * A snapshot taken by `compute` rather than by this script is deliberate and is the whole basis of the
 * check: by the time `verify` runs, the pre-upgrade values are gone from the chain. Reading them "before"
 * from inside an after-the-fact script is not possible, so the seal is the only witness — and it is
 * written before `materialize`, by a stage that cannot know what `materialize` will do.
 *
 * ## Independence
 *
 * The coordinator runs this against a FRESH `--out`, so `_checkSealedBuild` and `_checkDeployedCode` are
 * an independent recompile: the current checkout must reproduce the sealed init-code hashes, and the
 * code on chain must be that build's output. An auditor with the source, a node and the manifest can
 * re-run exactly this and needs to trust nothing the deploying machine kept.
 *
 * ## What is NOT here, and why
 *
 * The survey — every zero-argument getter on the live stack, unchanged — lives in
 * `upgrade-testnet.ts`, together with the event scans and the `--handle` value re-read. That split is a
 * capability constraint, not a preference: Solidity cannot enumerate an ABI, so a Solidity survey would be
 * a hand-maintained list of getters — exactly what the survey exists to avoid. The event scans need
 * `eth_getLogs` over the upgrade's block range, which is likewise a coordinator job.
 *
 * The consequence is that **this script passing is necessary and not sufficient.** It says the intended
 * changes happened; only the coordinator's passes say nothing else did.
 */
contract FhevmVerifyUpgrade is FhevmUpgradeChecks {
    function run() external {
        _loadUpgradeConfig();
        string memory manifest = _loadManifest();

        _banner("verify upgrade");

        _expectFactoryPresent();

        console.log("--- the sealed build ---");
        _checkSealedBuild(manifest);
        _checkDeployedCode(manifest);
        _checkImplementationIdentity(manifest);
        _checkImplementationWiring(manifest);
        _checkLiveCode(manifest);

        // Unlike a deploy, "not materialized" is not a state to report and carry on from — the stack is
        // then still the previous generation, and every check below would be answering about v13. Say so
        // once and stop, rather than emitting a wall of failures that all have one cause.
        console.log("--- the seven slots ---");
        if (_expectImplementations(manifest, _upgradeProxyRoles()) != 0) {
            _summary("the upgrade has been materialized");
            return;
        }
        _checkUntouchedProxies(manifest);

        console.log("--- the stack, after ---");
        _checkVersions(manifest);
        _expectWiring(manifest);
        _checkSurvivedValues(manifest);
        _checkKmsContextPromoted(manifest);
        _checkOwnershipUnchanged(manifest);
        _checkPausersUnchanged(manifest);

        _summary("every terminal condition for the upgrade");
        console.log("  NOT sufficient on its own: the survey and the event scans run in the");
        console.log("  coordinator. This says the intended changes happened, not that nothing else did.");
        _mainnetReplayNotice();
    }

    // ---------------------------------------------------------------------------------------
    // Checks
    // ---------------------------------------------------------------------------------------

    /**
     * @dev Code at everything this flow was HANDED rather than created.
     *
     *      On a deploy, no code at a role means "not deployed yet"; here it means the operator pointed
     *      `--acl` (or another flag) at something that is not a contract, which the supplied-address
     *      validation should have caught before any transaction. Re-asserting it lets this script stand
     *      alone as a statement about the chain. The seven creates are covered by `_checkSealedBuild`.
     */
    function _checkLiveCode(string memory manifest) private {
        _expectCodeAt(manifest, _allProxyRoles());
        string[] memory singletons = new string[](2);
        singletons[0] = R_PAUSER_SET;
        singletons[1] = R_ACL_OWNER;
        _expectCodeAt(manifest, singletons);
    }

    /**
     * @dev The versions each proxy now reports, against the generated `LocalHostVersions`.
     *
     *      The last lines are the interesting ones. They assert what did NOT move: `InputVerifier`,
     *      `CleartextDB` and `PauserSet` are absent from the op list, so a moved version there
     *      means something re-pointed a proxy nobody intended to touch — the failure mode that a list of
     *      only positive expectations cannot see.
     */
    function _checkVersions(string memory manifest) private {
        string[] memory upgraded = _upgradeProxyRoles();
        for (uint256 i; i < upgraded.length; i++) {
            _expectVersion(manifest, upgraded[i]);
        }
        string[] memory untouched = _untouchedProxyRoles();
        for (uint256 i; i < untouched.length; i++) {
            _expectVersion(manifest, untouched[i]);
        }
        _expectVersion(manifest, R_PAUSER_SET);
    }

    function _expectVersion(string memory manifest, string memory role) private {
        address a = _readManifestAddress(manifest, role);
        _expectStr(IVersioned(a).getVersion(), _versionFor(role), string.concat(role, ".getVersion()"));
    }

    /**
     * @dev The values that must come through the upgrade untouched, against `compute`'s snapshot.
     *
     *      `reinitializeV2` stores no new signer set or thresholds — it re-declares the live ones — so the
     *      KMS values here can only move if something other than the sealed op list ran. The check that
     *      binds the SEAL to the chain is `_checkKmsContextPromoted`, through the anchor hash.
     *
     *      `InputVerifier`'s coprocessor set is here for the same reason: nothing was supposed to touch it
     *      at all, so this is the check that its absence from the op list actually held.
     */
    function _checkSurvivedValues(string memory manifest) private {
        IWiredProtocolConfig pc = IWiredProtocolConfig(_readManifestAddress(manifest, R_PROTOCOL_CONFIG));
        _expectSignerSet(
            pc.getKmsSigners(),
            vm.parseJsonAddressArray(manifest, ".preUpgrade.kmsSigners"),
            "ProtocolConfig.getKmsSigners() == the pre-upgrade KMS set"
        );
        _expectUint(
            pc.getCurrentKmsContextId(),
            vm.parseUint(vm.parseJsonString(manifest, ".preUpgrade.migration.existingContextId")),
            "ProtocolConfig.getCurrentKmsContextId() == the pre-upgrade context id"
        );

        string memory t = ".preUpgrade.kmsThresholds.";
        _expectUint(
            pc.getPublicDecryptionThreshold(),
            vm.parseJsonUint(manifest, string.concat(t, "publicDecryption")),
            "publicDecryption threshold survived"
        );
        _expectUint(
            pc.getUserDecryptionThreshold(),
            vm.parseJsonUint(manifest, string.concat(t, "userDecryption")),
            "userDecryption threshold survived"
        );
        _expectUint(
            pc.getKmsGenThreshold(), vm.parseJsonUint(manifest, string.concat(t, "kmsGen")), "kmsGen threshold survived"
        );
        _expectUint(pc.getMpcThreshold(), vm.parseJsonUint(manifest, string.concat(t, "mpc")), "mpc threshold survived");

        IWiredInputVerifier iv = IWiredInputVerifier(_readManifestAddress(manifest, R_INPUT_VERIFIER));
        _expectSignerSet(
            iv.getCoprocessorSigners(),
            vm.parseJsonAddressArray(manifest, ".preUpgrade.coprocessorSigners"),
            "InputVerifier.getCoprocessorSigners() untouched"
        );
        _expectUint(
            iv.getThreshold(),
            vm.parseJsonUint(manifest, ".preUpgrade.coprocessorThreshold"),
            "InputVerifier.getThreshold() untouched"
        );
    }

    /**
     * @dev v14's intended change to the KMS state, and the one place the seal is bound to the chain.
     *
     *      `reinitializeV2` promotes the live context into the epoch model and anchors
     *      `keccak256(abi.encode(kmsNodeParams, thresholds, softwareVersion, pcrValues))`. The node
     *      metadata, software version and PCR values are readable no other way, so recomputing that hash
     *      from the SEALED migration and comparing is what proves the chain recorded what the operator
     *      reviewed at the gate — and nothing else.
     */
    function _checkKmsContextPromoted(string memory manifest) private {
        IWiredProtocolConfig pc = IWiredProtocolConfig(_readManifestAddress(manifest, R_PROTOCOL_CONFIG));
        uint256 sealedContextId = _migrationContextId();
        (uint256 contextId, uint256 epochId) = pc.getCurrentKmsContextAndEpoch();
        _expectUint(contextId, sealedContextId, "getCurrentKmsContextAndEpoch() reports the promoted context");
        _expect(epochId != 0, "getCurrentKmsContextAndEpoch() reports its first epoch");
        (uint256 emissionBlock, bytes32 contextInfoHash) = pc.getKmsContextAnchor(sealedContextId);
        _expect(emissionBlock != 0, "getKmsContextAnchor(contextId) was backfilled");
        _expect(
            contextInfoHash == _migrationContextInfoHash(),
            "getKmsContextAnchor(contextId).contextInfoHash == keccak256 of the sealed migration"
        );
    }
}
