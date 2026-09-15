# Port of `devex/alex/v13/forge-compat-fix` to main

Branch: `devex/alexb/v14/port-v13-forge-compat-fix` (off `main`).
Source: the 23 commits of `origin/devex/alex/v13/forge-compat-fix` (PR into `release/0.13.x`).
Targets: `fhevm-npm`, `host-contracts-cleartext/v13`, `host-contracts-cleartext/v14`.

## What the PR contains

1. **Forge-std-free payload.** `pkg/forge/src` stops importing forge-std. Hand-written `IForgeVm.sol`
   (vendored cheatcodes) and `ForgeVmBase.sol` (binds the cheatcode address as `fvm`, not `vm`, to avoid the
   `is Test, FhevmDeploy` identifier clash). Tests pin that nothing under `pkg/forge/src` imports forge-std.
2. **Forge-only cleartext checks.** `CleartextForgeACL` and the shared `CleartextHandle` library apply
   chain-id checks on handles. `IS_FORGE` / `IS_CLEARTEXT` constant markers; errors renamed `CleartextError*`.
   The in-process deploy uses the forge variants; `DeployLocalStack` keeps plain contracts (it broadcasts to a
   node, where cheatcodes do not exist).
3. **CleartextACL replaces ACL everywhere.** `CleartextACL is ACL` adds `IS_CLEARTEXT` and
   `CLEARTEXT_PROTOCOL_VERSION`. Renamed artifacts follow (`abi/CleartextACL.json`, `ICleartextACL.sol`,
   `artifacts/CleartextACL.ts`, `CLEARTEXT_ACL_CREATION_CODE`). Role name `ACL_ADDRESS` unchanged. Hardhat
   v2/v3 plugins map `ACL` to the new ABI file. `ACL.CLEARTEXT_PROTOCOL_VERSION` joins every upgrade
   "may change" allow-list. `stack-order.test.ts` scans every deploy layer for the plain ACL.
4. **New forge libraries for consumers.** `FhevmCleartextEncrypt`, `FhevmCleartextDecrypt`,
   `FhevmCleartextDecryptPublic`, `FhevmCleartextSigners`, `FhevmCoprocessorConfig` (byte-exact extract of
   `@fhevm/solidity` 0.13.3 `lib/Impl.sol`). Tests under `test/forge/` plus `test/utils/Bits.sol`.
5. **Naming and layout.** `FhevmDeploy` -> `FhevmCleartextDeploy`, `deployFhevm()` -> `deployLocalFhevm()`,
   forge tests move to `test/forge/`. `FhevmCleartextConfig.sol` moves from `create2-deploy/script/` to
   `pkg/forge/src/`.
6. **Build hygiene.** Foundry profiles `forgefhevmcore` and `create2` so the payload and CREATE2 scripts are
   compiled, formatted and linted. `generateLocalHostBytecode` runs `forge fmt` on its output.
   `FhevmDeployScript.s.sol` fixed (missing import; initializer encoded against `ACL`). `_constant` is `pure`.
7. **fhevm-npm.** Cleartext config generator emits a required one-line `summary` per constant into the
   Solidity face and writes it to the new path. Schema updated. `sync vendored` names the download cache to
   delete on a read failure.
8. **operators-data.** Standalone top-level dir of FHE operator vectors plus a Rust checker. Unreferenced.

## Measured against main

- `fhevm-npm` on main is byte-identical to `release/0.13.x`: hunks apply cleanly.
- `hardhat` hunks apply cleanly.
- `cleartext-config.json` conflicts: main has five v14-only constants and a reshaped nonce table. Hand merge.
- `host-contracts-cleartext/v13` on main equals release minus the v12->v13 upgrade path. All hunks apply
  except the five upgrade files that no longer exist.
- `host-contracts-cleartext/v14`: the v13 patch with paths rewritten applies to 62 of 68 non-generated files.
  Hand work: `FhevmDeploy.sol`, `DeployLocalStack.s.sol`, `FhevmDeployScript.s.sol`,
  `MaterializeInitData.sol`, `verify.ts`, `deploy-v14.test.ts`, plus the v13->v14 upgrade path.

## Steps

### Phase 1. Shared and fhevm-npm
1. Apply the PR diff for `fhevm-npm`, `hardhat`, and `common-vendored/src/cleartext-config-v13.ts`. Apply the
   same path-comment fix to `common-vendored/src/cleartext-config-v14.ts`.
2. Hand-merge `cleartext-config.json`: add the PR's `summary` to each shared constant, write summaries for
   the five v14-only constants. The schema makes `summary` required, so generation fails until done.
3. Run the fhevm-npm unit tests.

### Phase 2. v13
4. Apply the PR diff for `host-contracts-cleartext/v13`, excluding the five missing upgrade files. Keep the
   `DEFAULT_MAY_CHANGE` hunk in `verify.ts` (shipped API).
5. Delete the stale `create2-deploy/script/FhevmCleartextConfig.sol` after regeneration writes the new one.

