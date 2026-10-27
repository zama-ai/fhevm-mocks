# Plan: rename generation v15 to v1.0

There will be no published `0.15.x`. The generation currently named `v15` / `0.15` ships as **`1.0.x`**, so it
is renamed `v1.0` everywhere: directory, file names, identifiers, versions, docs.

Revision 11: the reviewed revision 10 (both independent reviewers, one Fable and one Opus, agreed after six rounds), plus the owner's decisions D1 and D2. Every file:line
below was verified at `2080015`.

## Decisions

- **A generation is `major.minor`**, at every version: `1.0` and `1.1` are different generations.
- **Names:**
  - Directory and generation key: `v1.0`, so `host-contracts-cleartext/v1.0`, `cleartext-config-v1.0.ts`,
    workspace `@fhevm/host-contracts-cleartext-v1.0-dev`.
  - Identifiers use `V1_0`, since an identifier cannot hold a dot. Example: `updateV14ToV1_0`.
  - Legacy names stay as they are: `v13`, `v14`.
- **Name ↔ version mapping**, defined once in `fhevm-npm`:

  | Name               | Version           | Release branch              |
  | ------------------ | ----------------- | --------------------------- |
  | `v<N>`             | `0.<N>` (legacy)  | `release/0.<N>.x`           |
  | `v<major>.<minor>` | `<major>.<minor>` | `release/<major>.<minor>.x` |

  Generations order numerically: `v13 < v14 < v1.0 < v1.1`. The **next** generation of `v14` is `v1.0`; the
  next of `v<M>.<m>` is the next one that exists, not "+1".

