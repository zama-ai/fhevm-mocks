// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/// @notice Bit-level edits on byte arrays, for tampering tests.
library Bits {
    /**
     * @notice Inverts one bit of `data`, in place: 0 becomes 1, 1 becomes 0. Every other bit is untouched.
     * @dev Bit `b` lives in byte `b / 8`, at position `b % 8` inside that byte, position 0 being the least
     *      significant bit. So bits 0..7 are byte 0, bits 8..15 are byte 1, and so on. Example, byte 1:
     *
     *          bit index         15 14 13 12 11 10  9  8
     *          before             0  0  1  1  0  0  0  0     byte 1 = 0x30
     *          flip(data, 12)              ^
     *          after              0  0  1  0  0  0  0  0     byte 1 = 0x20
     *
     *      Flipping the same bit again restores the original.
     * @param data The array to modify.
     * @param bit Index of the bit to invert, `0 <= bit < data.length * 8`.
     */
    function flip(bytes memory data, uint256 bit) internal pure {
        data[bit / 8] = bytes1(uint8(data[bit / 8]) ^ uint8(1 << (bit % 8)));
    }
}
