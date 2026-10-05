# Upgrade a running cleartext FHEVM stack from v12 to v13

This guide upgrades a **live v12** cleartext FHEVM stack to v13, in place, on a public **testnet**. The
example chain is **Arbitrum Sepolia** (chain id `421614`).

What the upgrade does:

- creates 10 contracts through the CREATE2 factory: 2 new proxies (`ProtocolConfig`, `KMSGeneration`), their
  empty implementation, and 7 v13 implementations;
- re-points 7 proxies in **one atomic transaction** (`ACLOwner.upgrade`), sent by the current admin.

What it never touches: the addresses, the owner, the pausers, `InputVerifier`, `CleartextDB` and its data.

You work with two folders:

| folder                                           | what it is                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `~/src/fhevm-mocks`                              | the tool. You install it once and never edit it                  |
| `~/fhevm-deployments/arbsepolia-upgrade-v13`     | **your upgrade folder**: your config, the seal, the journal. A git repo of yours |

Both paths are examples: put them wherever you like.

> ⚠️ **Testnets only.** The same rules as [DEPLOY.md](DEPLOY.md) apply: the chain must be a testnet **and**
> be listed in [`create2-deploy.config.json`](create2-deploy.config.json), in the tool folder.

To deploy a new stack instead, see [DEPLOY.md](DEPLOY.md). For the checklist and the reasoning behind each
check, see [upgrade/RUNBOOK.md](upgrade/RUNBOOK.md) and [README.md](README.md#upgrading-a-v12-stack).

## Contents

1. [Requirements](#1-requirements)
2. [Step by step](#2-step-by-step)
   - [Step 1: install the tool](#step-1-install-the-tool)
   - [Step 2: create your upgrade folder](#step-2-create-your-upgrade-folder)
   - [Step 3: copy the v12 manifest](#step-3-copy-the-v12-manifest)
   - [Step 4: check who the admin is](#step-4-check-who-the-admin-is)
   - [Step 5: import the keys](#step-5-import-the-keys)
   - [Step 6: create a test handle](#step-6-create-a-test-handle)
   - [Step 7: write the KMS migration file](#step-7-write-the-kms-migration-file)
   - [Step 8: write the config file](#step-8-write-the-config-file)
   - [Step 9: preview the init parameters](#step-9-preview-the-init-parameters)
   - [Step 10: compute and seal](#step-10-compute-and-seal)
   - [Step 11: create the new contracts](#step-11-create-the-new-contracts)
   - [Step 12: run the gate](#step-12-run-the-gate)
   - [Step 13: rehearse on a fork](#step-13-rehearse-on-a-fork)
   - [Step 14: materialize](#step-14-materialize)
   - [Step 15: verify](#step-15-verify)
   - [Step 16: commit the record](#step-16-commit-the-record)
   - [What your folder contains](#what-your-folder-contains)
   - [If something goes wrong](#if-something-goes-wrong)
3. [Warnings and security notes](#3-warnings-and-security-notes)

## 1. Requirements

| you need                                      | why                                                     |
| --------------------------------------------- | ------------------------------------------------------- |
| Foundry (`forge`, `cast`, `anvil`)            | build, send, and fork the chain for the rehearsal       |
| Node.js ≥ 22.18, `git`, `make`, `jq`          | run the tool                                            |
| the v12 deploy's `manifest.json`              | the nine live addresses and the `deploymentId`          |
| the **admin** key or multisig, with testnet ETH | the current owner of `ACLOwner`; it sends the upgrade, the biggest transaction of the run |
| a **deployer** key with testnet ETH           | sends the 10 creates; it gets no power over the stack   |
| your KMS nodes' tx sender, IP and storage URL | new in v13, not on chain                                |
| an RPC that serves `eth_getLogs`              | verify reads the upgrade's events                       |

## 2. Step by step

### Step 1: install the tool

> ⚠️ **Use the `release/0.13.x` branch only.** Never `main` or another branch.

```sh
git clone --branch release/0.13.x --single-branch https://github.com/zama-ai/fhevm-mocks.git ~/src/fhevm-mocks
cd ~/src/fhevm-mocks
make install
```

Put the `upgrade-cli` command on your `PATH`, and check it runs:

```sh
export PATH="$HOME/src/fhevm-mocks/host-contracts-cleartext/v13/create2-deploy/upgrade:$PATH"
upgrade-cli --help
```

To have it in every new terminal, add the `export` line to `~/.zshrc` (or `~/.bashrc`).

### Step 2: create your upgrade folder

```sh
mkdir -p ~/fhevm-deployments/arbsepolia-upgrade-v13
cd ~/fhevm-deployments/arbsepolia-upgrade-v13
git init
git remote add origin <your git remote>
```

**Run every command from now on from this folder.**

### Step 3: copy the v12 manifest

Copy the `manifest.json` that was committed when v12 was deployed:

```sh
cp <path to the v12 deploy>/manifest.json v12-manifest.json
jq '{chainId, deploymentId, admin, address}' v12-manifest.json
```

### Step 4: check who the admin is

```sh
RPC=https://sepolia-rollup.arbitrum.io/rpc
cast call "$(jq -r .address.ACL_OWNER v12-manifest.json)" 'owner()(address)' --rpc-url $RPC
```

This address is your `admin` in step 8.

### Step 5: import the keys

```sh
cast wallet import fhevm-deployer --interactive
cast wallet import fhevm-admin --interactive   # skip if the admin is a multisig
```

Both keys need testnet ETH: the deployer sends the 10 creates, and the admin key sends the upgrade itself
(step 14). A multisig admin pays its own gas.

```sh
cast balance "$(cast wallet address --account fhevm-deployer)" --rpc-url $RPC --ether
cast balance "$(cast wallet address --account fhevm-admin)" --rpc-url $RPC --ether   # admin key only
```

If the admin key has no ETH, the tool refuses to start step 14. The rehearsal (step 13) does not catch it:
on its fork, the admin is given ETH.

### Step 6: create a test handle

Optional, strongly recommended: it proves existing data survives the upgrade.

```sh
EXEC=$(jq -r .address.FHEVM_EXECUTOR_ADDRESS v12-manifest.json)
TOPIC=$(cast keccak 'TrivialEncrypt(address,uint256,uint8,bytes32)')
cast send $EXEC 'trivialEncrypt(uint256,uint8)' 42 5 --account fhevm-deployer --rpc-url $RPC --json \
  | jq -r --arg t $TOPIC '.logs[] | select(.topics[0] == $t) | "0x" + .data[-64:]'
```

Keep the printed `0x…` handle.

### Step 7: write the KMS migration file

Read the live KMS set:

```sh
KMS=$(jq -r .address.KMS_VERIFIER_ADDRESS v12-manifest.json)
cast call $KMS 'getKmsSigners()(address[])' --rpc-url $RPC
cast call $KMS 'getThreshold()(uint256)' --rpc-url $RPC
cast call $KMS 'getCurrentKmsContextId()(uint256)' --rpc-url $RPC
```

Create `kms-migration.json` in your upgrade folder, with one node per signer, **in the same order**:

```json
{
  "existingContextId": "<context id>",
  "existingKmsNodes": [
    {
      "signerAddress": "0x<signer 1>",
      "txSenderAddress": "0x<that node's tx sender>",
      "ipAddress": "<that node's IP>",
      "storageUrl": "<that node's storage URL>"
    }
  ],
  "existingThresholds": { "publicDecryption": "<t>", "userDecryption": "<t>", "kmsGen": "<t>", "mpc": "<t>" }
}
```

All four thresholds equal the live `getThreshold()` value.

### Step 8: write the config file

Create `upgrade.config.json` in your upgrade folder, for example
`~/fhevm-deployments/arbsepolia-upgrade-v13/upgrade.config.json`:

```json
{
  "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc",
  "account": "fhevm-deployer",
  "admin": "0x<address from step 4>",
  "adminAccount": "fhevm-admin",
  "deploymentId": "<same deploymentId as in v12-manifest.json>",
  "outDir": "out",
  "confirmations": 3,
  "previousManifest": "v12-manifest.json",
  "migration": "kms-migration.json",
  "handles": ["0x<handle from step 6>"]
}
```

- **Admin is a key:** `admin` is optional. Without it, the tool reads the address from `adminAccount`
  (one password prompt) and shows it in its first lines. With both, they must be the same account, or
  the tool refuses to start.
- **Admin is a multisig:** delete the `adminAccount` line. `admin` is then required.

`upgrade-cli` reads `upgrade.config.json` from the folder you run it in, so always run it from your
upgrade folder. If you open a new terminal, set `RPC` from step 4 again.

> ⚠️ **Paths in the config file are relative to the config file.** `"out"`, `"v12-manifest.json"` and
> `"kms-migration.json"` all mean files next to `upgrade.config.json`.
>
> | `"outDir"` in `upgrade.config.json`       | result                                                             |
> | ----------------------------------------- | ------------------------------------------------------------------ |
> | `"out"`                                   | ✅ OK: `out/` next to `upgrade.config.json`                         |
> | `"/home/me/fhevm-deployments/arbsepolia-upgrade-v13/out"` | ✅ OK: the same folder, written in full             |
> | `"~/fhevm-deployments/arbsepolia-upgrade-v13/out"` | ❌ Not OK: `~` is not expanded in a JSON file. Write `"out"`, or the full path |
> | `"out"`, reused for a second upgrade      | ❌ Not OK: one `outDir` per upgrade. Use a new upgrade folder       |
> | `"/home/me/src/fhevm-mocks"` (or any folder containing the tool) | ❌ Not OK: the tool refuses to start            |

### Step 9: preview the init parameters

```sh
upgrade-cli --stage params
```

Check that every tx sender, IP and storage URL is your KMS nodes'.

### Step 10: compute and seal

```sh
upgrade-cli --stage compute
```

You should see `9 addresses verified against the live stack`, then `wrote` followed by the full path of
`out/manifest.json`.

```sh
git -C ~/src/fhevm-mocks rev-parse HEAD > tool-commit.txt
git add upgrade.config.json kms-migration.json v12-manifest.json tool-commit.txt out/manifest.json out/addresses.sol
git commit -m "seal: upgrade <deploymentId>"
git push
```

### Step 11: create the new contracts

```sh
upgrade-cli --stage creates
```

Answer `y` to `Pushed to git? [y/N]`. You should see `created 10`.

### Step 12: run the gate

```sh
upgrade-cli --stage precheck
```

You should see `OK - every pre-materialize condition`. Note the `calldata keccak256` it prints.

### Step 13: rehearse on a fork

```sh
upgrade-cli --stage rehearse
```

You should see `REHEARSAL PASSED at block N`. Nothing is sent to the live chain.

### Step 14: materialize

**Admin is a key:**

```sh
upgrade-cli --stage materialize
```

You should see `seven proxies upgraded atomically`.

**Admin is a multisig:**

```sh
upgrade-cli --stage materialize
```

It prints `target`, `value 0`, `calldata` and `keccak`. In the multisig, send that calldata to that
target. Before signing, check that the wallet's digest equals the `keccak` printed here **and** the one
from step 12.

### Step 15: verify

```sh
upgrade-cli --stage verify
```

You should see `OK - every terminal condition for the upgrade`, `v12 getter readings survived`,
`cleartext handle(s) survived` and `one atomic ACLOwner.upgrade`.

### Step 16: commit the record

```sh
git add out/journal.jsonl out/progress.jsonl out/verify-report.json
git commit -m "record: upgrade <deploymentId>"
git push
```

### What your folder contains

```text
arbsepolia-upgrade-v13/
├── upgrade.config.json    you wrote it                       commit it (step 10)
├── kms-migration.json     you wrote it                       commit it (step 10)
├── v12-manifest.json      copied from the v12 deploy         commit it (step 10)
├── tool-commit.txt        the tool's git commit              commit it (step 10)
└── out/
    ├── manifest.json      the seal, with the pre-upgrade snapshot   commit it (step 10)
    ├── addresses.sol      the generated config               commit it (step 10)
    ├── journal.jsonl      every transaction sent             commit it (step 16)
    ├── progress.jsonl     every step, including the checks   commit it (step 16)
    ├── verify-report.json the verify result                  commit it (step 16)
    ├── logs/              one transcript per command         optional
    ├── rehearsal/         the fork rehearsal's records       optional
    ├── build/, build-check/, broadcast/, .foundry/           do not commit
```

### If something goes wrong

| symptom                                | do                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------ |
| a stage was interrupted                | run the same command again                                               |
| `precheck` or `rehearse` prints `FAIL` | nothing was sent. Read the line, fix it, go back to step 12             |
| `materialize` reverts in simulation    | nothing was sent. The message names the failed check                    |
| `verify` says `no HostUpgraded event`  | the upgrade did not land. Run `upgrade-cli --stage status`, then step 14 again |
| `compute` refuses                      | contracts are already on chain. Resume at step 11, never reseal          |
| `status` shows `FATAL`                 | **stop.** Do not retry. Read [Warnings](#3-warnings-and-security-notes)  |
| you need to start over                 | a new `outDir` in the config file (keep the same `deploymentId`), then step 10 |

Steps 10 to 15 can also run as one command, once you trust the setup (admin key only):

```sh
upgrade-cli --stage all
```

## 3. Warnings and security notes

1. **Materialize is irreversible.** It is one atomic transaction. Its reinitializers run once, so a second
   attempt reverts. Run `precheck` and `rehearse` first, every time.
2. **The admin key is root over the stack.** It sends the upgrade. Keep it in a keystore or a multisig,
   never as a raw private key.
3. **For a multisig, compare the digest.** The `keccak` printed by `materialize`, the one printed by
   `precheck`, and the one the wallet shows must all be equal. If they differ, do not sign.
4. **The nine addresses get baked into the new code.** A wrong one gives a stack that upgrades cleanly and
   breaks in use. `compute` cross-checks eight of them against the stack itself. The ninth,
   `KMS_VERIFIER_ADDRESS`, is checked only weakly: make sure it is **your** stack's verifier.
5. **The migration file decides the KMS nodes.** `compute` refuses it when the signers, context id or
   thresholds differ from the chain. It cannot check the tx senders, IPs and storage URLs: a wrong value
   there registers the wrong node. Read `--stage params` carefully.
6. **Do not change the stack between compute and verify.** No other upgrade, no ownership transfer, no
   pauser change. `materialize` refuses if a slot moved, and `verify` fails on any ownership or pauser
   event since the seal. A KMS signer rotation in that window also blocks `materialize`: start over.
7. **Never reseal once the creates are on chain.** To start over, use a new `outDir` and keep the same
   `deploymentId` (it must match the v12 manifest). The creates already sent are harmless: an unchanged
   build lands on the same addresses, and `creates` reports them as already present.
8. **Commit and push the seal (step 10) before step 11.** It is the only record of the pre-upgrade state.
   `verify` compares against it.
9. **Do not update the tool during an upgrade.** No `git pull` or `git checkout` in `~/src/fhevm-mocks`
   between step 10 and step 16. `precheck` and `verify` recompile and fail if the bytecode no longer
   matches the seal. `tool-commit.txt` says which commit to use if you ever need to resume.
10. **Pass at least one `--handle`.** Without one, verify proves the stack still works, not that existing
    data survived.
11. **What verify does not prove.** It checks every zero-argument getter, the handles you gave, the slots,
    the versions and the events. It does not check state keyed by arguments, such as ACL permissions
    (`isAllowed(handle, account)`).
12. **The rehearsal is a fork, not the chain.** It proves the payload works on today's state. Gas and
    ordering can still differ on the live chain.
13. **Testnets only.** The same chain allow-list and the same published-mnemonic warning as
    [DEPLOY.md](DEPLOY.md#3-warnings-and-security-notes) apply.
14. **Do not use the rehearsal flags on a live chain.** `--no-git`, `--no-confirm`, `--no-finality` and
    `--confirmations 0` exist for a local anvil only.
15. **Not yet battle-tested.** This path has been run end to end on a local anvil (`npm run test:upgrade`),
    not yet on a public testnet. Rehearse it on anvil first (see
    [GUIDE.md](GUIDE.md#v12--v13-upgrade-rehearsal)).