- **Branches (owner decision D1).**
  - No `release/1.0.x` is created: we lack the permission. All 1.0 work stays on **`devex/alexb/v16/new`**, and
    `release/0.15.x` stays where it is, as the line's existing integration branch.
  - #219 (`a9b5fb1`, the tip of `release/0.15.x`, one commit past this line's base `3f35897`) is **not** merged:
    it restores `hardhat/v2`, and **hardhat v2 is dead for 1.0.x**. Nothing else in it is missing here (its
    `fhevm-npm` additions came through #215; its v14/v15 edits are already here).
  - Refs verified against `git ls-remote` after `git fetch --prune`.
- **`release/0.15.x` is a zombie for the tooling.** A 0.15 release will never exist, so no code or tooling derives,
  targets or defaults to it: no mapping produces it (`v1.0` → `release/1.0.x`, `v15` is rejected). The CI and
  branch configuration that names it today (three workflows, `dependabot.yml` on `main`, the operator runbooks) is
  left as it is: retargeting it needs `release/1.0.x`, which only the maintainers can create. Out of scope here.
- **On-chain marker:** from 1.0 on, `CleartextACL.CLEARTEXT_PROTOCOL_VERSION = major * 1_000_000 + minor *
1_000 + patch`.

  | Version       | Value     |
  | ------------- | --------- |
  | 0.13 (legacy) | 13        |
  | 0.14 (legacy) | 14        |
  | 1.0.0         | 1_000_000 |
  | 1.0.1         | 1_000_001 |
  | 1.1.0         | 1_001_000 |
  | 2.0.0         | 2_000_000 |
  - Legacy values stay as they are, since v13 and v14 are deployed and frozen.
  - Room: up to 999 minors and 999 patches per minor.
  - **Comparisons use the generation, decoded by one helper, `generationOfMarker`:**
    - `marker < 1_000_000` → legacy `0.<marker>`;
    - otherwise `major = marker / 1_000_000`, `minor = (marker / 1_000) % 1_000`.

    A plain `marker / 1_000` is wrong: 13 and 14 would both decode to 0. The patch part is informational,
    since a hotfix that does not touch the ACL leaves it behind. The helper exists once in TS (`create2-deploy/ts/common.ts`) and once
    in Solidity for the forge tests.

- **Published pin:** `~1.0.0` (tilde) from 1.0 on, so `1.1.x` is excluded. The tooling renders it; there are
  no hand-written pins to edit (step 1).
- **The CREATE2 salt needs no edit.** It is `majorMinorOf(packageVersion())` (`create2-deploy/ts/common.ts:362`),
  so it becomes `"1.0"` with the version bump. Only fixtures change.

## Where "generation N = release 0.N" is baked in

### Tooling (`fhevm-npm`, step 1)

| Where                                         | Today                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `base/checks/generation-parity.ts:86-87`      | `^v(\d+)$` → `release/0.<N>.x`                                                               |
| `base/checks/generation-parity.ts:62-74`      | override env `FHEVM_PARITY_REF_<GEN>` lowercased; a dot cannot be in an env name             |
| `base/checks/generations.ts:252`              | face file names `-(v\d+)\.[^.]+$` (two dots in `v1.0.ts` break it)                           |
| `base/generate-cleartext-config.ts:144`       | `appliesTo.generations` must match `^v\d+$` (`make generate` fails)                          |
| `schemas/cleartext-config.schema.json:28,117` | `"^v[0-9]+$"`                                                                                |
| `base/checks/deployments.ts:55,57`            | record names `-v(\d+)\.(\d+)-`                                                               |
| `base/checks/deployments.ts:67-68,420`        | `GENERATION=/^0\.(\d+)$/`, `PACKAGE_VERSION=/^0\.(\d+)\.(\d+)$/`, rebuilds `0.<gen>.<patch>` |
| `base/checks/deployments.ts:518`              | an upgrade must be `generation + 1` (`14 → 1.0` is not)                                      |
| `base/semver.ts:66-68`                        | `dependencyRange` always emits `^`                                                           |
| `base/semver.ts:71-76`                        | `satisfiesDependencyRange`: non-`^` = exact; local `sameGeneration` = major from 1.0         |

**Not affected:** `base/registry-age.ts:99-106` reproduces npm's own `^`/`~` resolution for third-party
updates and must not change.

### This generation's own derivations (step 3)

These are found by reading the code, not by grepping `v15`.

| Where (under `host-contracts-cleartext/v15/`)                                             | What breaks                                                           |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `create2-deploy/ts/hotfix.ts:48`                                                          | `Number(FHEVM_VERSION.split('.')[1])` silently gives **0** for 1.0    |
| `create2-deploy/ts/hotfix.ts:112,116,121,169-172`                                         | `^0\.(\d+)\.(\d+)$`; live marker compared with that generation        |
| `create2-deploy/ts/common.ts:1554,1557,1699`                                              | copy of the deployments regexes + `0.${gen}.${patch}` fallback        |
| `test/forge/ForgeFhevmDeploy.t.sol:157-168`                                               | parses trailing digits of the folder, asserts `/v<digits>` (step 2)   |
| `test/e2e/create2-deploy.test.ts:38-39`                                                   | `BigInt(basename.slice(1))` throws (step 2)                           |
| `test/ts/deploy-v14.test.ts:35-45`                                                        | `^0\.(\d+)\.` (the file also tests this generation: rename it)        |
| `test/create2-versions.test.ts:40-43`                                                     | asserts `FHEVM_VERSION === \`0.${marker}\``; regex misses `1_000_000` |
| `test/e2e/create2-hotfix.test.ts:142,193-195`                                             | `0.N` assumptions                                                     |
| `test/create2-hotfix.test.ts:65-77`                                                       | fixtures built as `` `0.${g}` ``                                      |
| `test/e2e/upgrade/create2.test.ts:482,811`, `test/ts/upgrade/library.test.ts:497-499,667` | marker equality `14n` / `15n`                                         |
| `pkg/src/cleartext/CleartextACL.sol:25`                                                   | `CLEARTEXT_PROTOCOL_VERSION = 15`                                     |
| `export.manifest.json:633` (→ `test-consumer/*/src/export.ts:213`)                        | dummy `version: '0.15'`                                               |
| `test/forge/LibForgeFhevmHostVersions.t.sol:247`                                          | label `"0.16"` (the generation after this one) → `"1.1"`              |

Where the marker is compared: for equality in `hotfix.ts:169-172` and the tests above. The upgrade code
(`pkg/ts/verify.ts:665`, `create2-deploy/upgrade/ts/testnet.ts:593`) only exempts it from the survival check.

### Workspace, CI, config (steps 2 and 3)

- **Out of scope (D1), left as they are until the maintainers create `release/1.0.x`:**
  `.github/workflows/sdk-cleartext-tests.yml:6`, `sdk-cleartext-deployments.yml:21`,
  `sdk-cleartext-publish-package.yml:73` (`ALLOWED_REF`), and `origin/main:.github/dependabot.yml:146,206,263`,
  all naming `release/0.15.x`.
- `versions.json:6-8`: keys are paths (`./host-contracts-cleartext/v15/pkg`), values `0.15.0-0`.
- `npm-manifest.json`:
  - generation key, workspace and test-consumer names, `dependencyGroup` (`:189,211,283,293`);
  - vendored `renamed` `cleartext-config-v15.ts` (`:263`);
  - `inventory.exclude` `./host-contracts-cleartext/v16` (`:4`), which becomes `v1.1`.
- Root `package.json:9-10` workspaces. `hardhat/v3/plugin/pkg/package.json:33` `file:` path.
- `host-contracts-cleartext/v15/package.json:15,17,64,68,69` (scripts hardcode the folder),
  `pkg/package.json:10` (`repository.directory`), `remappings.txt:2`.
- `cleartext-config.json`: `appliesTo.generations`, constant scopes `'v15'`, `localhost.generations["0.15.0"]`.
- Generated: `foundry/forge-fhevm-std/pkg/src/StdFhevmVersion.sol:7`.
- Lockfiles: root `package-lock.json`, `hardhat/v3/package-lock.json`, the test-consumer locks.
- The `Makefile` needs no edit: it reads names from `npm-manifest.json` and `package.json`.

### Docs (step 4)

- `CHANGELOG.md:5-6`: "pin with a caret" must become a tilde from 1.0.
- `fhevm-npm-docs/FHEVM_NPM_RULES.md:247-289,649,755` (rule 4.3.4, `^` → `~` from 1.0), `:1359,1369`, and
  `:554-555` ("identical on release/0.13.x and 0.14.x"), which step 6's decision must update either way.
- Hardhat plugin: `hardhat/v3/plugin/pkg/src/internal/contracts.ts:53,55` ("Since v15", "every v15 stack").
  (`chains.ts:39` goes with the trick in step 0.4.)
- `fhevm-npm-docs/VERSION_BUMP_RUNBOOK.md:3-61`, `GUIDE.md:97`.
- Operator runbooks that name `release/0.15.x`: **left as they are** until the maintainers create `release/1.0.x`
  (D1); listed so they are not forgotten then:
  - `create2-deploy/DEPLOY.md:93,96` and `UPGRADE.md:78,81` ("Use the `release/0.15.x` branch only",
    `git clone --branch release/0.15.x`);
  - `ROTATION.md:58` (the branch that owns parity).
- `foundry/forge-fhevm-std/rules.md:11,494-495`. `host-contracts-cleartext/v15/pkg/README.md:3-4,95`.
- The `Makefile:631-632` and `.gitignore:71` comments, and every remaining `v15` / `0.15.x` meaning our
  generation.

### Must NOT be touched by any replace

- **Everything under `host-contracts-cleartext/v14`** (frozen; for example `README.md:161-163`, `ROTATION.md`,
  `LibForgeFhevmHostVersions.t.sol:227` label `"0.15"`).
- **Upstream `@fhevm/sdk` `^0.15.0-3`:**
  - `npm-manifest.json:9`;
  - `hardhat/v3/plugin/package.json:37`, `plugin/pkg/package.json:36`, `fhevm-hardhat-template/pkg/package.json:54`,
    `plugin/test-consumer/esm/package.json:15`;
  - `v15/package.json:83`.
- **Upstream refs and paths:** floors/ceilings in `LibForgeFhevmHostVersions.sol:82-91,269` (and its test
  `:191`), "vendors v0.15.0-3", `LibCleartextPad.sol:14` (`src/v0.16.0/` upstream path).
- **Contract version strings** (`ProtocolConfig v0.3.0`, `CleartextDB v0.${…}.0`).
- **Unrelated 15s:** forge-std `rules.md` §2.15.x and README §15, "rules 15 and 17", `all[15]`, enum 15,
  "15 blocks", "10*3/2 = 15", `ADDRESSED_NONCE_COUNT = 14`.
- **Third-party dependency versions** in lockfiles (`hardhat 3.15.0`, `hardhat-ethers 4.0.15`,
  `@humanfs/types ^0.15.0`, …) and `operators-data/*/Cargo.lock`.
- **Upstream SDK line:** `v15/test/ts/utils/sdkLines.ts:4,99,128,230`
  (`protocolLine = Number(manifest.version.split('.')[1])`) reads the installed upstream `@fhevm/sdk` version
  (`0.15.0-3` gives 15), not our generation.
- **Triage by hand:** "v0.15.0, RFC-030" (`internal/constants.ts:96`, `pkg/ts/addresses.ts:36`,
  `internal/generateLocalHostBytecode.ts:295`), "Keeps v0.15's version" (`npm-manifest.json:234,238`),
  `v15/README.md:297` ("because v0.15 changed and bumped it"), `ForkCleartextUpgrade.t.sol:39` and
  `ROTATION.md:112` ("mix of 0.14 and 0.15 contracts"). These refer to upstream or devnet contract lines.

## Why the rename does not force an edit inside v14

- **Generated face:** v14's generated face does not change. Every `v15` mention in `cleartext-config.json` is in
  `appliesTo` or in entries scoped `["v15"]`, which never reach v14's face (`common-vendored/src/cleartext-config-v14.ts`
  matches `release/0.14.x`).
