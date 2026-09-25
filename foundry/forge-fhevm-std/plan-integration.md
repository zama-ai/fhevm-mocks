# forge-fhevm-std joins the workspace: npm-manifest.json and the Makefile

Status: STEPS 1–3 AND 5 DONE (2026-09-21); step 4 (full `make ci`) waits for a commit, since `build-ci` requires a spotless tree. Steps are ordered so that every one leaves a green tree; each ends
with the command that proves it.

## 0. Decisions taken as defaults

Flip either before step 1; nothing below depends on flipping them later being cheap.

| Decision | Default | If flipped |
|---|---|---|
| Installation root | **member of the sdk root**: `foundry/forge-fhevm-std` joins `workspaces`, its own `package-lock.json` goes, the root lock covers it. Its dev deps (`@fhevm/solidity`, `encrypted-types`, `prettier`, `publint`) are all already pinned at the root, so hoisting is clean, and forge already resolves `../../node_modules` through `libs`. | Own root, like `./hardhat/v2`: keep the lockfile, add a `workspace-root` entry at `./foundry`, mark both packages `memberOf: ./foundry`, add the root to `install`, `distclean`, `ci-from-scratch`, and use `npm --prefix` in the Makefile helper. |
| Published name | **`@fhevm/forge-std`** in directory `forge-fhevm-std`. No check ties directory to name. | Rename before step 3 puts it in `versions.json` and the lockfile. |
| Consumer test | ~~none at first~~ — NOT AVAILABLE: rule 5.3.1 makes a consumer test mandatory for every published payload. Landed as a FOUNDRY PROJECT (see §2). | — |

## 1. Conformance fixes inside the package (no manifest change yet) — DONE

Everything the checks will demand once the package is inventoried, done first so step 2 lands green.

1. `package.json` (dev owner)
   - `@fhevm/solidity`: `0.13.3` → `^0.13.3`, the range `npm-manifest.json#dependencies.pinned` requires
     (`check pinned-dependencies`).
   - `lint`: `eslint && tsc -p internal/tsconfig.json --noEmit && npm run forge:lint`, so `internal/*.ts` is linted
     and typechecked like every other dev owner (rule 5.1.4).
   - `generate:post`: currently the shell no-op `true`. Drop it and the reference from `generate`; a `generate:*`
     leaf must do something `clean:generated` undoes (rule 5.1.4b).
   - Scripts stay alphabetically ordered (`check package-json`, the gate that caught `test:fast`).
2. Add `eslint.config.js` re-exporting the workspace base, and `internal/tsconfig.json` covering `internal/**/*.ts`
   (rule 5.1.7; model both on `host-contracts-cleartext/v13`).
3. Verify in place, before any manifest edit:
   ```sh
   cd foundry/forge-fhevm-std && npm run lint && npm run build && npm run check && npm test
   ```

Landed: `lint` now runs eslint, `tsc` over `internal/`, then `forge lint`; `eslint.config.js` and
`internal/tsconfig.json` added (models: `common/`, v13); `generate:post` dropped; `clean` also removes
`*.tsbuildinfo`; lint tooling added to `devDependencies` at the root's ranges. eslint found six real
findings in the two generators (untyped `forge config` JSON, truthiness on env strings, a needless `?.`),
all fixed; the fork-url runner and `generate` were re-run to prove the scripts still behave, and the
regenerated payload is byte-identical. lint, build, check and the offline suite (538) are green.

## 2. Inventory the package — DONE

1. `npm-manifest.json`
   - `inventory.exclude`: remove `"./foundry"`.
   - Add, modelled on the v13 pair:
     ```jsonc
     "./foundry/forge-fhevm-std": {
       "kind": "dev", "type": "esm", "browser": false,
       "name": "@fhevm/forge-std-dev", "private": true, "member": true,
       "publishedRelPath": "./foundry/forge-fhevm-std/pkg",
       "dependencyGroup": "forge-fhevm-std",
       "note": "Forge companion to forge-std. Its pkg/src/_host is GENERATED from V(N)'s pkg/forge/src (see generate:forge-payload), so it compiles after the current cleartext generation."
     },
     "./foundry/forge-fhevm-std/pkg": {
       "kind": "published", "type": "esm", "browser": false,
       "name": "@fhevm/forge-std", "member": true,
       "dependencyGroup": "forge-fhevm-std",
       "note": "Solidity-only payload: `exports` maps ./src/* and nothing else; no consumer test yet (plan §0)."
     }
     ```
   - `type: esm` is what `consumerModuleKinds` derives from `"type": "module"` with no entry points; `check
     package-json` will say so if it disagrees.
