// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {LibHostUpgradeCode} from "./LibHostUpgradeCode.sol";
import {LibForgeFhevmStack} from "./LibForgeFhevmStack.sol";
import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";
import {ERC1967_PROXY_CREATION_CODE, FhevmAddressRole, FhevmHostContracts} from "./_internal/LocalHostBytecode.sol";
import {ICleartextDB} from "./_internal/interfaces/ICleartextDB.sol";
import {ICleartextArithmetic} from "./_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextFHEVMExecutor} from "./_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {IEmptyUUPSProxy} from "./_internal/interfaces/IEmptyUUPSProxy.sol";
import {IACL} from "./_internal/interfaces/IACL.sol";
import {ICleartextHCULimit} from "./_internal/interfaces/ICleartextHCULimit.sol";
import {IFHEVMExecutor} from "./_internal/interfaces/IFHEVMExecutor.sol";
import {IKMSGeneration} from "./_internal/interfaces/IKMSGeneration.sol";
import {IKMSVerifier} from "./_internal/interfaces/IKMSVerifier.sol";
import {IProtocolConfig} from "./_internal/interfaces/IProtocolConfig.sol";

/// @notice `upgradeToAndCall` is on every UUPS proxy but on none of the generated interfaces as a
///         standalone, so it is named here once for all six.
interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/**
 * @title LibForgeFhevmUpgrade
 * @notice Brings a forked stack from the previous protocol generation up to this one, in memory.
 *
 * @dev WHY THIS EXISTS. This SDK speaks one protocol line and refuses the others, which would make a
 *      fork of a chain that has not upgraded yet useless — and that is most chains most of the time,
 *      since they do not all move on release day. Rather than refuse, the SDK runs the generation's own
 *      upgrade against the forked copy. Nothing is invented: these are the same implementations and the
 *      same reinitializers `pkg/ts/upgrade.ts` sends on a real chain, so the storage layout question is
 *      one upstream has already answered and `test:upgrade` already rehearses.
 *
 * @dev WHY THE OP LIST IS NOT THE TYPESCRIPT ONE. `updateV(N-1)ToV(N)` also re-points
 *      `CleartextArithmetic`, because it upgrades a CLEARTEXT stack, and a real deployment has no such
 *      contract — nor a `CleartextDB`. `InputVerifier` is absent from both for the opposite reason: its
 *      bytecode does not change across the two generations, so re-pointing it would burn a reinitializer
 *      to no effect. What is left is the six below, in the order the TypeScript path uses.
 *
 * @dev WHY THE IMPLEMENTATIONS ARE PATCHED. Each one names its siblings as compile-time constants, and
 *      the blobs this package ships name the LOCALHOST addresses. A forked stack lives at the chain's
 *      own, so every implementation is rewritten before it is deployed (`LibHostUpgradeCode`, and rule
 *      4.1's one exception).
 *
 * @dev THE OWNER IS IMPERSONATED, not asked. `_authorizeUpgrade` admits `ACL.owner()` and nothing else;
 *      on a fork that is whoever the real deployment made owner, and forge can be them. Nothing here
 *      needs the `ACLOwner` contract, which a chain may not even have.
 *
 * @dev ONCE PER FORK. Every reinitializer is one-shot, so a second call reverts `InvalidInitialization`.
 *      The caller preparing a fork already runs once per fork (rule 2.12); this library does not guard.
 */
