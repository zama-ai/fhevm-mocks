// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title CleartextHandle
 * @notice Handle sanity checks shared by the cleartext contracts.
 * @dev Handles embed `block.chainid` at bytes [22:29] when minted, see
 *      `FHEVMExecutor._appendMetadataToPrehandle` and the `InputVerifier` handle layout. A handle carrying
 *      another chain id was never produced by this stack: in a test that mostly means it was created before
 *      `vm.chainId` moved, or was copied in from another network's trace. The real host contracts do not
 *      check this; the cleartext ones can afford to, and a precise error beats a silent wrong answer.
 */
library CleartextHandle {
    /**
     * @notice Returned when a handle carries a chain id other than the current one.
     * @param handle The offending handle.
     * @param handleChainId The chain id read from the handle.
     * @param blockChainId The current `block.chainid`.
     */
    error CleartextErrorHandleChainIdMismatch(bytes32 handle, uint64 handleChainId, uint64 blockChainId);

    /// @dev Bytes [22:29] of a handle.
    function chainIdOf(bytes32 handle) internal pure returns (uint64) {
        return uint64(uint256(handle) >> 16);
    }

    function checkChainId(bytes32 handle) internal view {
        uint64 handleChainId = chainIdOf(handle);
        if (handleChainId != uint64(block.chainid)) {
            revert CleartextErrorHandleChainIdMismatch(handle, handleChainId, uint64(block.chainid));
        }
    }
}
