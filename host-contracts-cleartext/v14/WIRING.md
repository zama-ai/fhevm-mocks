# Wiring ledger: what must change outside `v14/` to make it V(N)

Everything in this package was built without touching a file outside `sdk/host-contracts-cleartext/v14`
(plan: `sdk/plans/HOST_CONTRACTS_CLEARTEXT_V14_PLAN.md`, golden rule 1). This file is the debt that rule
created, for the developer who wires v14 in. Delete it when the list is empty.

## Outside `v14/`, in the order the checks report them

1. `sdk/npm-manifest.json`: `generations.host-contracts-cleartext` → `current: ./host-contracts-cleartext/v14`,
   `previous: ./host-contracts-cleartext/v13`; five inventory entries for v14 (dev, pkg, pkg/ts, two
   consumers); `member: true` moves from `v13/pkg` to `v14/pkg`; v12's five entries removed.
2. `sdk/package.json#workspaces`: `v12` → `v14`, `v13/pkg` → `v14/pkg`.
3. `sdk/cleartext-config.json`: merge `internal/cleartext-config.provisional.json` into it — the five
   constants with `generations: ["v14"]`, and `localhost.generations["0.14.0"]`; `appliesTo.generations`
   → `["v13", "v14"]`; `0.12.0` removed. Decision 8.9 of the plan: `CLEARTEXT_KMS_NODE_STORAGE_URL_PREFIX`
   → `s3://cleartext-kms-bucket-`, for every generation.
4. `sdk/fhevm-npm/base/generate-cleartext-config.ts`: emit the scoped face `cleartext-config-v14.ts`
   (the sample checkout's version of this change is the reference).
5. `sdk/common-vendored/manifest.json`: destinations `host-contracts-cleartext/v14/pkg/ts` and
   `.../pkg/ts/types`; v12's removed.
6. Hardhat pins to `v14/pkg`: `hardhat/v2/plugin/pkg`, `hardhat/v2/e2e`, `hardhat/v3/plugin/pkg`, and the
   mirror patch in `fhevm-npm/base/mirrors/hardhat-template-v2.ts`.
7. `v13`: drop the `-v12-dev` devDependency and its upgrade e2e; `git rm -r host-contracts-cleartext/v12`.
8. `make install`, regenerate the consumer lockfiles, `make ci`; `check-generations` must be green.

## Inside `v14/`, once the above is done

- Delete `internal/cleartext-config.provisional.json` and the guard test
  "the shared JSON does not yet declare what v14 carries provisionally" in `test/cleartext-config-mirror.test.ts`;
  the mirror test then reads scoped truth from the shared JSON like the sample does.
- Regenerate `pkg/ts/cleartext-config-v14.ts`, `scripts/cleartext-config.sh` and
  `create2-deploy/script/FhevmCleartextConfig.sol` with `make generate`; drop the PROVISIONAL headers and the
  "until the shared JSON scopes them" comments. `internal/generateLocalHostBytecode.ts` then imports the
  scoped constants from `@fhevm/sdk-vendored-dev/cleartext-config-v14.ts` instead of reading the JSON.
- Delete the byte-equality test for the vendored TypeScript faces; `sync-vendored` owns them again.
- Delete this file.

## Record: Part B as delivered

Seven commits from `c7e4667be` (B1) to B8 on 2026-09-06: 1075 hand-written lines added and 917 removed
against the end of Part A, generated output excluded. Both upgrade suites run and pass: the nonce path
(`test:upgrade-e2e`, 2 tests) and the CREATE2 path (`test:create2-upgrade-e2e`, 12 tests).

## Record: Part C as delivered

`fheMulDiv` implemented on 2026-09-06 (`f16f2d4da`, C1 and C2 as one commit): `recordMulDiv` in the
arithmetic, `_mulDivOp` overridden in both executor variants, `CleartextArithmetic` v0.5.0 with
`reinitializeV3`, fifteen Foundry cases. The upgrade is seven creates and seven ops again, and
`list:upgrade-ops -- ../v13` reports no `⚠`. Nothing for the wiring step beyond what Part B listed.

## Record: Part A as delivered

Against `v13` at the branch point, vendored contracts, generated output, lockfiles, the provisional JSON and
the pooled-address essay excluded: 1235 hand-written lines added, 208 removed, 72 of the added lines are
comments (5 %). Configuration files differ only by the bridge `skip` list and the remapping prefix.
