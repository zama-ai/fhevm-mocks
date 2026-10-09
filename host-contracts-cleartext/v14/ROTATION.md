# When v15 arrives: what to delete in v14

v14 has tests and tools that upgrade a **v13** stack to v14. They need v13 to be there. Once v15 ships,
v13 is retired and those tests cannot run, so delete them.

No rush: the Makefile only asks V(N) for `test:upgrade`, so they stop running by themselves. Nothing
breaks while they sit there — except the `@fhevm/sdk*` lines of step 2, which must go in the same change that moves
the sdk pins forward.

## 1. Delete six folders

They are all named `upgrade`.

```sh
cd sdk/host-contracts-cleartext/v14
rm -rf create2-deploy/upgrade          # the upgrade CLI, its config, its runbook
rm -rf create2-deploy/script/upgrade   # the 8 Solidity scripts that CLI runs
rm -rf internal/upgrade                # starts the upgrade test
rm -rf test/upgrade                    # forge tests: the upgrade tables, and a v13 stack brought forward
rm -rf test/e2e/upgrade                # upgrades a real v13 stack through the CLI
rm -rf test/ts/upgrade                 # upgrades it through the TypeScript API
```

## 2. Delete five lines in `package.json`

```jsonc
"test:upgrade": "node internal/upgrade/cli/runUpgradeE2e.ts && node --test test/e2e/upgrade/create2.test.ts",
"test:upgrade:fast": "../../scripts/forge-test.sh --match-path 'test/upgrade/*' && … list:upgrade-ops -- ../v13 && …"
"@fhevm/host-contracts-cleartext-v13-dev": "file:../v13",
"@fhevm/sdk": "^0.14.2",
"@fhevm/sdk-prev1": "npm:@fhevm/sdk@^0.13.7",
```

Both `test:upgrade*` scripts go: `test:upgrade:fast` is the same suite's fast lane, and it runs `test/upgrade/*`,
`test/ts/upgrade` and `list:upgrade-ops -- ../v13`, all of which are gone after step 1. Delete every script whose
name starts with `test:upgrade`, not only the one called that.

`test:upgrade:fast` is the last entry in `scripts`, so drop the comma on the line above `test:upgrade`.

Every `@fhevm/sdk*` devDependency goes too. Those names are roles, not versions: `@fhevm/sdk` is the current sdk line,
`@fhevm/sdk-prev<k>` the line k steps back, and when v15 arrives `npm-manifest.json` moves every role one line forward
(and adds `@fhevm/sdk-prev2`). Only V(N) may declare them, so this one is not optional: if v14 keeps them, `check
pinned-dependencies` fails. `test/ts/sdk-compatibility.test.ts` stays; it finds no sdk line and skips. v14's sdk
compatibility keeps being tested on its own release branch.

Nothing else in `package.json` changes.

## 3. Delete two lines in the forge config

The forge side of the same edge: `test/upgrade/CleartextGenerationUpgrade.t.sol` compiles against v13's forge
payload through these, and it is gone after step 1.

```sh
# remappings.txt
@fhevm/host-contracts-cleartext-v13-dev/=../v13/
# foundry.toml (with the comment above it)
allow_paths = ["../v13"]
```

## 4. Keep these

They mention v13, but they are not going anywhere:

- `pkg/` — `updateV13ToV14` and its types. v14 still upgrades v13 deployments; only the test is going.
- `internal/listUpgradeOps.ts` and `list:upgrade-ops` — you pass it a folder, so it fits any generation.
- `create2-deploy/deploy-cli`, `create2-deploy/ts/`, `script/*.sol` outside `script/upgrade/`,
  and `test/Create2Ordinals.t.sol`.

Other files mention v13 too. They describe what v14 upgrades _from_, which stays true.

`internal/zama-config/` stays too. It is v14's copy of upstream's `library-solidity/config`, pinned at the same
commit as `pkg/src/contracts` (rule 5.1.3c), and `check:zama-config` reads it. It goes with the generation: it
leaves only when v14 itself is retired, and it is never edited by hand — `fhevm-npm sync vendored` owns it.

## 5. Check it worked

```sh
cd ../..
npm install
./fhevm-npm-cli check dependencies
./fhevm-npm-cli check generations
./fhevm-npm-cli check scripts
cd host-contracts-cleartext/v14
forge build && forge test && npm run lint && npm run test
```

Green means v14 is complete without v13.

## 6. Tidy the docs (optional)

Nothing reads documentation, so skip this if you like. These three still describe the deleted folders:

- `README.md`
- `create2-deploy/README.md`
- `create2-deploy/GUIDE.md`
