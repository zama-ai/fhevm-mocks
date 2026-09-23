// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {VmSafe} from "forge-std/Vm.sol";

import {LibFhevmFail} from "./LibFhevmFail.sol";

import {
    ACL_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    INPUT_VERIFIER_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    PROTOCOL_CONFIG_ADDRESS
} from "./_host/_internal/LocalHostAddresses.sol";
import {LocalHostBootstrap} from "./_host/_internal/LocalHostBootstrap.sol";

// The FHEVM NETWORK GROUPS: one gateway deployment each, with the host chains it serves and one relayer. The
// closed set of `fhevm-network-groups.config.json` at the root of the repository; a table entry's `fhevmGroup`
// is always one of these three, or `FHEVM_LOCAL_GROUP`.
string constant FHEVM_MAINNET_GROUP = "mainnet";
string constant FHEVM_TESTNET_GROUP = "testnet";
string constant FHEVM_DEVNET_GROUP = "devnet";

// The FHEVM group of the SDK's own cleartext stack: the local run, anvil, and any chain that has no FHEVM
// protocol and gets a cleartext stack from the SDK on first contact. Not a network group: no gateway, no
// relayer, and the one group a live stack is never listed under.
string constant FHEVM_LOCAL_GROUP = "local";

/**
 * StdFhevmChains provides information about the chains an FHEVM stack is deployed on, that can be
 * used in scripts/tests. It follows forge-std's `StdChains` exactly, with one difference: a chain
 * here is not identified by a name but by the FHEVM NETWORK GROUP it belongs to. A group is one
 * gateway deployment with the host chains it serves, and one relayer serves each group; the
 * supported groups are the closed set `mainnet`, `testnet` and `devnet` (see
 * `fhevm-network-groups.config.json` at the root of the repository).
 *
 * The same host chain may be served by several groups — Sepolia carries both a `testnet` and a
 * `devnet` FHEVM stack — so a chain is keyed by (group, alias) and (group, chain ID) rather than by
 * alias and chain ID alone. The alias is what identifies the host chain, and is the same as the
 * alias in the `[rpc_endpoints]` section of the `foundry.toml` file: for best UX, ensure the alias
 * in the `foundry.toml` file matches the alias used in this contract, which can be found as the
 * first argument to the `setFhevmChainWithDefaultRpcUrl` call in the `initializeStdFhevmChains`
 * function. Aliases are deliberately those of forge-std's `StdChains`, so that one `[rpc_endpoints]`
 * entry serves both `getChain("sepolia")` and `getFhevmChain("testnet", "sepolia")`.
 *
 * There are two main ways to use this contract:
 *   1. Set a chain with `setFhevmChain(string memory chainAlias, FhevmChainData memory chain)` or
 *      `setFhevmChain(string memory chainAlias, FhevmChain memory chain)`
 *   2. Get a chain with `getFhevmChain(string memory fhevmGroup, string memory chainAlias)` or
 *      `getFhevmChain(string memory fhevmGroup, uint256 chainId)`.
 *
 * The first time either of those are used, chains are initialized with the default set of RPC URLs.
 * This is done in `initializeStdFhevmChains`, which uses `setFhevmChainWithDefaultRpcUrl`. Defaults
 * are recorded in `defaultRpcUrls`.
 *
 * The `setFhevmChain` function is straightforward, and it simply saves off the given chain data.
 *
 * The `getFhevmChain` methods use `getFhevmChainWithUpdatedRpcUrl` to return a chain. For example,
 * let's say we want to retrieve the RPC URL for the `testnet` stack on `sepolia`:
 *   - If you have specified data with `setFhevmChain`, it will return that.
 *   - If you have configured a sepolia RPC URL in `foundry.toml`, it will return the URL, provided it
 *     is valid (e.g. a URL is specified, or an environment variable is given and exists).
 *   - If neither of the above conditions is met, the default data is returned.
 *
 * Summarizing the above, the prioritization hierarchy is `setFhevmChain` -> `foundry.toml` -> environment variable -> defaults.
 *
 * Two helpers name a chain for `fhevm.createSelectFork`: `getFhevmChain(group, alias)` names a chain that HAS
 * an FHEVM stack and points at it — `getFhevmChain(alias)` alone resolves in the alias's DECLARED default group,
 * so `getFhevmChain("sepolia")` is Sepolia's `testnet` stack (`setDefaultFhevmGroup` moves the label);
 * `cleartextChain(alias)` names a chain that has NONE and gets this package's cleartext stack on first contact
 * (rules.md 2.17).
 */
