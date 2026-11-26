// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibForgeFhevmUpgrade} from "../../pkg/forge/src/LibForgeFhevmUpgrade.sol";
import {LibHostUpgradeCode} from "../../pkg/forge/src/LibHostUpgradeCode.sol";
import {
    ERC1967_PROXY_CREATION_CODE,
    FhevmAddressRole,
    FhevmHostContracts
} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {ICleartextDB} from "../../pkg/forge/src/_internal/interfaces/ICleartextDB.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {IEmptyUUPSProxy} from "../../pkg/forge/src/_internal/interfaces/IEmptyUUPSProxy.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {FhevmGeneration, LibForgeFhevmHostVersions} from "../../pkg/forge/src/LibForgeFhevmHostVersions.sol";
import {FhevmChainsConfig} from "../utils/FhevmChainsConfig.sol";
import {ForkBlock} from "../utils/ForkBlock.sol";

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/**
 * `CleartextImplementationSwap` showed a proxy can carry the production executor and
 * the cleartext one interchangeably, on a LOCAL stack where every sibling address is the one the blobs
 * bake in. This asks the remaining question: does it still work when the addresses are a real chain's?
 *
 * TWO CHAINS, ONE RECIPE, and the difference between them is the point. Devnet Sepolia runs this SDK's own
 * protocol line, so the cleartext swap is the ONLY thing under test there -- a failure has one possible
 * cause. Testnet Sepolia is a generation behind, so the same swap runs on top of the `<vN-1>` -> `<vN>` upgrade,
 * which is what a real user forking a lagging chain would get. Devnet proves the mechanism; testnet proves
 * it composes. Once testnet has upgraded too, there is nothing left to compose, and its cases skip.
 *
 * NOTHING IS COMPILED AGAINST THESE ADDRESSES. Every implementation comes out of `LocalHostUpgrade` and is
 * rewritten for the fork by `LibHostUpgradeCode` -- the executor's arithmetic, the arithmetic's DB, and
 * each contract's ACL. That is the whole point of the exercise: the deploy path here is the patch path.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *          forge test --match-contract DevnetCleartextUpgrade -vv
 */
