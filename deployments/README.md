# Deployment records

One folder per deployed stack, holding one numbered folder per on-chain event — the deploy, each generation
upgrade, each hotfix — copied from the operator's folder once the event is final.

```text
deployments/
└── <chain>/                               a host chain name from fhevm-chains.config.json, e.g. ethereum_sepolia
    └── <stack>/                           the stack's deploymentId, for its whole life (it is in the CREATE2 salt)
        ├── 00-deploy-v13.0-2026-10-05/    the deploy
        │   ├── deploy.config.json         the config the tool ran with (upgrade.config.json, hotfix.config.json)
        │   ├── tool-commit.txt            first line: the fhevm-mocks commit that reproduces the seal
        │   └── record/                    the folder the config's outDir names
        │       ├── manifest.json          the seal: every address, and `previous` (below)
        │       ├── addresses.sol          the generated config
        │       ├── journal.jsonl          every transaction sent
        │       ├── event.json             the transactions that date the event, read from the chain
        │       └── progress.jsonl, verify-report.json   upgrades and hotfixes
        ├── 01-hotfix-v13.1-2026-10-20/
        ├── 02-upgrade-v14.1-2026-11-02/
        ├── aborted/
        │   └── 2026-10-30-upgrade-v14.1-1/  an attempt that sent transactions but never became an event
        └── README.md                      optional, editable
```

Other files in an event folder (a README, an `addresses.json` of account labels) are allowed.

## Names

- **Event folder**: `<seq>-<kind>-v<release>-<YYYY-MM-DD>`.
  - `<seq>`: the order of events, two digits, contiguous from `00`. `00` is the one deploy.
  - `<kind>`: `deploy`, `upgrade` (exactly one generation up) or `hotfix` (same generation, higher patch).
  - `v<release>`: the package version the tool ran at. Below 1.0 it drops the major: package `0.14.1` gives
    `v14.1`. From 1.0 on it is written in full: package `1.0.0` gives `v1.0.0`.
  - `<YYYY-MM-DD>`: **the UTC day of the block** holding the event's defining transaction: an upgrade's or
    hotfix's `ACLOwner.upgrade`, a deploy's last transaction. Never the operator's clock. The name is therefore
    known only once that transaction is mined.
- **Attempt folder**, under `aborted/`: `<YYYY-MM-DD>-<kind>-v<release>-<n>`, dated by its first transaction's block.
  An attempt is recorded when it sent at least one transaction and will not be finished (its transactions are on
  chain for good); a sealed attempt that sent nothing is not recorded. It is never in the sequence. Add an
  `ABORTED.md` saying why; the checks do not read it.

## Rules

- **A record never changes once it lands.** It is evidence of transactions that cannot be undone: editing it can
  only make it disagree with the chain. CI fails a pull request that adds, modifies, renames or deletes anything
  inside an event or attempt folder that already exists on the base branch.
- **A later event gets a new folder**, with the next sequence number. Its manifest's `previous` names the record it
  started from: `path` (relative, to the previous event's `record/manifest.json`) and the `sha256` of that file's
  bytes, with its `deploymentId`, `chainId`, `version` and `packageVersion`. The chain of `previous` links is the
  stack's history, checked link by link.
- **Every record is produced by the tools and proven against the chain. None is written by hand.** A repair that
  completes what was sealed is that event, resumed; a repair that departs from the seal is a new event with its own
  seal, and the earlier attempt goes under `aborted/`.
- **Never run a tool inside a record.** It writes forge scratch into the out dir, and `compute` clears paths there.
  To verify an event, copy its folder elsewhere and run from the copy with the generation it was made with:

  ```sh
  cp -R deployments/<chain>/<stack>/<event> /tmp/verify && cd /tmp/verify
  <fhevm-mocks>/host-contracts-cleartext/v<N>/create2-deploy/deploy-cli --stage verify
  ```

  After a later event the implementation slots differ from an older record's: that is expected, not a failure.

- Files outside event and attempt folders, like this README, stay editable.

## Checks

```sh
./fhevm-npm-cli check deployments                     # every record complete, every link and date consistent
./fhevm-npm-cli check deployments --base <base ref>   # and no existing record changed
```

The first runs in `make check-pre`; the second runs in CI on every pull request. The rules are
`fhevm-npm-docs/FHEVM_NPM_RULES.md` § 8.
