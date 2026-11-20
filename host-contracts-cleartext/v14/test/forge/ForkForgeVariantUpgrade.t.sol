// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {LibHostUpgradeCode} from "../../pkg/forge/src/LibHostUpgradeCode.sol";
import {
    ERC1967_PROXY_CREATION_CODE,
    FhevmAddressRole,
    FhevmHostContracts
} from "../../pkg/forge/src/_internal/LocalHostBytecode.sol";
import {IACL} from "../../pkg/forge/src/_internal/interfaces/IACL.sol";
import {ICleartextArithmetic} from "../../pkg/forge/src/_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextDB} from "../../pkg/forge/src/_internal/interfaces/ICleartextDB.sol";
import {ICleartextFHEVMExecutor} from "../../pkg/forge/src/_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {IEmptyUUPSProxy} from "../../pkg/forge/src/_internal/interfaces/IEmptyUUPSProxy.sol";
import {LibCleartextProbe} from "../../pkg/forge/src/shared/LibCleartextProbe.sol";
import {FheType} from "../../pkg/forge/src/shared/LibFheType.sol";
import {FhevmChainsConfig} from "../utils/FhevmChainsConfig.sol";

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/**
 * the WHOLE forge-variant set on a forked stack, not just the executor.
 *
 * `ForkForgeVariantMeasurement` established the two facts this rests on -- an over-EIP-170
 * implementation deploys fine inside a test, and `allowCheatcodes` on the PROXY is what lets a
 * cheatcode-calling implementation run behind one the fork brought with it. What it did not do is install
 * the set, or ask for anything the forge variants exist for.
 *
 * THREE OF THE FOUR ARE ONLY OBSERVABLE IF YOU ASK THE RIGHT QUESTION:
 *   - `fheRand` goes through `vmSafe.randomUint()` in the forge arithmetic, and through something else in
 *     the plain one. A stack that took the plain variant still answers -- differently.
 *   - the forge variants pause gas metering around their bookkeeping, so the mock's cost does not land on
 *     a test's measurement. Asserted here as a COMPARISON against the plain variant rather than a
 *     threshold, because the absolute number is forge's business and would rot.
 *   - `IS_FORGE` is the only way to tell the two apart: `getVersion()` says the same for both.
 *
 * WHICH CONTRACTS. Four have a forge twin -- ACL, executor, HCULimit, arithmetic. KMSVerifier and
 * InputVerifier have only the plain cleartext variant, and the DB has one implementation. That ragged
 * coverage is the thing a substitution table has to encode, so it is stated here as assertions.
 *
 *          SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
 *          forge test --match-contract ForkForgeVariantUpgrade -vv
 */
