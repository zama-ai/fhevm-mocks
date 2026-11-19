# Upgrade a running cleartext FHEVM stack from `v13` to `v14`

This guide upgrades a **live `v13`** cleartext FHEVM stack to `v14`, in place, on a public **testnet**. The
example chain is **Arbitrum Sepolia** (chain id `421614`).

What the upgrade does:

- creates the 7 `v14` implementations through the CREATE2 factory;
- re-points 7 proxies (`ProtocolConfig`, `KMSGeneration`, `ACL`, `FHEVMExecutor`, `HCULimit`, `KMSVerifier`,
  `CleartextArithmetic`) in **one atomic transaction** (`ACLOwner.upgrade`), sent by the current admin. That
  transaction also calls `ProtocolConfig.reinitializeV2`, which re-declares the live KMS context with the
  per-node metadata that is new in `v14`.

What it never touches: the addresses, the owner, the pausers, `InputVerifier`, `CleartextDB` and its data.

You work with two folders:

| folder                                           | what it is                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `~/src/fhevm-mocks`                              | the tool. You install it once and never edit it                  |
| `~/fhevm-deployments/arbsepolia-upgrade-v14`     | **your upgrade folder**: your config, the seal, the journal. A git repo of yours |

Both paths are examples: put them wherever you like.

> ⚠️ **Testnets only.** The same rules as [DEPLOY.md](DEPLOY.md) apply: the chain must be a testnet **and**
> be listed in [`create2-deploy.config.json`](create2-deploy.config.json), in the tool folder.

