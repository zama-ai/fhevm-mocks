# Upgrade a running cleartext FHEVM stack from v14 to v15

This guide upgrades a **live v14** cleartext FHEVM stack to v15, in place, on a public **testnet**. The
example chain is **Arbitrum Sepolia** (chain id `421614`).

What the upgrade does:

- creates 6 contracts through the CREATE2 factory: the 6 v15 implementations. No proxy is created — v15 adds
  no contract to the stack;
- re-points 6 proxies in **one atomic transaction** (`ACLOwner.upgrade`), sent by the current admin:
  `ACL`, `FHEVMExecutor`, `KMSVerifier`, `InputVerifier`, `ProtocolConfig`, `KMSGeneration`, each with its
  no-argument reinitializer. Nothing is migrated.

What it never touches: the addresses, the owner, the pausers, the KMS context and its signers and thresholds,
the coprocessor signers, `HCULimit`, `CleartextArithmetic`, and `CleartextDB` and its data.

You work with two folders:

| folder                                       | what it is                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `~/src/fhevm-mocks`                          | the tool. You install it once and never edit it                                  |
| `~/fhevm-deployments/arbsepolia-upgrade-v15` | **your upgrade folder**: your config, the seal, the journal. A git repo of yours |

Both paths are examples: put them wherever you like.

> ⚠️ **Testnets only.** The same rules as [DEPLOY.md](DEPLOY.md) apply: the chain must be a testnet **and**
> be listed in [`create2-deploy.config.json`](create2-deploy.config.json), in the tool folder.

