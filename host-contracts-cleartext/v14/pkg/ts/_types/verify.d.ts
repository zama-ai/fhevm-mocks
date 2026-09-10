import type { StackSnapshot, VerifyParameters, VerifyReport, SnapshotParameters } from './types/public.js';
/**
 * Snapshots everything readable about a live stack, for comparison after an upgrade.
 *
 * Must be called BEFORE the upgrade: by the time `verify` runs the previous values are gone from the
 * chain, so this snapshot is the only witness that they were ever different.
 *
 * `blockNumber` is captured alongside the readings, and is what bounds the event scans `verify` runs over
 * the upgrade's blocks. Without it those scans would have to guess a range.
 *
 * ## A caveat when snapshotting the PREVIOUS generation
 *
 * The getters are enumerated from THIS package's ABIs. Pointed at a v13 stack, a getter that v14 added
 * simply reverts and is recorded as `<reverted>` — harmless, and it stays `<reverted>` or starts working,
 * either of which reads correctly. What this cannot see is a getter v14 REMOVED: it is absent from the
 * enumeration, so its disappearance is invisible. Supply `abis` with the previous generation's ABIs to
 * close that gap when the previous package is available.
 */
export declare function snapshotStack(parameters: SnapshotParameters): Promise<StackSnapshot>;
/**
 * The readings allowed to differ across an upgrade, and why. Anything else must be identical.
 *
 * `getVersion` moves on exactly the contracts an upgrade re-points — which `checkVersions` asserts
 * positively, so here it is only excused. `InputVerifier` is deliberately absent: its bytecode is
 * unchanged between generations, so a moved version there means something re-pointed a proxy nobody
 * intended to touch.
 */
export declare const DEFAULT_MAY_CHANGE: readonly string[];
/**
 * Checks the full integrity of a deployed or upgraded stack.
 *
 * Returns a report rather than throwing, so one run reports everything wrong. `report.ok` is the verdict;
 * `report.failures` says what is broken and `report.skipped` what could not be checked at all — read both,
 * because a skip is not a pass.
 *
 * ## `mode: 'deploy'`
 *
 * Everything that must be true of a correct stack at rest: code at every address, every proxy pointing at
 * a real implementation, every version matching `CONTRACT_VERSIONS`, every baked-in address agreeing with
 * what was actually deployed, ownership resting in the `ACLOwner` with nothing pending, and the `ACLOwner`
 * being a pauser. Anything the package cannot derive — who the admin should be, which signers were seeded —
 * is checked only if `expected` says what to expect, and reported as a skip otherwise rather than assumed.
 *
 * ## `mode: 'upgrade'`
 *
 * All of the above, plus what a version check cannot see: that nothing ELSE changed. Requires a
 * `snapshotStack()` taken before the upgrade, and compares every readable value against it — every
 * zero-argument getter on every contract, not a list someone remembered — allowing only `mayChange`.
 * It also requires that each `mayChange` entry actually changed, so the exemption list cannot decay into
 * a way of ignoring regressions.
 *
 * ## Adapter capabilities
 *
 * Two checks need more than `AbstractEthereumProvider` offers, so they take an optional `history`
 * adapter: reading the ERC-1967 slot (a proxy's code is identical before and after materialization) and
 * scanning for ownership/pauser events. Both are reported as skips when it is absent — with the reason,
 * because the pauser event scan is the ONLY check that can show nobody was added to a set that exposes no
 * enumeration.
 *
 * @example
 * ```ts
 * const before = await snapshotStack({ ethProvider, history, deployed: v13Stack });
 * await updateV13ToV14({ ... }); // creates no proxy: the address set is unchanged
 * const report = await verify({ ethProvider, history, deployed: v13Stack, mode: 'upgrade', before });
 * if (!report.ok) throw new Error(report.failures.map((f) => `${f.name}: ${f.detail ?? ''}`).join('\n'));
 * ```
 */
export declare function verify(parameters: VerifyParameters): Promise<VerifyReport>;
//# sourceMappingURL=verify.d.ts.map