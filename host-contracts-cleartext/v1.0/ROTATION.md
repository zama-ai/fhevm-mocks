# When the next generation arrives: what to delete in this one

This generation has tests and tools that upgrade a stack of the previous generation (today **v14**) to this one.
They need the previous generation to be there. Once the next generation ships, the previous one is retired and
those tests cannot run, so delete them.

No rush: the Makefile only asks V(N) for `test:upgrade`, so they stop running by themselves. Nothing
breaks while they sit there — except the `@fhevm/sdk*` lines of step 2, which must go in the same change that moves
the sdk pins forward.

## 1. Delete six folders

They are all named `upgrade`.

```sh
cd host-contracts-cleartext/v1.0
rm -rf create2-deploy/upgrade          # the upgrade CLI, its config, its runbook
rm -rf create2-deploy/script/upgrade   # the 7 Solidity scripts that CLI runs
rm -rf internal/upgrade                # starts the upgrade test
rm -rf test/upgrade                    # forge tests: the upgrade tables, and a previous-generation stack brought forward
rm -rf test/e2e/upgrade                # upgrades a real previous-generation stack through the CLI
rm -rf test/ts/upgrade                 # upgrades it through the TypeScript API
```

`rm -rf` on tracked files cannot be undone from the working tree; `git rm -r <the same six paths>` does the same and
leaves `git restore --staged --worktree` as a way back until the commit.

## 2. Delete six lines in `package.json`

```jsonc
"test:upgrade": "node internal/upgrade/cli/runUpgradeE2e.ts && node --test test/e2e/upgrade/create2.test.ts",
"test:upgrade:fast": "../../scripts/forge-test.sh --match-path 'test/upgrade/*' && … list:upgrade-ops -- ../v14 && …"
"@fhevm/host-contracts-cleartext-v14-dev": "file:../v14",
"@fhevm/sdk": "<the current sdk line>",
"@fhevm/sdk-prev1": "npm:@fhevm/sdk@<the line before>",
"@fhevm/sdk-prev2": "npm:@fhevm/sdk@<the line before that>",
```

Both `test:upgrade*` scripts go: `test:upgrade:fast` is the same suite's fast lane, and it runs `test/upgrade/*`,
`test/ts/upgrade` and `list:upgrade-ops -- ../v14`, all of which are gone after step 1. Delete every script whose
name starts with `test:upgrade`, not only the one called that.

`test:upgrade:fast` is the last entry in `scripts`, so drop the comma on the line above `test:upgrade`.

Every `@fhevm/sdk*` devDependency goes too. Those names are roles, not versions: `@fhevm/sdk` is the current sdk line,
`@fhevm/sdk-prev<k>` the line k steps back, and when the next generation arrives `npm-manifest.json` moves every role one line forward.
Only V(N) may declare them, so this one is not optional: if this generation keeps them, `check pinned-dependencies` fails.
`test/ts/sdk-compatibility.test.ts` stays; it finds no sdk line and skips. This generation's sdk compatibility keeps being tested
on its own release branch.

Nothing else in `package.json` changes.

## 3. Do NOT touch the forge config

`remappings.txt` keeps `@fhevm/host-contracts-cleartext-v14-dev/=../v14/` and `foundry.toml` keeps
`allow_paths = ["../v14"]`, even though nothing imports through them once step 1 is done. They dangle harmlessly.

The reason is rule 3.4.6: once the next generation is V(N), this one is V(N-1), and V(N-1) must be byte-identical to
its release branch (`release/<major>.<minor>.x`) except for DELETED files — `check generation-parity` compares the committed tree, and the only
modified file it forgives is `package.json`. The v13→v14 rotation's checklist deleted these two lines; that broke
parity and had to be reverted.

## 4. Keep these

They mention the previous generation, but they are not going anywhere:

- `pkg/ts` — `updateV<N-1>ToV<N>`, `FhevmAddressesV14`. This generation still upgrades previous-generation deployments; only the test is going.
- `pkg/forge/src/LibForgeFhevmUpgrade.sol` and `LibForgeFhevmHostVersions.sol` — a fork of a chain still on 0.14 is
  still brought forward in memory, and forge-fhevm-std ships this payload.
- `test/forge/LibForgeFhevmUpgrade.t.sol`, `LibForgeFhevmHostVersions*.t.sol`, `ForkCleartextUpgrade.t.sol` — they
  test that payload, not the previous generation's package, and need nothing from `../v14`.
