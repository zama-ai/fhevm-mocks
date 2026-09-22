// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {CleartextHCULimit} from "./CleartextHCULimit.sol";
import {VmSafe} from "forge-std/Vm.sol";

contract CleartextForgeHCULimit is CleartextHCULimit {
    /// @dev Calls cheatcodes, so this contract reverts outside forge and must never ship to a chain.
    ///      `DeployLocalStack.s.sol` broadcasts to a node and keeps `CleartextHCULimit` for that reason.
    VmSafe private constant vmSafe = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @notice Marks the Forge-only variant, mirroring forge-std's `IS_TEST`. A constant rather than a
    ///         storage variable: these run behind proxies, where an initialized state variable would
    ///         only ever be set in the implementation's own storage and read back as `false`.
    bool public constant IS_FORGE = true;

    /// @dev Transient: whether this transaction has already metered an operation. The base shares this
    ///      namespace, storing a reading per handle AT the handle's own value and the running transaction
    ///      total at slot 0, which a namespace hash stays clear of.
    uint256 private constant _METERED_THIS_TX_SLOT =
        uint256(keccak256("fhevm.cleartext.forge.hculimit.metered-this-tx"));

    /// @notice Total HCU metered for this transaction, or for the last one that metered anything.
    uint256 public lastTransactionHCU;

    /// @notice Deepest sequential handle chain metered for it, the reading the depth cap is applied to.
    uint256 public maxHandleHCU;

    function _setHCUForTransaction(uint256 transactionHCU) internal override {
        super._setHCUForTransaction(transactionHCU);
        vmSafe.pauseGasMetering();
        {
            _clearOnNewTransaction();
            lastTransactionHCU = transactionHCU;
        }
        vmSafe.resumeGasMetering();
    }

    function _setHCUForHandle(bytes32 handle, uint256 handleHCU) internal override {
        super._setHCUForHandle(handle, handleHCU);
        vmSafe.pauseGasMetering();
        {
            _clearOnNewTransaction();
            if (handleHCU > maxHandleHCU) {
                maxHandleHCU = handleHCU;
            }
        }
        vmSafe.resumeGasMetering();
    }

    /// @dev Clears the readings once per transaction, on the first metered operation.
    function _clearOnNewTransaction() private {
        uint256 slot = _METERED_THIS_TX_SLOT;
        bool metered;
        assembly {
            metered := tload(slot)
        }
        if (metered) {
            return;
        }
        assembly {
            tstore(slot, 1)
        }
        lastTransactionHCU = 0;
        maxHandleHCU = 0;
    }
}