library LibForgeFhevmUpgrade {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    /// @notice The proxies this upgrade re-points, in the order it re-points them.
    /// @dev INDEX-ALIGNED with `opImplementation` and `opInitData`, the way `UpgradeInitData` is aligned
    ///      with the create2 coordinator's role table. `LibForgeFhevmUpgrade.t.sol` pins all three
    ///      together, because a table that disagrees with its neighbours installs one contract's code
    ///      behind another's proxy.
    uint256 internal constant OP_COUNT = 6;

    error UpgradeIndexOutOfRange(uint256 index);
    error ImplementationDeployFailed(uint256 index);

    /// @notice Which proxy op `index` re-points, named by role so the address comes from the caller.
    function opProxyRole(uint256 index) internal pure returns (FhevmAddressRole) {
        if (index == 0) return FhevmAddressRole.ProtocolConfig;
        if (index == 1) return FhevmAddressRole.KMSGeneration;
        if (index == 2) return FhevmAddressRole.ACL;
        if (index == 3) return FhevmAddressRole.FHEVMExecutor;
        if (index == 4) return FhevmAddressRole.HCULimit;
        if (index == 5) return FhevmAddressRole.KMSVerifier;
        revert UpgradeIndexOutOfRange(index);
    }

    /// @notice Which implementation goes behind it.
    function opImplementation(uint256 index) internal pure returns (FhevmHostContracts) {
        if (index == 0) return FhevmHostContracts.ProtocolConfig;
        if (index == 1) return FhevmHostContracts.KMSGeneration;
        if (index == 2) return FhevmHostContracts.ACL;
        if (index == 3) return FhevmHostContracts.FHEVMExecutor;
        if (index == 4) return FhevmHostContracts.HCULimit;
        if (index == 5) return FhevmHostContracts.KMSVerifier;
        revert UpgradeIndexOutOfRange(index);
    }

    /**
     * @notice The initializer call `upgradeToAndCall` carries for op `index`.
     * @dev Only `ProtocolConfig` takes arguments. It does NOT install the node set it is given — it
     *      reshapes the context already there into the epoch model the new line uses, and the arguments
     *      only feed the event and the anchor hash. The cleartext set is passed because the caller swaps
     *      the signers to exactly that immediately afterwards, so the anchor describes what the stack is
     *      about to be.
     */
    function opInitData(uint256 index) internal pure returns (bytes memory) {
        if (index == 0) {
            return abi.encodeCall(
                IProtocolConfig.reinitializeV2,
                (
                    LibForgeFhevmStack.cleartextKmsNodes(),
                    LocalHostBootstrap.KMS_SOFTWARE_VERSION,
                    new IProtocolConfig.PcrValues[](0)
                )
            );
        }
        if (index == 1) return abi.encodeCall(IKMSGeneration.reinitializeV2, ());
        if (index == 2) return abi.encodeCall(IACL.reinitializeV5, ());
        if (index == 3) return abi.encodeCall(IFHEVMExecutor.reinitializeV6, ());
        if (index == 4) return abi.encodeCall(ICleartextHCULimit.reinitializeV4, ());
        if (index == 5) return abi.encodeCall(IKMSVerifier.reinitializeV4, ());
        revert UpgradeIndexOutOfRange(index);
    }

    /// @notice A human-readable name per op, for the failure messages and the gate's listing.
    function opName(uint256 index) internal pure returns (string memory) {
        if (index == 0) return "ProtocolConfig.reinitializeV2(kmsNodeParams, softwareVersion, pcrValues)";
        if (index == 1) return "KMSGeneration.reinitializeV2()";
        if (index == 2) return "ACL.reinitializeV5()";
        if (index == 3) return "FHEVMExecutor.reinitializeV6()";
        if (index == 4) return "HCULimit.reinitializeV4()";
        if (index == 5) return "KMSVerifier.reinitializeV4()";
        revert UpgradeIndexOutOfRange(index);
    }

    /**
     * @notice Runs the whole upgrade against the stack `addresses` describes.
     * @param addresses One address per `FhevmAddressRole`, by position: the FORK's, not this package's.
     *                  The cleartext roles are unused and may be zero. The length is written out because
     *                  Solidity refuses another library's constant as an array length;
     *                  `LibForgeFhevmUpgrade.t.sol` pins it against `LibHostUpgradeCode.ROLE_COUNT`.
     *
     * @dev Deploys each implementation patched for those addresses, then re-points its proxy. One
     *      transaction per op, each pranked as the ACL owner, in the order the table gives — the order
     *      matters for `ProtocolConfig`, which the others read through once re-pointed.
     */
    function upgradeFromPreviousGeneration(address[10] memory addresses) internal {
        address owner = IACL(addresses[uint8(FhevmAddressRole.ACL)]).owner();

        for (uint256 index = 0; index < OP_COUNT; index++) {
            address proxy = addresses[uint8(opProxyRole(index))];
            address implementation =
                _deploy(index, LibHostUpgradeCode.creationCodeFor(opImplementation(index), addresses));

            fvm.prank(owner);
            IUUPSProxy(proxy).upgradeToAndCall(implementation, opInitData(index));
        }
    }

    /// @dev `create` returns the zero address on failure rather than reverting, so it is checked.
    function _deploy(uint256 index, bytes memory creationCode) private returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        if (deployed == address(0)) revert ImplementationDeployFailed(index);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Turning a forked stack into a cleartext one
    ////////////////////////////////////////////////////////////////////////////

    /**
     * @notice Re-points a forked stack at this package's CLEARTEXT implementations, so it holds the
     *         plaintexts of everything it computes instead of only announcing handles.
     *
     * @param addresses One address per `FhevmAddressRole`, by position: the FORK's. The two cleartext
     *                  roles are ignored on the way in and reported on the way out, because the contracts
     *                  they name do not exist on a real chain and are deployed here.
     * @return arithmetic The `CleartextArithmetic` proxy this call created.
     * @return db The `CleartextDB` proxy it writes into.
     *
     * @dev WHY A FORK WANTS THIS. A production executor keeps no cleartexts, so a reader has to
     *      reconstruct them from events -- a replay that has to implement every operator, and that cannot
     *      see a value a dApp computed without emitting. A cleartext executor simply answers. The
     *      implementations are this package's own, deployed patched for the fork's addresses (4.1's
     *      exception), behind the chain's own proxies.
     *
     * @dev NO REINITIALIZERS. These add no storage of their own -- each is a subclass of the production
     *      contract it replaces -- so there is nothing to initialize, and a generation upgrade, if one was
     *      needed, has already run by the time this is called.
     *
     * @dev THE FORGE VARIANTS WHERE THEY EXIST, because a fork should behave like a local stack: gas
     *      metering paused around the mock's own bookkeeping, forge's randomness, and the per-handle
     *      record that tells a missed computation from a handle older than the fork. They call cheatcodes,
     *      and forge grants those per address to what IT created -- a forked chain's proxy is not that, so
     *      each one is granted explicitly. Miss a grant and the stack reverts on its first FHE operation.
     */
    function upgradeToCleartext(address[10] memory addresses) internal returns (address arithmetic, address db) {
        address owner = IACL(addresses[uint8(FhevmAddressRole.ACL)]).owner();

        // The two contracts no real chain has. They must exist before the executor is patched, because it
        // names the arithmetic as a compile-time constant -- hence empty proxies first, addresses second,
        // implementations third.
        address emptyImplementation =
            _deploy(0, LibHostUpgradeCode.creationCodeFor(FhevmHostContracts.EmptyUUPSProxy, addresses));
        bytes memory initEmpty = abi.encodeCall(IEmptyUUPSProxy.initialize, ());
        db = _deploy(1, abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImplementation, initEmpty)));
        arithmetic =
            _deploy(2, abi.encodePacked(ERC1967_PROXY_CREATION_CODE, abi.encode(emptyImplementation, initEmpty)));

        addresses[uint8(FhevmAddressRole.CleartextArithmetic)] = arithmetic;
        addresses[uint8(FhevmAddressRole.CleartextDB)] = db;

        _materialize(
            owner,
            db,
            FhevmHostContracts.CleartextDB,
            addresses,
            abi.encodeCall(ICleartextDB.initializeFromEmptyProxy, (arithmetic))
        );
        _materialize(
            owner,
            arithmetic,
            FhevmHostContracts.CleartextForgeArithmetic,
            addresses,
            abi.encodeCall(ICleartextArithmetic.initializeFromEmptyProxy, ())
        );

        // The chain's own proxies, pointed at this package's code. `InputVerifier` is here even though the
        // generation upgrade skips it: its bytecode does not change between generations, but its CLEARTEXT
        // subclass differs from the production one, so the cleartext pass has to visit it.
        _materialize(owner, addresses[uint8(FhevmAddressRole.ACL)], FhevmHostContracts.CleartextForgeACL, addresses, "");
        _materialize(
            owner,
            addresses[uint8(FhevmAddressRole.FHEVMExecutor)],
            FhevmHostContracts.CleartextForgeFHEVMExecutor,
            addresses,
            ""
        );
        _materialize(
            owner, addresses[uint8(FhevmAddressRole.HCULimit)], FhevmHostContracts.CleartextForgeHCULimit, addresses, ""
        );
        _materialize(
            owner,
            addresses[uint8(FhevmAddressRole.KMSVerifier)],
            FhevmHostContracts.CleartextKMSVerifier,
            addresses,
            ""
        );
        _materialize(
            owner,
            addresses[uint8(FhevmAddressRole.InputVerifier)],
            FhevmHostContracts.CleartextInputVerifier,
            addresses,
            ""
        );

        // Only the four that call cheatcodes; the others need nothing.
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.ACL)]);
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.FHEVMExecutor)]);
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.HCULimit)]);
        fvm.allowCheatcodes(arithmetic);
    }

    /// @dev Deploy `implementation` patched for `addresses`, then point `proxy` at it as the ACL owner.
    function _materialize(
        address owner,
        address proxy,
        FhevmHostContracts implementation,
        address[10] memory addresses,
        bytes memory initData
    ) private {
        address deployed = _deploy(uint8(implementation), LibHostUpgradeCode.creationCodeFor(implementation, addresses));
        fvm.prank(owner);
        IUUPSProxy(proxy).upgradeToAndCall(deployed, initData);
    }

    /**
     * @notice Brings a stack that is ALREADY CLEARTEXT forward a generation, keeping its store.
     *
     * @param addresses One address per `FhevmAddressRole`, the FORK's. The two cleartext roles are
     *                  ignored on the way in: they are asked of the stack, which is the point.
     *
     * @dev WHY THIS IS NOT `upgradeToCleartext`. That one installs a cleartext layer on a production
     *      stack and must create the store, because no real chain has one. Here the store EXISTS and
     *      holds values — a deployed cleartext stack has been computing into it — so it is found rather
     *      than replaced: the executor names its arithmetic, the arithmetic names its store.
     *
     * @dev AND THAT IS WHY A FORK OF ONE HAS NO UNKNOWN-HANDLE PROBLEM. An upgrade re-points proxies;
     *      it does not touch their storage. Every cleartext this stack recorded before the fork is still
     *      in the same `CleartextDB` afterwards, so handles minted long ago read back normally and
     *      nothing has to be stated with `forkUnknown`. On a production fork those same handles are
     *      unknowable, because nothing ever recorded them.
     *
     * @dev THE REINITIALIZERS RUN, unlike in `upgradeToCleartext`: this IS the generation upgrade, so
     *      each proxy takes the same init data `upgradeFromPreviousGeneration` would send it, and
     *      `CleartextArithmetic` takes the one only a cleartext stack has -- `reinitializeV3`, which
     *      upstream added for the operator this generation introduced.
     */
    function upgradeCleartextFromPreviousGeneration(address[10] memory addresses)
        internal
        returns (address arithmetic, address db)
    {
        address owner = IACL(addresses[uint8(FhevmAddressRole.ACL)]).owner();
        address executor = addresses[uint8(FhevmAddressRole.FHEVMExecutor)];

        // Asked of the stack, so the values it already holds stay reachable.
        arithmetic = ICleartextFHEVMExecutor(executor).getCleartextArithmeticAddress();
        db = ICleartextArithmetic(arithmetic).getCleartextDBAddress();
        addresses[uint8(FhevmAddressRole.CleartextArithmetic)] = arithmetic;
        addresses[uint8(FhevmAddressRole.CleartextDB)] = db;

        // The generation's own op list, each proxy taking the cleartext implementation rather than the
        // production one -- the stack is cleartext and must stay so.
        for (uint256 index = 0; index < OP_COUNT; index++) {
            FhevmHostContracts implementation = _cleartextCounterpart(opImplementation(index));
            address deployed = _deploy(index, LibHostUpgradeCode.creationCodeFor(implementation, addresses));
            fvm.prank(owner);
            IUUPSProxy(addresses[uint8(opProxyRole(index))]).upgradeToAndCall(deployed, opInitData(index));
        }

        // Absent from the op list because its bytecode does not change between generations -- but its
        // CLEARTEXT subclass differs from the production one, so the pass still has to visit it.
        _materialize(
            owner,
            addresses[uint8(FhevmAddressRole.InputVerifier)],
            FhevmHostContracts.CleartextInputVerifier,
            addresses,
            ""
        );

        // And the one contract only a cleartext stack has. Not a host contract, so no op list mentions it.
        _materialize(
            owner,
            arithmetic,
            FhevmHostContracts.CleartextForgeArithmetic,
            addresses,
            abi.encodeCall(ICleartextArithmetic.reinitializeV3, ())
        );

        _grantCheatcodes(addresses, arithmetic);
    }

    /// @dev The cleartext subclass of a host contract, where one exists. `ProtocolConfig` and
    ///      `KMSGeneration` have none and need none: nothing about them differs between a mock stack and
    ///      a real one.
    function _cleartextCounterpart(FhevmHostContracts implementation) private pure returns (FhevmHostContracts) {
        if (implementation == FhevmHostContracts.FHEVMExecutor) return FhevmHostContracts.CleartextForgeFHEVMExecutor;
        if (implementation == FhevmHostContracts.ACL) return FhevmHostContracts.CleartextForgeACL;
        if (implementation == FhevmHostContracts.KMSVerifier) return FhevmHostContracts.CleartextKMSVerifier;
        if (implementation == FhevmHostContracts.HCULimit) return FhevmHostContracts.CleartextForgeHCULimit;
        return implementation;
    }

    /// @dev The four that call cheatcodes. A forked chain's proxy is not something forge created, so it
    ///      has no access until it is granted -- and without it the stack reverts at its first FHE call.
    function _grantCheatcodes(address[10] memory addresses, address arithmetic) private {
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.ACL)]);
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.FHEVMExecutor)]);
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.HCULimit)]);
        fvm.allowCheatcodes(arithmetic);
    }
}