abstract contract StdFhevmChains {
    // forge-lint: disable-next-line(screaming-snake-case-const)
    VmSafe private constant vm = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    bool private stdFhevmChainsInitialized;

    struct FhevmChainData {
        string fhevmGroup;
        uint256 chainId;
        string rpcUrl;
        string relayerUrl;
        address acl;
        address fhevmExecutor;
        address inputVerifier;
        address kmsVerifier;
        address protocolConfig;
        address decryption;
        address inputVerification;
    }

    struct FhevmChain {
        // The FHEVM network group this stack belongs to: `mainnet`, `testnet` or `devnet`.
        string fhevmGroup;
        // The chain's Chain ID.
        uint256 chainId;
        // The chain's alias. (i.e. what gets specified in `foundry.toml`).
        string chainAlias;
        // A default RPC endpoint for this chain.
        // NOTE: This default RPC URL is included for convenience to facilitate quick tests and
        // experimentation. Do not use this RPC URL for production test suites, CI, or other heavy
        // usage as you will be throttled and this is a disservice to others who need this endpoint.
        string rpcUrl;
        // The relayer serving this chain's group. Infrastructure, not an on-chain address, so it comes
        // from `fhevm-network-groups.config.json` rather than from the protocol registry.
        string relayerUrl;
        // The FHEVM host contracts deployed on this chain, from `fhevm-chains.config.json`.
        address acl;
        address fhevmExecutor;
        address inputVerifier;
        address kmsVerifier;
        address protocolConfig;
        // The group's gateway contracts this chain's stack is served by.
        address decryption;
        address inputVerification;
    }

    struct FhevmChainKey {
        string fhevmGroup;
        string chainAlias;
    }

    // Maps from the FHEVM group, then the chain's alias (matching the alias in the `foundry.toml` file) to chain data.
    mapping(string => mapping(string => FhevmChain)) private chains;
    // Every (group, alias) ever set, in insertion order, so the table can be walked: mappings cannot be.
    FhevmChainKey[] private chainKeys;

    // The DEFAULT group of each alias
    mapping(string => string) private defaultGroupOfAlias;
    // Maps from the chain's alias to it's default RPC URL.
    mapping(string => string) private defaultRpcUrls;
    // Maps from the FHEVM group, then a chain ID to it's alias.
    mapping(string => mapping(uint256 => string)) private idToAlias;

    bool private fallbackToDefaultRpcUrls = true;

    function getFhevmChain(string memory fhevmGroup, string memory chainAlias)
        internal
        virtual
        returns (FhevmChain memory chain)
    {
        require(
            bytes(fhevmGroup).length != 0,
            "StdFhevmChains getFhevmChain(string,string): FHEVM group cannot be the empty string."
        );
        require(
            bytes(chainAlias).length != 0,
            "StdFhevmChains getFhevmChain(string,string): Chain alias cannot be the empty string."
        );

        initializeStdFhevmChains();
        chain = chains[fhevmGroup][chainAlias];
        require(
            chain.chainId != 0,
            string(
                abi.encodePacked(
                    "StdFhevmChains getFhevmChain(string,string): Chain with alias \"",
                    chainAlias,
                    "\" not found in FHEVM group \"",
                    fhevmGroup,
                    "\"."
                )
            )
        );

        chain = getFhevmChainWithUpdatedRpcUrl(chainAlias, chain);
    }

    function getFhevmChain(string memory chainAlias) internal virtual returns (FhevmChain memory) {
        require(
            bytes(chainAlias).length != 0,
            "StdFhevmChains getFhevmChain(string): Chain alias cannot be the empty string."
        );
        initializeStdFhevmChains();
        string memory group = defaultGroupOfAlias[chainAlias];
        require(
            bytes(group).length != 0,
            string(
                abi.encodePacked(
                    "StdFhevmChains getFhevmChain(string): Chain with alias \"",
                    chainAlias,
                    "\" not found in any FHEVM group."
                )
            )
        );
        return getFhevmChain(group, chainAlias);
    }

    function defaultFhevmGroup(string memory chainAlias) internal virtual returns (string memory) {
        initializeStdFhevmChains();
        return defaultGroupOfAlias[chainAlias];
    }

    function setDefaultFhevmGroup(string memory chainAlias, string memory fhevmGroup) internal virtual {
        initializeStdFhevmChains();
        require(
            chains[fhevmGroup][chainAlias].chainId != 0,
            string(
                abi.encodePacked(
                    "StdFhevmChains setDefaultFhevmGroup(string,string): FHEVM group \"",
                    fhevmGroup,
                    "\" does not serve chain alias \"",
                    chainAlias,
                    "\"."
                )
            )
        );
        defaultGroupOfAlias[chainAlias] = fhevmGroup;
    }

    function getFhevmChain(string memory fhevmGroup, uint256 chainId)
        internal
        virtual
        returns (FhevmChain memory chain)
    {
        require(
            bytes(fhevmGroup).length != 0,
            "StdFhevmChains getFhevmChain(string,uint256): FHEVM group cannot be the empty string."
        );
        require(chainId != 0, "StdFhevmChains getFhevmChain(string,uint256): Chain ID cannot be 0.");
        initializeStdFhevmChains();
        string memory chainAlias = idToAlias[fhevmGroup][chainId];

        chain = chains[fhevmGroup][chainAlias];

        require(
            chain.chainId != 0,
            string(
                abi.encodePacked(
                    "StdFhevmChains getFhevmChain(string,uint256): Chain with ID ",
                    vm.toString(chainId),
                    " not found in FHEVM group \"",
                    fhevmGroup,
                    "\"."
                )
            )
        );

        chain = getFhevmChainWithUpdatedRpcUrl(chainAlias, chain);
    }

    // set chain info, with priority to argument's rpcUrl field.
    function setFhevmChain(string memory chainAlias, FhevmChainData memory chain) internal virtual {
        require(
            bytes(chainAlias).length != 0,
            "StdFhevmChains setFhevmChain(string,FhevmChainData): Chain alias cannot be the empty string."
        );

        require(
            bytes(chain.fhevmGroup).length != 0,
            "StdFhevmChains setFhevmChain(string,FhevmChainData): FHEVM group cannot be the empty string."
        );

        require(chain.chainId != 0, "StdFhevmChains setFhevmChain(string,FhevmChainData): Chain ID cannot be 0.");

        initializeStdFhevmChains();
        string memory foundAlias = idToAlias[chain.fhevmGroup][chain.chainId];

        require(
            // forge-lint: disable-next-line(asm-keccak256)
            bytes(foundAlias).length == 0 || keccak256(bytes(foundAlias)) == keccak256(bytes(chainAlias)),
            string(
                abi.encodePacked(
                    "StdFhevmChains setFhevmChain(string,FhevmChainData): Chain ID ",
                    vm.toString(chain.chainId),
                    " already used by \"",
                    foundAlias,
                    "\" in FHEVM group \"",
                    chain.fhevmGroup,
                    "\"."
                )
            )
        );

        uint256 oldChainId = chains[chain.fhevmGroup][chainAlias].chainId;
        delete idToAlias[chain.fhevmGroup][oldChainId];
        if (oldChainId == 0) chainKeys.push(FhevmChainKey({fhevmGroup: chain.fhevmGroup, chainAlias: chainAlias}));
        if (bytes(defaultGroupOfAlias[chainAlias]).length == 0) defaultGroupOfAlias[chainAlias] = chain.fhevmGroup;

        chains[chain.fhevmGroup][chainAlias] = FhevmChain({
            fhevmGroup: chain.fhevmGroup,
            chainId: chain.chainId,
            chainAlias: chainAlias,
            rpcUrl: chain.rpcUrl,
            relayerUrl: chain.relayerUrl,
            acl: chain.acl,
            fhevmExecutor: chain.fhevmExecutor,
            inputVerifier: chain.inputVerifier,
            kmsVerifier: chain.kmsVerifier,
            protocolConfig: chain.protocolConfig,
            decryption: chain.decryption,
            inputVerification: chain.inputVerification
        });
        idToAlias[chain.fhevmGroup][chain.chainId] = chainAlias;
    }

    // set chain info, with priority to argument's rpcUrl field.
    function setFhevmChain(string memory chainAlias, FhevmChain memory chain) internal virtual {
        setFhevmChain(
            chainAlias,
            FhevmChainData({
                fhevmGroup: chain.fhevmGroup,
                chainId: chain.chainId,
                rpcUrl: chain.rpcUrl,
                relayerUrl: chain.relayerUrl,
                acl: chain.acl,
                fhevmExecutor: chain.fhevmExecutor,
                inputVerifier: chain.inputVerifier,
                kmsVerifier: chain.kmsVerifier,
                protocolConfig: chain.protocolConfig,
                decryption: chain.decryption,
                inputVerification: chain.inputVerification
            })
        );
    }

    function fhevmChains() internal virtual returns (FhevmChain[] memory all) {
        initializeStdFhevmChains();
        all = new FhevmChain[](chainKeys.length);
        for (uint256 i = 0; i < chainKeys.length; i++) {
            all[i] = chains[chainKeys[i].fhevmGroup][chainKeys[i].chainAlias];
        }
    }

    function getFhevmChains(uint256 chainId) internal virtual returns (FhevmChain[] memory matching) {
        FhevmChain[] memory all = fhevmChains();
        uint256 n;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].chainId == chainId) n++;
        }
        matching = new FhevmChain[](n);
        uint256 j;
        for (uint256 i = 0; i < all.length; i++) {
            if (all[i].chainId == chainId) matching[j++] = all[i];
        }
    }

    function getFhevmChainWithUpdatedRpcUrl(string memory chainAlias, FhevmChain memory chain)
        private
        view
        returns (FhevmChain memory)
    {
        if (bytes(chain.rpcUrl).length == 0) {
            try vm.rpcUrl(chainAlias) returns (string memory configRpcUrl) {
                chain.rpcUrl = configRpcUrl;
            } catch (bytes memory err) {
                string memory envName = string(abi.encodePacked(vm.toUppercase(chainAlias), "_RPC_URL"));
                if (fallbackToDefaultRpcUrls) {
                    chain.rpcUrl = vm.envOr(envName, defaultRpcUrls[chainAlias]);
                } else {
                    chain.rpcUrl = vm.envString(envName);
                }
                // Distinguish 'not found' from 'cannot read' (forge-std's rule, rendered per rules.md 2.11):
                // an alias ABSENT from foundry.toml falls back to the environment and the defaults, and fails
                // only if all three are empty; an alias DECLARED but unreadable (its `${VAR}` unset) is a
                // misconfiguration and fails whatever the fallbacks hold. Both encodings forge has used for
                // the 'not found' cheat error are recognised.
                bytes memory oldNotFoundError =
                    abi.encodeWithSignature("CheatCodeError", string(abi.encodePacked("invalid rpc url ", chainAlias)));
                bytes memory newNotFoundError = abi.encodeWithSignature(
                    "CheatcodeError(string)", string(abi.encodePacked("invalid rpc url: ", chainAlias))
                );
                // forge-lint: disable-start(asm-keccak256)
                bytes32 errHash = keccak256(err);
                bool notDeclared = errHash == keccak256(oldNotFoundError) || errHash == keccak256(newNotFoundError);
                // forge-lint: disable-end(asm-keccak256)
                if (!notDeclared) revert(LibFhevmFail.rpcUrlUnreadable(chainAlias, envName, _cheatcodeErrorText(err)));
                if (bytes(chain.rpcUrl).length == 0) revert(LibFhevmFail.rpcUrlMissing(chainAlias, envName));
            }
        }
        return chain;
    }

    function cleartextChain(string memory chainAlias) internal virtual returns (FhevmChain memory chain) {
        require(
            bytes(chainAlias).length != 0,
            "StdFhevmChains cleartextChain(string): Chain alias cannot be the empty string."
        );
        chain = FhevmChain({
            fhevmGroup: FHEVM_LOCAL_GROUP,
            chainId: 0,
            chainAlias: chainAlias,
            rpcUrl: "",
            relayerUrl: "",
            acl: ACL_ADDRESS,
            fhevmExecutor: FHEVM_EXECUTOR_ADDRESS,
            inputVerifier: INPUT_VERIFIER_ADDRESS,
            kmsVerifier: KMS_VERIFIER_ADDRESS,
            protocolConfig: PROTOCOL_CONFIG_ADDRESS,
            decryption: LocalHostBootstrap.DECRYPTION_ADDRESS,
            inputVerification: LocalHostBootstrap.INPUT_VERIFICATION_ADDRESS
        });
        chain = getFhevmChainWithUpdatedRpcUrl(chainAlias, chain);
    }

    function _cheatcodeErrorText(bytes memory err) private pure returns (string memory) {
        // The first four bytes ARE the selector: a deliberate truncation, not a value that could be lost.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (err.length >= 4 && bytes4(err) == bytes4(keccak256("CheatcodeError(string)"))) {
            bytes memory payload = new bytes(err.length - 4);
            for (uint256 i = 0; i < payload.length; i++) {
                payload[i] = err[i + 4];
            }
            return abi.decode(payload, (string));
        }
        return vm.toString(err);
    }

    function setFallbackToDefaultFhevmRpcUrls(bool useDefault) internal {
        fallbackToDefaultRpcUrls = useDefault;
    }

    function initializeStdFhevmChains() private {
        if (stdFhevmChainsInitialized) return;

        stdFhevmChainsInitialized = true;

        setFhevmChainWithDefaultRpcUrl(
            "anvil",
            FhevmChainData({
                fhevmGroup: FHEVM_LOCAL_GROUP,
                chainId: 31337,
                rpcUrl: "http://127.0.0.1:8545",
                relayerUrl: "",
                acl: ACL_ADDRESS,
                fhevmExecutor: FHEVM_EXECUTOR_ADDRESS,
                inputVerifier: INPUT_VERIFIER_ADDRESS,
                kmsVerifier: KMS_VERIFIER_ADDRESS,
                protocolConfig: PROTOCOL_CONFIG_ADDRESS,
                decryption: LocalHostBootstrap.DECRYPTION_ADDRESS,
                inputVerification: LocalHostBootstrap.INPUT_VERIFICATION_ADDRESS
            })
        );

        // mainnet
        setFhevmChainWithDefaultRpcUrl(
            "mainnet",
            FhevmChainData({
                fhevmGroup: FHEVM_MAINNET_GROUP,
                chainId: 1,
                rpcUrl: "https://eth.llamarpc.com",
                relayerUrl: "https://relayer.mainnet.zama.org",
                acl: 0xcA2E8f1F656CD25C01F05d0b243Ab1ecd4a8ffb6,
                fhevmExecutor: 0xD82385dADa1ae3E969447f20A3164F6213100e75,
                inputVerifier: 0xCe0FC2e05CFff1B719EFF7169f7D80Af770c8EA2,
                kmsVerifier: 0x77627828a55156b04Ac0DC0eb30467f1a552BB03,
                protocolConfig: 0xD8236B57394f90726b26aB25D38CeAC776E1a7C4,
                decryption: 0x0f6024a97684f7d90ddb0fAAD79cB15F2C888D24,
                inputVerification: 0xcB1bB072f38bdAF0F328CdEf1Fc6eDa1DF029287
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "polygon",
            FhevmChainData({
                fhevmGroup: FHEVM_MAINNET_GROUP,
                chainId: 137,
                rpcUrl: "https://polygon-rpc.com",
                relayerUrl: "https://relayer.mainnet.zama.org",
                acl: 0x6737F17e31cf26a1b62fb0362acC5a16CB156F49,
                fhevmExecutor: 0xAB0075E77fe06083f52bdf10e2ccDB3712483057,
                inputVerifier: 0xf40BD204B035522EaAc8E5afAdc55113Acac96ca,
                kmsVerifier: 0x14e609595474874Dd6b6128376E336EfADfdBE37,
                protocolConfig: 0x17f62Ab3A1Ea519703cD597410147A30Fa1a7f1e,
                decryption: 0x0f6024a97684f7d90ddb0fAAD79cB15F2C888D24,
                inputVerification: 0xcB1bB072f38bdAF0F328CdEf1Fc6eDa1DF029287
            })
        );

        // testnet
        setFhevmChainWithDefaultRpcUrl(
            "sepolia",
            FhevmChainData({
                fhevmGroup: FHEVM_TESTNET_GROUP,
                chainId: 11155111,
                rpcUrl: "https://sepolia.infura.io/v3/b9794ad1ddf84dfb8c34d6bb5dca2001",
                relayerUrl: "https://relayer.testnet.zama.org",
                acl: 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D,
                fhevmExecutor: 0x92C920834Ec8941d2C77D188936E1f7A6f49c127,
                inputVerifier: 0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0,
                kmsVerifier: 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A,
                protocolConfig: 0x51f9AFBc89Ea792e1a21a12AB802ab58D4dbee83,
                decryption: 0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478,
                inputVerification: 0x483b9dE06E4E4C7D35CCf5837A1668487406D955
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "polygon_amoy",
            FhevmChainData({
                fhevmGroup: FHEVM_TESTNET_GROUP,
                chainId: 80002,
                rpcUrl: "https://rpc-amoy.polygon.technology",
                relayerUrl: "https://relayer.testnet.zama.org",
                acl: 0xD99Cb9Fc3c42c87f2A4A12e8Fd60318d6bDdf985,
                fhevmExecutor: 0x89420269f61e4db00545cd99da0aEcA7fF0912f9,
                inputVerifier: 0x6e5A7D8b0c645467Cba7e62D6624917085118631,
                kmsVerifier: 0xCD1D89E311bce4C8DEa9a0857a0c9A4E153D4041,
                protocolConfig: 0x4CcF009Aba90D04f52b31fc7aDdE240578aFe10F,
                decryption: 0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478,
                inputVerification: 0x483b9dE06E4E4C7D35CCf5837A1668487406D955
            })
        );

        // devnet
        setFhevmChainWithDefaultRpcUrl(
            "sepolia",
            FhevmChainData({
                fhevmGroup: FHEVM_DEVNET_GROUP,
                chainId: 11155111,
                rpcUrl: "https://sepolia.infura.io/v3/b9794ad1ddf84dfb8c34d6bb5dca2001",
                relayerUrl: "https://relayer.dev.zama.cloud",
                acl: 0x1aC3073813148992aA928C9903681fA7Ec202b13,
                fhevmExecutor: 0x356cc81A08aa782C96F00dC30b60d4f33f1a4e43,
                inputVerifier: 0x160AaB6199FAEAEA1B27E62999c597E530a3abA9,
                kmsVerifier: 0xDe8893C04e118431aeC076A39F6aFa951669F720,
                protocolConfig: 0x257950EbB65A1D2b697f03D08E7D3Dc26CbDB304,
                decryption: 0x14666350f146dD290F90775fD7C455F4214540F3,
                inputVerification: 0x0cCBE5E1Ffb84b23E4e258038B2933EFF186CC3F
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "polygon_amoy",
            FhevmChainData({
                fhevmGroup: FHEVM_DEVNET_GROUP,
                chainId: 80002,
                rpcUrl: "https://rpc-amoy.polygon.technology",
                relayerUrl: "https://relayer.dev.zama.cloud",
                acl: 0x78753a24821f1442e139F9a8b19acABB4DA643cF,
                fhevmExecutor: 0x5fE86659DACAFc91C180d79D0c9E6E7C3d9c09aF,
                inputVerifier: 0x92e65718A1A31388C3D9C45E46121fFd0a099081,
                kmsVerifier: 0xAE8fd848428e0f332c0169ACC5b97Ac7c0B8696E,
                protocolConfig: 0x803ec8b1198e6d0261fb96959f6d13CB0879AEef,
                decryption: 0x14666350f146dD290F90775fD7C455F4214540F3,
                inputVerification: 0x0cCBE5E1Ffb84b23E4e258038B2933EFF186CC3F
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "bnb_smart_chain_testnet",
            FhevmChainData({
                fhevmGroup: FHEVM_DEVNET_GROUP,
                chainId: 97,
                rpcUrl: "https://rpc.ankr.com/bsc_testnet_chapel",
                relayerUrl: "https://relayer.dev.zama.cloud",
                acl: 0x90F1BC86eB99FC0235C21867133331F9C2d3CDE4,
                fhevmExecutor: 0x5cb8D716998e5D7aD2a7B45b172e2287CaDE1B7c,
                inputVerifier: 0xe8a9fA7cc4ab46Dfe9EE681f6059145275296891,
                kmsVerifier: 0x0E2e5A922b9f6bB94245Cc26B30FaCb603d1BD49,
                protocolConfig: 0xb5ca060165B169b46782044a82D9D043e4D5Fde3,
                decryption: 0x14666350f146dD290F90775fD7C455F4214540F3,
                inputVerification: 0x0cCBE5E1Ffb84b23E4e258038B2933EFF186CC3F
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "hoodi",
            FhevmChainData({
                fhevmGroup: FHEVM_DEVNET_GROUP,
                chainId: 560048,
                rpcUrl: "https://rpc.hoodi.ethpandaops.io",
                relayerUrl: "https://relayer.dev.zama.cloud",
                acl: 0xC00119D680d63386E76b37Ec21e09E1A23399FBc,
                fhevmExecutor: 0x91751a280a364e337D307A7f9719637E68Ec298E,
                inputVerifier: 0x333b25BeBea93293179717e19298AacD876c7e37,
                kmsVerifier: 0x9a359B9CbeAC4e87bC0A3DbAa96002fa8876754B,
                protocolConfig: 0x31251B7F1Ce25c0E874121144173B1474555F327,
                decryption: 0x14666350f146dD290F90775fD7C455F4214540F3,
                inputVerification: 0x0cCBE5E1Ffb84b23E4e258038B2933EFF186CC3F
            })
        );

        // THE DEFAULT GROUP OF EVERY ALIAS
        setDefaultFhevmGroup("anvil", FHEVM_LOCAL_GROUP);
        setDefaultFhevmGroup("mainnet", FHEVM_MAINNET_GROUP);
        setDefaultFhevmGroup("polygon", FHEVM_MAINNET_GROUP);
        setDefaultFhevmGroup("sepolia", FHEVM_TESTNET_GROUP);
        setDefaultFhevmGroup("polygon_amoy", FHEVM_TESTNET_GROUP);
        setDefaultFhevmGroup("bnb_smart_chain_testnet", FHEVM_DEVNET_GROUP);
        setDefaultFhevmGroup("hoodi", FHEVM_DEVNET_GROUP);
    }

    function setFhevmChainWithDefaultRpcUrl(string memory chainAlias, FhevmChainData memory chain) private {
        string memory rpcUrl = chain.rpcUrl;
        defaultRpcUrls[chainAlias] = rpcUrl;
        chain.rpcUrl = "";
        setFhevmChain(chainAlias, chain);
        chain.rpcUrl = rpcUrl; // restore argument
    }
}
