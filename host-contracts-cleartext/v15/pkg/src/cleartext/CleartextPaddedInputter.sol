// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {PaddedInputter} from "../contracts/PaddedInputter.sol";

/**
 * @title CleartextPaddedInputter
 * @notice The RFC-030 padded inputter of a cleartext stack, carrying the markers that identify one.
 * @dev Behaviourally identical to `PaddedInputter`: it adds one constant and overrides nothing. A real
 *      deployment has no such selector, so a consumer can probe it to tell a cleartext stack from a production
 *      deployment. The generation marker lives on `CleartextACL` alone, the one address every consumer
 *      already holds; `getVersion()` here still reports the base contract.
 *
 *      The cleartext value of a pad-based input is not recovered here but by `CleartextArithmetic`, from the
 *      input package the executor hands it (`LibCleartextPad.unmaskPart`).
 *
 *      Constants rather than storage: these run behind proxies, where an initialized state variable is
 *      only ever written to the implementation's own storage and reads back as `false` or zero through
 *      the proxy.
 */
/// @custom:security-contact https://github.com/zama-ai/fhevm/blob/main/SECURITY.md
contract CleartextPaddedInputter is PaddedInputter {
    /// @notice Marks a cleartext (mock) implementation. Real host contracts have no such selector, so a
    ///         consumer can probe it to tell a cleartext stack from a production deployment.
    bool public constant IS_CLEARTEXT = true;
}
