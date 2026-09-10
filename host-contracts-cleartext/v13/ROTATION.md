# When v14 arrives: what to delete in v13

v13 has tests and tools that upgrade a **v12** stack to v13. They need v12 to be there. Once v14 ships,
v12 is retired and those tests cannot run, so delete them.

No rush: the Makefile only asks V(N) for `test:upgrade`, so they stop running by themselves. Nothing
breaks while they sit there.

## 1. Delete six folders

They are all named `upgrade`.

```sh
cd sdk/host-contracts-cleartext/v13
rm -rf create2-deploy/upgrade          # the upgrade CLI, its config, its runbook
rm -rf create2-deploy/script/upgrade   # the 8 Solidity scripts that CLI runs
rm -rf internal/upgrade                # starts the upgrade test
rm -rf test/upgrade                    # forge test for the upgrade tables
rm -rf test/e2e/upgrade                # upgrades a real v12 stack through the CLI
rm -rf test/ts/upgrade                 # upgrades it through the TypeScript API
```

## 2. Delete two lines in `package.json`

```jsonc
"test:upgrade": "node internal/upgrade/cli/runUpgradeE2e.ts && node --test test/e2e/upgrade/create2.test.ts"
"@fhevm/host-contracts-cleartext-v12-dev": "file:../v12",
```

`test:upgrade` is the last entry in `scripts`, so drop the comma on the line above it. Nothing else in
`package.json` changes.

## 3. Keep these

They mention v12, but they are not going anywhere:

- `pkg/` — `updateV12ToV13` and its types. v13 still upgrades v12 deployments; only the test is going.
- `internal/listUpgradeOps.ts` and `list:upgrade-ops` — you pass it a folder, so it fits any generation.
- `create2-deploy/common.ts`, `utils.ts`, `deploy-testnet.ts`, `script/*.sol` outside `script/upgrade/`,
  and `test/Create2Ordinals.t.sol`.

Other files mention v12 too. They describe what v13 upgrades _from_, which stays true.

## 4. Check it worked

```sh
cd ../..
npm install
./fhevm-npm-cli check dependencies
./fhevm-npm-cli check generations
./fhevm-npm-cli check scripts
cd host-contracts-cleartext/v13
forge build && forge test && npm run lint && npm run test
```

Green means v13 is complete without v12.

## 5. Tidy the docs (optional)

Nothing reads documentation, so skip this if you like. These three still describe the deleted folders:

- `README.md`
- `create2-deploy/README.md`
- `create2-deploy/GUIDE.md`
