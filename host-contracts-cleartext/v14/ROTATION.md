# When v15 arrives: what to delete in v14

v14 has tests and tools that upgrade a **v13** stack to v14. They need v13 to be there. Once v15 ships,
v13 is retired and those tests cannot run, so delete them.

No rush: the Makefile only asks V(N) for `test:upgrade`, so they stop running by themselves. Nothing
breaks while they sit there.

## 1. Delete six folders

They are all named `upgrade`.

```sh
cd sdk/host-contracts-cleartext/v14
rm -rf create2-deploy/upgrade          # the upgrade CLI, its config, its runbook
rm -rf create2-deploy/script/upgrade   # the 8 Solidity scripts that CLI runs
rm -rf internal/upgrade                # starts the upgrade test
rm -rf test/upgrade                    # forge test for the upgrade tables
rm -rf test/e2e/upgrade                # upgrades a real v13 stack through the CLI
rm -rf test/ts/upgrade                 # upgrades it through the TypeScript API
```

## 2. Delete two lines in `package.json`

```jsonc
"test:upgrade": "node internal/upgrade/cli/runUpgradeE2e.ts && node --test test/e2e/upgrade/create2.test.ts"
"@fhevm/host-contracts-cleartext-v13-dev": "file:../v13",
```

`test:upgrade` is the last entry in `scripts`, so drop the comma on the line above it. Nothing else in
`package.json` changes.

## 3. Keep these

They mention v13, but they are not going anywhere:

- `pkg/` — `updateV13ToV14` and its types. v14 still upgrades v13 deployments; only the test is going.
- `internal/listUpgradeOps.ts` and `list:upgrade-ops` — you pass it a folder, so it fits any generation.
- `create2-deploy/common.ts`, `utils.ts`, `deploy-testnet.ts`, `script/*.sol` outside `script/upgrade/`,
  and `test/Create2Ordinals.t.sol`.

Other files mention v13 too. They describe what v14 upgrades _from_, which stays true.

## 4. Check it worked

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

## 5. Tidy the docs (optional)

Nothing reads documentation, so skip this if you like. These four still describe the deleted folders:

- `README.md`
- `WIRING.md`
- `create2-deploy/README.md`
- `create2-deploy/GUIDE.md`