To deploy a new stack instead, see [DEPLOY.md](DEPLOY.md). For the checklist and the reasoning behind each
check, see [upgrade/RUNBOOK.md](upgrade/RUNBOOK.md) and [README.md](README.md#upgrading-a-previous-generation-stack).

## Contents

1. [Requirements](#1-requirements)
2. [Step by step](#2-step-by-step)
   - [Step 1: install the tool](#step-1-install-the-tool)
   - [Step 2: create your upgrade folder](#step-2-create-your-upgrade-folder)
   - [Step 3: copy the v14 manifest](#step-3-copy-the-v14-manifest)
   - [Step 4: check who the admin is](#step-4-check-who-the-admin-is)
   - [Step 5: import the keys](#step-5-import-the-keys)
   - [Step 6: create a test handle](#step-6-create-a-test-handle)
   - [Step 7: write the config file](#step-7-write-the-config-file)
   - [Step 8: preview the init calls](#step-8-preview-the-init-calls)
   - [Step 9: compute and seal](#step-9-compute-and-seal)
   - [Step 10: create the new contracts](#step-10-create-the-new-contracts)
   - [Step 11: run the gate](#step-11-run-the-gate)
   - [Step 12: rehearse on a fork](#step-12-rehearse-on-a-fork)
   - [Step 13: materialize](#step-13-materialize)
   - [Step 14: verify](#step-14-verify)
   - [Step 15: commit the record](#step-15-commit-the-record)
   - [What your folder contains](#what-your-folder-contains)
   - [If something goes wrong](#if-something-goes-wrong)
3. [Warnings and security notes](#3-warnings-and-security-notes)

## 1. Requirements

| you need                                        | why                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Foundry (`forge`, `cast`, `anvil`)              | build, send, and fork the chain for the rehearsal                                        |
| Node.js ≥ 22.18, `git`, `make`, `jq`            | run the tool                                                                             |
| the v14 deploy's `manifest.json`                | the eleven live addresses and the `deploymentId`                                         |
| the **admin** key or multisig, with testnet ETH | the current owner of `ACLOwner`; it sends the upgrade, the biggest transaction of the run |
| a **deployer** key with testnet ETH             | sends the 6 creates; it gets no power over the stack                                     |
| an RPC that serves `eth_getLogs`                | verify reads the upgrade's events                                                        |

## 2. Step by step

### Step 1: install the tool

> ⚠️ **Use the `release/0.15.x` branch only.** Never `main` or another branch.

```sh
git clone --branch release/0.15.x --single-branch https://github.com/zama-ai/fhevm-mocks.git ~/src/fhevm-mocks
cd ~/src/fhevm-mocks
make install
```

Put the `upgrade-cli` command on your `PATH`, and check it runs:

```sh
export PATH="$HOME/src/fhevm-mocks/host-contracts-cleartext/v15/create2-deploy/upgrade:$PATH"
upgrade-cli --help
```

To have it in every new terminal, add the `export` line to `~/.zshrc` (or `~/.bashrc`).

### Step 2: create your upgrade folder

```sh
mkdir -p ~/fhevm-deployments/arbsepolia-upgrade-v15
cd ~/fhevm-deployments/arbsepolia-upgrade-v15
git init
git remote add origin <your git remote>
```

**Run every command from now on from this folder.**

### Step 3: copy the v14 manifest

Copy the `manifest.json` that was committed when the v14 stack was deployed:

```sh
cp <path to the v14 deploy>/manifest.json v14-manifest.json
jq '{chainId, deploymentId, admin, address}' v14-manifest.json
```

### Step 4: check who the admin is

```sh
RPC=https://sepolia-rollup.arbitrum.io/rpc
cast call "$(jq -r .address.ACL_OWNER v14-manifest.json)" 'owner()(address)' --rpc-url $RPC
```

This address is your `admin` in step 7.

### Step 5: import the keys

```sh
cast wallet import fhevm-deployer --interactive
cast wallet import fhevm-admin --interactive   # skip if the admin is a multisig
```

Both keys need testnet ETH: the deployer sends the 6 creates, and the admin key sends the upgrade itself
(step 13). A multisig admin pays its own gas.

```sh
cast balance "$(cast wallet address --account fhevm-deployer)" --rpc-url $RPC --ether
cast balance "$(cast wallet address --account fhevm-admin)" --rpc-url $RPC --ether   # admin key only
```

If the admin key has no ETH, the tool refuses to start step 13. The rehearsal (step 12) does not catch it:
on its fork, the admin is given ETH.

### Step 6: create a test handle

Optional, strongly recommended: it proves existing data survives the upgrade.

```sh
EXEC=$(jq -r .address.FHEVM_EXECUTOR_ADDRESS v14-manifest.json)
TOPIC=$(cast keccak 'TrivialEncrypt(address,uint256,uint8,bytes32)')
cast send $EXEC 'trivialEncrypt(uint256,uint8)' 42 5 --account fhevm-deployer --rpc-url $RPC --json \
  | jq -r --arg t $TOPIC '.logs[] | select(.topics[0] == $t) | "0x" + .data[-64:]'
```

Keep the printed `0x…` handle.

### Step 7: write the config file

Create `upgrade.config.json` in your upgrade folder, for example
`~/fhevm-deployments/arbsepolia-upgrade-v15/upgrade.config.json`:

```json
{
  "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc",
  "account": "fhevm-deployer",
  "admin": "0x<address from step 4>",
  "adminAccount": "fhevm-admin",
  "deploymentId": "<same deploymentId as in v14-manifest.json>",
  "outDir": "out",
  "confirmations": 3,
  "previousManifest": "v14-manifest.json",
  "handles": ["0x<handle from step 6>"]
}
```

- **Admin is a key:** `admin` is optional. Without it, the tool reads the address from `adminAccount`
  (one password prompt) and shows it in its first lines. With both, they must be the same account, or
  the tool refuses to start.
- **Admin is a multisig:** delete the `adminAccount` line. `admin` is then required.

`upgrade-cli` reads `upgrade.config.json` from the folder you run it in, so always run it from your
upgrade folder. If you open a new terminal, set `RPC` from step 4 again.

> ⚠️ **Paths in the config file are relative to the config file.** `"out"` and `"v14-manifest.json"` both mean
> files next to `upgrade.config.json`.
>
> | `"outDir"` in `upgrade.config.json`                              | result                                                                         |
> | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
> | `"out"`                                                          | ✅ OK: `out/` next to `upgrade.config.json`                                    |
> | `"/home/me/fhevm-deployments/arbsepolia-upgrade-v15/out"`        | ✅ OK: the same folder, written in full                                        |
> | `"~/fhevm-deployments/arbsepolia-upgrade-v15/out"`               | ❌ Not OK: `~` is not expanded in a JSON file. Write `"out"`, or the full path |
> | `"out"`, reused for a second upgrade                             | ❌ Not OK: one `outDir` per upgrade. Use a new upgrade folder                  |
> | `"/home/me/src/fhevm-mocks"` (or any folder containing the tool) | ❌ Not OK: the tool refuses to start                                           |

### Step 8: preview the init calls

```sh
upgrade-cli --stage params
```

It lists the six reinitializers the upgrade sends, one per re-pointed proxy, and says they take no arguments:
there is no migration file to write and nothing to seal beyond the addresses.

### Step 9: compute and seal

```sh
upgrade-cli --stage compute
```

You should see `11 addresses verified against the live stack`, then `wrote` followed by the full path of
`out/manifest.json`. The seal also records the stack's KMS context and epoch, its KMS and coprocessor signers
and thresholds, and every readable value of the v14 stack: `verify` holds the upgrade to all of them.

```sh
git add upgrade.config.json v14-manifest.json out/manifest.json out/addresses.sol
git commit -m "seal: upgrade <deploymentId>"
git push        # only if your repo has a remote
```

The seal also records which commit of the tool computed it.

### Step 10: create the new contracts

```sh
upgrade-cli --stage creates
```

You should see `created 6`. Before its first transaction, the tool checks that the seal is committed,
and pushed if your branch has an upstream. If not, it stops, sends nothing, and prints the git commands
to run.

### Step 11: run the gate

```sh
upgrade-cli --stage precheck
```

You should see `OK - every pre-materialize condition`. Note the `calldata keccak256` it prints. The gate
refuses a stack whose proxies are not all still initialized at their v14 versions — a stack that is not v14,
or one already upgraded.

### Step 12: rehearse on a fork

```sh
upgrade-cli --stage rehearse
```

You should see `REHEARSAL PASSED at block N`. Nothing is sent to the live chain.

### Step 13: materialize

**Admin is a key:**

```sh
upgrade-cli --stage materialize
```

You should see `6 proxies upgraded atomically`.

**Admin is a multisig:**

```sh
upgrade-cli --stage materialize
```

It prints `target`, `value 0`, `calldata` and `keccak`. In the multisig, send that calldata to that
target. Before signing, check that the wallet's digest equals the `keccak` printed here **and** the one
from step 11.

### Step 14: verify

```sh
upgrade-cli --stage verify
```

You should see `OK - every terminal condition for the upgrade`, `previous-generation getter readings survived`,
`pre-upgrade cleartext handle(s) survived` and `one atomic ACLOwner.upgrade, 6 ops`. Among the terminal
conditions: each re-pointed proxy is initialized at its v15 version, and the KMS context, epoch, signers and
thresholds and the coprocessor signers read as they did at the seal.

### Step 15: commit the record

```sh
git add out/journal.jsonl out/progress.jsonl out/verify-report.json
git commit -m "record: upgrade <deploymentId>"
git push
```

### What your folder contains

```text
arbsepolia-upgrade-v15/
├── upgrade.config.json    you wrote it                       commit it (step 9)
├── v14-manifest.json      copied from the v14 deploy         commit it (step 9)
└── out/
    ├── manifest.json      the seal, with the pre-upgrade snapshot   commit it (step 9)
    ├── addresses.sol      the generated config               commit it (step 9)
    ├── journal.jsonl      every transaction sent             commit it (step 15)
    ├── progress.jsonl     every step, including the checks   commit it (step 15)
    ├── verify-report.json the verify result                  commit it (step 15)
    ├── logs/              one transcript per command         optional
    ├── rehearsal/         the fork rehearsal's records       optional
    ├── build/, build-check/, broadcast/, .foundry/           do not commit
```

### If something goes wrong

| symptom                                | do                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| a stage was interrupted                | run the same command again                                                     |
| `precheck` or `rehearse` prints `FAIL` | nothing was sent. Read the line, fix it, go back to step 11                    |
| `materialize` reverts in simulation    | nothing was sent. The message names the failed check                           |
| `verify` says `no HostUpgraded event`  | the upgrade did not land. Run `upgrade-cli --stage status`, then step 13 again |
| `compute` refuses                      | contracts are already on chain. Resume at step 10, never reseal                |
| `status` shows `FATAL`                 | **stop.** Do not retry. Read [Warnings](#3-warnings-and-security-notes)        |
| you need to start over                 | a new `outDir` in the config file (keep the same `deploymentId`), then step 9  |

Steps 9 to 14 can also run as one command, once you trust the setup (admin key only):

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
4. **The eleven addresses get baked into the new code.** A wrong one gives a stack that upgrades cleanly and
   breaks in use. `compute` cross-checks eight of them against the stack itself. Three —
   `KMS_VERIFIER_ADDRESS`, `PROTOCOL_CONFIG_ADDRESS` and `KMS_GENERATION_ADDRESS` — are checked only weakly
   (right kind of contract, right version line): make sure they are **your** stack's.
5. **Nothing is migrated, so nothing may move.** Every reinitializer takes no arguments; `verify` requires the
   KMS context, epoch, signers and thresholds and the coprocessor signers to read as they did at the seal.
6. **Do not change the stack between compute and verify.** No other upgrade, no ownership transfer, no
   pauser change, no KMS rotation. `precheck` refuses if a proxy moved or is no longer at its v14 version,
   and `verify` fails on any ownership or pauser event since the seal, or on a KMS context that changed.
   Start over instead.
7. **Never reseal once the creates are on chain.** To start over, use a new `outDir` and keep the same
   `deploymentId` (it must match the v14 manifest). The creates already sent are harmless: an unchanged
   build lands on the same addresses, and `creates` reports them as already present.
8. **Commit and push the seal (step 9) before step 10.** It is the only record of the pre-upgrade state.
   `verify` compares against it.
9. **Do not update the tool during an upgrade.** No `git pull` or `git checkout` in `~/src/fhevm-mocks`
   between step 9 and step 15. `precheck` and `verify` recompile and fail if the bytecode no longer
   matches the seal. The seal records the tool's commit, and the tool refuses to send anything from
   another commit: it prints the `git checkout` that brings the tool back to the sealed one.
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
    [GUIDE.md](GUIDE.md#upgrade-rehearsal)).
