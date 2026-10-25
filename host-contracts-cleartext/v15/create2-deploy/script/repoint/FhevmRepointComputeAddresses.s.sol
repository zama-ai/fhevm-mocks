// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {console} from "forge-std/Script.sol";
import {FhevmRepointBase} from "./FhevmRepointBase.s.sol";

/**
 *  Two-pass CREATE2 computation for re-pointing a supplied live stack.
 *
 *  Pass 1 writes the addresses file the implementations are compiled against (every live proxy, and the
 *  proxies the flow creates, predicted from committed bytecode: see `_newProxyEmptyImplCode`) and records
 *  its hash. Pass 2, after the rebuild, asserts that file did not move and that this build agrees with the
 *  committed bytecode the created proxies were predicted from, predicts the implementations and seals the
 *  manifest.
 */
abstract contract FhevmRepointComputeAddresses is FhevmRepointBase {
    function run() external {
        _loadUpgradeConfig();
        vm.createDir(cfg.outDir, true);
        uint256 pass = vm.envUint("FHEVM_PASS");
        if (pass == 1) _pass1();
        else if (pass == 2) _pass2();
        else revert("FhevmRepointComputeAddresses: FHEVM_PASS must be 1 or 2");
    }

    function _pass1() private {
        _banner(string.concat(_flowName(), " pass 1/2: live addresses"));
        _writeAddresses();

        string memory o = "upgradePass1";
        string memory out = vm.serializeBytes32(o, "addressesHash", _addressesHash());
        vm.writeJson(out, _scratchPath());

        console.log("  PROTOCOL_CONFIG_ADDRESS", existingProtocolConfig);
        console.log("  KMS_GENERATION_ADDRESS ", existingKmsGeneration);
        console.log(
            _newProxyRoles().length == 0 ? "  PADDED_INPUTTER_ADDRESS" : "  PADDED_INPUTTER_ADDRESS (created)",
            existingPaddedInputter
        );
        console.log("  wrote", _addressesPath());
    }

    function _pass2() private {
        _banner(string.concat(_flowName(), " pass 2/2: implementations, assert, seal"));
        string memory scratch = vm.readFile(_scratchPath());
        require(
            _addressesHash() == vm.parseJsonBytes32(scratch, ".addressesHash"),
            "upgrade pass2: addresses file moved since pass 1"
        );
        _requireNewProxyCodeIsThisBuild();

        // The candidates the flow considers, and the ones it keeps: an upgrade keeps its whole table, a hotfix
        // the roles whose implementation in this build is not the one the proxy runs.
        string[] memory candidates = _candidateRoles();
        string[] memory kept = new string[](candidates.length);
        address[] memory found = new address[](candidates.length);
        uint256 n;
        for (uint256 i; i < candidates.length; i++) {
            bytes memory code = _initCode(_implArtifactFor(candidates[i]));
            require(code.length != 0, string.concat("repoint pass2: missing artifact for ", candidates[i]));
            require(
                code.length <= MAX_INITCODE_SIZE, string.concat("repoint pass2: EIP-3860 overflow in ", candidates[i])
            );
            address implementation = _predictCreate2Address(_implRole(candidates[i]), code);
            if (!_keepRole(candidates[i], implementation)) {
                console.log(string.concat("  unchanged ", candidates[i]), implementation);
                continue;
            }
            kept[n] = candidates[i];
            found[n] = implementation;
            n++;
            console.log(string.concat("  IMPL_", candidates[i]), implementation);
        }
        require(n != 0, "nothing to re-point: every candidate already runs this build's implementation");
        string[] memory roles = new string[](n);
        address[] memory implementations = new address[](n);
        for (uint256 i; i < n; i++) {
            roles[i] = kept[i];
            implementations[i] = found[i];
        }

        _writeManifest(roles, implementations);
        console.log("  wrote", _manifestPath());
    }

    /**
     * @dev The created proxies were predicted from the COMMITTED bytecode; this build must produce the same.
     *      Not what makes the creates safe — `creates` re-derives each address from the code it sends, and
     *      refuses a mismatch — but a stale `LocalHostBytecode.sol` is better named here than as a drift there.
     */
    function _requireNewProxyCodeIsThisBuild() private view {
        if (_newProxyRoles().length == 0) return;
        require(
            keccak256(_newProxyEmptyImplCode()) == keccak256(_initCode(A_EMPTY_SHARED)),
            "repoint pass2: the committed EmptyUUPSProxy is not this build's (run make generate)"
        );
        address emptyImpl = _predictCreate2Address(R_UPGRADE_EMPTY, _newProxyEmptyImplCode());
        require(
            keccak256(_newProxyInitCode()) == keccak256(_proxyInitCode(emptyImpl, _sharedProxyInitData())),
            "repoint pass2: the committed ERC1967Proxy is not this build's (run make generate)"
        );
        console.log("  UPGRADE_EMPTY_UUPS_PROXY", emptyImpl);
    }

    /// @dev The addresses file as pass 1 wrote it, so pass 2 can tell a rebuild from a re-targeting.
    function _addressesHash() private view returns (bytes32) {
        return keccak256(bytes(vm.readFile(_addressesPath())));
    }

    function _writeAddresses() private {
        string memory source = string.concat(
            "// SPDX-License-Identifier: BSD-3-Clause-Clear\npragma solidity ^0.8.24;\n",
            "// Generated by FhevmRepointComputeAddresses; do not edit.\n"
        );
        source = string.concat(source, _constant(R_ACL, existingAcl));
        source = string.concat(source, _constant(R_FHEVM_EXECUTOR, existingExecutor));
        source = string.concat(source, _constant(R_KMS_VERIFIER, existingKmsVerifier));
        source = string.concat(source, _constant(R_INPUT_VERIFIER, existingInputVerifier));
        source = string.concat(source, _constant(R_HCU_LIMIT, existingHcuLimit));
        source = string.concat(source, _constant(R_PROTOCOL_CONFIG, existingProtocolConfig));
        source = string.concat(source, _constant(R_KMS_GENERATION, existingKmsGeneration));
        source = string.concat(source, _constant(R_CLEARTEXT_ARITHMETIC, existingArithmetic));
        source = string.concat(source, _constant(R_CLEARTEXT_DB, existingDb));
        source = string.concat(source, _constant(R_PADDED_INPUTTER, existingPaddedInputter));
        source = string.concat(source, _constant(R_PAUSER_SET, existingPauserSet));
        vm.writeFile(_addressesPath(), source);
    }

    function _constant(string memory name, address value) private pure returns (string memory) {
        return string.concat("address constant ", name, " = address(", vm.toString(value), ");\n");
    }

    function _writeManifest(string[] memory roles, address[] memory implementations) private {
        string memory addressMap = _serializeAddresses(roles, implementations);
        string memory o = "upgradeManifest";
        vm.serializeUint(o, "chainId", cfg.chainId);
        vm.serializeString(o, "version", cfg.version);
        vm.serializeString(o, "deploymentId", cfg.deploymentId);
        vm.serializeAddress(o, "deployer", cfg.deployer);
        vm.serializeAddress(o, "admin", cfg.admin);
        vm.serializeAddress(o, "factory", CREATE2_FACTORY);
        vm.serializeUint(o, "confirmations", cfg.confirmations);
        // The proxies this re-point moves, in op order: what every later script and the coordinator read back.
        vm.serializeString(o, "repointed", roles);
        // The proxies it creates first, over `UPGRADE_EMPTY_UUPS_PROXY`: their `.preUpgrade.implementation`.
        vm.serializeString(o, "created", _newProxyRoles());
        _sealExtras(o);
        string memory out = vm.serializeString(o, "address", addressMap);
        vm.writeJson(out, _manifestPath());
    }

    function _serializeAddresses(string[] memory roles, address[] memory implementations)
        private
        returns (string memory out)
    {
        string memory o = "upgradeAddressMap";
        vm.serializeAddress(o, R_ACL, existingAcl);
        vm.serializeAddress(o, R_FHEVM_EXECUTOR, existingExecutor);
        vm.serializeAddress(o, R_KMS_VERIFIER, existingKmsVerifier);
        vm.serializeAddress(o, R_INPUT_VERIFIER, existingInputVerifier);
        vm.serializeAddress(o, R_HCU_LIMIT, existingHcuLimit);
        vm.serializeAddress(o, R_PROTOCOL_CONFIG, existingProtocolConfig);
        vm.serializeAddress(o, R_KMS_GENERATION, existingKmsGeneration);
        vm.serializeAddress(o, R_CLEARTEXT_ARITHMETIC, existingArithmetic);
        vm.serializeAddress(o, R_CLEARTEXT_DB, existingDb);
        vm.serializeAddress(o, R_PADDED_INPUTTER, existingPaddedInputter);
        vm.serializeAddress(o, R_PAUSER_SET, existingPauserSet);
        vm.serializeAddress(o, R_ACL_OWNER, existingAclOwner);
        if (_newProxyRoles().length != 0) {
            vm.serializeAddress(o, R_UPGRADE_EMPTY, _predictCreate2Address(R_UPGRADE_EMPTY, _newProxyEmptyImplCode()));
        }

        require(implementations.length == roles.length, "FhevmRepointComputeAddresses: implementation arity");
        for (uint256 i; i + 1 < roles.length; i++) {
            vm.serializeAddress(o, _implRole(roles[i]), implementations[i]);
        }
        out = vm.serializeAddress(o, _implRole(roles[roles.length - 1]), implementations[roles.length - 1]);
    }
}
