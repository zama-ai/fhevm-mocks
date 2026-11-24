// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {VmSafe} from "forge-std/Vm.sol";

import {LibFhevmFail} from "./LibFhevmFail.sol";

import {
    ACL_ADDRESS,
    FHEVM_EXECUTOR_ADDRESS,
    INPUT_VERIFIER_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    PROTOCOL_CONFIG_ADDRESS,
    KMS_GENERATION_ADDRESS
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
        address kmsGeneration;
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
        // Zero where a chain has none: it arrived with the 0.13 line, and only three deployments carry
        // one today. No contract exposes its address, so unlike `hcuLimit` or `pauserSet` it cannot be
        // resolved from the chain and has to come from the table.
        address kmsGeneration;
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
            kmsGeneration: chain.kmsGeneration,
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
                kmsGeneration: chain.kmsGeneration,
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
            kmsGeneration: KMS_GENERATION_ADDRESS,
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
                kmsGeneration: KMS_GENERATION_ADDRESS,
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
                kmsGeneration: 0xf102cC9A9D2174630c394f5b7B7D63104E348daa,
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
                kmsGeneration: address(0),
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
                kmsGeneration: 0x77389113d7000EcBCfc2bDed57202f5f46109934,
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
                kmsGeneration: address(0),
                decryption: 0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478,
                inputVerification: 0x483b9dE06E4E4C7D35CCf5837A1668487406D955
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "bnb_smart_chain_testnet",
            FhevmChainData({
                fhevmGroup: FHEVM_TESTNET_GROUP,
                chainId: 97,
                rpcUrl: "https://rpc.ankr.com/bsc_testnet_chapel",
                relayerUrl: "https://relayer.testnet.zama.org",
                acl: 0x9Adac873Ae2f737AF011f0778305Cff0B220ac36,
                fhevmExecutor: 0x24f6bBCd97E2FE90E43cb9C32B89A9828d8Ece08,
                inputVerifier: 0xDd378841F0125656b97818d9d371e1027Df4c424,
                kmsVerifier: 0x1F7CAD0c05fDED5F988683AdfDB4F242b310cdcB,
                protocolConfig: 0xC320dd3d4e15D8E4c20dff42fE09Aa936A88b3ED,
                kmsGeneration: address(0),
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
                acl: 0x274D67464238A0176f5686688294C0C0C87695CE,
                fhevmExecutor: 0x25bAD8981E3DC5e400427dF7718B23337471837e,
                inputVerifier: 0xf0b044e97E201beCDE38ceB2853653070411327C,
                kmsVerifier: 0xe053E4858762F773553f6123dcC0116299055790,
                protocolConfig: 0x06678E0EC3e348fE1Ce7908de586152be08bF16B,
                kmsGeneration: 0x0dD49BCC50d4fa4d57df79eEB83a15cC450280aD,
                decryption: 0x6933C9Fb890e2417e35b4cB0A66b2f84939a61E3,
                inputVerification: 0x01d1829c7Eba4D1F53Ba4f1DfD6a269a8328fa5e
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "polygon_amoy",
            FhevmChainData({
                fhevmGroup: FHEVM_DEVNET_GROUP,
                chainId: 80002,
                rpcUrl: "https://rpc-amoy.polygon.technology",
                relayerUrl: "https://relayer.dev.zama.cloud",
                acl: 0x11602f8b66f8deDEd0EcDCAa098bcF937f2f318D,
                fhevmExecutor: 0x8E01218Ec6C825E7AB32A20a724C40536bb69F35,
                inputVerifier: 0x48812B8ECF9DE3788D07aD0d3feb621d41755AeA,
                kmsVerifier: 0xAAfea113905ae09364cAC9AF308Bb426f63D6B53,
                protocolConfig: 0x473C62A2E6B30AE61F5C99BBB2edc9BB51Cd6Bc9,
                kmsGeneration: address(0),
                decryption: 0x6933C9Fb890e2417e35b4cB0A66b2f84939a61E3,
                inputVerification: 0x01d1829c7Eba4D1F53Ba4f1DfD6a269a8328fa5e
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "bnb_smart_chain_testnet",
            FhevmChainData({
                fhevmGroup: FHEVM_DEVNET_GROUP,
                chainId: 97,
                rpcUrl: "https://rpc.ankr.com/bsc_testnet_chapel",
                relayerUrl: "https://relayer.dev.zama.cloud",
                acl: 0x57a7452069EBe533f78A8af586cC9CA785293fec,
                fhevmExecutor: 0x54cED3fF5B20A4F957D9553f25b0D2530F611D92,
                inputVerifier: 0x9130e44D97b15EDc091ABa5A8B1dCEAD322aB840,
                kmsVerifier: 0x1296ae537edDFBD31437927B94f3c5930Bd83eE3,
                protocolConfig: 0x19AF5cea8629b203E170C2ede7B79DB645EF25fb,
                kmsGeneration: address(0),
                decryption: 0x6933C9Fb890e2417e35b4cB0A66b2f84939a61E3,
                inputVerification: 0x01d1829c7Eba4D1F53Ba4f1DfD6a269a8328fa5e
            })
        );
        setFhevmChainWithDefaultRpcUrl(
            "hoodi",
            FhevmChainData({
                fhevmGroup: FHEVM_DEVNET_GROUP,
                chainId: 560048,
                rpcUrl: "https://rpc.hoodi.ethpandaops.io",
                relayerUrl: "https://relayer.dev.zama.cloud",
                acl: 0x46194d2e24918f414F0a3FE11713f70e5cEd09E4,
                fhevmExecutor: 0x3C7038171808e4560325688670aD292764B22A6F,
                inputVerifier: 0x890ad817023b91308c23F6437Ac2E5F90F6e83eF,
                kmsVerifier: 0xEa96BDC2f36Cab4BaeC82dbCFBcDbDFeBD265553,
                protocolConfig: 0x01ee28C68A55242dc63Be2ab25d43bc67C3285C1,
                kmsGeneration: address(0),
                decryption: 0x6933C9Fb890e2417e35b4cB0A66b2f84939a61E3,
                inputVerification: 0x01d1829c7Eba4D1F53Ba4f1DfD6a269a8328fa5e
            })
        );

        // THE DEFAULT GROUP OF EVERY ALIAS
        setDefaultFhevmGroup("anvil", FHEVM_LOCAL_GROUP);
        setDefaultFhevmGroup("mainnet", FHEVM_MAINNET_GROUP);
        setDefaultFhevmGroup("polygon", FHEVM_MAINNET_GROUP);
        setDefaultFhevmGroup("sepolia", FHEVM_TESTNET_GROUP);
        setDefaultFhevmGroup("polygon_amoy", FHEVM_TESTNET_GROUP);
        setDefaultFhevmGroup("bnb_smart_chain_testnet", FHEVM_TESTNET_GROUP);
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
