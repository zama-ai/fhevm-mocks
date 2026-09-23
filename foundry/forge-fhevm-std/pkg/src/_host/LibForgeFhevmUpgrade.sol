// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {LibHostUpgradeCode} from "./LibHostUpgradeCode.sol";
import {LibForgeFhevmStack} from "./LibForgeFhevmStack.sol";
import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";
import {FhevmAddressRole, FhevmHostContracts} from "./_internal/LocalHostBytecode.sol";
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
}