- **Mirror test:** v14's mirror test reads every `localhost.generations` key. That is why step 0 lands the
  backward-only mirror test on `release/0.14.x` and re-copies v14 **before** the key is renamed. Otherwise the
  `1.0.0` table breaks v14, as `0.15.0` did.

## Steps

### Step 0: prerequisites (before anything is renamed)

0. **Owner decisions (taken):**
   - **D1, branches:** no `release/1.0.x`; work stays on `devex/alexb/v16/new`; `release/0.15.x` kept; #219 not
     merged (hardhat v2 is dead for 1.0.x). A dry run (`git merge-tree HEAD a9b5fb1`) had shown it would conflict in
     `Makefile`, a workflow, four `fhevm-npm` files and seven `hardhat/v2` files.
   - **D2, backports to v14:** everything v14 needs is ported in the separate checkout
     **`/Users/alex/src/me/zama-ai/fhevm-mocks-v14`** (clean, on `release/0.14.x` at `6045b1b`, equal to origin),
     on **one single branch** created there (proposed name: `devex/alexb/v14/v1.0-naming`). Only what v14 needs is
     ported, not a reconciliation of the whole `fhevm-npm` tree. Nothing is merged until the whole 1.0 naming is
     done. `release/0.13.x` is not touched.
   - **D3, #222's "no protocolConfig" trick: dropped on this line.** The SDK is being changed to the new
     formalism, so the stopgap must go. #222 was only partly brought across (its v14 part came with `378c2ea`);
     step 0.4 completes it here, as its own commit outside the rename.

   For reference, `release/0.14.x` is 3 commits ahead of this line (#152, #217, #222), but under `v14/` all of it is
   already here, so v14 here differs from that branch only by allowed deletions, the exempt `package.json` and the
   `b270f41` mirror edit. Step 0.2 therefore copies back only the mirror test.

1. **Mirror-test fix, v15.** `cleartext-config-mirror.test.ts` judges only its own generation and older ones
   (`generationsUpToThisOne`); a newer generation declares what it appends (`APPENDED_SECONDARY_ROLES`). It is
   written, uncommitted, awaiting review. Commit it here.
2. **Backport, in the v14 checkout** (D2), on the single branch: the same mirror-test code with an empty
   `APPENDED_SECONDARY_ROLES`, naming nothing from later generations. On the same branch, `npm-manifest.json:4`
   `inventory.exclude` gains `./host-contracts-cleartext/v1.0` (keeping `v15`), so a checkout that switches back
   from a renamed tree is not polluted by the ignored leftover directory. Then copy v14's mirror test from that
   branch into this line, which removes the `b270f41` edit. Nothing is pushed or merged yet.
3. **Re-enable `check generation-parity`** in the `Makefile` (commented out in `2080015`), comparing v14 with the
   v14 branch rather than with `release/0.14.x`, through the check's own escape hatch:
   - make the branch visible here without pushing:
     `git fetch /Users/alex/src/me/zama-ai/fhevm-mocks-v14 devex/alexb/v14/v1.0-naming:refs/v14-checkout/v1.0-naming`;
   - run with `FHEVM_PARITY_REF_V14=refs/v14-checkout/v1.0-naming` **exported** (for example
     `FHEVM_PARITY_REF_V14=refs/v14-checkout/v1.0-naming make ci`). The `Makefile` runs the check plainly and
     never names the ref: its own convention (the `ci-local` comment) is that an unmerged parity ref is exported by
     whoever needs it. Without the export, the check fails against `release/0.14.x`, loudly and correctly.

   Each later port to the v14 branch is followed by that `git fetch` and by copying the changed v14 files across.
   Once the v14 branch is merged into `release/0.14.x`, drop the override.

4. **Drop the "no protocolConfig" trick** (D3), one commit, mirroring #222 (`6045b1b`):
   - `hardhat/v3/plugin/pkg/src/internal/chains.ts:28-41`: delete the "TEMPORARY TRICK" block and restore
     `protocolConfig: contract(fhevmAddresses.protocolConfigAddress)`;
   - `v15/pkg/src/cleartext/CleartextKMSVerifier.sol:87,104-116`: remove the TEMPORARY block in the one-argument
     `publicDecrypt(handles)`, which keeps signing extraData v1 exactly as #222 left it on v14;
   - `npm-manifest.json:10`: `@fhevm/sdk-prev1` `^0.14.3` → `^0.14.4`, then the lockfiles;
   - the tests #222 adapted on v14 (`CleartextKMSVerifierExtraData.t.sol`, `sdk-compatibility.test.ts`,
     `sdk-kms-rotation.test.ts`, `utils/sdkLines.ts`), applied to this generation's copies where they differ.
   - **SDK 0.15.x is never tested** (owner decision): there will be no 0.15 release, and the 0.15.x prereleases
     predate the SDK's port to v1.0.0, which happens later in the fhevm repo with this package as the source of
     truth. `sdkLines.ts` skips any SDK whose installed version is `0.15.*`; until the port, SDK 0.14 (and 0.13) are
     the working lines.