To deploy a new stack instead, see [DEPLOY.md](DEPLOY.md). For the checklist and the reasoning behind each
check, see [upgrade/RUNBOOK.md](upgrade/RUNBOOK.md) and [README.md](README.md#upgrading-a-v13-stack).

## Contents

1. [Requirements](#1-requirements)
2. [Step by step](#2-step-by-step)
   - [Step 1: install the tool](#step-1-install-the-tool)
   - [Step 2: create your upgrade folder](#step-2-create-your-upgrade-folder)
   - [Step 3: copy the `v13` manifest](#step-3-copy-the-v13-manifest)
   - [Step 4: check who the admin is](#step-4-check-who-the-admin-is)
   - [Step 5: import the keys](#step-5-import-the-keys)
   - [Step 6: create a test handle](#step-6-create-a-test-handle)
   - [Step 7: write the KMS migration file](#step-7-write-the-kms-migration-file)
   - [Step 8: write the config file](#step-8-write-the-config-file)
   - [Step 9: preview the init parameters](#step-9-preview-the-init-parameters)
   - [Step 10: simulate the whole upgrade on a fork](#step-10-simulate-the-whole-upgrade-on-a-fork)
   - [Step 11: compute and seal](#step-11-compute-and-seal)
   - [Step 12: create the new contracts](#step-12-create-the-new-contracts)
   - [Step 13: run the gate](#step-13-run-the-gate)
   - [Step 14: rehearse on a fork](#step-14-rehearse-on-a-fork)
   - [Step 15: materialize](#step-15-materialize)
   - [Step 16: verify](#step-16-verify)
   - [Step 17: commit the record](#step-17-commit-the-record)
   - [What your folder contains](#what-your-folder-contains)
   - [If something goes wrong](#if-something-goes-wrong)
3. [Warnings and security notes](#3-warnings-and-security-notes)

## 1. Requirements

| you need                                      | why                                                     |
| --------------------------------------------- | ------------------------------------------------------- |
| Foundry (`forge`, `cast`, `anvil`)            | build, send, and fork the chain for the rehearsal       |
| Node.js ≥ 22.18, `git`, `make`, `jq`          | run the tool                                            |
| the `v13` deploy's `manifest.json`              | the eleven live addresses and the `deploymentId`        |
| the **admin** key or multisig, with testnet ETH | the current owner of `ACLOwner`; it sends the upgrade, the biggest transaction of the run |
| a **deployer** key with testnet ETH           | sends the 7 creates; it gets no power over the stack    |
| your KMS nodes' `v14` metadata                  | each node's party id, MPC identity, CA certificate and storage prefix, plus the KMS software version and PCR values. New in `v14`, not on the `v13` chain |
| an RPC that serves `eth_getLogs`              | verify reads the upgrade's events                       |
| an **archive** RPC (step 10 only)             | the fork simulation reads the chain's state at a pinned block |

## 2. Step by step

### Step 1: install the tool

> ⚠️ **Use the `release/0.14.x` branch only.** Never `main` or another branch.

```sh
git clone --branch release/0.14.x --single-branch https://github.com/zama-ai/fhevm-mocks.git ~/src/fhevm-mocks
cd ~/src/fhevm-mocks
make install
```

`make install` is required: without it, `upgrade-cli` fails with `Cannot find package
'@fhevm/host-contracts-cleartext-v13-dev'`. Use this same checkout, at this same commit, for every step
below.

Put the `upgrade-cli` command on your `PATH`, and check it runs:

```sh
export PATH="$HOME/src/fhevm-mocks/host-contracts-cleartext/v14/create2-deploy/upgrade:$PATH"
upgrade-cli --help
```

To have it in every new terminal, add the `export` line to `~/.zshrc` (or `~/.bashrc`).

### Step 2: create your upgrade folder

```sh
mkdir -p ~/fhevm-deployments/arbsepolia-upgrade-v14
cd ~/fhevm-deployments/arbsepolia-upgrade-v14
git init
git remote add origin <your git remote>   # optional
```

The folder must be a git repository: before its first transaction, the tool requires the seal (step 11) to
be committed. A remote is optional. With one, the seal must also be pushed. Without one, the seal lives
in a single copy: back it up yourself (see [Warnings](#3-warnings-and-security-notes)).

**Run every command from now on from this folder.**

### Step 3: copy the `v13` manifest

Copy the `manifest.json` that was committed when `v13` was deployed. If the stack is archived in this
repository, it is `deployments/<chain>/<deploymentId>/00-deploy-v13.<p>-<date>/record/manifest.json`, in
the tool folder.

```sh
cp <path to the v13 deploy>/manifest.json v13-manifest.json
jq '{chainId, deploymentId, admin, address}' v13-manifest.json
```

### Step 4: check who the admin is

```sh
RPC=https://sepolia-rollup.arbitrum.io/rpc
cast call "$(jq -r .address.ACL_OWNER v13-manifest.json)" 'owner()(address)' --rpc-url $RPC
```

This address is your `admin` in step 8.

### Step 5: import the keys

```sh
cast wallet import fhevm-deployer --interactive
cast wallet import fhevm-admin --interactive   # skip if the admin is a multisig
```

Both keys need testnet ETH: the deployer sends the 7 creates, and the admin key sends the upgrade itself
(step 15). A multisig admin pays its own gas.

```sh
cast balance "$(cast wallet address --account fhevm-deployer)" --rpc-url $RPC --ether
cast balance "$(cast wallet address --account fhevm-admin)" --rpc-url $RPC --ether   # admin key only
```

If the admin key has no ETH, the tool refuses to start step 15. Neither the fork simulation (step 10) nor
the rehearsal (step 14) catches it: on a fork, the admin is given ETH.

### Step 6: create a test handle

Optional, strongly recommended: it proves existing data survives the upgrade.

```sh
EXEC=$(jq -r .address.FHEVM_EXECUTOR_ADDRESS v13-manifest.json)
TOPIC=$(cast keccak 'TrivialEncrypt(address,uint256,uint8,bytes32)')
cast send $EXEC 'trivialEncrypt(uint256,uint8)' 42 5 --account fhevm-deployer --rpc-url $RPC --json \
  | jq -r --arg t $TOPIC '.logs[] | select(.topics[0] == $t) | "0x" + .data[-64:]'
```

Keep the printed `0x…` handle.

### Step 7: write the KMS migration file

In `v13`, the live KMS context is held by `ProtocolConfig`. Read it:

```sh
PC=$(jq -r .address.PROTOCOL_CONFIG_ADDRESS v13-manifest.json)
CTX=$(cast call $PC 'getCurrentKmsContextId()(uint256)' --rpc-url $RPC --json | jq -r '.[0]')
cast call $PC 'getKmsSigners()(address[])' --rpc-url $RPC
cast call $PC 'getKmsNodesForContext(uint256)((address,address,string,string)[])' $CTX --rpc-url $RPC
```

The context id is read through `--json`: plain `cast call` follows a large integer with an annotation such
as `[3.166e75]`, which would end up in `$CTX` and break the next call.

The last call prints, for each node: tx sender, signer, IP, storage URL.

Create `kms-migration.json` in your upgrade folder, with one node per signer, **in the same order**:

```json
{
  "kmsNodeParams": [
    {
      "signerAddress": "0x<signer 1>",
      "txSenderAddress": "0x<that node's tx sender, as on chain>",
      "ipAddress": "<that node's IP, as on chain>",
      "storageUrl": "<that node's storage URL, as on chain>",
      "partyId": 1,
      "mpcIdentity": "<that node's MPC identity>",
      "caCert": "0x<that node's CA certificate, hex>",
      "storagePrefix": "<that node's public storage prefix>"
    }
  ],
  "softwareVersion": "<the KMS software version>",
  "pcrValues": []
}
```

- `signerAddress`, `txSenderAddress`, `ipAddress` and `storageUrl` must be **exactly** what the chain
  holds, in order. `compute`, `precheck`, `materialize` and `verify` each refuse otherwise.
- `partyId`, `mpcIdentity`, `caCert` (hex, `"0x"` when empty) and `storagePrefix` are new in `v14` and come
  from whoever runs the KMS nodes. Party ids and tx senders must be unique.
- `pcrValues` is a list of `{ "pcr0": "0x…", "pcr1": "0x…", "pcr2": "0x…" }`, empty for cleartext.
- The context id and the four thresholds are **not** in the file: they are read off the chain.

**Without a migration file**, the tool fills it in from the package defaults (`LocalHostBootstrap`). It
refuses when a live signer is not one of the package's, so this only works for a stack deployed from the
package's published mnemonic. Even then, read step 9 carefully.

### Step 8: write the config file

Create `upgrade.config.json` in your upgrade folder, for example
`~/fhevm-deployments/arbsepolia-upgrade-v14/upgrade.config.json`:

```json
{
  "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc",
  "account": "fhevm-deployer",
  "admin": "0x<address from step 4>",
  "adminAccount": "fhevm-admin",
  "deploymentId": "<same deploymentId as in v13-manifest.json>",
  "outDir": "out",
  "confirmations": 3,
  "previousManifest": "v13-manifest.json",
  "migration": "kms-migration.json",
  "handles": ["0x<handle from step 6>"]
}
```

- **Admin is a key:** `admin` is optional. Without it, the tool reads the address from `adminAccount`
  (one password prompt) and shows it in its first lines. With both, they must be the same account, or
  the tool refuses to start.
- **Admin is a multisig:** delete the `adminAccount` line. `admin` is then required.
- **No migration file** (step 7): delete the `migration` line.

`upgrade-cli` reads `upgrade.config.json` from the folder you run it in, so always run it from your
upgrade folder. If you open a new terminal, set `RPC` from step 4 again.

> ⚠️ **Paths in the config file are relative to the config file.** `"out"`, `"v13-manifest.json"` and
> `"kms-migration.json"` all mean files next to `upgrade.config.json`.
>
> | `"outDir"` in `upgrade.config.json`       | result                                                             |
> | ----------------------------------------- | ------------------------------------------------------------------ |
> | `"out"`                                   | ✅ OK: `out/` next to `upgrade.config.json`                         |
> | `"/home/me/fhevm-deployments/arbsepolia-upgrade-v14/out"` | ✅ OK: the same folder, written in full             |
> | `"~/fhevm-deployments/arbsepolia-upgrade-v14/out"` | ❌ Not OK: `~` is not expanded in a JSON file. Write `"out"`, or the full path |
> | `"out"`, reused for a second upgrade      | ❌ Not OK: one `outDir` per upgrade. Use a new upgrade folder       |
> | `"/home/me/src/fhevm-mocks"` (or any folder containing the tool) | ❌ Not OK: the tool refuses to start            |
> | anything inside the tool folder, `deployments/` included | ❌ Not OK: the tool refuses to start          |

### Step 9: preview the init parameters

```sh
upgrade-cli --stage params
```

It prints `ProtocolConfig.reinitializeV2(kmsNodeParams, softwareVersion, pcrValues)` exactly as `compute`
will seal it. Nothing on chain can check the party ids, MPC identities, CA certificates, storage prefixes,
software version and PCR values: make sure they are your KMS nodes'.

### Step 10: simulate the whole upgrade on a fork

Optional, strongly recommended: it runs every step below against a local copy of the chain, with your real
`v13` stack in it. Nothing is sent to the real chain.

In a second terminal, start an anvil fork, from an **archive** RPC, pinned a few blocks back (after your
step 6 handle, so the fork has it):

```sh
ARCHIVE_RPC=<your archive RPC for this chain>
BLOCK=$(( $(cast block-number --rpc-url "$ARCHIVE_RPC") - 10 ))
anvil --fork-url "$ARCHIVE_RPC" --fork-block-number "$BLOCK" --port 8556
```

Set the variables on their own lines, as above: in `BLOCK=… anvil … $BLOCK`, the shell expands `$BLOCK`
before assigning it.

Back in your upgrade folder, run the whole upgrade against the fork:

```sh
upgrade-cli --fork http://127.0.0.1:8556 --out-dir out-fork --stage all
```

You should see `REHEARSAL PASSED`, then `7 proxies upgraded atomically` and `OK - every terminal condition
for the upgrade`. With `--fork`, the tool:

- sends only to the fork. It refuses a URL that is not an anvil;
- ignores `account` and `adminAccount`: no key, no password. The deployer is anvil's test account 0, and
  the `admin` of the config file is impersonated on the fork;
- needs no git commit, waits for no confirmation and no finality;
- marks its records `simulation`. They can never be archived.

Keep `--out-dir out-fork` on every `--fork` command, and never let it be `out`: without `--out-dir`, the
tool uses `outDir` from the config file, and the real run's `out/` must not hold a simulated seal. You can
also run the stages one by one, as in steps 11 to 16, each with `--fork http://127.0.0.1:8556 --out-dir
out-fork`. If anvil stops, the fork is gone: delete `out-fork/` and start again.

### Step 11: compute and seal

```sh
upgrade-cli --stage compute
```

You should see `11 addresses verified against the live stack`, then `wrote` followed by the full path of
`out/manifest.json`.

```sh
git add upgrade.config.json kms-migration.json v13-manifest.json out/manifest.json out/addresses.sol
git commit -m "seal: upgrade <deploymentId>"
git push        # only if your repo has a remote
```

The seal also records which commit of the tool computed it.

### Step 12: create the new contracts

From here on, every stage that sends a transaction to a real chain needs `--real <deploymentId>`: you name
the stack you are changing. Without it, the tool stops and sends nothing.

```sh
upgrade-cli --stage creates --real <deploymentId>
```

You should see `created 7`. Before its first transaction, the tool checks that the seal is committed, and
pushed if your branch has an upstream. If not, it stops, sends nothing, and prints the git commands to run.

### Step 13: run the gate

```sh
upgrade-cli --stage precheck
```

You should see `OK - every pre-materialize condition`. Note the `calldata keccak256` it prints.

### Step 14: rehearse on a fork

```sh
upgrade-cli --stage rehearse
```

You should see `REHEARSAL PASSED at block N`. The rehearsal starts its own temporary fork, applies the
upgrade there, verifies it, and throws the fork away. **It does not upgrade anything**: step 15 still has to
run.

### Step 15: materialize

**Admin is a key:**

```sh
upgrade-cli --stage materialize --real <deploymentId>
```

You should see `7 proxies upgraded atomically`.

**Admin is a multisig:**

```sh
upgrade-cli --stage materialize --real <deploymentId>
```

It prints `target`, `value 0`, `calldata` and `keccak`, and saves the calldata to
`out/materialize-calldata.txt`. In the multisig, send that calldata to that target. Before signing, check
that the wallet's digest equals the `keccak` printed here **and** the one from step 13.

### Step 16: verify

```sh
upgrade-cli --stage verify
```

You should see `OK - every terminal condition for the upgrade`, `v13 getter readings survived`,
`cleartext handle(s) survived` and `one atomic ACLOwner.upgrade`.

### Step 17: commit the record

```sh
git add out/journal.jsonl out/progress.jsonl out/verify-report.json
git commit -m "record: upgrade <deploymentId>"
git push        # only if your repo has a remote
```

If the stack is archived in this repository, its record goes next to the deploy's, in
`deployments/<chain>/<deploymentId>/<seq>-upgrade-v14.<p>-<YYYY-MM-DD>/`, dated by the UTC day of the
`ACLOwner.upgrade` block. See [deployments/README.md](../../../deployments/README.md).

### What your folder contains

```text
arbsepolia-upgrade-v14/
├── upgrade.config.json    you wrote it                       commit it (step 11)
├── kms-migration.json     you wrote it, if any               commit it (step 11)
├── v13-manifest.json      copied from the v13 deploy         commit it (step 11)
├── out-fork/              the fork simulation (step 10)      do not commit
└── out/
    ├── manifest.json      the seal, with the pre-upgrade snapshot   commit it (step 11)
    ├── addresses.sol      the generated config               commit it (step 11)
    ├── journal.jsonl      every transaction sent             commit it (step 17)
    ├── progress.jsonl     every step, including the checks   commit it (step 17)
    ├── verify-report.json the verify result                  commit it (step 17)
    ├── materialize-calldata.txt  the upgrade payload         optional
    ├── logs/              one transcript per command         optional
    ├── rehearsal/         the fork rehearsal's records       optional
    ├── build/, build-check/, broadcast/, cache/, .foundry/   do not commit
```

### If something goes wrong

| symptom                                | do                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `Cannot find package '@fhevm/…'`       | `make install` was not run in the tool folder you are using (step 1)    |
| a stage was interrupted                | run the same command again                                               |
| a sending stage stops and asks for `--real` | add `--real <deploymentId>`, or `--fork <anvil url>` to simulate     |
| `precheck` or `rehearse` prints `FAIL` | nothing was sent. Read the line, fix it, go back to step 13             |
| `materialize` reverts in simulation    | nothing was sent. The message names the failed check                    |
| `verify` says `no HostUpgraded event`  | the upgrade did not land. A passed rehearsal does not count: run `upgrade-cli --stage status`, then step 15 |
| `compute` refuses                      | contracts are already on chain. Resume at step 12, never reseal          |
| `status` shows `FATAL`                 | **stop.** Do not retry. Read [Warnings](#3-warnings-and-security-notes)  |
| you need to start over                 | a new `outDir` in the config file (keep the same `deploymentId`), then step 11 |

Steps 11 to 16 can also run as one command, once you trust the setup (admin key only):

```sh
upgrade-cli --stage all --real <deploymentId>
```

## 3. Warnings and security notes

1. **Materialize is irreversible.** It is one atomic transaction. Its reinitializers run once, so a second
   attempt reverts. Run `precheck` and `rehearse` first, every time.
2. **The admin key is root over the stack.** It sends the upgrade. Keep it in a keystore or a multisig,
   never as a raw private key.
3. **For a multisig, compare the digest.** The `keccak` printed by `materialize`, the one printed by
   `precheck`, and the one the wallet shows must all be equal. If they differ, do not sign.
4. **The eleven addresses get baked into the new code.** A wrong one gives a stack that upgrades cleanly and
   breaks in use. `compute` cross-checks eight of them against the stack itself. The other three,
   `KMS_VERIFIER_ADDRESS`, `PROTOCOL_CONFIG_ADDRESS` and `KMS_GENERATION_ADDRESS`, are checked only weakly:
   make sure they are **your** stack's.
5. **The migration file decides the KMS nodes.** `compute` refuses it when the signers, tx senders, IPs or
   storage URLs differ from the chain. It cannot check the party ids, MPC identities, CA certificates,
   storage prefixes, software version or PCR values: a wrong value there registers the wrong node. Read
   `--stage params` carefully.
6. **Do not change the stack between compute and verify.** No other upgrade, no ownership transfer, no
   pauser change. `materialize` refuses if a slot moved, and `verify` fails on any ownership or pauser
   event since the seal. A KMS signer rotation in that window also blocks `materialize`: start over.
7. **Never reseal once the creates are on chain.** To start over, use a new `outDir` and keep the same
   `deploymentId` (it must match the `v13` manifest). The creates already sent are harmless: an unchanged
   build lands on the same addresses, and `creates` reports them as already present.
8. **Commit the seal (step 11) before step 12**, and push it if your repo has a remote. It is the only record
   of the pre-upgrade state, and `verify` compares against it. Without a remote, copy `out/manifest.json`
   and `out/addresses.sol` somewhere else too.
9. **Do not update the tool during an upgrade.** No `git pull` or `git checkout` in `~/src/fhevm-mocks`
   between step 11 and step 17. `precheck` and `verify` recompile and fail if the bytecode no longer
   matches the seal. The seal records the tool's commit, and the tool refuses to send anything from
   another commit: it prints the `git checkout` that brings the tool back to the sealed one.
10. **Pass at least one handle.** Without one, verify proves the stack still works, not that existing
    data survived.
11. **What verify does not prove.** It checks every zero-argument getter, the handles you gave, the slots,
    the versions and the events. It does not check state keyed by arguments, such as ACL permissions
    (`isAllowed(handle, account)`).
12. **A fork is not the chain.** The simulation (step 10) and the rehearsal (step 14) prove the payload works
    on the state they forked. Gas and ordering can still differ on the live chain, and on a fork the admin
    is impersonated and given ETH, so an unfunded admin key is not caught.
13. **`--real` is a statement, not a formality.** It names the stack a run changes. Type the
    `deploymentId` yourself; never put `--real` in a script or alias that could also run against another
    stack.
14. **Never reuse a simulation's out dir for the real run.** Its seal is marked `simulation`, and its creates
    exist only on the fork.
15. **Testnets only.** The same chain allow-list and the same published-mnemonic warning as
    [DEPLOY.md](DEPLOY.md#3-warnings-and-security-notes) apply.
16. **Do not use the rehearsal flags on a live chain.** `--no-git`, `--no-confirm`, `--no-finality` and
    `--confirmations 0` exist for a local anvil only.
17. **Not yet battle-tested.** This path has been run end to end on a local anvil (`npm run test:upgrade`)
    and on an anvil fork of Ethereum Sepolia (step 10), not yet against a public testnet itself. Simulate it
    first.
