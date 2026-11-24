# When `<vN+1>` arrives: what `<vN>` deletes

This file names generations as they stand before the rotation: `<vN>` is the generation that this directory holds,
`<vN-1>` is the generation before it, and `<vN+1>` is the next one. In a command, replace each of them with the real
name.

`<vN>` has tests and tools that upgrade a `<vN-1>` stack to `<vN>`. They need `<vN-1>` in the workspace. The workspace
rotates when work on `<vN+1>` starts (NR-87): `<vN>` becomes the previous generation, and `<vN-1>` leaves the
workspace. From then on those tests and tools cannot run, so delete them.

Make the deletions in the same change that moves `npm-manifest.json#generations`. If they wait, that change fails:

- `npm install` cannot resolve `file:../<vN-1>` once that directory is gone.
- `check generations` refuses a previous generation that declares `test:upgrade` (NR-26) or that depends on a retired
  generation (NR-22).
- `check pinned-dependencies` refuses the `@fhevm/sdk` specs of step 2 as soon as the manifest moves those pins
  (NR-21).
- The forge tests of `test/upgrade/` and `create2-deploy/upgrade/ts/testnet.ts` import `<vN-1>`, so `npm run test` and
  `npm run lint` fail to compile them.

This file covers the directory of `<vN>`, and one workspace file that names the tests of `<vN>` (step 3). The rest of
a rotation changes workspace files, which the Generations rules NR-22 to NR-27 govern.
[rules/fhevm-npm/WORKSPACE.md](../../rules/fhevm-npm/WORKSPACE.md) introduces them.

## Delete files and edit `package.json`, nothing else

After the rotation, `<vN>` is frozen (R-04). `check generation-parity` compares the committed `<vN>` with
`release/<N>.x` and accepts only two differences: a file that is on the branch and deleted here, and the content of
the `package.json` of `<vN>` (NR-27). Any other committed edit fails the check, even a fix to a comment. Make that kind
of change on `release/<N>.x`, before the rotation.

So inside `<vN>` the steps below only delete files and edit `package.json`. Step 3 edits a file at the workspace
root, which the check does not compare.

## 1. Delete six folders

```sh
cd host-contracts-cleartext/<vN>
rm -rf create2-deploy/upgrade          # the upgrade CLI, its config, its runbook
rm -rf create2-deploy/script/upgrade   # the forge scripts that the CLI runs
rm -rf internal/upgrade                # the runner of `test:upgrade`
rm -rf test/upgrade                    # forge tests: the upgrade tables, and a <vN-1> stack upgraded in place
rm -rf test/e2e/upgrade                # upgrades a <vN-1> stack through the CLI
rm -rf test/ts/upgrade                 # upgrades a <vN-1> stack through the TypeScript API
```

Delete these six paths only. `pkg/src/upgrade/` has the same name, but it is part of the payload and stays.

## 2. Delete five lines in `package.json`

Two scripts:

```jsonc
"test:upgrade": "…",
"test:upgrade:fast": "…"
```

Delete every script whose name starts with `test:upgrade`. They run the folders of step 1. They are the last entries
of `scripts`, so also remove the comma at the end of the line above them.

Three `devDependencies`:

```jsonc
"@fhevm/host-contracts-cleartext-<vN-1>-dev": "file:../<vN-1>",
"@fhevm/sdk": "…",
"@fhevm/sdk-prev1": "…",
```

`@fhevm/sdk` and each `@fhevm/sdk-prev<k>` name a role, not a version: the current sdk line, and the line k steps
back. At a rotation the manifest moves every role one line forward, and only the current generation may declare them
(NR-21). Keep `@fhevm/sdk-common-dev` and `@fhevm/sdk-vendored-dev`. They are workspace packages, not sdk lines.

Without sdk lines, `test/ts/sdk-compatibility.test.ts` and `test/ts/sdk-kms-rotation.test.ts` skip. The sdk
compatibility of `<vN>` stays tested on `release/<N>.x`.

Change nothing else in `package.json`.

## 3. Delete three names in `test-ports.config.json`

`test-ports.config.json`, at the workspace root, gives each test of `<vN>` the port of its node, by name.
`check test-ports` fails when the group of `<vN>` holds a name that no test of `<vN>` reads. The folders of step 1 were the only readers of three names. Delete them from the group
`host-contracts-cleartext/<vN>`:

```jsonc
"create2-upgrade": …,
"upgrade-library-1": …,
"upgrade-library-2": …,
```

Keep every other name of the group, and every number. The two sdk tests of step 2 skip, but their files still read
their names.

The same change gives `<vN+1>` a group of its own and removes the group of `<vN-1>`. The `_readme` of the file says
how.

## 4. Keep everything else

These files name `<vN-1>` or the deleted folders. They stay as they are:

- **`remappings.txt` and `foundry.toml`.** The remapping line and `allow_paths` point at `../<vN-1>`. Forge accepts
  both when the directory is missing, and an edit to either file fails `check generation-parity`.
- **The docs.** `README.md`, `create2-deploy/README.md`, `create2-deploy/GUIDE.md`, and `create2-deploy/UPGRADE.md`
  still describe the deleted folders. Their broken links fail nothing, because `check md-links` skips the previous
  generation. Their content is still frozen: `check generation-parity` compares them like any other file.
- **`pkg/`.** The upgrade function of `pkg/ts/upgrade.ts` and its types stay. `<vN>` still upgrades deployed `<vN-1>`
  stacks. Only the tests of that upgrade go.
- **`internal/listUpgradeOps.ts` and the `list:upgrade-ops` script.** The command takes the other generation as an
  argument and names none.
- **The rest of `create2-deploy/`.** `deploy-cli`, `hotfix-cli`, `ts/`, and every script of `script/` outside
  `script/upgrade/` stay, with `test/Create2Ordinals.t.sol`.
- **`internal/zama-config/`.** It is the copy of the upstream `library-solidity/config` at the commit of
  `pkg/src/contracts` (NR-42c), and `check:zama-config` reads it. It leaves with `<vN>` itself.

## 5. Delete this file, if you want

Once the steps above are done, this file describes work that is finished. A deletion is a change that
`check generation-parity` accepts.

## 6. Check the result

Run from the workspace root, after you commit the change that moved `npm-manifest.json#generations`.
`check generation-parity` compares `HEAD` with the release branch, so it does not see uncommitted edits. The `v-prev`
target then runs `<vN>`. A frozen generation is not linted: no lint finding in it could be fixed.

```sh
git fetch origin release/<N>.x   # without the branch, `check generation-parity` skips <vN> and says so
npm install
make check-pre                   # dependencies, pinned-dependencies, generations, generation-parity, scripts
make test-cleartext-v-prev
```

When all of them pass, and `check generation-parity` printed no skip note, `<vN>` is complete without `<vN-1>`.