### Step 1: tooling (`fhevm-npm`), with tests

- **One name ↔ version ↔ branch mapping** (`v<N>` legacy, `v<M>.<m>`), with numeric ordering and "next
  generation".
  - Used by `generation-parity.ts` (branch), `generations.ts` (face file names) and
    `generate-cleartext-config.ts` (accepted keys).
  - Also used by the schema (`^v[0-9]+(\.[0-9]+)?$`) and by `deployments.ts`: record names
    `<kind>-v1.0.<patch>-<date>` (the dot count tells them from legacy `v13.0`), `GENERATION` /
    `PACKAGE_VERSION` accepting 1.x, the `0.<gen>` rebuild kept for legacy only, and "+1" replaced by "next
    generation".
- **Parity override:** `FHEVM_PARITY_REF_V1_0` maps `_` → `.` to address `v1.0`.
- **Zombie rule in the mapping:** the legacy form `v<N>` is limited to the known legacy generations (N ≤ 14); a
  `v15` name is rejected, never mapped to `release/0.15.x`. Test: `releaseBranchOf('v15')` is undefined or an
  error. On `release/0.14.x` and `release/0.13.x` (v14/v13, v13/v12) this changes nothing; v12 → `release/0.12.x`
  is skipped as today.
- **Comments in shared code:** reword `generation-parity.ts:83` ("when v15 lands, v14 becomes V(N-1)…") so the
  text stays true on every branch it is backported to.
