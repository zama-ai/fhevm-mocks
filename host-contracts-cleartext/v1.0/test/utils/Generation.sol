// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/// @notice Generations, `major.minor`, as the marker and the package folder spell them. The TypeScript twin is
///         `generationOfMarker` in `create2-deploy/ts/common.ts`.
library Generation {
    /// @dev The first marker of the 1.0-on encoding; below it, a marker is a legacy minor.
    uint256 internal constant FIRST_MARKER = 1_000_000;

    /**
     * @notice The generation `CLEARTEXT_PROTOCOL_VERSION` names. Below 1.0 the marker is the minor (`14` is 0.14);
     *         from 1.0 on it is `major * 1_000_000 + minor * 1_000 + patch` (`1_000_000` is 1.0).
     * @dev The patch is dropped: a hotfix that leaves the ACL alone leaves it behind, so only the generation can be
     *      compared. A plain `marker / 1_000` would decode 13 and 14 alike.
     */
    function ofMarker(uint256 marker) internal pure returns (uint256 major, uint256 minor) {
        if (marker < FIRST_MARKER) return (0, marker);
        return (marker / FIRST_MARKER, (marker / 1_000) % 1_000);
    }

    /**
     * @notice The generation a package folder path ends with: `.../v14` is 0.14, `.../v1.0` is 1.0.
     * @dev Reverts on anything else, so a renamed folder fails loudly rather than decoding to 0.0.
     */
    function ofFolder(bytes memory path) internal pure returns (uint256 major, uint256 minor) {
        uint256 i = path.length;
        uint256 last;
        uint256 lastDigits;
        (last, lastDigits, i) = _trailingNumber(path, i);
        require(lastDigits > 0, "the package folder is not v<N> or v<major>.<minor>");
        if (i > 0 && path[i - 1] == ".") {
            uint256 first;
            uint256 firstDigits;
            (first, firstDigits, i) = _trailingNumber(path, i - 1);
            require(firstDigits > 0 && first > 0, "the package folder is not v<N> or v<major>.<minor>");
            (major, minor) = (first, last);
        } else {
            (major, minor) = (0, last);
        }
        require(
            i >= 2 && path[i - 1] == "v" && path[i - 2] == "/", "the package folder is not v<N> or v<major>.<minor>"
        );
    }

    /// @dev The decimal number ending at `end` (exclusive), its digit count, and where it starts.
    function _trailingNumber(bytes memory path, uint256 end)
        private
        pure
        returns (uint256 value, uint256 digits, uint256 start)
    {
        start = end;
        for (uint256 scale = 1; start > 0 && path[start - 1] >= "0" && path[start - 1] <= "9"; scale *= 10) {
            --start;
            value += (uint8(path[start]) - uint8(bytes1("0"))) * scale;
        }
        digits = end - start;
    }
}
