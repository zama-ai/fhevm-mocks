# How to run the tests with the test engine

`fhevm-npm test-engine` runs the tests of the workspace, on a laptop and in CI, with the same command.

The engine reads an inventory: a JSON file, named `ALL_TESTS.json`, that lists every test with its
command and with the chains it uses. The engine knows nothing else about the workspace. It never
reads a package, a test file or the Makefile.

Run every command of this guide from the workspace root.

## Commands

```sh
./fhevm-npm-cli test-engine validate                          # check the inventory against its schema
./fhevm-npm-cli test-engine list                              # every test, with its state and its chains
./fhevm-npm-cli test-engine lanes --ci --max-lanes 4          # the lanes that a run would build
./fhevm-npm-cli test-engine run --ci --max-lanes 4            # what CI runs
./fhevm-npm-cli test-engine run --ci --max-lanes 1            # the same, one test at a time
./fhevm-npm-cli test-engine run --max-lanes 1 test-forge-std  # one test, by its ID
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --dry-run  # run nothing: print what would run
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --build "make compile"   # build first, then run
./fhevm-npm-cli test-engine check-report test-report.json     # check the report of a run
./fhevm-npm-cli test-engine ps                                # the nodes of the engine that still run
./fhevm-npm-cli test-engine kill --all                        # stop them
```

Add `--help` to a command to print its options.

## Give the engine its inventory

The engine reads `ALL_TESTS.json` at the workspace root, and its schema `ALL_TESTS.schema.json`
beside it. To use an inventory at another place, add `--inventory <file>` to any command. The inventory names its schema in its `$schema` key, and the
engine refuses an inventory that the schema does not accept.

The root is the folder that each test command starts from. It is the current folder, unless you give
`--root <dir>`.

Each test of the inventory has these fields:

| Field      | Meaning                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------- |
| `command`  | The shell command that runs the test, from the root.                                        |
| `package`  | The package that the test belongs to.                                                       |
| `ci`       | `true`: the CI selection holds the test. `false`: a run with `--ci` leaves it out.          |
| `skipped`  | `true`: no run runs the test, for now.                                                      |
| `duration` | How long the test takes: `fast` under one minute, `slow` up to ten, `very-slow` beyond.     |
| `chains`   | The chains that the test uses. Each one says where the chain runs, and who starts its node. |

To check an inventory after an edit, run `validate`.

## Select the tests of a run

Without any selection, a run holds every test of the inventory. Each of these keeps a part of it,
and they combine:

| Selection             | Keeps                                                         |
| --------------------- | ------------------------------------------------------------- |
| `<id> <id>`           | The tests with these IDs.                                     |
| `--ci`                | The tests with `"ci": true`.                                  |
| `--match <regex>`     | The tests whose ID matches this regular expression.           |
| `--chain <chainid>`   | The tests with a chain on this chain id.                      |
| `--runtime <runtime>` | The tests with a chain of this runtime, such as `forge-fork`. |

The engine never detects CI. A CI job passes `--ci`, and so do you, to run what CI runs.

To see what a selection holds before you run it, give the same selection to `list`:

```sh
./fhevm-npm-cli test-engine list --match 'forge-std'
```

```text
selected      test-forge-std           31337/local/forge
selected      test-forge-std-anvil     31337/local/anvil startedBy=runner fresh=true
unavailable   test-forge-std-fork-url  11155111/testnet/forge-fork  not set: SEPOLIA_RPC_URL
not-selected  test-hh-v3-template      31337/local/hardhat
```

| State          | Meaning                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| `selected`     | The run runs the test.                                                              |
| `skipped`      | The selection holds the test, and the test has `"skipped": true`.                   |
| `unavailable`  | The selection holds the test, and the RPC URL of one of its live chains is not set. |
| `not-selected` | The selection leaves the test out.                                                  |

## Set the environment variables

Some tests need a value that is yours, such as the RPC URL of a live chain. Write these values in a
file named `.env`, at the workspace root:

```sh
cp .env.example .env
```

Then open `.env` and fill in the values you have:

```sh
SEPOLIA_RPC_URL=https://...
MAINNET_RPC_URL=https://...
ARBITRUM_RPC_URL=https://...
```

Git ignores `.env`, so a key written there is never committed. `.env.example` is committed: it
lists the variables, with no value. Never write a key in it.

The engine reads `.env` before every `list`, `lanes` and `run`, and gives its variables to the
tests. It prints the names of the variables that the file sets, and never a value.

- A variable that your shell already exports wins over the file.
- A line with no value sets nothing.
- To read another file, add `--env-file <file>`.

