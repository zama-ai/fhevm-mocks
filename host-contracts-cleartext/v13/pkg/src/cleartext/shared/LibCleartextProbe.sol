// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @notice Tells a cleartext mock apart from the real thing, by asking it.
 *
 * @dev Every contract in the cleartext stack carries `bool public constant IS_CLEARTEXT = true`. No
 *      production host contract has that selector, so probing for it is how code decides which kind of
 *      deployment it is talking to — without being configured, and without a chain-id table that would
 *      be wrong the moment a stack is deployed somewhere new.
 *
 * @dev A LOW-LEVEL call, deliberately. A production contract does not return `false`; it has no such
 *      function and REVERTS, which a typed call would propagate instead of answering.
 */
library LibCleartextProbe {
    /// @dev `IS_CLEARTEXT()`
    bytes4 private constant IS_CLEARTEXT_SELECTOR = 0x83d5b266;

    /// @notice Whether `target` is part of a cleartext stack.
    /// @dev    False for anything that reverts, returns the wrong width, or has no code at all.
    function isCleartext(address target) internal view returns (bool) {
        (bool ok, bytes memory ret) = target.staticcall(abi.encodeWithSelector(IS_CLEARTEXT_SELECTOR));
        return ok && ret.length == 32 && abi.decode(ret, (bool));
    }
}