### Phase 3. v14, mechanical
6. Apply the path-rewritten patch for the 62 clean files (CleartextACL/ForgeACL/Handle, IForgeVm, ForgeVmBase,
   the five forge libraries, `test/forge/`, foundry profiles, package scripts, `.gitignore`, generator
   changes, test updates).
7. `CLEARTEXT_PROTOCOL_VERSION = 14` in v14's `CleartextACL.sol`.

### Phase 4. v14, hand port
8. `FhevmDeploy.sol` -> `FhevmCleartextDeploy.sol`: drop forge-std import, inherit `ForgeVmBase`, `vm` -> `fvm`,
   `CleartextForgeACL` in slot 0, `deployFhevm` -> `deployLocalFhevm`. Transform v14's own file; do not copy v13.
9. `DeployLocalStack.s.sol`, `FhevmDeployScript.s.sol`: deploy `CleartextACL`, add the import, encode the
   initializer against `ACL`.
10. `MaterializeInitData.sol` and the `ComputeAddresses` template: forge fmt, `pure` on `_constant`.
11. `verify.ts`: renamed artifact import; `ACL.CLEARTEXT_PROTOCOL_VERSION` in `DEFAULT_MAY_CHANGE`.
12. `deploy-v14.test.ts`: the marker assertions the PR added to `deploy-v13.test.ts`, expecting 14.
13. v13->v14 upgrade path: `FhevmUpgradeBase.s.sol` slot 2 and `FhevmCreate2Base.s.sol` slot 0 name
    `CleartextACL`; `Create2Ordinals.t.sol` and `Create2UpgradeOrdinals.t.sol` follow; `library.test.ts`,
    `create2.test.ts`, `testnet.ts` read `CleartextACL.json` from the v13 dev package, allow
    `ACL.CLEARTEXT_PROTOCOL_VERSION` to move, assert 13 before and 14 after.
14. `FhevmCoprocessorConfig.sol`: re-extract from the `@fhevm/solidity` version v14 targets and update the
    header, or confirm the slices are byte-identical and keep the file.
15. Confirm v14's `InputVerifier` and `KMSVerifier` signing paths match v13 so `FhevmCleartextEncrypt` and
    `FhevmCleartextDecrypt` port unchanged (upstream changed `KMSVerifier.sol` between generations).

### Phase 5. Regenerate and compile
16. `make generate`: config faces at the new path, ACL templates/ABI/TS artifacts renamed,
    `LocalHostBytecode.sol` reformatted. Remove the two stale `create2-deploy/script/FhevmCleartextConfig.sol`.
17. Per generation: `forge build` in all three profiles, `npm run lint`, `npm run fmt:check`.
18. Per generation: `npm run test:forge`, then the fast node tests `test/*.test.ts` (stack-order, templates,
    contract-sizes, config mirror). Watch `contract-sizes`: markers push `CleartextForgeFHEVMExecutor` past
    EIP-170 in v13; v14 was already over and is in the exception list.
19. Compile the hardhat v2 and v3 plugins.

### Phase 6. Long tests, last (~20 min)
20. `make test`, both `test:upgrade` runs, consumer rehearsal.

## Out of scope unless asked
- `operators-data` (self-contained, unreferenced). One copy command if wanted.
- v12 (absent on main).

## Status (2026-09-15)

- Phases 1-5 done. 22 commits on the branch: 21 PR commits (v12/operators-data halves stripped), one v14
  `_constant` fix, one v13 `stack-order.test.ts` fix (`af1f704`), one v14 port commit (`aabeafa`).
- Green: forge build/test both gens (v13 76, v14 96), fmt/lint, `test/*.test.ts` (v13 37, v14 40), vitest
  harness (v13 21, v14 22), fhevm-npm 314, hardhat v2/v3 plugin compile, per-gen checks, `make generate`
  spotless.
- Red by design until the PR merges: `check generation-parity` (rule 3.4.6) wants main's v13 to be a
  byte-copy of `origin/release/0.13.x`. `af1f704` must therefore move to the PR branch (make the scan skip
  a missing upgrade layer) or main's v13 will stay out of parity after the merge.
- Phase 6 (long tests) not run yet.

## Re-sync (2026-09-15, after #120 merged as `04e06c7`)

- Base branch is `origin/release/0.14.x`, not `origin/main` (main is the old `packages/` layout).
- `b2862ee`: v13 re-synced byte-for-byte from release minus the ROTATION.md deletions; `pkg/package.json`
  and consumer lockfiles now 0.13.0-0, `versions.json` follows. `check generation-parity` and
  `version check` green except one file.
- `stack-order.test.ts`: release copy reads the deleted upgrade lane. Rotation-safe version applied here
  and committed on local branch `devex/alexb/v13/stack-order-rotation-safe` (off release/0.13.x, not
  pushed). Merge that into release/0.13.x and parity is fully green.
- Phase 6 (long tests) still not run.
