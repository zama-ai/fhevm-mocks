// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig} from "@fhevm/solidity/lib/Impl.sol";

// Forge's own cheatcode address, `address(uint160(uint256(keccak256("hevm cheat code"))))`: forge places code
// there for the duration of a run, visible from EVERY contract — the test, a field initializer, a contract a
// factory created — and nothing anyone can deploy to on a real chain (no key, no CREATE preimage). Inlined
// rather than imported from forge-std, so a dApp compiled against this file pulls in no test library; the
// SDK's offline suite asserts it equals forge-std's `VM_ADDRESS`.
address constant FORGE_VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));

/// @dev The one cheatcode this file uses, declared here for the same reason the address is inlined.
interface IForgeEnv {
    function envOr(string calldata name, string calldata defaultValue) external view returns (string memory);
}

/**
 * @title   ZamaConfig — the forge-fhevm-std DEBUG build of `@fhevm/solidity/config/ZamaConfig.sol`.
 *
 * @notice  Upstream `ZamaConfig` (0.13.3), same library, same contracts, same functions, with two rules
 *          added: every constructor REVERTS unless it runs under forge, in the `fhevm-debug` profile; and a
 *          chain the table does not know resolves to the local cleartext stack — the one forge-fhevm-std
 *          provisions on a fork of a chain that has no FHEVM protocol.
 *
 * @dev NEVER DEPLOY A CONTRACT COMPILED AGAINST THIS FILE. It is reached only through a remapping in the
 *      `fhevm-debug` build profile (its own `out` and `cache_path`), and it defends itself four ways:
 *
 *        1. EVERY constructor here starts with `ZamaConfig.requireDebugBuild()`: forge's VM must hold code
 *           at `FORGE_VM_ADDRESS`. On ANY real chain — known to upstream or not — it does not, so
 *           construction reverts with `DebugConfigOnProductionChain` and nothing gets deployed. It crashes
 *           all the time, everywhere but under forge.
 *        2. Under forge, the same guard asks forge for `FOUNDRY_PROFILE` and requires `fhevm-debug`, the one
 *           profile whose remapping reaches this file. Any other profile — a default build importing the
 *           file directly, a script — reverts with `DebugConfigOutsideDebugProfile`. The debug config
 *           constructs only where it was meant to be reached.
 *        3. Both reverts carry `FHEVM_DEBUG_CONFIG`, so the marker is embedded in the bytecode of every
 *           contract compiled against this file. A deploy script or a CI step can refuse any artifact whose
 *           bytecode contains it (pkg/README.md, "Test on a chain that has no FHEVM protocol").
 *        4. Under the guard, on every chain the upstream table KNOWS — mainnet, Polygon, Sepolia, Amoy,
 *           31337 — it returns exactly what upstream returns, branch for branch; on a chain upstream refuses
 *           it returns the local addresses, the cleartext stack the SDK provisioned there. The divergence in
 *           RESULTS is confined to chains upstream refuses.
 *
 * @dev USABLE FROM ANYWHERE UNDER FORGE. The guard depends on forge alone, not on forge-fhevm-std's kernel:
 *      a dApp created in a test contract's field initializer (before any base constructor ran), or by a
 *      factory the test deployed, constructs the same as one created in `setUp`. Forge answers the
 *      environment cheatcode for all of them.
 *
 * @dev WHY NOT SIMPLY EDIT THE dApp. The dApp's bytecode must be the bytecode deployed; the only thing that
 *      may differ in a test build is this address table, and this file is the whole of that difference.
 */