You can also export a variable in the shell, or put it in front of the command, as in
`SEPOLIA_RPC_URL=https://... ./fhevm-npm-cli test-engine run ...`.

## Build before the tests

The tests need a built workspace. Build it yourself before the run, or give the build to the engine:

```sh
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --build "make compile"
```

The engine runs the command once, from the root, before any test. If the build fails, no test runs,
the engine writes no report, and it exits with status 2. The output of the build goes to `build.log`,
in the folder of the logs.

The unit tests of `fhevm-npm` are not in the inventory. They test the tool that runs the tests, the
engine included, so they run with the build: `make build` runs them, and `make compile` does not. To
run them alone, use `npm --prefix fhevm-npm test`.

## Run tests side by side

A run needs `--max-lanes <n>`. A lane is a list of tests that run one after the other, and the lanes
of a run go side by side. With `--max-lanes 1`, the run is serial: every test runs alone, in the
order of the inventory.

The engine builds the lanes from the inventory alone, so the same inventory, selection and maximum
give the same lanes on every machine:

1. Two tests that state a common fixed port conflict, and share a lane.
2. The tests that use a live chain, or a fork of one, all conflict, and share one lane. An RPC
   provider limits the requests that one key may send, so such tests never run at the same time.
3. The tests that send transactions on the same live chain share one lane, always: they sign with
   one account, and two transactions at the same time would take the same number.
4. The engine balances the lanes by the `duration` of their tests. A `slow` test weighs as much as
   20 `fast` tests, and a `very-slow` test as much as 60. A test with no `duration` weighs 20.

To print the lanes of a run without running it, give the same selection and maximum to `lanes`:

```sh
./fhevm-npm-cli test-engine lanes --ci --max-lanes 2 --match 'anvil|hh-v3'
```

```text
lane 1  port 8547  test-hh-v3-plugin -> test-hh-v3-e2e -> test-consumer-hh-v3-template -> test-forge-std-anvil-refusals
lane 2  port 8546,8548  test-hh-v3-template -> test-consumer-hh-v3-plugin-esm -> test-forge-std-anvil -> test-forge-std-anvil-mirror
```

If the plan of your RPC provider allows several tests at the same time, give the number with
`--live-chain-lanes <n>`, or set `FHEVM_TEST_LIVE_CHAIN_LANES` in `.env`. The engine then deals the
tests that use a live chain over `n` lanes. Without it, the number is 1.

A lane shows what its tests share: its fixed ports, and `live chains` for the lane of the tests that
use a live chain:

```text
lane 1  live chains  test-forge-std-fork-testnet -> test-forge-std-fork-resolve-mainnet -> ...
```

Add `--json` to get the lanes as JSON.

A run cannot be shorter than its longest test, whatever the maximum.

## Run the tests that need a live chain

A test that uses a live chain, or a fork of one, reads the RPC URL of that chain from one
environment variable:

| Chain            | Chain id | Variable           |
| ---------------- | -------- | ------------------ |
| Sepolia          | 11155111 | `SEPOLIA_RPC_URL`  |
| Ethereum mainnet | 1        | `MAINNET_RPC_URL`  |
| Arbitrum         | 42161    | `ARBITRUM_RPC_URL` |

