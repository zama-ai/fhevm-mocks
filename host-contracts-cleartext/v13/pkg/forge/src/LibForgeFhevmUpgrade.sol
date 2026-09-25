// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {LibHostUpgradeCode} from "./LibHostUpgradeCode.sol";
import {ERC1967_PROXY_CREATION_CODE, FhevmAddressRole, FhevmHostContracts} from "./_internal/LocalHostBytecode.sol";
import {ICleartextDB} from "./_internal/interfaces/ICleartextDB.sol";
import {ICleartextArithmetic} from "./_internal/interfaces/ICleartextArithmetic.sol";
import {IEmptyUUPSProxy} from "./_internal/interfaces/IEmptyUUPSProxy.sol";
import {IACL} from "./_internal/interfaces/IACL.sol";

/// @notice `upgradeToAndCall` is on every UUPS proxy but on none of the generated interfaces as a
///         standalone, so it is named here once for all of them.
interface IUUPSProxy {
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}

/**
 * @title LibForgeFhevmUpgrade
 * @notice Turns a forked stack into a CLEARTEXT one, in memory, so it holds the plaintexts of what it
 *         computes instead of only announcing handles.
 *
 * @dev ONE THING ONLY, AND THAT IS THIS LINE'S WHOLE STORY. A stack on THIS protocol line is re-pointed
 *      at this package's cleartext implementations. A stack on an OLDER line is not carried forward --
 *      no chain runs one, so the path would be code nothing could ever exercise -- and a stack on a
 *      NEWER line is refused by the version gate before reaching here. The generation-upgrade machinery
 *      the next line carries has deliberately no counterpart here.
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
 * @dev ONCE PER FORK. The initializers this runs are one-shot, so a second call reverts
 *      `InvalidInitialization`. The caller preparing a fork already runs once per fork (rule 2.12);
 *      this library does not guard.
 */
library LibForgeFhevmUpgrade {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    error ImplementationDeployFailed(uint256 index);

    /// @dev ERC-7201-style, so it names a slot nothing else could pick. See `_markRefused`.
    bytes32 private constant REFUSED_SLOT =
        keccak256(abi.encode(uint256(keccak256("fhevm.forge.upgrade.refused")) - 1)) & ~bytes32(uint256(0xff));
    /// @dev See `upgradeFromPreviousGeneration`: this line has no generation below it to come from.
    error NoPreviousGeneration();

    /**
     * @notice REFUSED ON THIS LINE, and present only so the SDK reads the same on both generations.
     *
     * @dev THE SDK IS ONE PACKAGE ACROSS GENERATIONS. `FhevmVm` asks `classify` whether a forked stack is
     *      a generation behind and, if so, brings it forward — a path the next line needs and this one
     *      does not, because no chain in production runs the line below this one. Rather than let the two
     *      generations' SDKs diverge over a branch that can never be taken here, the symbol exists and
     *      says no.
     *
     *      UNREACHABLE, not merely discouraged: `LibForgeFhevmHostVersions.classify` carries no
     *      previous-line bounds and so never answers `Previous`, which is the only thing that leads here.
     *      If this ever reverts, the floors and this function disagree and one of them is wrong.
     */
    function upgradeFromPreviousGeneration(address[10] memory) internal {
        _markRefused();
        revert NoPreviousGeneration();
    }

    /**
     * @notice REFUSED ON THIS LINE, for the same reason as the function above.
     *
     * @dev The cleartext counterpart: on the next line it brings a stack that is ALREADY cleartext
     *      forward a generation, keeping its store. A deployed cleartext stack below this line would
     *      have to exist for that to mean anything here, and none does.
     *
     * @dev NEITHER STUB IS `view`, although both only revert -- see `_markRefused`.
     */
    function upgradeCleartextFromPreviousGeneration(address[10] memory) internal returns (address, address) {
        _markRefused();
        revert NoPreviousGeneration();
    }

    /**
     * @dev A TRANSIENT WRITE WITH NO READER, and it admits what it is: the two refusals above only
     *      revert, so without a state-writing opcode solc infers they could be `view` -- and taking that
     *      advice moves the warning into `FhevmVm`, the file that must read and compile identically on
     *      both generations. This keeps the noise in the file that genuinely differs, at zero.
     *
     *      `tstore`, NOT `sstore`. A library's `internal` function is inlined into its caller and writes
     *      the CALLER's storage, and `FhevmVm` keeps two dozen variables there; transient storage is
     *      cleared at the end of the transaction and collides with nothing. The `revert` on the next
     *      line undoes it either way, but that is a property of today's bodies, not something to rely on.
     *
     *      DO NOT DELETE IT AS DEAD CODE. It is load-bearing for the warning, not for the behaviour.
     */
    function _markRefused() private {
        bytes32 slot = REFUSED_SLOT;
        assembly ("memory-safe") {
            tstore(slot, 1)
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

    /// @dev The four that call cheatcodes. A forked chain's proxy is not something forge created, so it
    ///      has no access until it is granted -- and without it the stack reverts at its first FHE call.
    function _grantCheatcodes(address[10] memory addresses, address arithmetic) private {
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.ACL)]);
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.FHEVMExecutor)]);
        fvm.allowCheatcodes(addresses[uint8(FhevmAddressRole.HCULimit)]);
        fvm.allowCheatcodes(arithmetic);
    }
}
