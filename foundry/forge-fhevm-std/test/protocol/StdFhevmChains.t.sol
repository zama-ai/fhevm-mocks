// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LocalHostBootstrap} from "../../pkg/src/_host/_internal/LocalHostBootstrap.sol";
import {StdFhevmChains} from "../../pkg/src/StdFhevmChains.sol";

/// A `FhevmChainData` with only the fields these cases care about; every address stays zero.
function _data(string memory fhevmGroup, uint256 chainId, string memory rpcUrl)
    pure
    returns (StdFhevmChains.FhevmChainData memory)
{
    return StdFhevmChains.FhevmChainData({
        fhevmGroup: fhevmGroup,
        chainId: chainId,
        rpcUrl: rpcUrl,
        relayerUrl: "",
        acl: address(0),
        fhevmExecutor: address(0),
        inputVerifier: address(0),
        kmsVerifier: address(0),
        protocolConfig: address(0),
        kmsGeneration: address(0),
        decryption: address(0),
        inputVerification: address(0)
    });
}

// `exposed_` is forge-std's own naming for a mock that surfaces internal members.
// forge-lint: disable-start(mixed-case-function)
contract StdFhevmChainsMock is Test, StdFhevmChains {
    function exposed_getFhevmChain(string memory fhevmGroup, string memory chainAlias)
        public
        returns (FhevmChain memory)
    {
        return getFhevmChain(fhevmGroup, chainAlias);
    }

    function exposed_getFhevmChain(string memory fhevmGroup, uint256 chainId) public returns (FhevmChain memory) {
        return getFhevmChain(fhevmGroup, chainId);
    }

    function exposed_getFhevmChain(string memory chainAlias) public returns (FhevmChain memory) {
        return getFhevmChain(chainAlias);
    }

    function exposed_setDefaultFhevmGroup(string memory chainAlias, string memory fhevmGroup) public {
        setDefaultFhevmGroup(chainAlias, fhevmGroup);
    }

    function exposed_setFhevmChain(string memory chainAlias, FhevmChainData memory chainData) public {
        setFhevmChain(chainAlias, chainData);
    }

    function exposed_setFallbackToDefaultFhevmRpcUrls(bool useDefault) public {
        setFallbackToDefaultFhevmRpcUrls(useDefault);
    }
}

// forge-lint: disable-end(mixed-case-function)

