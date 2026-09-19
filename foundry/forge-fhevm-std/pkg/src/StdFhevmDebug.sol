// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    ebool,
    euint8,
    euint16,
    euint32,
    euint64,
    euint128,
    euint256,
    eaddress
} from "encrypted-types/EncryptedTypes.sol";

import {CLEARTEXT_DB_ADDRESS} from "./_host/FhevmCleartextDeploy.sol";
import {ICleartextDB} from "./_host/_internal/interfaces/ICleartextDB.sol";

abstract contract StdFhevmDebug {
    /**
     * @notice The store `read` looks handles up in.
     *
     * @dev `virtual`, and the only place the store is decided. The default is the local cleartext
     *      stack's, which is right whenever `setUpFhevm()` deployed one.
     *
     *      It is overridable because a FORKED chain has no such stack: there the values come from
     *      replaying the real executor's events into a store of the replayer's own, at an address this
     *      package cannot know. Overriding this one getter is all it takes to point `read` at it —
     *      every accessor below goes through it.
     */
    function cleartextDbAddress() public view virtual returns (address) {
        return CLEARTEXT_DB_ADDRESS;
    }

    function read(ebool value) internal view returns (bool clear) {
        clear = _read(ebool.unwrap(value)) != 0;
    }

    function read(euint8 value) internal view returns (uint8 clear) {
        clear = uint8(_read(euint8.unwrap(value)));
    }

    function read(euint16 value) internal view returns (uint16 clear) {
        clear = uint16(_read(euint16.unwrap(value)));
    }

    function read(euint32 value) internal view returns (uint32 clear) {
        clear = uint32(_read(euint32.unwrap(value)));
    }

    function read(euint64 value) internal view returns (uint64 clear) {
        clear = uint64(_read(euint64.unwrap(value)));
    }

    function read(euint128 value) internal view returns (uint128 clear) {
        clear = uint128(_read(euint128.unwrap(value)));
    }

    function read(euint256 value) internal view returns (uint256 clear) {
        clear = _read(euint256.unwrap(value));
    }

    function read(eaddress value) internal view returns (address clear) {
        clear = address(uint160(_read(eaddress.unwrap(value))));
    }

    /// @dev The store keeps every handle's cleartext keyed by handle; this is a plain lookup.
    function _read(bytes32 handle) private view returns (uint256) {
        return ICleartextDB(cleartextDbAddress()).get(handle);
    }
}
