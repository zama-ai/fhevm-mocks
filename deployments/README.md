# Deployment records

One folder per on-chain event — a deploy, an upgrade — at `deployments/<chain>/<deploymentId>/`, copied
from the operator's deployment folder once the event is final.

```text
deployments/
└── <chain>/                    a host chain name from fhevm-chains.config.json, e.g. ethereum_sepolia
    └── <deploymentId>/         the deploymentId of deploy.config.json and of the sealed manifest
        ├── deploy.config.json  the config the deploy tool ran with
        ├── tool-commit.txt     first line: the fhevm-mocks commit that reproduces the seal
        └── <outDir>/           the folder deploy.config.json#outDir names
            ├── manifest.json   the seal: every address
            ├── addresses.sol   the generated config
            └── journal.jsonl   every transaction sent
```

Other files in a record folder (a README, an `addresses.json` of account labels) are allowed.

## Rules

- **A record never changes once it lands.** It is evidence of transactions that cannot be undone: editing
  it can only make it disagree with the chain. CI fails a pull request that adds, modifies, renames or
  deletes anything inside a record folder that already exists on the base branch.
- **A later event gets a new folder.** An upgrade to the next generation, an ownership or pauser change:
  each is a new record. An upgrade points at the previous record through `previousManifest` in its
  `deploy.config.json`, as a relative path such as `../<previous deploymentId>/<outDir>/manifest.json`.
- **Never run the deploy tool inside a record.** It writes forge scratch into the out dir, and `compute`
  clears paths there. To verify a deployment, copy its folder elsewhere and run from the copy:

  ```sh
  cp -R deployments/<chain>/<deploymentId> /tmp/verify && cd /tmp/verify
  <fhevm-mocks>/host-contracts-cleartext/v13/create2-deploy/deploy-cli --stage verify
  ```

- Files outside record folders, like this README, stay editable.

## Checks

```sh
./fhevm-npm-cli check deployments                                # every record is complete and consistent
./fhevm-npm-cli check deployments --base origin/release/0.13.x   # and no existing record changed
```

The first runs in `make check-pre`; the second runs in CI on every pull request.