contract ForkForgeVariantUpgradeTest is Test {
    /// @dev Devnet Sepolia's host contracts, read from fhevm-chains.config.json by `setUp`.
    address internal ACL;
    address internal EXECUTOR;
    address internal KMS_VERIFIER;
    address internal INPUT_VERIFIER;
    address internal HCU_LIMIT;
    address internal PROTOCOL_CONFIG;
    address internal KMS_GENERATION;
    address internal PAUSER_SET;

    bool internal forked;
    address internal owner;
    address internal arithmeticProxy;
    address internal dbProxy;

    function setUp() public {
        ACL = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "acl");
        EXECUTOR = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "fhevmExecutor");
        KMS_VERIFIER = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "kmsVerifier");
        INPUT_VERIFIER = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "inputVerifier");
        HCU_LIMIT = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "hcuLimit");
        PROTOCOL_CONFIG = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "protocolConfig");
        KMS_GENERATION = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "kmsGeneration");
        PAUSER_SET = FhevmChainsConfig.hostContract("devnet", "ethereum_sepolia", "pauserSet");

        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
        owner = IACL(ACL).owner();
    }

    /// The whole set, then the questions only a forge variant answers correctly.
    function test_theForgeVariantSetRunsOnAForkedStack() public {
        vm.skip(!forked);
        _upgradeToCleartext(true);

        // -- the four that have a forge twin took it ---------------------------------------------------
        assertTrue(LibCleartextProbe.isForge(EXECUTOR), "executor is the forge variant");
        assertTrue(LibCleartextProbe.isForge(ACL), "and the ACL");
        assertTrue(LibCleartextProbe.isForge(HCU_LIMIT), "and the HCU limit");
        assertTrue(LibCleartextProbe.isForge(arithmeticProxy), "and the arithmetic");

        // -- the ones that do not are cleartext all the same --------------------------------------------
        assertTrue(LibCleartextProbe.isCleartext(KMS_VERIFIER), "kms verifier is cleartext");
        assertFalse(LibCleartextProbe.isForge(KMS_VERIFIER), "but has no forge twin");
        assertTrue(LibCleartextProbe.isCleartext(INPUT_VERIFIER), "input verifier is cleartext");
        assertFalse(LibCleartextProbe.isForge(INPUT_VERIFIER), "and no forge twin either");

        // -- the stack computes ------------------------------------------------------------------------
        bytes32 handle = ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(7, FheType.Uint32);
        assertEq(ICleartextDB(dbProxy).get(handle), 7, "and records what it computes");

        // -- `fheRand`, which is the forge arithmetic's own path ----------------------------------------
        // The plain variant would answer too, from a different source; what matters here is that the call
        // reaches `vmSafe.randomUint()` behind a foreign proxy at all, which needs the grant.
        bytes32 random = ICleartextFHEVMExecutor(EXECUTOR).fheRand(FheType.Uint32);
        assertTrue(ICleartextDB(dbProxy).has(random), "the random handle has a plaintext");
        assertLe(ICleartextDB(dbProxy).get(random), type(uint32).max, "and it fits its type");
    }

    /**
     * WHY THE FORGE VARIANT EXISTS, measured. The same operation on the same forked stack, once with the
     * forge implementations and once with the plain ones: the forge one must charge the caller LESS,
     * because its bookkeeping runs with metering paused.
     *
     * A comparison, not a threshold. The absolute cost is forge's to change.
     */
    function test_theForgeVariantKeepsItsBookkeepingOffTheMeter() public {
        vm.skip(!forked);

        _upgradeToCleartext(false);
        uint256 before = gasleft();
        ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(7, FheType.Uint32);
        uint256 plain = before - gasleft();

        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL")); // a clean stack, nothing carried over
        _upgradeToCleartext(true);
        before = gasleft();
        ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(7, FheType.Uint32);
        uint256 metered = before - gasleft();

        emit log_named_uint("plain cleartext, gas charged", plain);
        emit log_named_uint("forge variant,   gas charged", metered);
        assertLt(metered, plain, "the forge variant keeps its bookkeeping off the caller's meter");
    }

    // -- the upgrade ---------------------------------------------------------------------------------

    /// @dev `useForgeVariants` picks the twin wherever one exists. Every proxy that receives a
    ///      cheatcode-calling implementation is granted access FIRST: a forked chain's proxy is not
    ///      something forge created, so it has none by default.
    function _upgradeToCleartext(bool useForgeVariants) private {
        _installStore(useForgeVariants);

        _repoint(ACL, useForgeVariants ? FhevmHostContracts.CleartextForgeACL : FhevmHostContracts.CleartextACL);
        _repoint(
            EXECUTOR,
            useForgeVariants
                ? FhevmHostContracts.CleartextForgeFHEVMExecutor
                : FhevmHostContracts.CleartextFHEVMExecutor
        );
        _repoint(
            HCU_LIMIT,
            useForgeVariants ? FhevmHostContracts.CleartextForgeHCULimit : FhevmHostContracts.CleartextHCULimit
        );
        _repoint(KMS_VERIFIER, FhevmHostContracts.CleartextKMSVerifier); // no forge twin
        _repoint(INPUT_VERIFIER, FhevmHostContracts.CleartextInputVerifier); // nor here

        if (useForgeVariants) {
            vm.allowCheatcodes(ACL);
            vm.allowCheatcodes(EXECUTOR);
            vm.allowCheatcodes(HCU_LIMIT);
            vm.allowCheatcodes(arithmeticProxy);
        }
    }

    function _installStore(bool useForgeVariants) private {
        address emptyImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.EmptyUUPSProxy, _roles()));
        bytes memory initEmpty = abi.encodeCall(IEmptyUUPSProxy.initialize, ());
        dbProxy = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));
        arithmeticProxy = _create(abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImpl, initEmpty)));

        address dbImpl = _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextDB, _roles()));
        vm.prank(owner);
        IUUPSProxy(dbProxy)
            .upgradeToAndCall(dbImpl, abi.encodeCall(ICleartextDB.initializeFromEmptyProxy, (arithmeticProxy)));

        address arithmeticImpl = _create(
            LibHostUpgradeCode.creationCodeFor(
                useForgeVariants ? FhevmHostContracts.CleartextForgeArithmetic : FhevmHostContracts.CleartextArithmetic,
                _roles()
            )
        );
        vm.prank(owner);
        IUUPSProxy(arithmeticProxy)
            .upgradeToAndCall(arithmeticImpl, abi.encodeCall(ICleartextArithmetic.initializeFromEmptyProxy, ()));
    }

    function _repoint(address proxy, FhevmHostContracts implementation) private {
        address deployed = _create(LibHostUpgradeCode.creationCodeFor(implementation, _roles()));
        vm.prank(owner);
        IUUPSProxy(proxy).upgradeToAndCall(deployed, "");
    }

    function _roles() private view returns (address[10] memory addresses) {
        addresses[uint8(FhevmAddressRole.ACL)] = ACL;
        addresses[uint8(FhevmAddressRole.FHEVMExecutor)] = EXECUTOR;
        addresses[uint8(FhevmAddressRole.KMSVerifier)] = KMS_VERIFIER;
        addresses[uint8(FhevmAddressRole.InputVerifier)] = INPUT_VERIFIER;
        addresses[uint8(FhevmAddressRole.HCULimit)] = HCU_LIMIT;
        addresses[uint8(FhevmAddressRole.ProtocolConfig)] = PROTOCOL_CONFIG;
        addresses[uint8(FhevmAddressRole.KMSGeneration)] = KMS_GENERATION;
        addresses[uint8(FhevmAddressRole.PauserSet)] = PAUSER_SET;
        addresses[uint8(FhevmAddressRole.CleartextArithmetic)] = arithmeticProxy;
        addresses[uint8(FhevmAddressRole.CleartextDB)] = dbProxy;
    }

    function _create(bytes memory creationCode) private returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "deploy failed");
    }
}
