# Runbook: bump two package versions

Example: `fhevm-hardhat-template-v2` and `@fhevm/hardhat-plugin`, both `0.4.2` → `0.13.0`.
Versions live in ONE file, `sdk/versions.json`; everything else is derived from it. Run from `sdk/`.

## 1. Start clean

```sh
git status --porcelain      # must print nothing
make version-list           # see the current central versions
```

## 2. Edit the two lines in `sdk/versions.json`

```diff
-    "./hardhat/v2/plugin/pkg": "0.4.2",
-    "./hardhat/v2/fhevm-hardhat-template/pkg": "0.4.2",
+    "./hardhat/v2/plugin/pkg": "0.13.0",
+    "./hardhat/v2/fhevm-hardhat-template/pkg": "0.13.0",
```

Never touch a `package.json` version by hand; `version apply` does it.

## 3. Preview

```sh
./fhevm-npm-cli version apply --dry-run --check-npmjs
```

Expected (nothing is written yet; `--check-npmjs` proves `@fhevm/hardhat-plugin@0.13.0` is not on npmjs):

```text
central edits
  @fhevm/hardhat-plugin  0.4.2 → 0.13.0
  fhevm-hardhat-template-v2  0.4.2 → 0.13.0
would reconcile
  hardhat/v2/fhevm-hardhat-template/pkg/package.json  version 0.4.2 → 0.13.0
  hardhat/v2/package-lock.json  fhevm-hardhat-template/pkg version 0.4.2 → 0.13.0
  hardhat/v2/plugin/pkg/package.json  version 0.4.2 → 0.13.0
  hardhat/v2/package-lock.json  plugin/pkg version 0.4.2 → 0.13.0
```

Four lines in three files. No dependency spec changes: members link each other with `file:`.

## 4. Apply

```sh
make version-apply          # writes the four lines, refreshes hardhat/v2/package-lock.json, runs `version check`
git diff --stat             # versions.json + the three files above, nothing else
```

## 5. Commit

```sh
make check-pre              # `version check` is part of it
git add -A sdk && git commit -m "chore(sdk): bump @fhevm/hardhat-plugin and fhevm-hardhat-template-v2 to 0.13.0"
```

## If something goes wrong

- `only versions.json may be modified` — the tree was not clean; stash or commit the other changes first.
- `a central version only moves forward` — the new version is not greater than the committed one. Note
  that turning a release back into a prerelease (`0.13.0` → `0.13.0-0`) counts: SemVer §11 sorts a
  prerelease below its own release. The rule stands in for "a published version is never reused", but it
  compares against HEAD rather than the registry, so it also refuses moves that are safe because nothing
  was ever published. When that is the case, waive it and let the registry answer the real question:
  `./fhevm-npm-cli version apply --allow-downgrade --check-npmjs`.
- The run fails after writing — it leaves the diff for you to inspect; restore with
  `git checkout -- sdk` (this also drops your `versions.json` edit) and start again from step 2.
