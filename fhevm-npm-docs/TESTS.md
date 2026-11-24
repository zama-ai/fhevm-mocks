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
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --build "make build-ci-test-engine"  # the same gates and tests as `make ci`
./fhevm-npm-cli test-engine shards 3 --ci                     # which tests each of 3 machines would run
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --shard 2/3 # the share of machine 2 of 3
./fhevm-npm-cli test-engine check-report test-report.json     # check the report of a run
./fhevm-npm-cli test-engine duplicates --ci                   # find a test case that two tests run
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

| Field      | Meaning                                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`  | The shell command that runs the test, from the root.                                                                                          |
| `package`  | The package that the test belongs to.                                                                                                         |
| `ci`       | `true`: the CI selection holds the test. `false`: a run with `--ci` leaves it out.                                                            |
| `skipped`  | `true`: no run runs the test, for now.                                                                                                        |
| `duration` | How long the test takes: `fast` under one minute, `slow` up to ten, `very-slow` beyond.                                                       |
| `chains`   | The chains that the test uses. Each one says where the chain runs, and who starts its node.                                                   |
| `read`     | The resources that the test needs in their normal state. See [Keep a test away from a shared folder](#keep-a-test-away-from-a-shared-folder). |
| `write`    | The resources that the test alters while it runs, and puts back before it ends.                                                               |
| `list`     | A command that prints the cases the test selects. See [Run each test case once](#run-each-test-case-once).                                    |

To check an inventory after an edit, run `validate`. It checks the inventory against its schema. It
also refuses a command that names `SEPOLIA_RPC_URL`, `MAINNET_RPC_URL`, or `ARBITRUM_RPC_URL` when
the test does not declare that chain with the runtime `forge-fork` or `remote`. Every other command
of the engine makes the same checks before it does anything.

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

A build can take minutes and prints nothing on the terminal. So the engine prints the path of
`build.log` when the build starts, then one line every 30 seconds while it runs, as for a test:

```text
⏳ building  2m00s  log: /path/to/test-logs/build.log
```

To read the output while the build runs, use `tail -f test-logs/build.log`. `--progress 0` turns
these lines off.

The unit tests of `fhevm-npm` are not in the inventory. They test the tool that runs the tests, the
engine included, so they run with the build: `make build` runs them, and `make compile` does not. To
run them alone, use `npm --prefix fhevm-npm test`.

### Run the same gates and tests as `make ci`

`make ci` runs `make build-ci`, then its tests. To do the same with the engine, give it
`make build-ci-test-engine` as the build, and select the tests of CI:

```sh
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --build "make build-ci-test-engine"
```

`make build-ci-test-engine` runs the same gates as `make build-ci`, and keeps the folder `test-logs`.
Never give `make build-ci` to the engine: it runs `make clean`, which deletes `test-logs` while the
engine writes the log of the build there.

`make ci-test-engine` runs this command. To change the number of lanes, give it
`FHEVM_TEST_MAX_LANES`, as in `make ci-test-engine FHEVM_TEST_MAX_LANES=2`. Without it, the number
is 4. `make ci` still runs the tests without the engine, as `make ci-legacy` does.

Commit your work first: `make build-ci-test-engine` refuses a tree with uncommitted changes, and it
deletes every build output before it compiles.

Three make targets can serve as the build. Each one contains the one before it:

| Build                       | What it runs                                                                                                     | When to use it                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `make compile`              | The compile of every package                                                                                     | To run tests again while you edit             |
| `make build`                | `make compile`, after the formatting check, the lint of every package, and the unit tests of `fhevm-npm`         | For a full check of a tree with local changes |
| `make build-ci-test-engine` | `make build` from a clean tree, with the check of the generated files, and the checks before and after the build | In CI, and before a push                      |

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
4. Two tests that write the same resource share a lane. See
   [Keep a test away from a shared folder](#keep-a-test-away-from-a-shared-folder).
5. The engine balances the lanes by the `duration` of their tests. A `slow` test weighs as much as
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

## Keep a test away from a shared folder

Some tests change files that other tests use. `templates.test.ts` of a cleartext package is one: it
rebuilds the package with other addresses, checks the result, then puts everything back. For about
two minutes, a `forge test` in the same folder fails, or runs on wrong bytecode.

Two optional fields of a test say so. Each is a list of names:

```json
"test-cleartext-v-cur-templates":    { "write": ["host-contracts-cleartext/v14"] },
"test-cleartext-v-cur-fork-mainnet": { "read": ["host-contracts-cleartext/v14"] }
```

- `write`: while the test runs, it puts the resource in a state that no other test can use. When the
  test ends, the resource is back as it was.
- `read`: the test needs the resource in its normal state from its start to its end.

A name is free text, and here it is the folder of the package. The engine does not interpret it: two
tests share a resource when they state the same name.

| Two tests                                       | Can they run at the same time |
| ----------------------------------------------- | ----------------------------- |
| Both read the resource                          | Yes                           |
| One reads the resource, and the other writes it | No. One waits for the other.  |
| Both write the resource                         | No. They share a lane.        |
| They name no common resource                    | Yes                           |

A test that reads a resource stays in its own lane. Before a test starts, the engine takes all its
resources in one step. When another test holds one of them in a way that excludes it, the test
waits, and its lane with it:

```text
⏸ waiting  lane 3  test-cleartext-v-cur-templates  for a resource that test-hh-v2-plugin, test-hh-v2-template use
```

The tests that wait are served in the order they came. A reader that comes after a writer that
waits does not pass in front of it.

`validate` refuses two mistakes: a name that one test both reads and writes, and a name that a test
reads and that no test writes. The second one is most often a typing mistake.

A resource is of one machine: each shard has its own copy of the workspace, so two shards do not
wait for each other. At the end of a run, the time of a lane says how long it waited, apart from its
tests.

A test that alters a resource and does not put it back is outside these fields. It harms every later
test, whatever the lanes, and must be fixed.

## Run each test case once

A package can run in several tests of the inventory. The forge tests of `forge-fhevm-std` are one: the
offline suite is one test, and each group of fork tests is a test of its own, with its own chains. If
two of these tests select the same forge function, the function runs twice, and a fork test may then
call a live chain from a test that declares none.

Each such test uses two protections together:

1. **A filter.** The command of the larger test leaves out what the others run, as in
   `--no-match-path 'test/{fork,anvil,anvilMirror}/*'`. Each function is then selected by one test.
2. **A skip.** A fork test still skips itself when its RPC variable is not set, and
   `FHEVM_SKIP_RPC_TESTS=true` still skips the network tests of the offline suite. A function that a
   filter misses then skips, and does not call a live chain.

The filters can only be checked by listing what each test selects. The optional field `list` gives a
command that prints the cases of the test, one per line, and runs none of them. For a forge test, it
calls the same script as the command, with `FHEVM_TEST_LIST=1`:

```json
"test-forge-std-anvil": {
  "command": "npm run --silent test-engine:anvil -w @fhevm/forge-std-dev",
  "list": "FHEVM_TEST_LIST=1 npm run --silent test-engine:anvil -w @fhevm/forge-std-dev"
}
```

With `FHEVM_TEST_LIST=1`, `scripts/forge-test.sh` calls `forge test --list` with its arguments, and runs
no test. It needs no network and no node, and compiles what is not compiled yet. Each line names the
folder, the file, the contract and the function, and the profile when `FOUNDRY_PROFILE` sets one, so a
function of two packages or of two profiles gives two lines. The test and its list run the same filters,
so they cannot select different functions.

To check the CI tests, run this on a built workspace:

```sh
./fhevm-npm-cli test-engine duplicates --ci
```

The engine runs the list command of each selected test, one after the other, and runs no test. It
reads the tests that are unavailable too, since they run where their variables are set. On a built
workspace, the check takes about 20 seconds. It ends in one of three ways:

| Result                                         | Exit status |
| ---------------------------------------------- | ----------- |
| Each case is selected by one test              | 0           |
| A case is selected by two tests: it names both | 1           |
| A list command failed: no result               | 2           |

```text
❌ foundry/forge-fhevm-std/test/anvil/AnvilFork.t.sol:AnvilForkTest.test_forkAnvilAndTheStackIsThere  is selected by test-forge-std, test-forge-std-anvil
```

The check has two limits:

- It sees what a test selects, and not what runs: a selected case that skips itself counts. That is
  the intent, since a skip is the second protection and not the first.
- It finds a case that two tests select, and not a case that no test selects. A filter that leaves out
  more than the other tests run goes unnoticed.

## Name the scripts of the test engine

The inventory says which test runs, on which chains, in which folder. How a package selects its tests
belongs to the package. So the command of a test of `host-contracts-cleartext` or `forge-fhevm-std`
calls one script of its package, and the filters live in that script:

```json
"test-cleartext-v-cur-fork-mainnet": {
  "command": "npm run --silent test-engine:fork-mainnet -w @fhevm/host-contracts-cleartext-v14-dev",
  "list": "FHEVM_TEST_LIST=1 npm run --silent test-engine:fork-mainnet -w @fhevm/host-contracts-cleartext-v14-dev"
}
```

These scripts follow one convention, in every package:

1. A script that the inventory calls is named `test-engine:<name>`.
2. The main test of a package calls `test-engine:suite`. Every other test of the package has an ID made
   of the ID of the main test, a hyphen, and its name: `test-cleartext-v-cur-fork-mainnet` calls
   `test-engine:fork-mainnet`. So the same kind of test has the same name in every package.
3. When `test-engine:<name>` runs more than forge, its forge part is `test-engine:<name>:forge`, and the
   list command calls that part: vitest and `node --test` cannot list their tests without running them.
4. The list command calls the forge script of the command, with `FHEVM_TEST_LIST=1`.
5. The previous generation is frozen, and no script can be added to its `package.json`. Its scripts are
   in the root `package.json`, and its tests call them with no `-w`. The previous generation has every
   name of the current generation except `upgrade`. `test-cleartext-v-cur-upgrade` upgrades the previous
   generation to the current one, so only the current generation has it. At the next rotation, the
   current generation becomes the previous one with its scripts in place, and the scripts of the root
   are deleted.
6. Every `test-engine:` script is called by a test, and every test of a package that has a
   `test-engine:suite` script calls one. The only exception is the `upgrade` script of the previous
   generation: after a rotation, no test calls it any more.
7. A script names the RPC variable of a chain only when its test declares that chain. `validate` checks
   this for a command, and cannot see inside a script, so the convention test checks it for the
   scripts.

`fhevm-npm/test/all-tests-scripts.test.ts` checks the convention on the real files. `make build` runs it
with the other tests of `fhevm-npm`.

A script runs from the folder of its package, and needs no variable that the engine sets: the engine
gives a test the URL of its node in `ANVIL_RPC_URL`, and the URLs of its live chains.

`validate` refuses a command that names an RPC variable of a chain that the test does not declare. It
reads only the command, so it cannot see a variable that a script names. A script that needs the URL
of a chain that its test does not declare finds the variable empty when the engine runs it.

## Split a run over several machines

To run a selection on several machines, give each machine the same command with its own shard:
`--shard <k>/<n>`.

### What k and n mean

A shard is the share of the selection that one machine runs.

| Part | Meaning                                                           | Values        |
| ---- | ----------------------------------------------------------------- | ------------- |
| `n`  | How many machines share the selection: the number of shards.      | 1 or more     |
| `k`  | Which of those shares this machine runs: the number of its shard. | From 1 to `n` |

So `--shard 2/3` reads "this machine runs shard 2 of 3". The engine cuts the selection into 3 shards,
and runs the second one. Without `--shard`, a run is `1/1`: one machine runs the whole selection.

For example, take four tests: one `slow` test and three `fast` ones. With two machines, the `slow`
test is a shard of its own, since it weighs more than the three others together:

```sh
./fhevm-npm-cli test-engine lanes --max-lanes 2 --shard 1/2 test-cleartext-v-cur-upgrade test-hh-v3-plugin test-hh-v3-template test-hh-v3-e2e
```

```text
lane 1  port 8700,8714,8715  test-cleartext-v-cur-upgrade
```

```sh
./fhevm-npm-cli test-engine lanes --max-lanes 2 --shard 2/2 test-cleartext-v-cur-upgrade test-hh-v3-plugin test-hh-v3-template test-hh-v3-e2e
```

```text
lane 1  no shared resource  test-hh-v3-plugin -> test-hh-v3-e2e
lane 2  no shared resource  test-hh-v3-template
```

Machine 1 runs one test, and machine 2 runs the three others in two lanes. Each of the four tests
is in one shard, and in one only.

To see every shard at once, give the number of machines to `shards`, with the same selection:

```sh
./fhevm-npm-cli test-engine shards 2 test-cleartext-v-cur-upgrade test-hh-v3-plugin test-hh-v3-template test-hh-v3-e2e
```

```text
shard 1 of 2  1 test(s)  test-cleartext-v-cur-upgrade
shard 2 of 2  3 test(s)  test-hh-v3-plugin, test-hh-v3-template, test-hh-v3-e2e
```

`shards` runs nothing. It takes the selection of a run, and `--live-chain-lanes`. Add `--json` to
get the shards as JSON.

With three machines:

```sh
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --shard 1/3 --build "make build-ci-test-engine"   # machine 1
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --shard 2/3 --build "make build-ci-test-engine"   # machine 2
./fhevm-npm-cli test-engine run --ci --max-lanes 4 --shard 3/3 --build "make build-ci-test-engine"   # machine 3
```

Each machine builds once, runs its shard, and writes its own report.

Follow three rules, or the machines do not cover the selection:

1. Give every machine the same `n`.
2. Give each `k` from 1 to `n` to exactly one machine. A `k` that no machine runs leaves its tests
   unrun, and a `k` that two machines run runs its tests twice.
3. Give every machine the same selection and the same other options. The engine splits the selection
   from the inventory and from these options alone, so every machine then finds the same split.

`check-report` catches a mistake in any of the three: see the end of this section.

### How shards and lanes combine

`--shard` and `--max-lanes` are independent, and neither has to be larger than the other:

| Option        | Counts                          | Applies to          |
| ------------- | ------------------------------- | ------------------- |
| `--shard k/n` | Machines                        | The whole selection |
| `--max-lanes` | Tests that run at the same time | One machine         |

The engine first cuts the selection into `n` shards. Each machine then runs its shard in at most
`--max-lanes` lanes. With `--shard 2/3 --max-lanes 4`, machine 2 runs up to four tests at once, and
the three machines together up to twelve.

Choose `--max-lanes` for the machine, by its number of processors. Choose `n` for the selection: a
run lasts as long as its longest test, so more shards than long tests gain nothing.

### What goes to which shard

The engine balances the shards by the `duration` of their tests, as it does for the lanes:

- Tests that share only a fixed port can go to two shards: each machine has its own ports.
- Tests that use a live chain stay in one shard, since every machine uses the same RPC key. With
  `--live-chain-lanes <n>`, they can go to `n` shards at most.
- Tests that send transactions on the same live chain always stay in one shard.

To see the lanes of one shard without running it, give the same options to `lanes`:

```sh
./fhevm-npm-cli test-engine lanes --ci --max-lanes 4 --shard 3/3
```

In the report of a shard, a test that another shard runs is `not-selected`, with the number of that
shard. A shard that gets no test is valid: it runs nothing and passes.

When every machine has ended, collect the reports and check them together:

```sh
./fhevm-npm-cli test-engine check-report report-1.json report-2.json report-3.json --inventory ALL_TESTS.json --ci
```

The command fails when a shard has no report or has two, when the reports were not built from the
same inventory, selection and options, or when a selected test did not run in exactly one shard.

## Run the tests that need a live chain

A test that uses a live chain, or a fork of one, reads the RPC URL of that chain from one
environment variable:

| Chain            | Chain id | Variable           |
| ---------------- | -------- | ------------------ |
| Sepolia          | 11155111 | `SEPOLIA_RPC_URL`  |
| Ethereum mainnet | 1        | `MAINNET_RPC_URL`  |
| Arbitrum         | 42161    | `ARBITRUM_RPC_URL` |

To run these tests, give the engine the variables. See [Set the environment variables](#set-the-environment-variables).

A test gets the RPC URL of a chain only when its `chains` in the inventory hold that chain, with the
runtime `forge-fork` or `remote`. A test that declares no live chain gets none of the three
variables, even when they are set. So a suite that holds fork tests among its local ones skips
them, on your machine as on CI, and only the tests in the lane of the live chains call your RPC
provider. When you add a test that needs a live chain, declare the chain, or the test finds no URL. A test
that needs two live chains declares both.

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
would run  lane 1  test-forge-std  $ npm run --silent test-engine:suite -w @fhevm/forge-std-dev
```