library ZamaConfig {
    /// @notice Returned if the Zama protocol is not supported on the current chain. Kept for selector parity
    ///         with upstream; this build raises the two errors below in its place.
    error ZamaProtocolUnsupported();

    /**
     * @notice A contract compiled against the DEBUG config was constructed where forge's VM is absent: a real
     *         chain. This build must not exist there.
     * @param chainId The chain the constructor ran on.
     * @param marker  `FHEVM_DEBUG_CONFIG`, so the string is in the bytecode and a CI step can find it.
     */
    error DebugConfigOnProductionChain(uint256 chainId, string marker);

    /**
     * @notice A contract compiled against the DEBUG config was constructed under forge, but not in the
     *         `fhevm-debug` profile: a default build imported this file directly, or a script did.
     * @param foundryProfile What `FOUNDRY_PROFILE` held; empty when unset.
     * @param marker         `FHEVM_DEBUG_CONFIG`.
     */
    error DebugConfigOutsideDebugProfile(string foundryProfile, string marker);

    /// @notice The marker every contract compiled against this file carries in its bytecode.
    string internal constant FHEVM_DEBUG_CONFIG = "forge-fhevm-std DEBUG config: never deploy";

    /// @notice The one profile allowed to construct against this file.
    string internal constant FHEVM_DEBUG_PROFILE = "fhevm-debug";

    /**
     * @notice The first statement of every DEBUG constructor: forge's VM present, `FOUNDRY_PROFILE` equal to
     *         `fhevm-debug`, or revert by name. Runs before any table lookup, so a known chain resolving to
     *         upstream's addresses is still not a place this build may exist.
     */
    function requireDebugBuild() internal view {
        if (!_underForge()) revert DebugConfigOnProductionChain(block.chainid, FHEVM_DEBUG_CONFIG);
        string memory profile = IForgeEnv(FORGE_VM_ADDRESS).envOr("FOUNDRY_PROFILE", "");
        if (keccak256(bytes(profile)) != keccak256(bytes(FHEVM_DEBUG_PROFILE))) {
            revert DebugConfigOutsideDebugProfile(profile, FHEVM_DEBUG_CONFIG);
        }
    }

    /**
     * @notice Returns the Zama coprocessor config for the current chain, routed by `block.chainid`.
     * @dev    Upstream branches verbatim; then the debug rule for every other chain.
     */
    function getCoprocessorConfig() internal view returns (CoprocessorConfig memory config) {
        if (block.chainid == 1) {
            config = _getEthereumConfig();
        } else if (block.chainid == 137) {
            config = _getPolygonConfig();
        } else if (block.chainid == 11155111) {
            config = _getSepoliaConfig();
        } else if (block.chainid == 80002) {
            config = _getPolygonAmoyConfig();
        } else if (block.chainid == 31337) {
            config = _getLocalConfig();
        } else {
            config = _getDebugConfigOrRevert();
        }
    }

    function getEthereumCoprocessorConfig() internal view returns (CoprocessorConfig memory config) {
        if (block.chainid == 1) {
            config = _getEthereumConfig();
        } else if (block.chainid == 11155111) {
            config = _getSepoliaConfig();
        } else if (block.chainid == 31337) {
            config = _getLocalConfig();
        } else {
            config = _getDebugConfigOrRevert();
        }
    }

    function getPolygonCoprocessorConfig() internal view returns (CoprocessorConfig memory config) {
        if (block.chainid == 137) {
            config = _getPolygonConfig();
        } else if (block.chainid == 80002) {
            config = _getPolygonAmoyConfig();
        } else if (block.chainid == 31337) {
            config = _getLocalConfig();
        } else {
            config = _getDebugConfigOrRevert();
        }
    }

    /// @dev Upstream answers 0 for an unknown chain and does not revert; a view, not a constructor, so this
    ///      build keeps that and only adds the local id where forge is present.
    function getConfidentialProtocolId() internal view returns (uint256) {
        if (block.chainid == 1 || block.chainid == 137) {
            return _getZamaMainnetProtocolId();
        } else if (block.chainid == 11155111 || block.chainid == 80002) {
            return _getZamaTestnetProtocolId();
        } else if (block.chainid == 31337 || _underForge()) {
            return _getLocalProtocolId();
        }
        return 0;
    }

    // -- The debug rule --------------------------------------------------------

    /// @dev The one branch upstream does not have. Reachable only under forge in the debug profile — where the
    ///      SDK has provisioned the cleartext stack at the local addresses on a chain with no FHEVM protocol.
    ///      The constructors already ran `requireDebugBuild`; asked again here so the dispatchers hold on
    ///      their own, whoever calls them.
    function _getDebugConfigOrRevert() private view returns (CoprocessorConfig memory) {
        requireDebugBuild();
        return _getLocalConfig();
    }

    /// @dev One EXTCODESIZE. Plain EVM, so it answers correctly from any caller, factories included.
    function _underForge() private view returns (bool) {
        return FORGE_VM_ADDRESS.code.length != 0;
    }

    // -- Upstream, verbatim ----------------------------------------------------

    /// @dev chainid == 1
    function _getZamaMainnetProtocolId() private pure returns (uint256) {
        // Zama Mainnet protocol id is '1'
        return 1;
    }

    /// @dev chainid == 1
    function _getEthereumConfig() private pure returns (CoprocessorConfig memory) {
        return CoprocessorConfig({
            ACLAddress: 0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6,
            CoprocessorAddress: 0xD82385dADa1ae3E969447f20A3164F6213100e75,
            KMSVerifierAddress: 0x77627828a55156b04Ac0DC0eb30467f1a552BB03
        });
    }

    /// @dev chainid == 11155111 or chainid == 80002
    function _getZamaTestnetProtocolId() private pure returns (uint256) {
        // Zama Testnet protocol id is '10000 + Zama Mainnet protocol id'
        return 10001;
    }

    /// @dev chainid == 11155111
    function _getSepoliaConfig() private pure returns (CoprocessorConfig memory) {
        return CoprocessorConfig({
            ACLAddress: 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D,
            CoprocessorAddress: 0x92C920834Ec8941d2C77D188936E1f7A6f49c127,
            KMSVerifierAddress: 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A
        });
    }

    /// @dev chainid == 80002
    function _getPolygonAmoyConfig() private pure returns (CoprocessorConfig memory) {
        return CoprocessorConfig({
            ACLAddress: 0xD99Cb9Fc3c42c87f2A4A12e8Fd60318d6bDdf985,
            CoprocessorAddress: 0x89420269f61e4db00545cd99da0aEcA7fF0912f9,
            KMSVerifierAddress: 0xCD1D89E311bce4C8DEa9a0857a0c9A4E153D4041
        });
    }

    /// @dev chainid == 137
    function _getPolygonConfig() private pure returns (CoprocessorConfig memory) {
        return CoprocessorConfig({
            ACLAddress: 0x6737F17e31cf26a1b62fb0362acC5a16CB156F49,
            CoprocessorAddress: 0xAB0075E77fe06083f52bdf10e2ccDB3712483057,
            KMSVerifierAddress: 0x14e609595474874Dd6b6128376E336EfADfdBE37
        });
    }

    /// @dev chainid == 31337
    function _getLocalProtocolId() private pure returns (uint256) {
        return type(uint256).max;
    }

    /// @dev chainid == 31337, and every chain the debug rule admits: the canonical local addresses, the
    ///      ones forge-fhevm-std provisions the cleartext stack at.
    function _getLocalConfig() private pure returns (CoprocessorConfig memory) {
        return CoprocessorConfig({
            ACLAddress: 0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D,
            CoprocessorAddress: 0xe3a9105a3a932253A70F126eb1E3b589C643dD24,
            KMSVerifierAddress: 0x901F8942346f7AB3a01F6D7613119Bca447Bb030
        });
    }
}