- **`semver.ts`:** `dependencyRange` emits `~` when `major ≥ 1`; `satisfiesDependencyRange` understands `~` and
  compares major **and** minor. Update `test/semver.test.ts:46,60-63`. The 0.x behaviour is unchanged.
- Tests: `check-generation-parity.test.ts:73-76,237,242` (`releaseBranchOf` expectations, the `V15` override
  fixture), `check-deployments.test.ts:324-331` (its `v15.0` "two up" fixture), `check-generations.test.ts:457`
  (`0.15.0`), plus new cases for `v1.0`. These fixtures encode the zombie `0.15` and must not survive.
- **Backport:** the 0.x paths must behave exactly as today on `release/0.14.x` (v14 current, v13 previous) and
  `release/0.13.x`.

### Step 2: the generation's identity, in one buildable commit

Folder name, package version and on-chain marker change **together**, with **everything that reads any of the
three**. Tests compare the marker with the generation, and code derives the generation from the version or the
folder, so moving any input without its readers leaves a red commit.

- `git mv host-contracts-cleartext/v15 host-contracts-cleartext/v1.0`; delete the leftover ignored `v15/`
  directory (`dependencies/`, `out*`, `.out-*`, `node_modules`).
- `git mv common-vendored/src/cleartext-config-v15.ts …-v1.0.ts`; rename `test/ts/deploy-v14.test.ts` to what it
  tests.
