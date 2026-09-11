# Wiring ledger: what must change outside `v14/` to make it V(N)

Everything in this package was built without touching a file outside `sdk/host-contracts-cleartext/v14`
(plan: `sdk/plans/HOST_CONTRACTS_CLEARTEXT_V14_PLAN.md`, golden rule 1). This file is the debt that rule
created, for the developer who wires v14 in. Delete it when the list is empty.

## Status, 2026-09-11: wired in

Every item of the two lists this file carried is done. Outside `v14/`: npm-manifest.json names v14 as
`current` and v13 as `previous` with v12 gone, the root workspaces list v14, `cleartext-config.json` holds
the five KMS constants scoped with `generations: ["v14"]` and `localhost.generations["0.14.0"]`, the
generator emits the scoped face `cleartext-config-v14.ts` into common-vendored/src and `sync vendored`
copies it here, and the three Hardhat packages pin `v14/pkg`. Inside `v14/`: the provisional JSON, its
guard test and the byte-equality test for the vendored faces are deleted, the faces are regenerated, and
`internal/generateLocalHostBytecode.ts` imports the scoped constants from
`@fhevm/sdk-vendored-dev/cleartext-config-v14.ts`.

What v13's copy of `test/cleartext-config-mirror.test.ts` still needs — reading truth through the same
`generations` filter — is a change to a file `release/0.13.x` owns, so it lands there first (rule 3.4.6).

The records below are kept for what they measure; the wiring ledger itself is closed.

## Record: Part B as delivered

Seven commits from `c7e4667be` (B1) to B8 on 2026-09-06: 1075 hand-written lines added and 917 removed
against the end of Part A, generated output excluded. Both upgrade suites run and pass: the nonce path
(the TypeScript path, 2 tests) and the CREATE2 path (12 tests), both under `test:upgrade`.

## Record: Part C as delivered

`fheMulDiv` implemented on 2026-09-06 (`f16f2d4da`, C1 and C2 as one commit): `recordMulDiv` in the
arithmetic, `_mulDivOp` overridden in both executor variants, `CleartextArithmetic` v0.5.0 with
`reinitializeV3`, fifteen Foundry cases. The upgrade is seven creates and seven ops again, and
`list:upgrade-ops -- ../v13` reports no `⚠`. Nothing for the wiring step beyond what Part B listed.

## Record: Part A as delivered

Against `v13` at the branch point, vendored contracts, generated output, lockfiles, the provisional JSON and
the pooled-address essay excluded: 1235 hand-written lines added, 208 removed, 72 of the added lines are
comments (5 %). Configuration files differ only by the bridge `skip` list and the remapping prefix.