## Run one test by hand

To run a test without the engine, take its command from a dry run, as above, and paste the part
after `$` in a terminal at the root.

The command then runs alone: nothing builds the workspace, and nothing starts a node. For a test
whose node the engine starts, start the node yourself on the port of the inventory first.

## Read the output of a run

A run prints one line when a test starts and one line when a test ends:

```text
▶ started  lane 4  test-forge-std
✅ passed  lane 4  test-forge-std  22.3s
❌ failed  lane 2  test-cleartext-v-cur  292.2s  log: test-logs/test-cleartext-v-cur.log
```

It ends with the time of each lane, the time of the run, and one summary line:

```text
lane 1  16 test(s)  4m25s
lane 2   7 test(s)  11m32s
lane 3   7 test(s)  13m10s, and waited 7m21s
lane 4   9 test(s)  10m48s
Build 5m37s, tests 20m31s, total 26m08s.
Run: 39 passed, 0 failed, 0 skipped, 4 unavailable, 13 not selected. Report: test-report.json
```

The time of a lane is the sum of its tests, which run one after the other. A lane can also wait, before
one of its tests, for a resource that a test of another lane holds, as
[Keep a test away from a shared folder](#keep-a-test-away-from-a-shared-folder) explains. The line
then adds how long the lane waited. A lane that never waited shows no wait.

The lanes run side by side, so the tests take as long as the longest lane, with its wait, and not as
long as all the lanes together. In the example, lane 3 took 13m10s and waited 7m21s: 20m31s, the time
of the tests. The total adds the build, when the engine ran one. The report holds the same times, in
`timing`, with `waitedMilliseconds` for each lane.

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
4. If the test belongs to a package with `test-engine:` scripts, add its script to the package, and
   name it as [Name the scripts of the test engine](#name-the-scripts-of-the-test-engine) says.
5. If the test runs part of the cases of a package that another test also runs, give it a `list`
   command, and run `duplicates`.
6. Run the test alone, by its ID, with `--max-lanes 1`.

## Limits

- The engine was written and run on macOS.
- The engine has run on Linux in a container only, on ARM. It has not run on a CI machine yet.
