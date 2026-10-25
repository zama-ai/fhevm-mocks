# Upgrade run-book: v14 → v15, CREATE2 path

> **Start here instead:** [UPGRADE.md](../UPGRADE.md) is the step-by-step guide, with the warnings. This
> file is the condensed checklist.

Terminal commands only, in order. Every command is safe to re-run; re-running is how you resume.
For the reasoning behind each step see [GUIDE.md](../GUIDE.md) and [README.md](../README.md).

## To test the tooling first

```sh
npm run test:create2-deploy-e2e     # fresh v15 deploy through the CREATE2 coordinator, on a throwaway anvil
npm run test:upgrade                # every suite needing the previous generation: a v14 deploy, then this upgrade
```

## 0. Prerequisites

```sh
which forge cast anvil node          # foundry + node >= 22.18
cast wallet list                     # the deployer keystore must be listed
cd host-contracts-cleartext/v15/create2-deploy
```

Create `upgrade.config.json`, in `create2-deploy/`:

```json
{
  "rpcUrl": "https://sepolia.example",
  "account": "fhevm-testnet-deployer",
  "admin": "0x<current ACLOwner owner>",
  "deploymentId": "<same id as the v14 deploy>",
  "outDir": ".out-upgrade-<chain>-<date>",
  "confirmations": 3,
  "previousManifest": "../../v14/create2-deploy/<v14 out dir>/manifest.json",
  "handles": ["0x<a cleartext handle that exists in the live CleartextDB>"]
}
```

Relative paths in it (`outDir`, `previousManifest`) are relative to this file's folder, `create2-deploy/`.

There is no migration file: seven ops are no-argument reinitializers and the eighth initializes the
`PaddedInputter` the upgrade creates with the deploy's own PRF instances, so the only inputs are the live addresses.

```sh
./upgrade/upgrade-cli --stage params
```

Lists the eight init calls the atomic upgrade sends, one per re-pointed proxy: `ACL.reinitializeV6()`,
`FHEVMExecutor.reinitializeV7()`, `KMSVerifier.reinitializeV5()`, `InputVerifier.reinitializeV3()`,
`ProtocolConfig.reinitializeV3()`, `KMSGeneration.reinitializeV3()`, `CleartextArithmetic.reinitializeV4()`,
`PaddedInputter.initializeFromEmptyProxy(uint16[] initialPrfInstances)`, then the sealed `initialPrfInstances`
(after compute). FIXME: the list is empty until the default cleartext PRF id is decided, so every pad-based
input is refused.

## 1. Compute and seal

```sh
./upgrade/upgrade-cli --stage compute
```

Good: `11 addresses verified against the live stack`, then `wrote .../manifest.json`. The seal snapshots the KMS
context and epoch, the KMS and coprocessor signers and thresholds, and every readable value of the live stack.

```sh
git add -f .out-upgrade-*/manifest.json .out-upgrade-*/addresses.sol
git commit -m "seal: upgrade <deploymentId>"
git push
```

## 2. Deploy the ten creates

```sh
./upgrade/upgrade-cli --stage creates
```

Good: `created 10` (or `already present N` on a re-run), no `REVERTED`. The first two are the empty implementation
(`UPGRADE_EMPTY_UUPS_PROXY`) and the `PaddedInputter` proxy v15 adds on top of it; the other eight are the
implementations. The proxy's address is derived from the committed `LocalHostBytecode.sol`, not supplied.

## 3. Gate

```sh
./upgrade/upgrade-cli --stage precheck
```

Good: `OK - every pre-materialize condition`. Any `FAIL` line: stop, fix, re-run. Nothing has been sent. It refuses
a stack whose re-pointed proxies are not all still initialized at their v14 versions (ACL 6, FHEVMExecutor 7,
KMSVerifier 5, InputVerifier 3, ProtocolConfig 3, KMSGeneration 3): not a v14 stack, or one already upgraded.

## 4. Rehearse on a fork

```sh
./upgrade/upgrade-cli --stage rehearse
```

Good: `REHEARSAL PASSED at block N`. The live chain is untouched.

## 5. Materialize

If you hold the admin key in a keystore:

```sh
./upgrade/upgrade-cli --stage materialize --admin-account <admin keystore name>
```

If the admin is a multisig:

```sh
./upgrade/upgrade-cli --stage materialize
```

Copy `target`, `value 0` and `calldata` into the multisig. Before signing, check that the `keccak` shown
by the wallet equals the one printed here **and** the one `precheck` printed.

Good: `6 proxies upgraded atomically` (key path), or the multisig transaction confirmed.

## 6. Verify

```sh
./upgrade/upgrade-cli --stage verify
```

Waits until the materialize block is finalized, then checks. Good: `OK - every terminal condition for the
upgrade`, `N previous-generation getter readings survived`, `one atomic ACLOwner.upgrade, 6 ops`,
`wrote .../verify-report.json`. The terminal conditions include every re-pointed proxy initialized at its v15
version, and the KMS context, epoch, signers and thresholds and the coprocessor signers unchanged since the seal.

Run it again later, at greater depth:

```sh
./upgrade/upgrade-cli --stage verify
```

## 7. Read back

```sh
./upgrade/upgrade-cli --stage progress        # every step, when, how long, at which block (offline)
./upgrade/upgrade-cli --stage params          # the init calls that were sent
./upgrade/upgrade-cli --stage status          # what the chain says is done
./upgrade/upgrade-cli --stage log             # every transaction sent
./upgrade/upgrade-cli --report                # steps and their transactions
ls .out-upgrade-*/logs/   # one transcript per invocation
```

Commit the record:

```sh
git add -f .out-upgrade-*/journal.jsonl .out-upgrade-*/progress.jsonl \
           .out-upgrade-*/verify-report.json
git commit -m "record: upgrade <deploymentId>"
git push
```

## If something goes wrong

| symptom                                | do                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| a stage was interrupted                | re-run the same command                                                           |
| `precheck` or `rehearse` prints `FAIL` | nothing was sent; read the line, fix, re-run from step 3                          |
| `materialize` reverted in simulation   | nothing was sent; the message names the `require`                                 |
| `verify` says `no HostUpgraded event`  | the upgrade did not land or was reorged out; `--stage status`, then re-run step 5 |
| `compute` refuses                      | contracts are already on chain; resume from step 2, never reseal                  |
| you need to start over                 | new `outDir`, same `deploymentId` (it must match the v14 manifest)                |

## All at once

Only if the admin key is a keystore:

```sh
./upgrade/upgrade-cli --stage all --admin-account <admin keystore name>
```
