// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// Not wired into the build, not compiled, not tested.

import {console} from "forge-std/Script.sol";
import {FhevmVerifyBase} from "./FhevmVerifyBase.s.sol";
import {LibFhevmCleartextConfig as C} from "../../pkg/forge/src/shared/LibFhevmCleartextConfig.sol";
import {
    IOwnable2Step,
    IPauserSet,
    IACLOwner,
    IEIP712Domain,
    IWiredHCULimit,
    IWiredInputVerifier,
    IWiredKMSVerifier,
    IWiredProtocolConfig
} from "./Interfaces.sol";
import {KmsNode} from "../../pkg/src/contracts/shared/Structs.sol";

/**
 * @title FhevmVerify
 * @notice The terminal conditions. Reverts non-zero if any is unmet; the run is not
 *         "complete" until this passes.
 *
 * Read-only, no broadcast, no key. Runs against the chain and the MANIFEST — never against the
 * constants the deploy scripts used. That separation is the point: the deploy's own `require`s
 * compare what it just did against the same values it did it with, so they cannot catch a stack
 * built from a stale seal. Same reason VerifyFhevmDeploy.s.sol is separate on the nonce path.
 *
 * Run it twice — once at FHEVM_CONFIRMATIONS depth right after the deploy, and once at
 * greater depth at the end. Sepolia reorgs.
 */