/// Mirrors forge-std's `StdChains.t.sol`, minus the `foundry.toml` and `vm.setEnv` cases: this package
/// declares no `[rpc_endpoints]`, and a test that sets the environment races every other suite.
contract StdFhevmChainsTest is Test, StdFhevmChains {
    function test_ChainRpcInitialization() public {
        // With no `foundry.toml` entry and no environment variable, the defaults are returned, and they
        // are forge-std's for the same alias.
        assertEq(getFhevmChain("mainnet", 1).rpcUrl, getChain(1).rpcUrl);
        assertEq(getFhevmChain("mainnet", "polygon").rpcUrl, getChain("polygon").rpcUrl);
        assertEq(getFhevmChain("testnet", "sepolia").rpcUrl, getChain("sepolia").rpcUrl);
        assertEq(getFhevmChain("testnet", "polygon_amoy").rpcUrl, getChain("polygon_amoy").rpcUrl);
        assertEq(getFhevmChain("devnet", "sepolia").rpcUrl, getChain("sepolia").rpcUrl);
        assertEq(getFhevmChain("devnet", "polygon_amoy").rpcUrl, getChain("polygon_amoy").rpcUrl);
        assertEq(getFhevmChain("devnet", "bnb_smart_chain_testnet").rpcUrl, getChain("bnb_smart_chain_testnet").rpcUrl);
        assertEq(getFhevmChain("devnet", "hoodi").rpcUrl, getChain("hoodi").rpcUrl);
    }

    /// The whole reason a group exists: one host chain, two FHEVM stacks, both reachable, each with its
    /// own addresses and relayer.
    function test_SameChainUnderSeveralGroups() public {
        FhevmChain memory testnet = getFhevmChain("testnet", 11155111);
        FhevmChain memory devnet = getFhevmChain("devnet", 11155111);
        assertEq(testnet.fhevmGroup, "testnet");
        assertEq(devnet.fhevmGroup, "devnet");
        assertEq(testnet.chainAlias, "sepolia");
        assertEq(devnet.chainAlias, "sepolia");
        assertEq(testnet.chainId, devnet.chainId);
        assertEq(testnet.rpcUrl, devnet.rpcUrl);
        assertNotEq(testnet.relayerUrl, devnet.relayerUrl);
        assertNotEq(testnet.acl, devnet.acl);
        assertNotEq(testnet.decryption, devnet.decryption);
    }

    /// Spot-checked against an INDEPENDENT source, not the config the defaults were generated from:
    /// `ZamaConfig._getSepoliaConfig()` in the fhevm solidity library, as already pinned by `SepoliaFork.t.sol`.
    function test_SepoliaTestnetAddresses() public {
        FhevmChain memory sepolia = getFhevmChain("testnet", "sepolia");
        assertEq(sepolia.acl, 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D);
        assertEq(sepolia.fhevmExecutor, 0x92C920834Ec8941d2C77D188936E1f7A6f49c127);
        assertEq(sepolia.inputVerifier, 0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0);
        assertEq(sepolia.kmsVerifier, 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A);
        assertEq(sepolia.protocolConfig, 0x51f9AFBc89Ea792e1a21a12AB802ab58D4dbee83);
        assertEq(sepolia.kmsGeneration, 0x77389113d7000EcBCfc2bDed57202f5f46109934);
        assertEq(sepolia.relayerUrl, "https://relayer.testnet.zama.org");
    }

    /**
     * `kmsGeneration` is carried by the table and by nothing else.
     *
     * Every other host address is either in the table or readable from the stack — `hcuLimit` from the
     * executor, `pauserSet` from the ACL. This one has no getter anywhere, on any contract, so a fork
     * upgrade that must re-point its proxy can only learn where it is from here. Hence the entry, and
     * hence this test.
     *
     * ZERO WHERE A CHAIN HAS NONE, which is most of them: it arrived with the 0.13 line and only the
     * three Ethereum stacks carry one. Absence is data, not a gap — a chain without it is one the
     * version gate would refuse anyway.
     */
    function test_theTableCarriesKmsGenerationWhereTheChainHasOne() public {
        assertEq(
            getFhevmChain("mainnet", "mainnet").kmsGeneration, 0xf102cC9A9D2174630c394f5b7B7D63104E348daa, "mainnet"
        );
        assertEq(
            getFhevmChain("testnet", "sepolia").kmsGeneration,
            0x77389113d7000EcBCfc2bDed57202f5f46109934,
            "testnet sepolia"
        );
        assertEq(
            getFhevmChain("devnet", "sepolia").kmsGeneration,
            0x55bdE339a01DA46d2d3504b8d9A9F5412C85e5e7,
            "devnet sepolia"
        );

        assertEq(getFhevmChain("mainnet", "polygon").kmsGeneration, address(0), "polygon has none");
        assertEq(getFhevmChain("testnet", "polygon_amoy").kmsGeneration, address(0), "amoy has none");
        assertEq(getFhevmChain("devnet", "bnb_smart_chain_testnet").kmsGeneration, address(0), "bnb has none");
        assertEq(getFhevmChain("devnet", "hoodi").kmsGeneration, address(0), "hoodi has none");
    }

    /// The table can be walked: the eight defaults, then whatever a test adds, in order.
    function test_fhevmChainsWalksTheWholeTable() public {
        assertEq(fhevmChains().length, 9, "the defaults: eight network stacks and anvil");
        setFhevmChain("custom_chain", _data("devnet", 123456789, "https://custom.chain/"));
        FhevmChain[] memory all = fhevmChains();
        assertEq(all.length, 10, "plus the override");
        assertEq(all[9].chainAlias, "custom_chain", "appended last");
        // Re-setting an existing key does not grow the table.
        setFhevmChain("custom_chain", _data("devnet", 123456790, "https://custom.chain/"));
        assertEq(fhevmChains().length, 10, "same key, same row");
    }

    /// By chain id, across groups: Sepolia serves two stacks, mainnet one, an unknown chain none.
    function test_getFhevmChainsByChainId() public {
        FhevmChain[] memory sepolia = getFhevmChains(11155111);
        assertEq(sepolia.length, 2);
        assertEq(sepolia[0].fhevmGroup, "testnet");
        assertEq(sepolia[1].fhevmGroup, "devnet");
        assertNotEq(sepolia[0].fhevmExecutor, sepolia[1].fhevmExecutor, "two different stacks");
        assertEq(getFhevmChains(1).length, 1);
        assertEq(getFhevmChains(424242).length, 0);
    }

    function test_RevertIf_ChainNotFound() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert(
            "StdFhevmChains getFhevmChain(string,string): Chain with alias \"does_not_exist\" not found in FHEVM group \"mainnet\"."
        );
        stdFhevmChainsMock.exposed_getFhevmChain("mainnet", "does_not_exist");
    }

    /// Sepolia is a `testnet` chain, and no `mainnet` stack is deployed there.
    function test_RevertIf_ChainNotInGroup() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert(
            "StdFhevmChains getFhevmChain(string,string): Chain with alias \"sepolia\" not found in FHEVM group \"mainnet\"."
        );
        stdFhevmChainsMock.exposed_getFhevmChain("mainnet", "sepolia");

        vm.expectRevert(
            "StdFhevmChains getFhevmChain(string,uint256): Chain with ID 11155111 not found in FHEVM group \"mainnet\"."
        );
        stdFhevmChainsMock.exposed_getFhevmChain("mainnet", 11155111);
    }

    function test_RevertIf_SetFhevmChain_ChainIdExist_FirstTest() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert(
            "StdFhevmChains setFhevmChain(string,FhevmChainData): Chain ID 1 already used by \"mainnet\" in FHEVM group \"mainnet\"."
        );
        stdFhevmChainsMock.exposed_setFhevmChain("mainnet2", _data("mainnet", 1, "URL"));
    }

    /// A chain ID is only taken within its group: registering it under another group is not a clash.
    function test_SetFhevmChain_SameChainIdInAnotherGroup() public {
        setFhevmChain("mainnet", _data("devnet", 1, "https://custom.chain/"));
        FhevmChain memory chain = getFhevmChain("devnet", 1);
        assertEq(chain.fhevmGroup, "devnet");
        assertEq(chain.chainAlias, "mainnet");
        assertEq(chain.rpcUrl, "https://custom.chain/");
        // The original entry is untouched.
        assertEq(getFhevmChain("mainnet", 1).rpcUrl, getChain(1).rpcUrl);
    }

    /// The one-argument form: an alias one group serves resolves to the same entry as the two-argument form.
    function test_getFhevmChain_byAliasAlone() public {
        FhevmChain memory short_ = getFhevmChain("mainnet");
        FhevmChain memory full = getFhevmChain("mainnet", "mainnet");
        assertEq(short_.fhevmGroup, full.fhevmGroup);
        assertEq(short_.chainId, full.chainId);
        assertEq(short_.acl, full.acl);
        assertEq(short_.rpcUrl, full.rpcUrl);
        assertEq(getFhevmChain("polygon").chainId, 137);
        assertEq(getFhevmChain("anvil").fhevmGroup, "local");
        // The local entry names the cleartext gateway contracts its verifiers are initialised against, not zero.
        assertEq(getFhevmChain("anvil").decryption, LocalHostBootstrap.DECRYPTION_ADDRESS);
        assertEq(getFhevmChain("anvil").inputVerification, LocalHostBootstrap.INPUT_VERIFICATION_ADDRESS);
    }

    /// Every alias has a DECLARED default group. Sepolia and Amoy are served by two; the public one is the
    /// default, and `devnet` is a default only where it is the sole group.
    function test_getFhevmChain_byAliasAlone_usesTheDeclaredDefaultGroup() public {
        assertEq(defaultFhevmGroup("mainnet"), "mainnet");
        assertEq(defaultFhevmGroup("polygon"), "mainnet");
        assertEq(defaultFhevmGroup("sepolia"), "testnet");
        assertEq(defaultFhevmGroup("polygon_amoy"), "testnet");
        assertEq(defaultFhevmGroup("bnb_smart_chain_testnet"), "devnet");
        assertEq(defaultFhevmGroup("hoodi"), "devnet");
        assertEq(defaultFhevmGroup("anvil"), "local");
        assertEq(defaultFhevmGroup("nowhere"), "");

        FhevmChain memory sepolia = getFhevmChain("sepolia");
        assertEq(sepolia.fhevmGroup, "testnet");
        assertEq(sepolia.acl, getFhevmChain("testnet", "sepolia").acl);
        assertTrue(sepolia.acl != getFhevmChain("devnet", "sepolia").acl, "the two stacks differ; testnet is the label");
    }

    /// The label moves: `setDefaultFhevmGroup` changes what the shortcut means, and refuses a group that does
    /// not serve the alias. A custom alias is labelled with the group it was first registered under.
    function test_setDefaultFhevmGroup() public {
        setDefaultFhevmGroup("sepolia", "devnet");
        assertEq(getFhevmChain("sepolia").fhevmGroup, "devnet");

        StdFhevmChainsMock mock = new StdFhevmChainsMock();
        vm.expectRevert(
            'StdFhevmChains setDefaultFhevmGroup(string,string): FHEVM group "mainnet" does not serve chain alias "sepolia".'
        );
        mock.exposed_setDefaultFhevmGroup("sepolia", "mainnet");

        setFhevmChain("custom_chain", _data("devnet", 123456789, "https://custom.chain/"));
        assertEq(defaultFhevmGroup("custom_chain"), "devnet");
        assertEq(getFhevmChain("custom_chain").chainId, 123456789);
    }

    function test_RevertIf_getFhevmChainByAlias_Unknown() public {
        StdFhevmChainsMock mock = new StdFhevmChainsMock();
        vm.expectRevert(
            'StdFhevmChains getFhevmChain(string): Chain with alias "nowhere" not found in any FHEVM group.'
        );
        mock.exposed_getFhevmChain("nowhere");
    }

    function test_RevertIf_ChainBubbleUp() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        stdFhevmChainsMock.exposed_setFhevmChain("needs_undefined_env_var", _data("devnet", 123456789, ""));
        // Forge environment variable error.
        vm.expectRevert();
        stdFhevmChainsMock.exposed_getFhevmChain("devnet", "needs_undefined_env_var");
    }

    function test_RevertIf_SetFhevmChain_ChainIdExists_SecondTest() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        stdFhevmChainsMock.exposed_setFhevmChain("custom_chain", _data("devnet", 123456789, "https://custom.chain/"));

        vm.expectRevert(
            'StdFhevmChains setFhevmChain(string,FhevmChainData): Chain ID 123456789 already used by "custom_chain" in FHEVM group "devnet".'
        );

        stdFhevmChainsMock.exposed_setFhevmChain("another_custom_chain", _data("devnet", 123456789, ""));
    }

    function test_SetFhevmChain() public {
        setFhevmChain("custom_chain", _data("devnet", 123456789, "https://custom.chain/"));
        FhevmChain memory customChain = getFhevmChain("devnet", "custom_chain");
        assertEq(customChain.fhevmGroup, "devnet");
        assertEq(customChain.chainId, 123456789);
        assertEq(customChain.chainAlias, "custom_chain");
        assertEq(customChain.rpcUrl, "https://custom.chain/");
        FhevmChain memory chainById = getFhevmChain("devnet", 123456789);
        assertEq(chainById.fhevmGroup, customChain.fhevmGroup);
        assertEq(chainById.chainId, customChain.chainId);
        assertEq(chainById.chainAlias, customChain.chainAlias);
        assertEq(chainById.rpcUrl, customChain.rpcUrl);
        customChain.fhevmGroup = "testnet";
        customChain.chainId = 987654321;
        setFhevmChain("another_custom_chain", customChain);
        FhevmChain memory anotherCustomChain = getFhevmChain("testnet", "another_custom_chain");
        assertEq(anotherCustomChain.fhevmGroup, "testnet");
        assertEq(anotherCustomChain.chainId, 987654321);
        assertEq(anotherCustomChain.chainAlias, "another_custom_chain");
        assertEq(anotherCustomChain.rpcUrl, "https://custom.chain/");
        // Verify the first chain data was not overwritten
        chainById = getFhevmChain("devnet", 123456789);
        assertEq(chainById.fhevmGroup, "devnet");
        assertEq(chainById.chainId, 123456789);
    }

    function test_RevertIf_SetEmptyAlias() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert("StdFhevmChains setFhevmChain(string,FhevmChainData): Chain alias cannot be the empty string.");
        stdFhevmChainsMock.exposed_setFhevmChain("", _data("devnet", 123456789, ""));
    }

    function test_RevertIf_SetEmptyGroup() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert("StdFhevmChains setFhevmChain(string,FhevmChainData): FHEVM group cannot be the empty string.");
        stdFhevmChainsMock.exposed_setFhevmChain("alias", _data("", 123456789, ""));
    }

    function test_RevertIf_SetNoChainId0() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert("StdFhevmChains setFhevmChain(string,FhevmChainData): Chain ID cannot be 0.");
        stdFhevmChainsMock.exposed_setFhevmChain("alias", _data("devnet", 0, ""));
    }

    function test_RevertIf_GetNoChainId0() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert("StdFhevmChains getFhevmChain(string,uint256): Chain ID cannot be 0.");
        stdFhevmChainsMock.exposed_getFhevmChain("devnet", 0);
    }

    function test_RevertIf_GetNoEmptyAlias() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert("StdFhevmChains getFhevmChain(string,string): Chain alias cannot be the empty string.");
        stdFhevmChainsMock.exposed_getFhevmChain("devnet", "");
    }

    function test_RevertIf_GetNoEmptyGroup() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert("StdFhevmChains getFhevmChain(string,string): FHEVM group cannot be the empty string.");
        stdFhevmChainsMock.exposed_getFhevmChain("", "sepolia");

        vm.expectRevert("StdFhevmChains getFhevmChain(string,uint256): FHEVM group cannot be the empty string.");
        stdFhevmChainsMock.exposed_getFhevmChain("", 11155111);
    }

    function test_RevertIf_ChainAliasNotFound() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        vm.expectRevert(
            "StdFhevmChains getFhevmChain(string,uint256): Chain with ID 321 not found in FHEVM group \"devnet\"."
        );

        stdFhevmChainsMock.exposed_getFhevmChain("devnet", 321);
    }

    function test_SetFhevmChain_ExistingOne() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        stdFhevmChainsMock.exposed_setFhevmChain("custom_chain", _data("devnet", 123456789, "https://custom.chain/"));
        stdFhevmChainsMock.exposed_setFhevmChain("custom_chain", _data("devnet", 123456790, "https://custom.chain/"));

        // The old chain ID is released, and the alias now answers for the new one.
        assertEq(stdFhevmChainsMock.exposed_getFhevmChain("devnet", 123456790).chainAlias, "custom_chain");
        vm.expectRevert(
            "StdFhevmChains getFhevmChain(string,uint256): Chain with ID 123456789 not found in FHEVM group \"devnet\"."
        );
        stdFhevmChainsMock.exposed_getFhevmChain("devnet", 123456789);
    }

    function test_RevertIf_DontUseDefaultRpcUrl() public {
        // We deploy a mock to properly test the revert.
        StdFhevmChainsMock stdFhevmChainsMock = new StdFhevmChainsMock();

        // Should error if default RPCs flag is set false
        stdFhevmChainsMock.exposed_setFallbackToDefaultFhevmRpcUrls(false);
        vm.expectRevert();
        stdFhevmChainsMock.exposed_getFhevmChain("devnet", "hoodi");
        vm.expectRevert();
        stdFhevmChainsMock.exposed_getFhevmChain("devnet", 560048);
    }
}
