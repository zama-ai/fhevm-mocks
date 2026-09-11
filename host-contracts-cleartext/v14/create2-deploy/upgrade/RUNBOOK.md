# Upgrade run-book: v13 → v14, CREATE2 path

Terminal commands only, in order. Every command is safe to re-run; re-running is how you resume.
For the reasoning behind each step see [GUIDE.md](GUIDE.md) and [README.md](README.md).

## To test the tooling first

```sh
npm run test:create2-deploy-e2e     # fresh v14 deploy through the CREATE2 coordinator, on a throwaway anvil
npm run test:upgrade                # v13 deploy, then this upgrade, on a throwaway anvil
```

## 0. Prerequisites

```sh
which forge cast anvil node          # foundry + node >= 22.6
cast wallet list                     # the deployer keystore must be listed
cd sdk/host-contracts-cleartext/v14
```

Create `create2-deploy/upgrade.config.json`:

```json
{
  "rpcUrl": "https://sepolia.example",
  "account": "fhevm-testnet-deployer",
  "admin": "0x<current ACLOwner owner>",
  "deploymentId": "<same id as the v13 deploy>",
  "outDir": ".out-upgrade-<chain>-<date>",
  "confirmations": 3,
  "previousManifest": "../v13/create2-deploy/<v13 out dir>/manifest.json",
  "handles": ["0x<a cleartext handle that exists in the live CleartextDB>"]
}
```

The upgrade sends one set of init parameters: the live KMS context re-declared with v14's per-node
metadata, passed to `ProtocolConfig.reinitializeV2`. Signers, thresholds and context id are read off the
live `ProtocolConfig`; **each node's party id, MPC identity, CA certificate and storage prefix, plus the
KMS software version and enclave PCR values, are not on the v13 chain** and must come from whoever runs
the KMS nodes. Write them to `create2-deploy/kms-migration.json`:

```json
{
  "kmsNodeParams": [
    {
      "signerAddress": "0x<live KMS signer 1>",
      "txSenderAddress": "0x<that node's tx sender>",
      "ipAddress": "<that node's IP>",
      "storageUrl": "<that node's storage URL>",
      "partyId": 1,
      "mpcIdentity": "<that node's MPC identity>",
      "caCert": "0x<that node's CA certificate, hex>",
      "storagePrefix": "<that node's public storage prefix>"
    }
  ],
  "softwareVersion": "<the KMS software version>",
  "pcrValues": [{ "pcr0": "0x…", "pcr1": "0x…", "pcr2": "0x…" }]
}
```

and add it to the config:

```json
  "migration": "create2-deploy/kms-migration.json"
```

`compute` refuses the file if its signers differ from the live chain, in order. The keys are the contract's
parameter names kept verbatim; the context id and the four thresholds are not in the file because they stay
on chain and are only hashed into the context anchor. **Skip the file only for an anvil rehearsal**: then
the four v14 members, the software version (`0.0.0-cleartext`) and an empty PCR list are auto-filled from
the package defaults, which match a stack deployed from the same mnemonic and nothing else.

```sh
U="node create2-deploy/upgrade/testnet.ts --config create2-deploy/upgrade.config.json"
$U --stage params
```

Prints the init parameters exactly as `compute` will seal them: signers, thresholds and context id from the
live ProtocolConfig, the per-node metadata, software version and PCR values from the migration file, or
from the package defaults if none is configured. Read it before step 1.

## 1. Compute and seal

```sh
$U --stage compute
```

Good: `11 addresses verified against the live stack`, then `wrote .../manifest.json`.

```sh
git add -f create2-deploy/.out-upgrade-*/manifest.json create2-deploy/.out-upgrade-*/addresses.sol
git commit -m "seal: upgrade <deploymentId>"
git push
```

## 2. Deploy the seven creates

```sh
$U --stage creates
```

Good: `created 7` (or `already present N` on a re-run), no `REVERTED`.

## 3. Gate

```sh
$U --stage precheck
```

Good: `OK - every pre-materialize condition`. Any `FAIL` line: stop, fix, re-run. Nothing has been sent.

### Check the init parameters

What `compute` sealed from the migration file of step 0 (or from the package defaults, if you skipped it),
and what the atomic call will send. The other six ops take no arguments. `precheck` also prints the
`contextInfoHash` the chain must anchor; `verify` recomputes it from the seal and compares.

```sh
$U --stage params          # the sealed init parameters, decoded
$U --stage precheck        # the same values re-derived at send time, with every op around them
```

If the party ids, MPC identities, CA certificates or storage prefixes shown are not your KMS nodes', stop:
fix the migration file, then start over with a new `deploymentId` and `outDir` (the seal cannot be
recomputed once creates are on chain).

## 4. Rehearse on a fork

```sh
$U --stage rehearse
```

Good: `REHEARSAL PASSED at block N`. The live chain is untouched.

## 5. Materialize

If you hold the admin key in a keystore:

```sh
$U --stage materialize --admin-account <admin keystore name>
```

If the admin is a multisig:

```sh
$U --stage materialize
```

Copy `target`, `value 0` and `calldata` into the multisig. Before signing, check that the `keccak` shown
by the wallet equals the one printed here **and** the one `precheck` printed.

Good: `seven proxies upgraded atomically` (key path), or the multisig transaction confirmed.

## 6. Verify

```sh
$U --stage verify
```

Waits until the materialize block is finalized, then checks. Good: `OK - every terminal condition for the
upgrade`, `N v13 getter readings survived`, `one atomic ACLOwner.upgrade`, `wrote .../verify-report.json`.

Run it again later, at greater depth:

```sh
$U --stage verify
```

## 7. Read back

```sh
$U --stage progress        # every step, when, how long, at which block (offline)
$U --stage params          # the init parameters that were sent
$U --stage status          # what the chain says is done
$U --stage log             # every transaction sent
$U --report                # steps and their transactions
ls create2-deploy/.out-upgrade-*/logs/   # one transcript per invocation
```

Commit the record:

```sh
git add -f create2-deploy/.out-upgrade-*/journal.jsonl create2-deploy/.out-upgrade-*/progress.jsonl \
           create2-deploy/.out-upgrade-*/verify-report.json
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
| you need to start over                 | new `deploymentId` and new `outDir`; the old stack stays as it is                 |

## All at once

Only if the admin key is a keystore:

```sh
$U --stage all --admin-account <admin keystore name>
```
