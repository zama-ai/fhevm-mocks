// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

// THE IMPORTS BELOW ARE THIS FILE'S RE-EXPORT SURFACE, not just its own dependencies: ~30 consumers name
// their interfaces and address constants through `ForgeFhevmDeploy.sol`, because everything generated lives
// under `_internal/` and is not part of the API. They stay whether this contract's body uses them or not.
// forge-lint: disable-start(unused-import)
import {ForgeVmBase} from "./ForgeVmBase.sol";

import {
    ACL_ADDRESS,
    CLEARTEXT_ARITHMETIC_ADDRESS,
    CLEARTEXT_DB_ADDRESS,
    DEPLOYER_ADDRESS,
    DEPLOYER_START_NONCE,
    PROXY_COUNT,
    FHEVM_EXECUTOR_ADDRESS,
    HCU_LIMIT_ADDRESS,
    INPUT_VERIFIER_ADDRESS,
    KMS_GENERATION_ADDRESS,
    KMS_VERIFIER_ADDRESS,
    MNEMONIC,
    PAUSER_SET_ADDRESS,
    PROTOCOL_CONFIG_ADDRESS
} from "./_internal/LocalHostAddresses.sol";

import {
    ACL_OWNER_CREATION_CODE,
    CLEARTEXT_DB_CREATION_CODE,
    CLEARTEXT_FORGE_ACL_CREATION_CODE,
    CLEARTEXT_FORGE_ARITHMETIC_CREATION_CODE,
    CLEARTEXT_FORGE_FHEVM_EXECUTOR_CREATION_CODE,
    CLEARTEXT_INPUT_VERIFIER_CREATION_CODE,
    CLEARTEXT_KMS_VERIFIER_CREATION_CODE,
    EMPTY_UUPS_PROXY_ACL_CREATION_CODE,
    EMPTY_UUPS_PROXY_CREATION_CODE,
    ERC1967_PROXY_CREATION_CODE,
    HCU_LIMIT_CREATION_CODE,
    KMS_GENERATION_CREATION_CODE,
    PAUSER_SET_RUNTIME_CODE,
    PROTOCOL_CONFIG_CREATION_CODE
} from "./_internal/LocalHostBytecode.sol";

import {LocalHostBootstrap} from "./_internal/LocalHostBootstrap.sol";

import {ICleartextACL} from "./_internal/interfaces/ICleartextACL.sol";
import {ACLOwner, IACLOwner} from "./_internal/interfaces/IACLOwner.sol";
import {ICleartextArithmetic} from "./_internal/interfaces/ICleartextArithmetic.sol";
import {ICleartextDB} from "./_internal/interfaces/ICleartextDB.sol";
import {ICleartextFHEVMExecutor} from "./_internal/interfaces/ICleartextFHEVMExecutor.sol";
import {ICleartextInputVerifier} from "./_internal/interfaces/ICleartextInputVerifier.sol";
import {ICleartextKMSVerifier} from "./_internal/interfaces/ICleartextKMSVerifier.sol";
import {IEmptyUUPSProxy} from "./_internal/interfaces/IEmptyUUPSProxy.sol";
import {IEmptyUUPSProxyACL} from "./_internal/interfaces/IEmptyUUPSProxyACL.sol";
import {IHCULimit} from "./_internal/interfaces/IHCULimit.sol";
import {IKMSGeneration} from "./_internal/interfaces/IKMSGeneration.sol";
import {IPauserSet} from "./_internal/interfaces/IPauserSet.sol";
import {IProtocolConfig} from "./_internal/interfaces/IProtocolConfig.sol";
// forge-lint: disable-end(unused-import)

import {LibForgeFhevmStack} from "./LibForgeFhevmStack.sol";

/**
 * @title  ForgeFhevmDeploy
 * @notice Stands up a cleartext FHEVM stack at the canonical localhost addresses — the INHERITABLE face of
 *         `LibForgeFhevmStack`.
 * @dev
 * Inherit and call `deployLocalFhevm()`. It is idempotent, so calling it from `setUp()` in a base contract
 * and again from a derived one is safe.
 *
 * ## What this adds over the library
 *
 * The deploy itself lives in `LibForgeFhevmStack` — a library, so a caller that cannot inherit (a script
 * that already extends something else, another library, a contract at a fixed address) can run the same
 * sequence. This contract adds the one thing a library cannot have: STATE. `fhevmACLOwner()` answers from
 * an address remembered at deploy time, so it keeps answering after a test moves ACL ownership elsewhere;
 * the library's `aclOwner()` reads `ACL.owner()` and would then report the new owner. Everything else here
 * is a one-line forward.
 *
 * ## What a consumer may import
 *
 * Everything generated lives under `_internal/` and is not part of the API. Import from *this file*
 * instead — Solidity re-exports imported symbols, so the interfaces and address constants the deploy
 * already pulls in are reachable through it:
 *
 * ```solidity
 * import {ForgeFhevmDeploy, ICleartextACL, ACL_ADDRESS} from "host-contracts-cleartext-forge/ForgeFhevmDeploy.sol";
 *
 * contract MyTest is Test, ForgeFhevmDeploy {
 *     function setUp() public { deployLocalFhevm(); }
 *     function test_x() public { ICleartextACL(ACL_ADDRESS).isAllowed(handle, user); }
 * }
 * ```
 *
 * Reaching into `_internal/` works — Solidity has no directory visibility — but nothing there is stable,
 * and `LocalHostBytecode.sol` in particular is a trap: those blobs are pre-compiled against the canonical
 * addresses, so deploying them by hand bypasses the nonce-ordering guards and yields a stack whose
 * bytecode points at addresses nothing lives at.
 */
abstract contract ForgeFhevmDeploy is ForgeVmBase {
    /// @dev The standing ACLOwner, remembered at deploy time. Read it through `fhevmACLOwner()`.
    ///
    ///      Deliberately runtime state rather than a generated constant. On a fresh deploy it happens to be
    ///      CREATE(deployer, 12), but the ACLOwner *survives an upgrade*: `updateV12ToV13` takes the standing
    ///      one as a parameter and deploys none, so on an upgraded stack it came from the previous
    ///      generation's deploy at an unrelated nonce. A constant would be right here and wrong there.
    address private _fhevmACLOwner;

    /// @notice The mnemonic every account in the local stack derives from.
    function fhevmMnemonic() internal pure returns (string memory) {
        return LibForgeFhevmStack.mnemonic();
    }

    /**
     * @notice The standing ACLOwner: owner of ACL, and the only account that can upgrade the stack.
     * @dev Exposed because it is the one thing a caller needs that is neither a constant nor derivable:
     *      an upgrade tool built on top of this has to address the ACLOwner established by the deploy,
     *      and the same contract carries across generations. `ACL.owner()` answers the same question on
     *      chain, but only after the fact and only if ownership has not since moved — which is the whole
     *      reason this is remembered here rather than read back (`LibForgeFhevmStack.aclOwner()` reads).
     *
     *      Reverts rather than returning zero before `deployLocalFhevm()` has run — a zero here would other-
     *      wise surface much later as a call into an empty address.
     */
    function fhevmACLOwner() internal view returns (address) {
        require(_fhevmACLOwner != address(0), "ForgeFhevmDeploy: call deployLocalFhevm() before fhevmACLOwner()");
        return _fhevmACLOwner;
    }

    /// @notice Deploys the stack if it is absent, and remembers its ACLOwner. Idempotent.
    function deployLocalFhevm() internal virtual {
        _fhevmACLOwner = LibForgeFhevmStack.deployLocalFhevm();
    }
}