/**
 * @title   ZamaEthereumConfig.
 * @dev     Upstream, verbatim, behind the DEBUG guard: inherited by a contract using the FHEVM contracts Zama
 *          provides on Ethereum mainnet (chainId = 1) and Sepolia (chainId = 11155111); in this build the
 *          constructor also resolves on a chain forge-fhevm-std has provisioned.
 */
abstract contract ZamaEthereumConfig {
    constructor() {
        ZamaConfig.requireDebugBuild();
        FHE.setCoprocessor(ZamaConfig.getEthereumCoprocessorConfig());
    }

    function confidentialProtocolId() public view returns (uint256) {
        return ZamaConfig.getConfidentialProtocolId();
    }
}

/**
 * @title   ZamaPolygonConfig.
 * @dev     Upstream, verbatim, behind the DEBUG guard: Polygon (chainId = 137) and Polygon Amoy (chainId = 80002).
 */
abstract contract ZamaPolygonConfig {
    constructor() {
        ZamaConfig.requireDebugBuild();
        FHE.setCoprocessor(ZamaConfig.getPolygonCoprocessorConfig());
    }

    function confidentialProtocolId() public view returns (uint256) {
        return ZamaConfig.getConfidentialProtocolId();
    }
}

/**
 * @title   ZamaMultiChainConfig.
 * @dev     Upstream, verbatim, behind the DEBUG guard: the configuration is selected from `block.chainid` at
 *          construction time, so one implementation deploys on every supported network.
 */
abstract contract ZamaMultiChainConfig {
    constructor() {
        ZamaConfig.requireDebugBuild();
        FHE.setCoprocessor(ZamaConfig.getCoprocessorConfig());
    }

    function confidentialProtocolId() public view returns (uint256) {
        return ZamaConfig.getConfidentialProtocolId();
    }
}