- `internal/listUpgradeOps.ts` and `list:upgrade-ops` — you pass it a folder, so it fits any generation.
- `create2-deploy/deploy-cli`, `create2-deploy/hotfix-cli`, `create2-deploy/ts/`, `script/*.sol` outside
  `script/upgrade/`, and `test/Create2Ordinals.t.sol`.

`internal/zama-config/` stays too. It is this generation's copy of upstream's `library-solidity/config`, pinned at the same
commit as `pkg/src/contracts` (rule 5.1.3c), and `check:zama-config` reads it. It goes with the generation: it
leaves only when this generation itself is retired, and it is never edited by hand — `fhevm-npm sync vendored` owns it.

## 5. Check it worked

```sh
cd ../..
npm install
./fhevm-npm-cli check dependencies
./fhevm-npm-cli check generations
./fhevm-npm-cli check generation-parity
./fhevm-npm-cli check scripts
cd host-contracts-cleartext/v1.0
forge build && forge test && npm run lint && npm run test
```

Green means this generation is complete without the previous one.

## 6. Tidy the docs (optional)

Nothing reads documentation, so skip this if you like. These still describe the deleted folders:

- `README.md`
- `create2-deploy/README.md`
- `create2-deploy/GUIDE.md`
- `create2-deploy/UPGRADE.md`

---

# Lessons from the v14 → v1.0 rotation, for whoever builds the next generation

The steps above are about RETIRING this generation's upgrade lane. Building the next generation itself — copying this
one, rotating the manifest and porting the lane to V(N-1) → V(N) — is a separate job; these are the places it cost time last round, most expensive first.

1. **Which chain is on which line is a fact, not an assumption.** Before retargeting any fork test, read
   `getVersion()` off every host contract of every group (`cast call <addr> "getVersion()(string)"`). In the v1.0 round
   devnet moved from 0.14 to new addresses running a MIX of 0.14 and 0.15 contracts, mainnet and testnet stayed on
   0.13, and `fhevm-chains.config.json` was stale until `make sync-fhevm-chains`. `classify` refuses a mixed stack by
   design; forge-std's fork suites park themselves (`ForkBlocks.forkable`) rather than fail.
2. **The op set is upstream's rule, not ours.** A contract is upgraded exactly when its `REINITIALIZER_VERSION`
   moves; the order is upstream's `host-contracts/upgrade-manifest.json`. Compare the generated `LocalHostBytecode` of
   both generations to confirm, and read upstream's `.github/workflows/host-contracts-upgrade-tests.yml`.
3. **Identity lives outside the config files too.** Beyond `package.json` names and paths, the rename must reach
   `CleartextACL.CLEARTEXT_PROTOCOL_VERSION`, the sample `Create2Parameters.version` in `export.manifest.json`, and the
   `cleartext-config-v<N>.ts` import of `internal/generateLocalHostBytecode.ts`. The forge test
   `test_theCleartextGenerationIsThePackageFolder` and `test/create2-versions.test.ts` catch the first.
4. **Generated files are regenerated, never edited.** After a vendored bump or a payload change, `make generate`:
   it rewrites `LocalHostBytecode`/`LocalHostVersions`, the ABIs, templates and ts artifacts, `pkg/ts/index.ts`, the
   consumer `export.ts` files and forge-fhevm-std's `_host` copy. Until it runs, forge tests compile against the OLD
   bytecode and can pass for the wrong reason.
5. **A prerelease package version is fine, and the create2 tooling accepts it** (`majorMinorOf`: `1.1.0-0` → `1.1`).
   A hotfix still refuses one, on purpose.
6. **An upgrade with no-argument reinitializers is small.** v14 → v1.0 needed no sealed migration; if a later
   upgrade brings one back (a reinitializer with arguments), `FhevmUpgradeBase`'s `_liveStateFresh`/`sealedEnv` hooks and
   the coordinator's snapshot are where it goes — the v13 → v14 implementation is in git history (`release/0.14.x`).
7. **Write comments generation-agnostic.** "this generation" / "the previous generation" for identity, "since vN" for
   a feature's introduction; keep a number only for history, upstream data, or one specific upgrade's description.
   Most of the v1.0 comment churn came from "v13"/"v14" written where a role was meant.
8. **Move the release line in CI, or CI silently does not run.** Three refs name the line the files were carried
   from: the `pull_request.branches` of `.github/workflows/sdk-cleartext-tests.yml` and
   `sdk-cleartext-deployments.yml`, and `ALLOWED_REF` in `sdk-cleartext-publish-package.yml`. Left on
   `release/0.14.x`, the first PR into the new line's branch started no check at all, and a publish from it would have
   been refused. Mirror the old line's branch protection (the required `sdk-cleartext-tests/test (bpr)` check) onto
   the new one too.
