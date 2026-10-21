// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

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

interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/**
 * `CleartextImplementationSwap` showed a proxy can carry the production executor and
 * the cleartext one interchangeably, on a LOCAL stack where every sibling address is the one the blobs
 * bake in. This asks the remaining question: does it still work when the addresses are a real chain's?
 *
 * ONE CHAIN, TWO ROUTES. Devnet Sepolia runs the PREVIOUS protocol line (0.14: ACL v0.5.0, ProtocolConfig
 * v0.2.0, read off the chain), so the cleartext swap runs on top of the generation upgrade -- what a real user
 * forking a chain that has not upgraded yet would get. Route A upgrades to production first and swaps the
 * executor afterwards; route B lands on the cleartext implementations in the one pass.
 *
 * WHAT IS NOT HERE, AND WHY. No Sepolia chain runs this generation's line yet, so the "mechanism alone" case
 * (a chain on this SDK's own line, only the swap under test) has nowhere to run; the local
 * `CleartextImplementationSwap` covers that mechanism without a fork, and a subclass with `_isAGenerationBehind`
 * false comes back when a chain moves. Testnet Sepolia still runs 0.13 -- two lines behind, which this
 * generation does not upgrade from (`LibForgeFhevmHostVersions.classify` refuses it as `Unknown`).
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
    function _isAGenerationBehind() internal pure virtual returns (bool);

    /// @dev ROUTE. A: the generation upgrade lands on the production implementations and the executor is
    ///      swapped to cleartext afterwards, so its proxy moves twice. B: one pass, where the executor's
    ///      op re-points straight to `CleartextFHEVMExecutor` and its reinitializer runs on that.
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
        if (bytes(rpc).length == 0) {
            console.log("");
            console.log("!!! FORK TEST SKIPPED: %s", _label());
            console.log("!!! set SEPOLIA_RPC_URL (or a `sepolia` rpc endpoint in foundry.toml) to run it");
            console.log("");
            return;
        }

        _chain();
        vm.createSelectFork(rpc);
        forked = true;
        owner = IACL(ACL).owner();

        console.log("");
        console.log("=================================================================================");
        console.log(">>> FORK TEST RUNNING: %s", _label());
        console.log(">>> forked Sepolia at block %s", block.number);
        console.log(">>> chain's ACL: %s", IACL(ACL).getVersion());
        console.log(
            ">>> %s",
            _isAGenerationBehind()
                ? "one generation behind: upgraded in memory to this generation, then made cleartext"
                : "on this generation's line: made cleartext only"
        );
        console.log(
            ">>> route %s",
            _singlePass() ? "B (straight to cleartext, one pass)" : "A (production, then the executor swap)"
        );
        console.log("=================================================================================");
        console.log("");
    }

    /// @dev What this case forks, for the banner.
    function _label() internal pure virtual returns (string memory);

    function test_aForkedProductionStackBecomesCleartext() public {
        vm.skip(!forked);

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

        // -- 5. A COMPOSITE OPERATION, through every contract it touches ------------------------------
        //
        // `fheMulDiv` (since v14) routes to `HCULimit.checkHCUForFheMulDiv`, so a correct answer means the
        // executor, the HCU limit and the arithmetic are wired to one another on this chain's addresses.
        bytes32 factor = ICleartextFHEVMExecutor(EXECUTOR).trivialEncrypt(10, FheType.Uint32);
        bytes32 product = ICleartextFHEVMExecutor(EXECUTOR)
            .fheMulDiv(factor, bytes32(uint256(3)), bytes32(uint256(2)), SCALAR_FACTOR_AND_DIVISOR);
        assertEq(ICleartextFHEVMExecutor(EXECUTOR).plaintexts(product), 15, "10 * 3 / 2, computed by the stack");

        // -- 6. BEHAVIOUR ONLY THIS GENERATION HAS, which is what makes this test able to fail ---------
        //
        // Steps 4 and 5 cannot tell the two generations apart: both implement those operations the same
        // way, so they pass whether or not the generation upgrade really ran. Since v15 the executor bounds a
        // scalar shift amount to uint8 (`_checkScalarShiftAmount`): a previous-generation executor shifts by
        // 256 and answers, this one refuses with `ScalarOutOfRange()`.
        vm.expectRevert(bytes4(keccak256("ScalarOutOfRange()")));
        ICleartextFHEVMExecutor(EXECUTOR).fheShl(factor, bytes32(uint256(256)), bytes1(0x01));
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
     * @dev ROUTE B: the generation's own op list, with each implementation replaced by its cleartext subclass
     *      where one exists. The reinitializers are inherited, so the same init data runs on them, and each
     *      proxy moves once instead of twice.
     */
    function _upgradeGenerationStraightToCleartext(address[10] memory addresses) private {
        for (uint256 index = 0; index < LibForgeFhevmUpgrade.OP_COUNT; index++) {
            FhevmHostContracts implementation = _cleartextCounterpart(LibForgeFhevmUpgrade.opImplementation(index));
            address deployed = _create(LibHostUpgradeCode.creationCodeFor(implementation, addresses));
            vm.prank(owner);
            IUUPSProxy(addresses[uint8(LibForgeFhevmUpgrade.opProxyRole(index))])
                .upgradeToAndCall(deployed, LibForgeFhevmUpgrade.opInitData(index));
        }

        // AND THE ONE THE OP LIST CANNOT REACH. `HCULimit` is absent from the generation upgrade on purpose
        // -- its bytecode and reinitializer are the same in both generations -- but it has a cleartext
        // subclass all the same, so the cleartext pass has to visit it separately. No init data: nothing new
        // to initialize, and the generation did not move under it.
        address cleartextHcuLimit =
            _create(LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.CleartextHCULimit, addresses));
        vm.prank(owner);
        IUUPSProxy(HCU_LIMIT).upgradeToAndCall(cleartextHcuLimit, "");
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

/// Devnet Sepolia, one generation behind (0.14): brought forward in memory, then made cleartext. Route A.
contract DevnetCleartextUpgradeTest is ForkCleartextUpgrade {
    function _chain() internal override {
        ACL = 0x1aC3073813148992aA928C9903681fA7Ec202b13;
        EXECUTOR = 0x356cc81A08aa782C96F00dC30b60d4f33f1a4e43;
        KMS_VERIFIER = 0xDe8893C04e118431aeC076A39F6aFa951669F720;
        INPUT_VERIFIER = 0x160AaB6199FAEAEA1B27E62999c597E530a3abA9;
        HCU_LIMIT = 0xaa13C49f14C1a2EdA302e008AB314755Cac6E19F;
        PROTOCOL_CONFIG = 0x257950EbB65A1D2b697f03D08E7D3Dc26CbDB304;
        KMS_GENERATION = 0x55bdE339a01DA46d2d3504b8d9A9F5412C85e5e7;
        PAUSER_SET = 0x0E3668AA0faFF49B54126Febd59C8654f2d5Ff87;
    }

    function _isAGenerationBehind() internal pure override returns (bool) {
        return true;
    }

    function _label() internal pure virtual override returns (string memory) {
        return "Devnet Sepolia (0.14 line), route A";
    }
}

/// ROUTE B: the same chain and generation upgrade, but straight to cleartext in the one pass.
contract DevnetSinglePassCleartextUpgradeTest is DevnetCleartextUpgradeTest {
    function _singlePass() internal pure override returns (bool) {
        return true;
    }

    function _label() internal pure override returns (string memory) {
        return "Devnet Sepolia (0.14 line), route B";
    }
}
