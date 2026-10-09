# Deploy the cleartext FHEVM stack on a live testnet

This guide deploys a fresh v13 cleartext FHEVM stack (ACL, executor, verifiers, KMS, `ACLOwner`, ...) on a
public **testnet**, through the canonical CREATE2 factory.

> ℹ️ **As an example, every command below deploys on Arbitrum Sepolia**, the Arbitrum testnet (chain id
> `421614`, RPC `https://sepolia-rollup.arbitrum.io/rpc`). To deploy on another testnet, change only the
> RPC URL: `RPC` in step 5 and `rpcUrl` in step 6. The tool reads the chain from the RPC. Everything else
> stays the same.

The run sends about 30 transactions. At the end, the admin address you chose owns the stack, and the
deployer key owns nothing.

You work with two folders:

| folder                                   | what it is                                                       |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `~/src/fhevm-mocks`                      | the tool. You install it once and never edit it                  |
| `~/fhevm-deployments/arbsepolia-2026-10` | **your deployment folder**: your config, the seal, the journal. A git repo of yours |

Both paths are examples: put them wherever you like.

> ⚠️ **Testnets only.**
>
> The target chain must be **both**:
>
> 1. a **testnet**, and
> 2. **listed** in [`create2-deploy.config.json`](create2-deploy.config.json), in the tool folder.
>
> Every other chain is refused. A local anvil is always accepted, for rehearsals. Never add a mainnet to
> the file, for example Ethereum (`1`), Arbitrum One (`42161`) or Base (`8453`). A short list of well-known
> mainnets is also blocked in the code, so adding one of them to the file by mistake still fails.
>
> To use another testnet, add `{ "chainId": <id>, "name": "<name>" }` to `allowedChains` in that file. The
> chain must have the CREATE2 factory at `0x4e59b448…`; the run checks this before sending anything.
>
> See [Warnings](#3-warnings-and-security-notes).

To upgrade a stack that is already running, see [UPGRADE.md](UPGRADE.md). For the reasoning behind each
step, see [GUIDE.md](GUIDE.md) and [README.md](README.md).

## Contents

1. [Requirements](#1-requirements)
   - [1.1 Tools](#11-tools)
   - [1.2 Wallets](#12-wallets)
2. [Step by step](#2-step-by-step)
   - [Step 1: install the tool](#step-1-install-the-tool)
   - [Step 2: create your deployment folder](#step-2-create-your-deployment-folder)
   - [Step 3: create the deployer key](#step-3-create-the-deployer-key)
   - [Step 4: choose the admin](#step-4-choose-the-admin)
   - [Step 5: fund the keys](#step-5-fund-the-keys)
   - [Step 6: write the config file](#step-6-write-the-config-file)
   - [Step 7: compute the addresses](#step-7-compute-the-addresses)
   - [Step 8: commit and push the seal](#step-8-commit-and-push-the-seal)
   - [Step 9: deploy](#step-9-deploy)
   - [Step 10: check the result](#step-10-check-the-result)
   - [Step 11: commit the record](#step-11-commit-the-record)
   - [What your folder contains](#what-your-folder-contains)
   - [If something goes wrong](#if-something-goes-wrong)
3. [Warnings and security notes](#3-warnings-and-security-notes)
4. [Stages](#4-stages)

## 1. Requirements

### 1.1 Tools

| tool                             | version         |
| -------------------------------- | --------------- |
| [Foundry](https://getfoundry.sh) | `forge`, `cast` |
| [Node.js](https://nodejs.org)    | ≥ 22.18         |
| `git`, `make`, `jq`              | any             |

You also need a git remote you can push to.

### 1.2 Wallets

Two wallets, both funded with testnet ETH on the target chain:

| wallet       | what it does                                                                 | funds                 |
| ------------ | ---------------------------------------------------------------------------- | --------------------- |
| **deployer** | a keystore key. Sends every transaction except the last one (about 30)          | testnet ETH           |
| **admin**    | a second key, or a multisig. Sends one transaction at the end, to accept ownership of the stack. It owns the stack afterwards | a little testnet ETH (a multisig pays its own gas) |

They must be two different addresses. Steps 3 to 5 set them up.

## 2. Step by step

### Step 1: install the tool

> ⚠️ **Use the `release/0.13.x` branch only.** Never `main` or another branch.

```sh
git clone --branch release/0.13.x --single-branch https://github.com/zama-ai/fhevm-mocks.git ~/src/fhevm-mocks
cd ~/src/fhevm-mocks
make install
```

Put the `deploy-cli` command on your `PATH`, and check it runs:

```sh
export PATH="$HOME/src/fhevm-mocks/host-contracts-cleartext/v13/create2-deploy:$PATH"
deploy-cli --help
```

To have it in every new terminal, add the `export` line to `~/.zshrc` (or `~/.bashrc`).

### Step 2: create your deployment folder

```sh
mkdir -p ~/fhevm-deployments/arbsepolia-2026-10
cd ~/fhevm-deployments/arbsepolia-2026-10
git init
git remote add origin <your git remote>
```

**Run every command from now on from this folder.**

### Step 3: create the deployer key

```sh
cast wallet import fhevm-deployer --interactive
cast wallet address --account fhevm-deployer
```

### Step 4: choose the admin

The admin is the address that owns the stack at the end.

> ⚠️ **The admin MUST NOT be the deployer.** If `admin` equals the address of the `fhevm-deployer` key,
> the tool refuses to run. It stops at step 7, after its first build, with
> `FHEVM_ADMIN must differ from the deployer`. Nothing is sent.

- **A multisig:** note its address. Nothing to import.
- **A second key:** it needs testnet ETH too (step 5).

  ```sh
  cast wallet import fhevm-admin --interactive
  cast wallet address --account fhevm-admin
  ```

### Step 5: fund the keys

Send testnet ETH to the deployer, which sends about 30 transactions.

> ⚠️ **If the admin is a key, fund it too.** It sends one transaction itself, at the very end of step 9
> (step F, `acceptOwnership()`). A little testnet ETH is enough. If the admin key has no ETH, the tool
> refuses to start. A multisig admin pays its own gas: nothing to do.

```sh
RPC=https://sepolia-rollup.arbitrum.io/rpc
cast balance "$(cast wallet address --account fhevm-deployer)" --rpc-url $RPC --ether
cast balance "$(cast wallet address --account fhevm-admin)" --rpc-url $RPC --ether   # admin key only
```


### Step 6: write the config file

Create `deploy.config.json` in your deployment folder, for example
`~/fhevm-deployments/arbsepolia-2026-10/deploy.config.json`:

```json
{
  "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc",
  "account": "fhevm-deployer",
  "admin": "0x<admin address from step 4>",
  "adminAccount": "fhevm-admin",
  "deploymentId": "cleartext-v13-arbsepolia-2026-10",
  "outDir": "out",
  "confirmations": 3
}
```

- **Admin is a key:** `admin` is optional. Without it, the tool reads the address from `adminAccount`
  (one password prompt) and shows it in its first lines. With both, they must be the same account, or
  the tool refuses to start.
- **Admin is a multisig:** delete the `adminAccount` line. `admin` is then required.

`deploymentId` decides every address. The tool derives one CREATE2 salt per contract from it:
`keccak256(abi.encode("fhevm.cleartext", "0.13", deploymentId, <contract name>))`. The deployer key also
changes every address, because it is part of the ACL's creation code. Same `deploymentId` and same
deployer give the same addresses on every chain. A new `deploymentId` gives a new, separate set.

`deploy-cli` reads `deploy.config.json` from the folder you run it in, so always run it from your
deployment folder.

> ⚠️ **`"outDir"` is relative to the config file.** Keep it inside your deployment folder.
>
> | `"outDir"` in `deploy.config.json`        | result                                                              |
> | ----------------------------------------- | ------------------------------------------------------------------- |
> | `"out"`                                   | ✅ OK: `out/` next to `deploy.config.json`                           |
> | `"/home/me/fhevm-deployments/arbsepolia-2026-10/out"` | ✅ OK: the same folder, written in full                 |
> | `"~/fhevm-deployments/arbsepolia-2026-10/out"` | ❌ Not OK: `~` is not expanded in a JSON file. Write `"out"`, or the full path |
> | `"out"`, reused for a second deployment   | ❌ Not OK: one `outDir` per deployment. Use a new deployment folder  |
> | `"/home/me/src/fhevm-mocks"` (or any folder containing the tool) | ❌ Not OK: the tool refuses to start             |

### Step 7: compute the addresses

```sh
# from ~/fhevm-deployments/arbsepolia-2026-10
deploy-cli --stage compute
```

The last line is `sealed:` followed by the full path of `out/manifest.json`.

### Step 8: commit and push the seal

```sh
git add deploy.config.json out/manifest.json out/addresses.sol
git commit -m "seal: cleartext-v13-arbsepolia-2026-10"
git push        # only if your repo has a remote
```

The seal also records which commit of the tool computed it.

### Step 9: deploy

```sh
# from ~/fhevm-deployments/arbsepolia-2026-10
deploy-cli --stage all
```

- It reuses the seal of step 7: it does not compute again.
- Before its first transaction, it checks that the seal is committed, and pushed if your branch has an
  upstream. If not, it stops, sends nothing, and prints the git commands to run. Run them, then
  `deploy-cli --stage all` again.
- **Multisig admin:** the run stops at step F and prints a `cast send <ACL_OWNER> 'acceptOwnership()'`
  command. Have the multisig execute `acceptOwnership()` on that address. The run continues by itself
  once it lands.

You should see `OK - every terminal condition for the deploy`.

### Step 10: check the result

```sh
# from ~/fhevm-deployments/arbsepolia-2026-10
deploy-cli --stage status
deploy-cli --report
jq .address out/manifest.json
```

`status` should show every create `done`, and every step from A to F `done`.

### Step 11: commit the record

```sh
# from ~/fhevm-deployments/arbsepolia-2026-10
git add out/journal.jsonl
git commit -m "record: cleartext-v13-arbsepolia-2026-10"
git push
```

### What your folder contains

```text
arbsepolia-2026-10/
├── deploy.config.json     you wrote it               commit it (step 8)
└── out/
    ├── manifest.json      the seal: every address    commit it (step 8)
    ├── addresses.sol      the generated config       commit it (step 8)
    ├── journal.jsonl      every transaction sent     commit it (step 11)
    ├── build/             forge's compiled output    do not commit
    ├── broadcast/         forge's raw records        do not commit
    ├── cache/             forge's cache + RPC URL    never commit (may hold an API key)
    └── .foundry/          forge config for this run  do not commit
```

### If something goes wrong

| symptom                                     | do                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| the run was interrupted (Ctrl-C, RPC error) | run `deploy-cli --stage all` again                                          |
| `transaction(s) in the mempool`             | wait for them to be mined, then run the same command                    |
| `waiting for block ...`                     | nothing, it is waiting for finality                                     |
| `status` shows `FATAL` or `DRIFT`           | **stop.** Do not retry. Read [Warnings](#3-warnings-and-security-notes) |
| you want to start over                      | a new deployment folder, with a new `deploymentId`                      |

## 3. Warnings and security notes

1. **Never use this on a mainnet.** The KMS and coprocessor signer keys are derived from a **published**
   mnemonic. Anyone can sign decryptions and input proofs for this stack. That is the point on a testnet,
   and a total compromise anywhere else. The chain allow-list exists for this reason. Only ever add
   testnets to `create2-deploy.config.json`.
2. **The addresses can be replayed on any chain.** Anyone can deploy byte-identical contracts at the same
   addresses on another chain, mainnet included. Apps must check the **chain id**, not only the address.
3. **The deployer key is root until step F.** Until the admin accepts ownership, the deployer controls the
   whole stack. Finish the run, then keep the deployer key safe or retire it.
4. **Use keystores, never raw private keys.** The tool refuses a private key passed as `--account`. If you
   pasted one in a terminal, treat it as leaked.
5. **Double-check the admin address.** It receives root over the stack. Prefer a multisig. It cannot be
   the deployer.
6. **Commit and push the seal (step 8) before the first transaction.** The manifest holds the exact
   addresses. Without it, a half-finished deployment cannot be finished.
7. **One deployment folder per deployment.** Never delete it, and never reuse it for another chain or
   another `deploymentId`. Never reuse a `deploymentId` on the same chain with the same deployer: it
   points at the addresses of the stack that is already there.
8. **Never run `compute` again once a transaction has been sent.** To start over, use a new deployment
   folder and a new `deploymentId`. The old stack stays where it is.
9. **Do not update the tool during a deployment.** No `git pull` or `git checkout` in `~/src/fhevm-mocks`
   between step 7 and step 11. Every address depends on the compiled bytecode. The seal records the
   tool's commit, and the tool refuses to send anything from another commit: it prints the
   `git checkout` that brings the tool back to the sealed one.
10. **Run one invocation at a time.** Two runs in parallel, or a run while transactions are pending, waste
    gas and fail.
11. **Every stage waits for what it depends on to be final.** Whether you run `--stage all` or one stage
    at a time, a stage starts only once the earlier steps it needs are settled on chain (finalized, or
    `confirmations` deep). If they are not done at all, it stops and names what is missing.
12. **A `FATAL` in `status` is not resumable.** It means a proxy holds an implementation this deployment
    did not seal, or the stack is half-materialized. Retrying makes it worse. Stop and investigate.
13. **Do not use the rehearsal flags on a live chain.** `--no-git`, `--no-confirm`, `--no-finality` and
    `--confirmations 0` exist for a local anvil only.
14. **This is not the local-dev stack.** It does not land on the addresses `ZamaConfig.sol` expects on
    chain id `31337`. Use `scripts/deploy.sh` for local development.
15. **Not yet battle-tested.** This path has been run end to end on a local anvil, not yet on a public
    testnet. Rehearse it on anvil first (see [GUIDE.md](GUIDE.md#rehearsing-the-whole-thing-on-anvil)).

## 4. Stages

Run one with `deploy-cli --stage <stage>`. Every stage can be run again: what is already done is skipped.

| stage          | step | what it does                                                                        | sent by  |
| -------------- | ---- | ----------------------------------------------------------------------------------- | -------- |
| `compute`      |      | builds 3 times, computes every address, writes `out/manifest.json` (the seal)       | no tx    |
| `creates`      |      | deploys the 22 contracts through the CREATE2 factory                                | deployer |
| `pausers`      | A A′ | registers the pausers: `ACLOwner`, plus the optional `pauser` from the config       | deployer |
| `offer-acl`    | B    | offers ACL ownership to `ACLOwner`. Ownership does not move yet                     | deployer |
| `accept-acl`   | C    | `ACLOwner` accepts: ACL ownership moves to it                                       | deployer |
| `materialize`  | D    | points every proxy at its real implementation, in one atomic transaction            | deployer |
| `offer-admin`  | E    | offers `ACLOwner` to the admin. The deployer is still root                          | deployer |
| `accept-admin` | F    | the admin accepts: it owns the stack. With a multisig, waits for its transaction    | admin    |
| `verify`       |      | checks every final condition; fails if one is not met                               | no tx    |
| `all`          |      | the default: `compute` (skipped once anything was sent), `creates` to `accept-admin`, then `verify` | both |
| `status`       |      | reads the chain: what is done, what is left, and why                                | no tx    |
| `report`       |      | which steps ran, with their transactions. Local files only, no network. Also `--report` | no tx |
| `log`          |      | every transaction sent, in order. Local files only, no network                      | no tx    |

Add `--dry-run` to any single stage to simulate it without sending anything.