2. Root `package.json`: add `"foundry/forge-fhevm-std"` and `"foundry/forge-fhevm-std/pkg"` to `workspaces`
   (rule 2.1.1: explicit paths, never globs). Delete `foundry/forge-fhevm-std/package-lock.json` (rule 6.1.1).
3. `versions.json`: add `"./foundry/forge-fhevm-std/pkg": "0.13.0-1"`, matching `pkg/package.json` (rule 4.3.2:
   one authority; `version check` compares them).
4. Reinstall so the root lock learns the member: `make install`. Then:
   ```sh
   make check-pre        # names, workspaces, ownership, package-json, scripts, lockfiles, pinned deps, …
   ```
   Expect a short, exact to-do list on the first run; fix each item in place. This step is done when `check-pre`
   is clean.

Landed. `check-pre` handed back three things in turn, all fixed:
- `version check`: `versions.json` must follow manifest order — the entry sits after V(N)'s pkg, before hardhat.
- `check scripts` (rule 5.3.1): a consumer test is MANDATORY for every published payload, so the §0 default of
  "none at first" was not available. Added `test-consumer/esm/` as a FOUNDRY PROJECT — a first Node-script
  version that only resolved paths was replaced, since a Solidity package is proven by compiling and running
  against it: `package.json` depends on `@fhevm/forge-std` (`file:../../pkg`), `forge-std` as a git dependency
  pinned to `v1.11.0` (the tag this package vendors through soldeer), `@fhevm/solidity` and `encrypted-types`;
  `remappings.txt` maps all four prefixes into `node_modules`, `libs = []`; `src/AplusB.sol` is the dApp,
  `test/AplusB.t.sol` inherits `TestFhevm` (the Hardhat example plus modular wrap and the `plaintextOf`
  cheat); `test` is `forge build && forge test`. Registered under `consumerTests.esm`, own committed lockfile
  (rule 6.1.3), `test:consumer` / `test:consumer:dev` on the dev owner; 5 s under the runner, 3 tests.
  Two gates needed a change: `check foundry` demanded `extends = foundry.base.toml`, which cannot hold for a
  project copied out of the tree — `standalone` is now exempt from `extends` (rule 4.1.3, with a unit test)
  while its effective `[fmt]` is still compared; and `check scripts` wants `forge:fmt`, `forge:fmt:check`,
  `forge:lint` on any package with Solidity. Note: the lock records forge-std as `git+ssh://…`, which is
  npm's spelling for GitHub, not a transport requirement — `npm ci` with `GIT_SSH_COMMAND=false` installs it
  from the tarball endpoint; proven in an isolated copy, where the 3 tests then pass. In-tree the fixture has
  no `node_modules`, so `forge lint`/`forge test` there fail until installed; `forge fmt --check` works.
- `check lint-policy`: three `// solhint-disable-next-line` comments in owned Solidity — banned, `forge lint`
  is the linter. Removed.
Also: forge stopped finding `@fhevm/solidity` once the package's own `node_modules` went (risk §7 came true).
`libs` no longer lists the vanished directory and `remappings.txt` maps `@fhevm/solidity/` to the root's
`node_modules` explicitly; `encrypted-types/` auto-resolves. 538 offline tests green after.

## 3. Wire the Makefile — DONE

Same pattern as the cleartext generations; one helper, one target per verb, then the aggregates.

1. Variables (next to `DIR_CLEARTEXT_*` / `W_CLEARTEXT_*`):
   ```make
   DIR_FORGE_STD := foundry/forge-fhevm-std
   W_FORGE_STD   := $(call package-name,$(DIR_FORGE_STD))     # reads the name, cannot drift
   ```
   As a member, `$(call run,$(W_FORGE_STD),<script>)` works unchanged; no new `run-*` helper.