- Rewrite the paths and names that the move breaks, in this same commit:
  - `npm-manifest.json` (keys, names, `dependencyGroup`, `renamed`, `inventory.exclude`);
  - `versions.json` keys;
  - root `package.json` workspaces;
  - the plugin `file:` path;
  - the v1.0 `package.json` scripts and `repository.directory` (not `remappings.txt`: its `../v14/` line still
    resolves after the move, and its prefix line is handled below in this step);
  - `cleartext-config.json` `appliesTo.generations` and scopes (validated against the manifest by
    `generations.ts:297-320`).
- `fhevm-npm version apply` to `1.0.0-0` (never hand-edit `versions.json`); the CREATE2 salt becomes `"1.0"`.
- The config remapping prefix `fhevm-config-0.15.0/` → `fhevm-config-1.0.0/`, because
  `test/config-remapping.test.ts:26` asserts it equals the package's `major.minor`. It is read from the import in
  `pkg/src/addresses/FHEVMHostAddresses.sol:17` (`internal/configRemapping.ts:20-25`, `scripts/deploy.sh:89`), and
  the mirror test's `generationKey()` follows that import. So these change together: `FHEVMHostAddresses.sol:17`,
  `remappings.txt:2`, and the JSON key `localhost.generations["0.15.0"]` → `"1.0.0"` (safe after step 0). The generated `pkg/forge/script/ComputeAddresses.s.sol` follows via `make generate` (`test/templates.test.ts:761` checks it for staleness). The hand-written `FhevmDeployScript.s.sol:52,58` only mentions the prefix in doc comments: step 4.
- `CLEARTEXT_PROTOCOL_VERSION = 1_000_000` (`CleartextACL.sol:25`) and the `generationOfMarker` helper (TS and
  Solidity).
- Every derivation whose input is the folder name, the package version or the marker, through
  `generationOfMarker` and the step-1 name ↔ version mapping. That is, every row of "This generation's own
  derivations":
  - `test/e2e/create2-deploy.test.ts:38-39,357-359`, `test/forge/ForgeFhevmDeploy.t.sol:157-168`;
  - `create2-deploy/ts/hotfix.ts:48,112,116,121,169-172` and `create2-deploy/ts/common.ts:1554,1557,1699`;
  - `test/create2-versions.test.ts:40-43` (its regex must read `1_000_000`), `test/ts/deploy-v14.test.ts:35-45`;
  - `test/create2-hotfix.test.ts:65-77`, `test/e2e/create2-hotfix.test.ts:142,193-195`;
  - the marker equalities `test/e2e/upgrade/create2.test.ts:482,811`, `test/ts/upgrade/library.test.ts:497-499,667`;
  - `export.manifest.json:633` dummy version.
- Then `make generate`, then the lockfiles, all in the same commit. The marker and the import path change the ACL
  bytecode and contract metadata embedded in `LocalHostBytecode.sol`, its forge-std copy and the genesis outputs;
  the version rewrites `StdFhevmVersion.sol`.

### Step 3: identifiers

- **Names:**
  - `updateV14ToV15` and related names → `…V1_0`.
- Nothing here changes behaviour: every derivation of the generation, and the prefix, moved to step 2.
- Then `make generate`, in case a renamed identifier reaches generated output.

### Step 4: docs and comments

Everything in "Docs" above, respecting "Must NOT be touched".

### Step 5: regenerate and validate

Every step ends with `make generate` and, where names moved, the lockfiles, so every step from 0 to 4 is green on
its own. Then a final `make distclean && make install && make ci`.

### Step 6: port step 1 to the v14 branch (D2)

- In `/Users/alex/src/me/zama-ai/fhevm-mocks-v14`, on the same single branch as step 0.2: port the step-1 changes
  that v14's line needs (the name ↔ version mapping, its uses in `generation-parity`, `generations`,
  `generate-cleartext-config`, the schema and `deployments`, the `semver.ts` tilde rule). Do not reconcile the rest
  of `fhevm-npm`: that branch keeps its own drift (31 files) and its `sync hh-v2-constants`.
- There, v14 is current and v13 previous. The 0.x paths must behave exactly as before, and that branch's tests stay
  green.
- No merge, on either side, until the whole 1.0 naming is done.

## Later

SDK changes in the fhevm repo, at the end, as agreed.
