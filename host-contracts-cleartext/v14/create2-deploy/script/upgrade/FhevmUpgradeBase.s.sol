// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {console} from "forge-std/Script.sol";
import {FhevmRepointBase} from "../repoint/FhevmRepointBase.s.sol";
import {UpgradeInitData} from "./UpgradeInitData.sol";
import {IWiredProtocolConfig} from "../Interfaces.sol";
import {ProtocolConfig} from "../../../pkg/src/contracts/ProtocolConfig.sol";
import {IProtocolConfig} from "../../../pkg/src/contracts/interfaces/IProtocolConfig.sol";
import {KmsNode, KmsNodeParams, PcrValues} from "../../../pkg/src/contracts/shared/Structs.sol";

/**
 *  The v13 -> v14 CREATE2 upgrade, as the re-point engine runs it: the hooks of `FhevmRepointBase` overridden
 *  with this generation's table, its reinitializers and its KMS migration.
 *
 *  Every script of the upgrade — compute, creates, precheck, materialize, verify — is the engine's script with
 *  these hooks, so a check and the operation it checks cannot disagree about what "the upgrade" is.
 */
abstract contract FhevmUpgradeBase is FhevmRepointBase {
    // ---------------------------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------------------------

    /**
     * Seven live proxies re-pointed by the atomic upgrade, in ACLOwner.Op order. v14 creates no proxy.
     */
    function _upgradeProxyRoles() internal pure returns (string[] memory roles) {
        roles = new string[](7);
        roles[0] = R_PROTOCOL_CONFIG;
        roles[1] = R_KMS_GENERATION;
        roles[2] = R_ACL;
        roles[3] = R_FHEVM_EXECUTOR;
        roles[4] = R_HCU_LIMIT;
        roles[5] = R_KMS_VERIFIER;
        roles[6] = R_CLEARTEXT_ARITHMETIC;
    }

    /// @dev The table's artifacts, index-aligned with `_upgradeProxyRoles()`: the deploy path's own, by role.
    function _upgradeImplArtifact(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "pkg/src/contracts/ProtocolConfig.sol:ProtocolConfig";
        if (i == 1) return "pkg/src/contracts/KMSGeneration.sol:KMSGeneration";
        if (i == 2) return "pkg/src/cleartext/CleartextACL.sol:CleartextACL";
        if (i == 3) return "pkg/src/cleartext/CleartextFHEVMExecutor.sol:CleartextFHEVMExecutor";
        if (i == 4) return "pkg/src/cleartext/CleartextHCULimit.sol:CleartextHCULimit";
        if (i == 5) return "pkg/src/cleartext/CleartextKMSVerifier.sol:CleartextKMSVerifier";
        if (i == 6) return "pkg/src/cleartext/CleartextArithmetic.sol:CleartextArithmetic";
        revert("FhevmUpgradeBase: implementation index out of range");
    }

    // ---------------------------------------------------------------------------------------
    // The engine's hooks
    // ---------------------------------------------------------------------------------------

    function _flowName() internal pure override returns (string memory) {
        return "upgrade";
    }

    /// @dev The table, whatever the live stack runs: every one of the seven moves to this generation.
    function _candidateRoles() internal pure override returns (string[] memory) {
        return _upgradeProxyRoles();
    }

    function _keepRole(string memory, address) internal pure override returns (bool) {
        return true;
    }

    function _repointRoles() internal pure override returns (string[] memory) {
        return _upgradeProxyRoles();
    }

    /// @dev Op i's reinitializer; op 0's carries the sealed migration.
    function _initData(uint256 i, string memory) internal view override returns (bytes memory) {
        return UpgradeInitData.initData(i, i == 0 ? _protocolConfigInit() : bytes(""));
    }

    function _initName(uint256 i, string memory) internal pure override returns (string memory) {
        return UpgradeInitData.initName(i);
    }

    function _liveStateFresh() internal view override returns (bool ok, string memory why) {
        (ok, why) = _migrationMatchesLive();
        if (ok) why = "sealed KMS migration still matches the live ProtocolConfig";
    }

    /// @dev Op 0's payload: `reinitializeV2` promotes the live context into the epoch model, no context id.
    function _protocolConfigInit() internal view returns (bytes memory) {
        return abi.encodeCall(
            ProtocolConfig.reinitializeV2, (_migrationNodes(), _migrationSoftwareVersion(), _migrationPcrValues())
        );
    }

    // ---------------------------------------------------------------------------------------
    // The sealed KMS migration, from FHEVM_MIGRATION_*
    // ---------------------------------------------------------------------------------------

    function _migrationContextId() internal view returns (uint256) {
        return vm.envUint("FHEVM_MIGRATION_CONTEXT_ID");
    }

    /// @dev The sealed node set: the live signers, widened with the four v14 members the coordinator sealed.
    function _migrationNodes() internal view returns (KmsNodeParams[] memory nodes) {
        uint256 count = vm.envUint("FHEVM_MIGRATION_NODE_COUNT");
        require(count != 0, "FhevmUpgradeBase: sealed migration has no KMS nodes");
        nodes = new KmsNodeParams[](count);
        for (uint256 i; i < count; i++) {
            string memory prefix = string.concat("FHEVM_MIGRATION_NODE_", vm.toString(i));
            nodes[i] = KmsNodeParams({
                txSenderAddress: vm.envAddress(string.concat(prefix, "_TX_SENDER")),
                signerAddress: vm.envAddress(string.concat(prefix, "_SIGNER")),
                ipAddress: vm.envString(string.concat(prefix, "_IP")),
                storageUrl: vm.envString(string.concat(prefix, "_STORAGE")),
                partyId: int32(vm.envInt(string.concat(prefix, "_PARTY_ID"))),
                mpcIdentity: vm.envString(string.concat(prefix, "_MPC_IDENTITY")),
                caCert: vm.envBytes(string.concat(prefix, "_CA_CERT")),
                storagePrefix: vm.envString(string.concat(prefix, "_STORAGE_PREFIX"))
            });
        }
    }

    function _migrationSoftwareVersion() internal view returns (string memory) {
        return vm.envString("FHEVM_MIGRATION_SOFTWARE_VERSION");
    }

    /// @dev The sealed enclave measurements; empty for a cleartext stack.
    function _migrationPcrValues() internal view returns (PcrValues[] memory pcrs) {
        uint256 count = vm.envUint("FHEVM_MIGRATION_PCR_COUNT");
        pcrs = new PcrValues[](count);
        for (uint256 i; i < count; i++) {
            string memory prefix = string.concat("FHEVM_MIGRATION_PCR_", vm.toString(i));
            pcrs[i] = PcrValues({
                pcr0: vm.envBytes(string.concat(prefix, "_0")),
                pcr1: vm.envBytes(string.concat(prefix, "_1")),
                pcr2: vm.envBytes(string.concat(prefix, "_2"))
            });
        }
    }

    function _migrationSigners() internal view returns (address[] memory signers) {
        KmsNodeParams[] memory nodes = _migrationNodes();
        signers = new address[](nodes.length);
        for (uint256 i; i < nodes.length; i++) {
            signers[i] = nodes[i].signerAddress;
        }
    }

    function _migrationThresholds() internal view returns (IProtocolConfig.KmsThresholds memory) {
        return IProtocolConfig.KmsThresholds({
            publicDecryption: vm.envUint("FHEVM_MIGRATION_PUBLIC_DECRYPTION_THRESHOLD"),
            userDecryption: vm.envUint("FHEVM_MIGRATION_USER_DECRYPTION_THRESHOLD"),
            kmsGen: vm.envUint("FHEVM_MIGRATION_KMS_GEN_THRESHOLD"),
            mpc: vm.envUint("FHEVM_MIGRATION_MPC_THRESHOLD")
        });
    }

    /// @dev What `reinitializeV2` anchors: `keccak256(abi.encode(nodes, thresholds, softwareVersion, pcrValues))`.
    function _migrationContextInfoHash() internal view returns (bytes32) {
        return keccak256(
            abi.encode(_migrationNodes(), _migrationThresholds(), _migrationSoftwareVersion(), _migrationPcrValues())
        );
    }

    /**
     * @dev Is the sealed migration still what the live v13 ProtocolConfig holds? `compute` checked this when it
     *      sealed; days may pass before materialize, and a signer rotation in between would make the
     *      re-declared context describe a set the chain no longer runs. Returns why not, for a require or a report.
     */
    function _migrationMatchesLive() internal view returns (bool ok, string memory why) {
        IWiredProtocolConfig live = IWiredProtocolConfig(existingProtocolConfig);
        address[] memory liveSigners = live.getKmsSigners();
        address[] memory sealedSigners = _migrationSigners();
        if (liveSigners.length != sealedSigners.length) {
            return (false, "sealed migration signer count differs from live ProtocolConfig");
        }
        for (uint256 i; i < sealedSigners.length; i++) {
            if (liveSigners[i] != sealedSigners[i]) {
                return (false, "sealed migration signer differs from live ProtocolConfig");
            }
        }
        if (live.getCurrentKmsContextId() != _migrationContextId()) {
            return (false, "sealed migration context id differs from live ProtocolConfig");
        }
        IProtocolConfig.KmsThresholds memory t = _migrationThresholds();
        if (
            t.publicDecryption != live.getPublicDecryptionThreshold()
                || t.userDecryption != live.getUserDecryptionThreshold() || t.kmsGen != live.getKmsGenThreshold()
                || t.mpc != live.getMpcThreshold()
        ) {
            return (false, "sealed migration thresholds differ from live ProtocolConfig");
        }
        return _migrationNodesMatch(live.getKmsNodesForContext(_migrationContextId()));
    }

    /**
     * @dev Do the sealed nodes describe `liveNodes`, index by index? The four fields v13 stores per node —
     *      signer, tx sender, ip and storage url — must be exactly what the chain holds: `reinitializeV2`
     *      writes none of them, it only anchors and announces them, so a sealed value the chain does not
     *      hold would make the anchor and the NewKmsContext event describe a node set nobody runs. The
     *      four v14 members are not stored anywhere and remain the operator's to review at the gate.
     */
    function _migrationNodesMatch(KmsNode[] memory liveNodes) internal view returns (bool ok, string memory why) {
        KmsNodeParams[] memory nodes = _migrationNodes();
        if (liveNodes.length != nodes.length) {
            return (false, "sealed migration node count differs from live ProtocolConfig");
        }
        for (uint256 i; i < nodes.length; i++) {
            string memory n = string.concat("sealed migration node ", vm.toString(i), " ");
            if (liveNodes[i].signerAddress != nodes[i].signerAddress) {
                return (false, string.concat(n, "signerAddress differs from live ProtocolConfig"));
            }
            if (liveNodes[i].txSenderAddress != nodes[i].txSenderAddress) {
                return (false, string.concat(n, "txSenderAddress differs from live ProtocolConfig"));
            }
            if (keccak256(bytes(liveNodes[i].ipAddress)) != keccak256(bytes(nodes[i].ipAddress))) {
                return (false, string.concat(n, "ipAddress differs from live ProtocolConfig"));
            }
            if (keccak256(bytes(liveNodes[i].storageUrl)) != keccak256(bytes(nodes[i].storageUrl))) {
                return (false, string.concat(n, "storageUrl differs from live ProtocolConfig"));
            }
        }
        return (true, "");
    }

    /// @dev The sealed migration, printed by the gate after the op list.
    function _printMigration() internal view {
        KmsNodeParams[] memory nodes = _migrationNodes();
        PcrValues[] memory pcrs = _migrationPcrValues();
        IProtocolConfig.KmsThresholds memory t = _migrationThresholds();
        console.log("");
        console.log("  init parameters (ProtocolConfig.reinitializeV2):");
        console.log("    live contextId    ", _migrationContextId());
        for (uint256 i; i < nodes.length; i++) {
            console.log(string.concat("    kmsNodeParams[", vm.toString(i), "]"));
            console.log("        signer        ", nodes[i].signerAddress);
            console.log("        txSender      ", nodes[i].txSenderAddress);
            console.log(string.concat("        ip             ", nodes[i].ipAddress));
            console.log(string.concat("        storage        ", nodes[i].storageUrl));
            console.log("        partyId       ", vm.toString(nodes[i].partyId));
            console.log(string.concat("        mpcIdentity    ", nodes[i].mpcIdentity));
            console.log(string.concat("        caCert         ", vm.toString(nodes[i].caCert)));
            console.log(string.concat("        storagePrefix  ", nodes[i].storagePrefix));
        }
        console.log(string.concat("    softwareVersion   ", _migrationSoftwareVersion()));
        console.log("    pcrValues         ", pcrs.length);
        console.log("    thresholds  publicDecryption", t.publicDecryption);
        console.log("                userDecryption  ", t.userDecryption);
        console.log("                kmsGen          ", t.kmsGen);
        console.log("                mpc             ", t.mpc);
        console.log(string.concat("    anchor contextInfoHash  ", vm.toString(_migrationContextInfoHash())));
        console.log("    the six other ops take no arguments (reinitializers)");
    }
}