contract FhevmVerify is FhevmVerifyBase {
    function run() external {
        _loadConfig();
        string memory manifest = _loadManifest();

        _banner("Verify");

        address acl = _readManifestAddress(manifest, R_ACL);
        address pauserSet = _readManifestAddress(manifest, R_PAUSER_SET);
        address aclOwner = _readManifestAddress(manifest, R_ACL_OWNER);

        // The factory preflight, repeated so `verify` standing alone is a complete statement about the chain.
        // The coordinator gates on this BEFORE deploying; this is the after-the-fact record. A different
        // contract squatting 0x4e59... on some testnet is the one realistic way it actually fires.
        _expectFactoryPresent();
        _checkCode(manifest);
        bool materialized = _checkMaterialized(manifest);
        if (materialized) {
            _expectWiring(manifest);
            _checkCleartextConfig(manifest);
        } else {
            console.log("  ---- baked-in address checks skipped: the stack is not materialized (step D)");
        }

        _checkOwnership(acl, aclOwner);
        _checkPausers(pauserSet, aclOwner);

        _summary("every terminal condition for the deploy");
        _mainnetReplayNotice();
    }

    // ---------------------------------------------------------------------------------------

    /**
     * @dev Code at every address the deploy is responsible for: each proxy, each proxy's implementation,
     *      and the four singletons that are not proxies at all.
     */
    function _checkCode(string memory manifest) private {
        string[] memory proxyRoles = _allProxyRoles();
        string[] memory roles = new string[](proxyRoles.length * 2 + 4);
        uint256 n;
        for (uint256 i = 0; i < proxyRoles.length; i++) {
            roles[n++] = proxyRoles[i];
            roles[n++] = _implRole(proxyRoles[i]);
        }
        roles[n++] = R_PAUSER_SET;
        roles[n++] = R_ACL_OWNER;
        roles[n++] = R_IMPL_EMPTY_ACL;
        roles[n++] = R_IMPL_EMPTY_SHARED;
        require(n == roles.length, "FhevmVerify: role list arity");
        _expectCodeAt(manifest, roles);
    }

    /// @dev Every proxy, since a deploy materializes all of them at once (step D).
    function _checkMaterialized(string memory manifest) private returns (bool) {
        return _expectImplementations(manifest, _allProxyRoles()) == 0;
    }

    /**
     * @dev Every value step D seeded into storage, against LibFhevmCleartextConfig (`C`): the signer sets,
     *      thresholds, EIP-712 domains, KMS node metadata and HCU limits. The signer sets are DERIVED FROM
     *      THE MNEMONIC rather than read off a generated file.
     *
     *      LocalHostBootstrap holds the same addresses, and step D seeded the chain from it — which
     *      is precisely why comparing against it here would be weak. It is a generated mirror; if it
     *      were regenerated wrongly, or generated from a different mnemonic, the chain and the mirror
     *      would agree with each other and both be wrong. Deriving from each pool's mnemonic, path and
     *      first index in LibFhevmCleartextConfig checks the chain against the ACTUAL source, independently of
     *      whatever the build happened to bake in — which is "chosen, not inherited" applied to
     *      the one part of the config that only exists in storage.
     *
     *      Why it matters: these keys are what make the stack SDK-compatible. The
     *      js-sdk cleartext relayer derives its own keys from this mnemonic at these paths and looks
     *      a signer up by the address the chain reports. Seed a different set and everything else in
     *      this file still passes — the stack deploys, verifies against itself, and fails only when
     *      the relayer arrives. It is also why this stack is testnet-only: the mnemonic is published,
     *      so on mainnet these are keys everyone has.
     *
     *      Not checked, because it never reaches the chain: CLEARTEXT_RELAYER_URL.
     */
    function _checkCleartextConfig(string memory manifest) private {
        address[] memory coprocessors = _derive(
            C.CLEARTEXT_COPROCESSORS_MNEMONIC,
            C.CLEARTEXT_COPROCESSORS_MNEMONIC_PATH,
            C.CLEARTEXT_COPROCESSORS_MNEMONIC_INDEX,
            C.CLEARTEXT_COPROCESSOR_COUNT
        );
        address[] memory kmsSigners = _derive(
            C.CLEARTEXT_KMS_NODES_MNEMONIC,
            C.CLEARTEXT_KMS_NODES_MNEMONIC_PATH,
            C.CLEARTEXT_KMS_NODES_MNEMONIC_INDEX,
            C.CLEARTEXT_KMS_NODE_COUNT
        );
        uint256 kms = C.CLEARTEXT_KMS_NODE_COUNT;

        // InputVerifier: the coprocessor set, its threshold, and the domain input proofs are signed in.
        address inputVerifier = _readManifestAddress(manifest, R_INPUT_VERIFIER);
        _expectSignerSet(
            IWiredInputVerifier(inputVerifier).getCoprocessorSigners(),
            coprocessors,
            "InputVerifier.getCoprocessorSigners()"
        );
        _expectUint(
            IWiredInputVerifier(inputVerifier).getThreshold(),
            C.CLEARTEXT_COPROCESSOR_THRESHOLD,
            "InputVerifier.getThreshold()"
        );
        _expectDomain(inputVerifier, C.CLEARTEXT_INPUT_VERIFICATION_ADDRESS, "InputVerifier");

        // KMSVerifier: its domain, and the KMS set as it reads it through ProtocolConfig.
        address kmsVerifier = _readManifestAddress(manifest, R_KMS_VERIFIER);
        _expectDomain(kmsVerifier, C.CLEARTEXT_DECRYPTION_ADDRESS, "KMSVerifier");
        _expectSignerSet(IWiredKMSVerifier(kmsVerifier).getKmsSigners(), kmsSigners, "KMSVerifier.getKmsSigners()");
        _expectUint(IWiredKMSVerifier(kmsVerifier).getThreshold(), kms, "KMSVerifier.getThreshold()");

        // ProtocolConfig: the KMS set, every per-node field, and every threshold, which is the node count.
        IWiredProtocolConfig pc = IWiredProtocolConfig(_readManifestAddress(manifest, R_PROTOCOL_CONFIG));
        _expectSignerSet(pc.getKmsSigners(), kmsSigners, "ProtocolConfig.getKmsSigners()");
        _expectKmsNodes(pc.getKmsNodesForContext(pc.getCurrentKmsContextId()), kmsSigners);
        _expectUint(pc.getPublicDecryptionThreshold(), kms, "ProtocolConfig publicDecryption threshold");
        _expectUint(pc.getUserDecryptionThreshold(), kms, "ProtocolConfig userDecryption threshold");
        _expectUint(pc.getKmsGenThreshold(), kms, "ProtocolConfig kmsGen threshold");
        _expectUint(pc.getMpcThreshold(), kms, "ProtocolConfig mpc threshold");

        // HCULimit: the three limits.
        IWiredHCULimit hcu = IWiredHCULimit(_readManifestAddress(manifest, R_HCU_LIMIT));
        _expectUint(hcu.getGlobalHCUCapPerBlock(), C.CLEARTEXT_HCU_CAP_PER_BLOCK, "HCULimit.getGlobalHCUCapPerBlock()");
        _expectUint(hcu.getMaxHCUDepthPerTx(), C.CLEARTEXT_MAX_HCU_DEPTH_PER_TX, "HCULimit.getMaxHCUDepthPerTx()");
        _expectUint(hcu.getMaxHCUPerTx(), C.CLEARTEXT_MAX_HCU_PER_TX, "HCULimit.getMaxHCUPerTx()");
    }

    /// @dev The EIP-712 domain a verifier's signatures are made in: the gateway chain and the gateway contract.
    function _expectDomain(address verifier, address verifyingContract, string memory name) private {
        (,,, uint256 chainId, address gotContract,,) = IEIP712Domain(verifier).eip712Domain();
        _expectUint(
            chainId, C.CLEARTEXT_GATEWAY_CHAIN_ID, string.concat(name, " EIP-712 domain chainId (gateway chain)")
        );
        _expectAddr(gotContract, verifyingContract, string.concat(name, " EIP-712 domain verifyingContract"));
    }

    /// @dev Every KMS node of the current context: tx sender, signer, and its one-based `${prefix}${i + 1}` IP and URL.
    function _expectKmsNodes(KmsNode[] memory nodes, address[] memory signers) private {
        uint256 count = C.CLEARTEXT_KMS_NODE_COUNT;
        if (nodes.length != count) {
            _expectUint(nodes.length, count, "ProtocolConfig KMS nodes - count");
            return;
        }
        address[] memory txSenders = _derive(
            C.CLEARTEXT_KMS_NODES_TX_SENDER_MNEMONIC,
            C.CLEARTEXT_KMS_NODES_TX_SENDER_MNEMONIC_PATH,
            C.CLEARTEXT_KMS_NODES_TX_SENDER_MNEMONIC_INDEX,
            count
        );
        address[] memory gotSenders = new address[](count);
        address[] memory gotSigners = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            gotSenders[i] = nodes[i].txSenderAddress;
            gotSigners[i] = nodes[i].signerAddress;
            string memory n = vm.toString(i + 1);
            _expectStr(
                nodes[i].ipAddress,
                string.concat(C.CLEARTEXT_KMS_NODE_IP_ADDRESS_PREFIX, n),
                string.concat("KMS node ", n, " ipAddress")
            );
            _expectStr(
                nodes[i].storageUrl,
                string.concat(C.CLEARTEXT_KMS_NODE_STORAGE_URL_PREFIX, n),
                string.concat("KMS node ", n, " storageUrl")
            );
        }
        _expectSignerSet(gotSenders, txSenders, "ProtocolConfig KMS nodes - txSenderAddress");
        _expectSignerSet(gotSigners, signers, "ProtocolConfig KMS nodes - signerAddress");
    }

    /**
     * @dev The terminal conditions, in full. The two `pendingOwner() == 0` checks are not tidiness: a dangling
     *      pending owner on either contract is a latent takeover — anyone holding that key can
     *      accept at any future moment — and it blocks completion.
     *
     *      `ACLOwner.owner() == admin` (not `pendingOwner == admin`) is what makes the admin's own
     *      `acceptOwnership()` transaction a gate rather than a suggestion. Until the admin has
     *      actually sent it, the deployer key is still root over the stack.
     */
    function _checkOwnership(address acl, address aclOwner) private {
        _expect(IOwnable2Step(acl).owner() == aclOwner, "ACL.owner() == ACLOwner");
        _expect(IOwnable2Step(acl).pendingOwner() == address(0), "ACL.pendingOwner() == 0");
        _expect(IACLOwner(aclOwner).owner() == cfg.admin, "ACLOwner.owner() == admin (admin accepted)");
        _expect(IACLOwner(aclOwner).pendingOwner() == address(0), "ACLOwner.pendingOwner() == 0");
        _expect(IACLOwner(aclOwner).ACL_ADDRESS() == acl, "ACLOwner.ACL_ADDRESS() == ACL");
    }

    /**
     * @dev The signer pool at an HD path, from its first index on, derived rather than read from the chain.
     *
     *      Deriving is the point: comparing the chain against itself would pass whatever it held. These are
     *      the keys the js-sdk cleartext relayer will use, so the question is whether the stack registered
     *      the addresses those keys produce.
     */
    function _derive(string memory mnemonic, string memory path, uint32 first, uint256 count)
        private
        pure
        returns (address[] memory out)
    {
        out = new address[](count);
        for (uint32 i = 0; i < count; i++) {
            out[i] = vm.addr(vm.deriveKey(mnemonic, path, first + i));
        }
    }

    function _checkPausers(address pauserSet, address aclOwner) private {
        _expect(IPauserSet(pauserSet).isPauser(aclOwner), "PauserSet.isPauser(ACLOwner)");
        if (cfg.pauser0 != address(0)) {
            _expect(IPauserSet(pauserSet).isPauser(cfg.pauser0), "PauserSet.isPauser(operator)");
        }
    }
}
