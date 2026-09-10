import type { Create2Addresses, Create2Parameters } from './types/public.js';
/**
 * The canonical deterministic-deployment proxy, at the same address on every chain.
 *
 * Not configurable, deliberately: it is the one input that must never vary per operator or per chain, and
 * every address this module returns is a function of it. Note that inheriting the ADDRESS is not the same
 * as trusting the CONTRACT — a different contract could squat it on some testnet, which is why the deploy
 * coordinator gates on the factory's runtime code hash before sending anything. That check needs a chain;
 * this module is pure, so it cannot make it.
 */
export declare const CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
/**
 * Role names, byte-for-byte as the deploy scripts spell them.
 *
 * These strings are INSIDE the salt, therefore inside every address. A typo here does not fail — it
 * produces a different, perfectly valid address that nothing else in the system agrees with. They are
 * duplicated from `create2-deploy/script/FhevmCreate2Base.s.sol`'s `R_*` constants because Solidity and
 * TypeScript cannot share a constant; `test/create2-roles.test.ts` compares the two lists.
 */
export declare const CREATE2_ROLES: {
    readonly implEmptyProxyAcl: "IMPL_EMPTY_UUPS_PROXY_ACL";
    readonly implEmptyProxy: "IMPL_EMPTY_UUPS_PROXY";
    readonly acl: "ACL_ADDRESS";
    readonly fhevmExecutor: "FHEVM_EXECUTOR_ADDRESS";
    readonly kmsVerifier: "KMS_VERIFIER_ADDRESS";
    readonly inputVerifier: "INPUT_VERIFIER_ADDRESS";
    readonly hcuLimit: "HCU_LIMIT_ADDRESS";
    readonly protocolConfig: "PROTOCOL_CONFIG_ADDRESS";
    readonly kmsGeneration: "KMS_GENERATION_ADDRESS";
    readonly cleartextArithmetic: "CLEARTEXT_ARITHMETIC_ADDRESS";
    readonly cleartextDb: "CLEARTEXT_DB_ADDRESS";
    readonly pauserSet: "PAUSER_SET_ADDRESS";
    readonly aclOwner: "ACL_OWNER";
};
/**
 * Predicts every address a CREATE2 deploy of this generation will land on.
 *
 * The deterministic-deployment counterpart to `precomputeAddresses`, and a strictly stronger guarantee.
 * `precomputeAddresses` derives `CREATE(deployer, nonce)`, so it depends on the deployer's live nonce and
 * is invalidated by any transaction that moves it. These addresses depend on nothing but the factory, the
 * salt inputs and the init code: no chain access, no deployer nonce, no ordering. They are the same before
 * the first transaction and after the last.
 *
 * ## What it does not return
 *
 * The nine implementation addresses. Their init code bakes in the COMPLETE address set — that is what
 * makes the stack's wiring immutable — so predicting them needs the output of this function fed back into
 * a rebuild, which is the deploy coordinator's three-pass pipeline and not something a pure function can
 * do. Everything a consumer needs to talk to a stack is here; the implementations only matter to whoever
 * is deploying it.
 *
 * ## Why two passes are enough
 *
 * Only two templates carry a baked-in address at all — `EmptyUUPSProxy` and `PauserSet`, both just the
 * ACL — and the ACL proxy's own init code references no address, only the empty implementation it sits
 * over. So the chain resolves in order with no fixpoint:
 *
 *   1. the empty ACL implementation, whose init code is constant
 *   2. the ACL proxy over it, carrying `initialize(deployer)`
 *   3. the shared empty implementation, which bakes the ACL address from step 2
 *   4. every other proxy over step 3 — all sharing ONE init code, distinguished purely by salt
 *   5. `PauserSet` (bakes the ACL) and `ACLOwner` (takes it as a constructor argument)
 *
 * ## The deployer is part of the address
 *
 * `deployer` is baked into the ACL proxy's `initialize(address)` call and into `ACLOwner`'s constructor,
 * so it changes those two addresses. It is the DEPLOYER, not the final admin: `PauserSet.addPauser` is
 * `onlyACLOwner`, so the early steps are only sendable by whoever this names, and a multisig admin cannot
 * sign mid-run. Passing the admin here produces a stack that cannot be bootstrapped.
 *
 * @example
 * ```ts
 * const predicted = await precomputeCreate2Addresses({
 *   ethUtils,
 *   version: '0.13',
 *   deploymentId: 'mainnet-1',
 *   deployer: '0x…',
 * });
 * ```
 */
export declare function precomputeCreate2Addresses(parameters: Create2Parameters): Promise<Create2Addresses>;
//# sourceMappingURL=create2Addresses.d.ts.map