To run these tests, give the engine the variables. See [Set the environment variables](#set-the-environment-variables).

If a variable is not set, or is empty, the engine does not start the tests that need it. Such a test
is `unavailable`: the run warns, names the variable, and goes on. Its exit status does not change.

To make a missing variable fail the run instead, add `--strict`. A strict run then stops before any
test starts.

The engine checks only that the variable is set. A test that forks at a fixed block needs an RPC
with archive state, and fails on one that has none.

A test whose chain has `"wallet": true` sends transactions, and spends real funds of the account it
uses. Each such test has `"ci": false`, so a run with `--ci` never holds it. To run one, name it by
its ID.

## Let the engine start the nodes

Some tests need a local node. For a chain with `"startedBy": "runner"`, the engine starts a new
`anvil` or Hardhat node on the port that the inventory states, waits until the node answers, runs
the test, and stops the node. The test command gets two variables:

| Variable        | Holds                                           |
| --------------- | ----------------------------------------------- |
| `ANVIL_RPC_URL` | The URL of the node, as `http://127.0.0.1:8546` |
| `ANVIL_PORT`    | The port of the node                            |

For a chain with `"startedBy": "test"`, the engine starts nothing: the test starts and stops its own
node, on the ports that the inventory states for it.

If a node does not start, or dies during its test, the test fails.

An interrupted run can leave a node of the engine behind. To list such nodes, and to stop them:

```sh
./fhevm-npm-cli test-engine ps
./fhevm-npm-cli test-engine kill --all
```

`ps` prints one line per node, with its GUID. `kill <guid>` stops one node. Both commands touch only
the nodes that the engine started, which carry the variable `FHEVM_GUID`.

## See what a run would do

Add `--dry-run` to a run. The engine prints the build command and one line per test, runs nothing,
and writes its report:

```sh
./fhevm-npm-cli test-engine run --max-lanes 1 --dry-run test-forge-std
```

```text
would run  lane 1  test-forge-std  $ FHEVM_SKIP_RPC_TESTS=true npm run --silent test -w @fhevm/forge-std-dev
```

## Run one test by hand

To run a test without the engine, take its command from a dry run, as above, and paste the part
after `$` in a terminal at the root.

The command then runs alone: nothing builds the workspace, and nothing starts a node. For a test
whose node the engine starts, start the node yourself on the port of the inventory first.

## Read the output of a run

A run prints one line when a test starts, one line when a test ends, and one summary line:

```text
▶ started  lane 4  test-forge-std
✅ passed  lane 4  test-forge-std  22.3s
❌ failed  lane 2  test-cleartext-v-cur  292.2s  log: test-logs/test-cleartext-v-cur.log
Run: 20 passed, 1 failed, 0 skipped, 0 unavailable, 34 not selected. Report: test-report.json
```

Every 30 seconds, the run also prints one line for each test that is still running, with the time
since the test started:

```text
⏳ running  lane 1  test-forge-std-internal-fork-testnet  1m30s
```

A forge test prints nothing while one of its functions runs, and a fork test can take minutes. These
lines show that such a test is still running. To change the interval, add `--progress <seconds>`.
`--progress 0` removes the lines.

To print the output of every test while it runs, with the ID of the test in front of each line, add
`--verbose`.

The run writes these files:

| File                      | Holds                                                 |
| ------------------------- | ----------------------------------------------------- |
| `test-report.json`        | The final report.                                     |
| `test-logs/<id>.log`      | The command of the test, and everything it printed.   |
| `test-logs/<id>.node.log` | The last 500 lines that the node of the test printed. |
| `test-logs/build.log`     | The output of the build, when the engine ran one.     |

To send them to another place, use these options, or the variable of the same row:

| Option                 | Variable                    | Default                   |
| ---------------------- | --------------------------- | ------------------------- |
| `--report <file>`      | `FHEVM_TEST_REPORT`         | `<root>/test-report.json` |
| `--logs <dir>`         | `FHEVM_TEST_LOGS`           | `<root>/test-logs/`       |
| `--node-log-lines <n>` | `FHEVM_TEST_NODE_LOG_LINES` | 500                       |

An option wins over a variable, and a variable wins over the default.

The exit status of a run says how it ended:

| Status | Meaning                                                                               |
| ------ | ------------------------------------------------------------------------------------- |
| 0      | Every test that ran passed.                                                           |
| 1      | At least one test failed.                                                             |
| 2      | The run itself failed: a wrong inventory, a failed build, or a strict run that stops. |

A failed test does not stop the others, and the engine never runs a test again.

## Stop a test that never ends

A test may take one hour. After that, the engine stops the test and everything it started, and the
test fails. To change the limit, add `--timeout <seconds>`. `--timeout 0` removes the limit.

## Check the report of a run

The report is a JSON file. It gives every test of the inventory one state:

| State          | Meaning                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| `passed`       | The test ran, and its command succeeded. In a dry run: the test would run.          |
| `failed`       | The test ran, and its command failed, or its node did, or it passed its time limit. |
| `skipped`      | The test has `"skipped": true`.                                                     |
| `unavailable`  | The RPC URL of a live chain of the test was not set. The report names the variable. |
| `not-selected` | The selection left the test out.                                                    |

A test that ran also has its duration in milliseconds, its lane, and its place in the lane.

To check a report without running anything:

```sh
./fhevm-npm-cli test-engine check-report test-report.json --inventory ALL_TESTS.json --ci
```

The command fails when a test has no valid state, when a test that ran has no duration, or when the
report and the inventory disagree. With `--ci`, it also fails when a test with `"ci": true` was not
selected, or when a test with `"ci": false` was.

## Add a test, or change one

1. Add or edit the entry of the test in `ALL_TESTS.json`.
2. For each chain with `startedBy`, state its `port`. Two tests that state a common fixed port never
   run at the same time, so give a test its own ports when it must run beside the others.
3. Run `validate`, then `list` and `lanes`, to see the state of the test and its lane.
4. Run the test alone, by its ID, with `--max-lanes 1`.

## Limits

- The engine has run on macOS only.
- A run uses one machine. The engine cannot yet split a selection over several machines.
