// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {
    FORGE_VM_ADDRESS as DEBUG_FORGE_VM_ADDRESS,
    ZamaConfig as DebugConfig,
    ZamaEthereumConfig as DebugEthereumConfig
} from "../../pkg/src/config/DebugZamaConfig.sol";

import {TestFhevm} from "../../pkg/src/TestFhevm.sol";
import {LibFhevmFail} from "../../pkg/src/LibFhevmFail.sol";
import {ACL_ADDRESS} from "../../pkg/src/_host/_internal/LocalHostAddresses.sol";

/// A dApp compiled against the DEBUG config by direct import, so these hold under every profile.
contract DebugDApp is DebugEthereumConfig {
    euint64 public value;

    function set(uint64 v) external {
        value = FHE.asEuint64(v);
        FHE.allowThis(value);
    }
}

/// The same, made by a factory: no cheatcode access of its own, and the guard must still answer.
contract DebugDAppFactory {
    function make() external returns (DebugDApp d) {
        d = new DebugDApp();
    }
}

/**
 * @notice `DebugZamaConfig.sol` offline: it constructs only under forge in the `fhevm-debug` profile, it
 *         follows upstream on known chains and the local stack elsewhere, its marker is in the bytecode, and
 *         the alias helper it is used with fails with a rendered message. Needs no RPC. The profile-dependent
 *         tests cover one branch per run; §5 of the plan runs both profiles.
 */
contract DebugZamaConfigTest is TestFhevm {
    bool internal debugBuild;
    string internal profile;

    function setUp() public override {
        profile = vm.envOr("FOUNDRY_PROFILE", string(""));
        debugBuild = keccak256(bytes(profile)) == keccak256(bytes(DebugConfig.FHEVM_DEBUG_PROFILE));
    }

    function deploy() external returns (DebugDApp d) {
        d = new DebugDApp();
    }

    /// The address the debug config probes is forge's own (`CommonBase.VM_ADDRESS`), and cannot drift from it.
    function test_theInlinedForgeVmAddressIsForgeStds() public pure {
        assertEq(DEBUG_FORGE_VM_ADDRESS, VM_ADDRESS);
    }

    /// DEBUG profile: constructs from anywhere — `setUp`-style, from a factory, and in a field initializer —
    /// on a known chain (as upstream) and on an unknown one (the local stack).
    function test_debug_constructsFromAnywhereAndResolvesByChain() public {
        vm.skip(!debugBuild);
        vm.chainId(1);
        assertEq(new DebugDApp().confidentialProtocolId(), 1, "mainnet's protocol id, as upstream");

        vm.chainId(42161);
        DebugDApp onForeign = new DebugDAppFactory().make();
        assertEq(onForeign.confidentialProtocolId(), type(uint256).max, "the local protocol id, via a factory");
        assertEq(getCoprocessorConfig(address(onForeign)).ACLAddress, ACL_ADDRESS, "the local stack");
        vm.chainId(31337);

        assertEq(new FieldInitializerHost().dapp().confidentialProtocolId(), type(uint256).max);
    }

    /// DEFAULT profile (or any profile but `fhevm-debug`): construction reverts by name, on every chain,
    /// however the file was reached — here by direct import. The marker rides in the revert.
    function test_default_constructionRevertsOutsideTheDebugProfile() public {
        vm.skip(debugBuild);
        uint256[3] memory chains = [uint256(1), 42161, 31337];
        for (uint256 i = 0; i < chains.length; i++) {
            vm.chainId(chains[i]);
            vm.expectRevert(
                abi.encodeWithSelector(
                    DebugConfig.DebugConfigOutsideDebugProfile.selector, profile, DebugConfig.FHEVM_DEBUG_CONFIG
                )
            );
            this.deploy();
        }
        vm.chainId(31337);
    }

    /// The marker rides in the bytecode of every contract compiled against the file, constructed or not.
    function test_theMarkerIsInTheBytecode() public pure {
        assertTrue(_contains(type(DebugDApp).creationCode, bytes(DebugConfig.FHEVM_DEBUG_CONFIG)));
    }

    /// `cleartextChain` with an alias nothing defines: rendered, and nothing forked (plan §3).
    function test_cleartextChainWithAnUnknownAliasFailsRendered() public {
        vm.expectRevert(bytes(LibFhevmFail.rpcUrlMissing("nowhere", "NOWHERE_RPC_URL")));
        this.cleartextChainExternally("nowhere");
    }

    /// An alias foundry.toml DECLARES with an unset `${VAR}` is a misconfiguration, rendered as such and never
    /// replaced by a default. `needs_env` is declared in this package's foundry.toml for exactly this test.
    function test_cleartextChainWithADeclaredButUnreadableAliasFailsRendered() public {
        vm.expectRevert(
            bytes(
                LibFhevmFail.rpcUrlUnreadable(
                    "needs_env", "NEEDS_ENV_RPC_URL", "environment variable `FORGE_FHEVM_STD_UNSET_FOR_TESTS` not found"
                )
            )
        );
        this.cleartextChainExternally("needs_env");
    }

    function cleartextChainExternally(string memory chainAlias) external returns (FhevmChain memory) {
        return cleartextChain(chainAlias);
    }

    function _contains(bytes memory hay, bytes memory needle) private pure returns (bool) {
        if (needle.length == 0 || hay.length < needle.length) return false;
        for (uint256 i = 0; i + needle.length <= hay.length; i++) {
            uint256 j;
            while (j < needle.length && hay[i + j] == needle[j]) j++;
            if (j == needle.length) return true;
        }
        return false;
    }
}

/// A contract whose dApp is a FIELD INITIALIZER: constructed before this contract's own constructor body and
/// before any base's. Deployed by the test only under the debug profile.
contract FieldInitializerHost {
    DebugDApp public dapp = new DebugDApp();
}