2. Per-verb targets, each `## documented` for `make help`:
   - `compile-forge-std: compile-cleartext-v-cur` — the payload is copied from V(N)'s `pkg/forge/src`.
   - `lint-forge-std: compile-forge-std`, `test-forge-std: compile-forge-std` (runs `test`, the offline suite).
   - `test-forge-std-fork`, `test-forge-std-fork-url`, `test-forge-std-anvil` — opt-in, like `test-hh-*-anvil`;
     they need an RPC URL or a running node and never enter `test` or `ci`.
   - `clean`: add `$(call run,$(W_FORGE_STD),clean)` in reverse dependency order (before V(N)'s).
   - `fmt` / `fmt-check`: add the package.
3. Generation order. `generate` and `clean-generated` gain the package AFTER V(N): its `generate:forge-payload`
   reads V(N)'s generated `pkg/forge/src`, so V(N) regenerates first. `check-generated` then proves the whole chain
   (`clean-generated` → `generate` → spotless) including `pkg/src/_host` and `StdFhevmVersion.sol`.
4. Aggregates: `compile`, `lint` (a `lint-forge-std` in the `lint:` list), `test`, `test-fast`, `check-post`
   (`$(call run,$(W_FORGE_STD),check)` → publint), and every `.PHONY` line touched.
5. Prove it:
   ```sh
   make -n compile-forge-std test-forge-std   # order: V(N-1) → V(N) → forge-std
   make graph                                 # the dependency tree, unchanged elsewhere
   make ci-fast                               # everything that reads the tree as it is
   ```

Landed as planned: `DIR_FORGE_STD`/`W_FORGE_STD` (name read from package.json, guarded), `compile-forge-std`
after `compile-cleartext-v-cur`, the `compile-package` case the consumer runner needs, `lint-forge-std`,
`test-forge-std` plus the three opt-in `-fork`/`-fork-url`/`-anvil` targets, `clean` before V(N), `fmt`,
`fmt-check`, `generate` and `clean-generated` after V(N), `check-post`, every aggregate and `.PHONY`.
Proof: `make -n` shows v12 → v13 → forge-std; the consumer runs through `compile-package`; `make ci-fast`
exit 0 in 8 min 49 s with forge-std compiled, checked, linted and tested inside it.

## 4. Prove the full lane

```sh
git add -A && git commit -m "…"    # build-ci needs a spotless tree
make ci                            # clean, check-generated, checks, build, tests, consumer rehearsal
```

`check-generated` is the step most likely to find something: it deletes `pkg/src/_host` and `StdFhevmVersion.sol`
and regenerates them, and any drift between the committed copy and V(N)'s payload shows here.

## 5. Rules and docs — DONE

- `foundry/forge-fhevm-std/rules.md` §1: the package is now a workspace member; `npm run generate` is reached from
  `make generate` after V(N)'s. Rule 1.1's table gains nothing new (the payload was already generated).
- `fhevm-npm-docs/FHEVM_NPM_RULES.md`: no new rule. If the Solidity-only payload needed an exemption anywhere in
  step 2, record it there next to the check that granted it, not in the manifest note alone.
- `foundry/forge-fhevm-std/README.md`: install and test instructions become `make …` from the root, with the package
  commands as the in-package alternative.

Landed. There is no dev README — `pkg/README.md` is the PUBLISHED one and stays consumer-facing — so the
workspace story went into `rules.md` as rule 1.4 (membership, root `node_modules`, the `make` names, the
generate order, the consumer test) and into §8's checklist. Two things the integration surfaced were fixed
on the way: `pkg/README.md` installed the package under the wrong npm name (`@fhevm/forge-fhevm-std`; it is
`@fhevm/forge-std`), and the consumer's allowlist of bare imports is now exactly the payload's two
dependencies, `forge-std/` and `encrypted-types/`, so a third one appearing in `pkg/src` fails the consumer
until the README declares it.

## 6. Order of commits

1. Step 1 alone (package-internal conformance) — green on its own, reviewable without the manifest.
2. Steps 2 + 3 together — the manifest and the Makefile must move as one, or `check-pre` and `make` disagree.
3. Step 5.

## 7. Risks

- **Hoisting surprises.** A member's `node_modules` is the root's. forge's `libs` already lists `../../node_modules`,
  and `remappings.txt` names `@openzeppelin/=../../node_modules/…`; `encrypted-types/` and `@fhevm/solidity/` resolve
  the same way. If forge cannot find one after step 2.4, add the explicit remapping rather than reinstating a local
  `node_modules`.
- **`version check` semantics.** `@fhevm/forge-std` enters the release set at `0.13.0-1` while the others sit at
  `0.13.0-0`; the version tooling may expect the set to move together. Read what `version check` says before
  changing any number.
- **Fork tests in CI.** They are opt-in for a reason (shared public RPCs, 429s); keep them out of `ci` and document
  `SEPOLIA_RPC_URL` in the opt-in targets' `##` line.
