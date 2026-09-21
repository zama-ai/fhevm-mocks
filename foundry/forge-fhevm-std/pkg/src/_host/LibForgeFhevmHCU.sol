// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IForgeVm, FORGE_VM_ADDRESS} from "./IForgeVm.sol";
import {IHCULimit} from "./_internal/interfaces/IHCULimit.sol";
import {ACL_ADDRESS, HCU_LIMIT_ADDRESS} from "./_internal/LocalHostAddresses.sol";
import {LibForgeFhevmStack} from "./LibForgeFhevmStack.sol";

/**
 * @title LibForgeFhevmHCU
 * @notice The HCU caps of a stack's `HCULimit`, moved from a test: raised, lowered, or lifted entirely.
 *
 * @dev WHY. `HCULimit` meters homomorphic complexity three ways — a cap per block, a cap per transaction,
 *      and a cap on the DEPTH of a handle's dependency chain within a transaction. Production values are
 *      what a dApp must live with, and a test that measures HCU wants exactly those. But a test whose
 *      ORCHESTRATION is heavier than any production call — a stateful fuzz that drives fifty operations
 *      through one handler, an end-to-end that sets up a whole market before the call it is about — trips
 *      the depth cap on scaffolding, not on the code under test. This lifts the cap for such a test and
 *      leaves the metering itself in place.
 *
 * @dev TWO DIFFERENT LIFTS. `disableHCUDepthLimit` lifts ONLY the depth cap: it sets it equal to the
 *      per-transaction cap, which is as high as `HCULimit` lets it go (`maxHCUPerTx >= maxHCUDepthPerTx`
 *      is enforced on every write) and is exactly high enough — one chain can never cost more than the
 *      whole transaction, so a depth cap equal to the transaction cap can no longer bind on its own. The
 *      per-transaction and per-block caps are left as they were, so a test keeps measuring against them.
 *      `disableHCULimits` is the other thing: every cap to the ceiling, nothing metered against anything.
 *
 * @dev HOW. Every setter is `onlyACLOwner`, so each call is pranked as the ACL's owner, read off the ACL
 *      rather than assumed: the local stack's owner is the deployer's, a forked stack's is whoever owns it
 *      there. `HCULimit` enforces `hcuPerBlock >= maxHCUPerTx >= maxHCUDepthPerTx` on every write, so the
 *      three cannot be set in an arbitrary order — `setCaps` lifts all three to the ceiling first and then
 *      lowers them depth → tx → block, which satisfies the invariant at every step for any target that
 *      satisfies it itself. The ceiling is `type(uint48).max`: the setters take `uint48`, so that is the
 *      largest value the contract can hold, and it is what the deployed hosts use for the block cap.
 *
 * @dev The address-taking functions work on any stack, forked ones included; the argument-less ones are
 *      the local stack `ForgeFhevmDeploy` stands up.
 */
library LibForgeFhevmHCU {
    IForgeVm private constant fvm = IForgeVm(FORGE_VM_ADDRESS);

    /// @notice The largest cap `HCULimit` can hold — effectively no cap.
    uint48 internal constant UNBOUNDED = type(uint48).max;

    // -- Local stack ---------------------------------------------------------

    /// @notice Lifts ONLY the depth cap on the local stack; the per-transaction and per-block caps stay.
    function disableHCUDepthLimit() internal {
        disableHCUDepthLimit(HCU_LIMIT_ADDRESS, ACL_ADDRESS);
    }

    /// @notice Lifts every HCU cap on the local stack.
    function disableHCULimits() internal {
        disableHCULimits(HCU_LIMIT_ADDRESS, ACL_ADDRESS);
    }

    /// @notice Sets the local stack's three caps; see the address-taking form for the ordering rule.
    function setCaps(uint48 hcuPerBlock, uint48 maxHCUPerTx, uint48 maxHCUDepthPerTx) internal {
        setCaps(HCU_LIMIT_ADDRESS, ACL_ADDRESS, hcuPerBlock, maxHCUPerTx, maxHCUDepthPerTx);
    }

    /// @notice Exempts `account` from the local stack's block cap. A no-op when it already is.
    function whitelistForBlockCap(address account) internal {
        whitelistForBlockCap(HCU_LIMIT_ADDRESS, ACL_ADDRESS, account);
    }

    // -- Any stack -----------------------------------------------------------

    /**
     * @notice Lifts ONLY the depth cap of `hcuLimit`: a handle may depend on a chain as long as the whole
     *         transaction may cost, and the per-transaction and per-block caps keep metering as before.
     * @dev Sets `maxHCUDepthPerTx` to the CURRENT `maxHCUPerTx`, the highest value the contract accepts
     *      (`MaxHCUPerTxBelowDepth` otherwise) and the one past which the depth cap is redundant. Lower the
     *      transaction cap afterwards and the depth cap must come down with it — use `setCaps` for that.
     */
    function disableHCUDepthLimit(address hcuLimit, address acl) internal {
        IHCULimit limit = IHCULimit(hcuLimit);
        // Read BEFORE pranking: a prank applies to the next call, and a view call would consume it.
        uint48 txCap = limit.getMaxHCUPerTx();
        fvm.prank(LibForgeFhevmStack.aclOwner(acl));
        limit.setMaxHCUDepthPerTx(txCap);
    }

    /// @notice Lifts every cap on `hcuLimit`: block, transaction and depth all become `UNBOUNDED`.
    function disableHCULimits(address hcuLimit, address acl) internal {
        setCaps(hcuLimit, acl, UNBOUNDED, UNBOUNDED, UNBOUNDED);
    }

    /**
     * @notice Sets the three caps of `hcuLimit`, as its ACL owner, in an order the contract accepts.
     * @dev Lift everything to the ceiling, then lower depth, then tx, then block: raising to the maximum
     *      can never break `block >= tx >= depth`, and lowering in that order keeps each bound above the
     *      one just set. A TARGET that violates the invariant reverts with the contract's own error
     *      (`HCUPerBlockBelowMaxPerTx` or its depth twin), which is the right message.
     */
    function setCaps(address hcuLimit, address acl, uint48 hcuPerBlock, uint48 maxHCUPerTx, uint48 maxHCUDepthPerTx)
        internal
    {
        IHCULimit limit = IHCULimit(hcuLimit);
        fvm.startPrank(LibForgeFhevmStack.aclOwner(acl));
        limit.setHCUPerBlock(UNBOUNDED);
        limit.setMaxHCUPerTx(UNBOUNDED);
        limit.setMaxHCUDepthPerTx(UNBOUNDED);
        limit.setMaxHCUDepthPerTx(maxHCUDepthPerTx);
        limit.setMaxHCUPerTx(maxHCUPerTx);
        limit.setHCUPerBlock(hcuPerBlock);
        fvm.stopPrank();
    }

    /// @notice Exempts `account` from the block cap of `hcuLimit`. Idempotent: the contract refuses a
    ///         second add, so one that is already listed is left alone.
    function whitelistForBlockCap(address hcuLimit, address acl, address account) internal {
        IHCULimit limit = IHCULimit(hcuLimit);
        if (limit.isBlockHCUWhitelisted(account)) return;
        fvm.prank(LibForgeFhevmStack.aclOwner(acl));
        limit.addToBlockHCUWhitelist(account);
    }
}