abstract contract ForkCleartextUpgrade is Test {
    address internal ACL;
    address internal EXECUTOR;
    address internal KMS_VERIFIER;
    address internal INPUT_VERIFIER;
    address internal HCU_LIMIT;
    address internal PROTOCOL_CONFIG;
    address internal KMS_GENERATION;
    address internal PAUSER_SET;

    /// @dev `fheMulDiv`'s bitmask: bit 0 (the divisor) is always set, bit 1 marks factor2 as scalar.
    bytes1 internal constant SCALAR_FACTOR_AND_DIVISOR = 0x03;

    bool internal forked;
    address internal owner;

    /// @dev The stack this case forks, and whether it needs bringing forward a generation first.
    function _chain() internal virtual;

    /// @dev The generation the forked stack runs, read from each contract's `getVersion()` as `FhevmVm` reads it.
    function _generation() internal view returns (FhevmGeneration) {
        return LibForgeFhevmHostVersions.classify(
            LibForgeFhevmHostVersions.read(
                ACL, EXECUTOR, KMS_VERIFIER, INPUT_VERIFIER, HCU_LIMIT, PROTOCOL_CONFIG, KMS_GENERATION
            )
        );
    }

    /// @dev The host contracts of `host` in the network group `group`, from fhevm-chains.config.json.
    function _readHost(string memory group, string memory host) internal {
        ACL = FhevmChainsConfig.hostContract(group, host, "acl");
        EXECUTOR = FhevmChainsConfig.hostContract(group, host, "fhevmExecutor");
        KMS_VERIFIER = FhevmChainsConfig.hostContract(group, host, "kmsVerifier");
        INPUT_VERIFIER = FhevmChainsConfig.hostContract(group, host, "inputVerifier");
        HCU_LIMIT = FhevmChainsConfig.hostContract(group, host, "hcuLimit");
        PROTOCOL_CONFIG = FhevmChainsConfig.hostContract(group, host, "protocolConfig");
        KMS_GENERATION = FhevmChainsConfig.hostContract(group, host, "kmsGeneration");
        PAUSER_SET = FhevmChainsConfig.hostContract(group, host, "pauserSet");
    }
    function _isAGenerationBehind() internal pure virtual returns (bool);

    /// @dev ROUTE. A: the generation upgrade lands on the production implementations and the executor is
    ///      swapped to cleartext afterwards, so its proxy moves twice. B: one pass, where the executor's
    ///      op re-points straight to `CleartextFHEVMExecutor` and its `reinitializeV6` runs on that.
    function _singlePass() internal pure virtual returns (bool) {
        return false;
    }

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            try vm.rpcUrl("sepolia") returns (string memory configured) {
                rpc = configured;
            } catch {}
        }
        if (bytes(rpc).length == 0) return;

        _chain();
        ForkBlock.createSelectFork(rpc, "SEPOLIA_FORK_BLOCK");
        forked = true;
        owner = IACL(ACL).owner();
    }

    function test_aForkedProductionStackBecomesCleartext() public {
        vm.skip(!forked);
        // A case written for a lagging chain tests the upgrade from the previous generation. Once the chain has
        // upgraded, that upgrade has nothing to apply to, so the case skips. A chain on the current line can
        // still read `Unknown`, when one contract runs a newer release than the one this SDK vendors.
        vm.skip(
            _isAGenerationBehind() && _generation() != FhevmGeneration.Previous,
            "the chain is no longer a generation behind, so no generation upgrade is left to compose"
        );

        // -- 0. it really is a production stack ------------------------------------------------------
        assertFalse(LibCleartextProbe.isCleartext(EXECUTOR), "the chain runs the real executor");

        // -- 0b. a chain that lags gets brought forward FIRST, exactly as `FhevmVm` does it -----------
        if (_isAGenerationBehind() && !_singlePass()) {
            LibForgeFhevmUpgrade.upgradeFromPreviousGeneration(_roles(address(0), address(0)));
            assertFalse(LibCleartextProbe.isCleartext(EXECUTOR), "still production, just a newer one");
        }

        // -- 1. the two contracts a real chain has never heard of, behind bootstrap proxies -----------
        address[10] memory addresses = _roles(address(0), address(0));
        address emptyImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.EmptyUUPSProxy, addresses));
        bytes memory initEmpty = abi.encodeCall(IEmptyUUPSProxy.initialize, ());
        address dbProxy = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));
        address arithmeticProxy =
            _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));

        // now every role has an address, including the two just created
        addresses = _roles(arithmeticProxy, dbProxy);

        // -- 2. materialize them, each patched for THIS chain -----------------------------------------
        address dbImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextDB, addresses));
        vm.prank(owner);
        IUUPSProxy(dbProxy)
            .upgradeToAndCall(dbImpl, abi.encodeCall(ICleartextDB.initializeFromEmptyProxy, (arithmeticProxy)));

        address arithmeticImpl =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextArithmetic, addresses));
        vm.prank(owner);
        IUUPSProxy(arithmeticProxy)
            .upgradeToAndCall(arithmeticImpl, abi.encodeCall(ICleartextArithmetic.initializeFromEmptyProxy, ()));

        // -- 3. THE MOVE: the chain's own executor proxy, pointed at the cleartext implementation ------
        if (_isAGenerationBehind() && _singlePass()) {
            _upgradeGenerationStraightToCleartext(addresses);
        } else {
            address executorImpl =
                _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextFHEVMExecutor, addresses));
            vm.prank(owner);
            IUUPSProxy(EXECUTOR).upgradeToAndCall(executorImpl, "");
        }

        assertTrue(LibCleartextProbe.isCleartext(EXECUTOR), "the forked stack is now a cleartext one");
        if (_isAGenerationBehind() && _singlePass()) {
            assertTrue(LibCleartextProbe.isCleartext(ACL), "and so is the ACL");
            assertTrue(LibCleartextProbe.isCleartext(KMS_VERIFIER), "and the KMS verifier");
            assertTrue(LibCleartextProbe.isCleartext(INPUT_VERIFIER), "and the input verifier");
            assertTrue(LibCleartextProbe.isCleartext(HCU_LIMIT), "and the HCU limit");
        }

        // -- 4. and it records what it computes, with no event in sight -------------------------------
        bytes32 handle = ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(7, FheType.Uint32);
        assertEq(ICleartextDB(dbProxy).get(handle), 7, "the DB holds the plaintext");
        assertEq(ICleartextFHEVMExecutor(EXECUTOR).plaintexts(handle), 7, "and the executor answers for it");

        // -- 5. AN OPERATION `v14` ADDED, which is what makes this test able to fail ---------------------
        //
        // `trivialEncrypt` above cannot tell the two generations apart -- both implement it the same way,
        // so step 4 passes whether or not the upgrade that was supposed to run did. `fheMulDiv` is what
        // `v14` ADDED: the executor routes it to `HCULimit.checkHCUForFheMulDiv`, a function a `v13` HCULimit
        // did not have. Reaching a correct answer here means every contract the call touches really is
        // this generation's, not just the executor.
        bytes32 factor = ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(10, FheType.Uint32);
        bytes32 product = ICleartextFHEVMExecutor(EXECUTOR)
            .fheMulDiv(factor, bytes32(uint256(3)), bytes32(uint256(2)), SCALAR_FACTOR_AND_DIVISOR);
        assertEq(ICleartextFHEVMExecutor(EXECUTOR).plaintexts(product), 15, "10 * 3 / 2, computed by the stack");
    }

    /// @dev One address per `FhevmAddressRole`: this chain's, not this package's.
    function _roles(address arithmetic, address db) internal view returns (address[10] memory addresses) {
        addresses[uint8(FhevmAddressRole.ACL)] = ACL;
        addresses[uint8(FhevmAddressRole.FHEVMExecutor)] = EXECUTOR;
        addresses[uint8(FhevmAddressRole.KMSVerifier)] = KMS_VERIFIER;
        addresses[uint8(FhevmAddressRole.InputVerifier)] = INPUT_VERIFIER;
        addresses[uint8(FhevmAddressRole.HCULimit)] = HCU_LIMIT;
        addresses[uint8(FhevmAddressRole.ProtocolConfig)] = PROTOCOL_CONFIG;
        addresses[uint8(FhevmAddressRole.KMSGeneration)] = KMS_GENERATION;
        addresses[uint8(FhevmAddressRole.PauserSet)] = PAUSER_SET;
        addresses[uint8(FhevmAddressRole.CleartextArithmetic)] = arithmetic;
        addresses[uint8(FhevmAddressRole.CleartextDB)] = db;
    }

    /**
     * @dev ROUTE B: the generation's own op list, with ONE substitution -- the executor's implementation is
     *      the cleartext subclass rather than the production one. `reinitializeV6` is inherited, so the
     *      same init data runs on it, and the proxy moves once instead of twice.
     */
    function _upgradeGenerationStraightToCleartext(address[10] memory addresses) private {
        for (uint256 index = 0; index < LibForgeFhevmUpgrade.OP_COUNT; index++) {
            FhevmHostContracts implementation = _cleartextCounterpart(LibForgeFhevmUpgrade.opImplementation(index));
            address deployed = _create(LibHostUpgradeCode.creationCodeFor(implementation, addresses));
            vm.prank(owner);
            IUUPSProxy(addresses[uint8(LibForgeFhevmUpgrade.opProxyRole(index))])
                .upgradeToAndCall(deployed, LibForgeFhevmUpgrade.opInitData(index));
        }

        // AND THE ONE THE OP LIST CANNOT REACH. `InputVerifier` is absent from the generation upgrade on
        // purpose -- its bytecode is the same in both generations -- but it has a cleartext subclass all
        // the same, so the cleartext pass has to visit it separately. No init data: nothing new to
        // initialize, and the generation did not move under it.
        address cleartextInputVerifier =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextInputVerifier, addresses));
        vm.prank(owner);
        IUUPSProxy(INPUT_VERIFIER).upgradeToAndCall(cleartextInputVerifier, "");
    }

    /**
     * @dev THE SUBSTITUTION THE WHOLE DESIGN TURNS ON. Five of the seven host contracts have a cleartext
     *      subclass -- `CleartextACL is ACL`, and so on -- which adds behaviour over an identical storage
     *      layout and inherits the same reinitializers. So the generation's op list can name the subclass
     *      wherever one exists and arrive at a cleartext stack in the one pass it would have taken to
     *      arrive at a production one. `ProtocolConfig` and `KMSGeneration` have no cleartext variant and
     *      need none: nothing about them differs between a mock stack and a real one.
     */
    function _cleartextCounterpart(FhevmHostContracts implementation) private pure returns (FhevmHostContracts) {
        if (implementation == FhevmHostContracts.FHEVMExecutor) return FhevmHostContracts.CleartextFHEVMExecutor;
        if (implementation == FhevmHostContracts.ACL) return FhevmHostContracts.CleartextACL;
        if (implementation == FhevmHostContracts.KMSVerifier) return FhevmHostContracts.CleartextKMSVerifier;
        if (implementation == FhevmHostContracts.InputVerifier) return FhevmHostContracts.CleartextInputVerifier;
        if (implementation == FhevmHostContracts.HCULimit) return FhevmHostContracts.CleartextHCULimit;
        return implementation;
    }

    function _create(bytes memory creationCode) internal returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "deploy failed");
    }
}

/// THE MECHANISM ALONE: devnet is on this SDK's line, so only the cleartext swap runs.
contract DevnetCleartextUpgradeTest is ForkCleartextUpgrade {
    function _chain() internal override {
        _readHost("devnet", "ethereum_sepolia");
    }

    function _isAGenerationBehind() internal pure override returns (bool) {
        return false;
    }
}

/// IT COMPOSES: testnet is a generation behind, so the swap runs on top of the `<vN-1>` -> `<vN>` upgrade. This is
/// what a user forking a chain that has not upgraded yet would actually get. It skips once testnet has upgraded.
contract TestnetCleartextUpgradeTest is ForkCleartextUpgrade {
    function _chain() internal override {
        _readHost("testnet", "ethereum_sepolia");
    }

    function _isAGenerationBehind() internal pure override returns (bool) {
        return true;
    }
}

/// ROUTE B: the same generation upgrade, but the executor goes straight to cleartext in the one pass.
contract TestnetSinglePassCleartextUpgradeTest is TestnetCleartextUpgradeTest {
    function _singlePass() internal pure override returns (bool) {
        return true;
    }
}
