# forge-fhevm-std

FHEVM standard library for [Forge](https://getfoundry.sh), a companion to `forge-std`.

It lets you test FHEVM contracts with a plain `forge test`. You encrypt the inputs, call your contract, and
decrypt the result, all inside the test. You don't start a node or wire up mocks.

```solidity
(externalEuint32 v, bytes memory proof) = encryptUint32(5, address(counter), alice); // 1. encrypt
vm.prank(alice);
counter.increment(v, proof);                                                        // 2. call
assertEq(decryptPublic(counter.getCount()), 5);                                     // 3. decrypt
```

| directory | contents                                                      |
| --------- | ------------------------------------------------------------- |
| `src/`    | Solidity sources: the cheat-code helpers and their interfaces |

## Contents

1. [How it works](#1-how-it-works)
2. [Requirements](#2-requirements)
3. [Quickstart: your first encrypted test, step by step](#3-quickstart-your-first-encrypted-test-step-by-step)
4. [Adding the library to an existing Foundry project](#4-adding-the-library-to-an-existing-foundry-project)
5. [Writing tests: encrypt, call, decrypt](#5-writing-tests-encrypt-call-decrypt)
6. [Running the tests](#6-running-the-tests)
7. [Choosing where your tests run](#7-choosing-where-your-tests-run)
8. [Run on a local `anvil` node](#8-run-on-a-local-anvil-node)
9. [Run against a remote node that already has the cleartext stack](#9-run-against-a-remote-node-that-already-has-the-cleartext-stack)
10. [Run against a chain with no FHEVM protocol (e.g. Arbitrum)](#10-run-against-a-chain-with-no-fhevm-protocol-eg-arbitrum)
11. [Run against mainnet, Sepolia, or any production FHEVM stack](#11-run-against-mainnet-sepolia-or-any-production-fhevm-stack)
12. [The `forkUnknown` problem: values the fork never computed](#12-the-forkunknown-problem-values-the-fork-never-computed)
13. [HCU metering: limits, and measuring what a call cost](#13-hcu-metering-limits-and-measuring-what-a-call-cost)
14. [`StdFhevmChains`: naming a chain](#14-stdfhevmchains-naming-a-chain)
15. [Fork mode with `forge test --fork-url`](#15-fork-mode-with-forge-test---fork-url)
16. [Tips: public RPC endpoints and Forge's parallelism](#16-tips-public-rpc-endpoints-and-forges-parallelism)
17. [Troubleshooting](#17-troubleshooting)

## 1. How it works

On the real network, FHE computation runs off-chain on a coprocessor, and decryption goes through a KMS. You
can't reproduce either inside a unit test.

This library deploys a **cleartext FHEVM stack** instead: the ACL, the FHE executor, the input and KMS
verifiers, and the KMS. It behaves like the real protocol, including its permission checks, but keeps every
value in cleartext so a test can check what an encrypted computation produced.

- Your contract source doesn't change. It inherits `ZamaEthereumConfig` from `@fhevm/solidity` as usual.
- Your test inherits `TestFhevm` instead of forge-std's `Test`. `TestFhevm` extends `Test`, so `vm`,
  `assertEq`, `makeAddr` and the rest all still work.
- `TestFhevm`'s constructor deploys the cleartext stack before `setUp` runs, at the fixed addresses
  `ZamaEthereumConfig` already points at on chain id `31337`.
- To run against a real node or chain, fork it with `fhevm.createSelectFork(...)`, described in
  [§7](#7-choosing-where-your-tests-run).

## 2. Requirements

| tool                                   | why                                                          |
| -------------------------------------- | ------------------------------------------------------------ |
| [Foundry](https://getfoundry.sh)       | `forge` compiles and runs the tests                          |
| [Node.js](https://nodejs.org) with npm | installs this library and its Solidity dependencies          |
| `solc` 0.8.24, EVM version `cancun`    | set in `foundry.toml`; Forge downloads the compiler for you |

This library needs the following Solidity packages, all installed through npm and each reached through a
remapping:

| package           | remapping prefix   | what it provides                                     |
| ----------------- | ------------------ | ---------------------------------------------------- |
| `@fhevm/solidity` | `@fhevm/solidity/` | `FHE`, the encrypted types, and `ZamaEthereumConfig` |
| `encrypted-types` | `encrypted-types/` | the `euintXX` / `externalEuintXX` types used by tests |
| `forge-std`       | `forge-std/`       | `Test`, `Vm` and the rest of forge-std               |

> **`forge-std` must be remapped exactly as `forge-std/`**, not `forge-std-1.11.0/` or any other name. The
> library imports it as `import {Vm} from "forge-std/Vm.sol";`, and any other prefix fails to compile.

## 3. Quickstart: your first encrypted test, step by step

This walkthrough builds a working project from an empty folder. At the end you'll have a confidential
counter and a test that encrypts a value, adds it on-chain, and checks the decrypted result.

### Step 1: create the project folder

```sh
mkdir hello-fhevm && cd hello-fhevm
mkdir src test
```

### Step 2: declare the dependencies (`package.json`)

```json
{
  "name": "hello-fhevm",
  "private": true,
  "dependencies": {
    "@fhevm/forge-std": "^0.13.0",
    "@fhevm/solidity": "^0.13.3",
    "encrypted-types": "^0.0.4",
    "forge-std": "git+https://github.com/foundry-rs/forge-std.git#v1.11.0"
  }
}
```

`forge-std` comes from its git tag because it isn't published on npm.

### Step 3: configure Forge (`foundry.toml`)

```toml
[profile.default]
src = "src"
test = "test"
libs = []
solc_version = "0.8.24"
evm_version = "cancun"
```

- `libs = []`: every dependency lives in `node_modules` and is reached through `remappings.txt`, so Forge
  doesn't need to search a `lib/` folder.
- `evm_version = "cancun"`: the FHEVM contracts require it.

### Step 4: tell Forge where each import lives (`remappings.txt`)

```text
forge-std/=node_modules/forge-std/src/
@fhevm/forge-std/=node_modules/@fhevm/forge-std/src/
@fhevm/solidity/=node_modules/@fhevm/solidity/
encrypted-types/=node_modules/encrypted-types/
```

Each line maps an import prefix to a folder. For example, `import "@fhevm/forge-std/TestFhevm.sol"`
resolves to `node_modules/@fhevm/forge-std/src/TestFhevm.sol`.

### Step 5: write the contract (`src/Counter.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract Counter is ZamaEthereumConfig {
    euint32 private _count;

    function getCount() external view returns (euint32) {
        return _count;
    }

    function increment(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        euint32 value = FHE.fromExternal(inputEuint32, inputProof); // verify and import the encrypted input
        _count = FHE.add(_count, value);                            // add, still encrypted
        FHE.allowThis(_count);                                      // let this contract reuse _count later
        FHE.makePubliclyDecryptable(_count);                        // let anyone decrypt it
    }
}
```

This is an ordinary FHEVM contract. It contains nothing specific to testing.

### Step 6: write the test (`test/Counter.t.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {externalEuint32} from "encrypted-types/EncryptedTypes.sol";
import {TestFhevm} from "@fhevm/forge-std/TestFhevm.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is TestFhevm {
    Counter internal counter;
    address internal alice = makeAddr("alice");

    function setUp() public override {
        super.setUp();
        counter = new Counter();
    }

    function test_increment() public {
        // 1. Encrypt 5 as alice, for this counter. Returns the encrypted handle and its proof.
        (externalEuint32 v, bytes memory proof) = encryptUint32(5, address(counter), alice);

        // 2. Send the transaction as alice. The input was encrypted for her, so she must be the sender.
        vm.prank(alice);
        counter.increment(v, proof);

        // 3. Decrypt the result. This works because the contract called FHE.makePubliclyDecryptable.
        assertEq(decryptPublic(counter.getCount()), 5);
    }
}
```

What each part does:

| line                                        | purpose                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `contract CounterTest is TestFhevm`         | inherit `TestFhevm` instead of `Test`; its constructor deploys the cleartext stack |
| `super.setUp()`                             | keep this call when you override `setUp`, as you would with `Test`                |
| `encryptUint32(5, address(counter), alice)` | encrypt `5`, bound to the contract that consumes it and the user who sends it     |
| `vm.prank(alice)`                           | the input proof is only valid when `msg.sender` is the user it was encrypted for  |
| `decryptPublic(...)`                        | decrypt a handle the contract marked publicly decryptable                         |

### Step 7: install the dependencies

```sh
npm install
```

### Step 8: run the test

```sh
forge test
```

You should see:

```text
[PASS] test_increment() (gas: ...)
Suite result: ok. 1 passed; 0 failed; 0 skipped
```

## 4. Adding the library to an existing Foundry project

1. **Install the packages:**

   ```sh
   npm install @fhevm/forge-std @fhevm/solidity encrypted-types
   ```

   If `forge-std` isn't already reachable as `forge-std/`, add it too:

   ```sh
   npm install "forge-std@git+https://github.com/foundry-rs/forge-std.git#v1.11.0"
   ```

2. **Add the remappings.** Put them in `remappings.txt`:

   ```text
   forge-std/=node_modules/forge-std/src/
   @fhevm/forge-std/=node_modules/@fhevm/forge-std/src/
   @fhevm/solidity/=node_modules/@fhevm/solidity/
   encrypted-types/=node_modules/encrypted-types/
   ```

   Or put them in `foundry.toml`:

   ```toml
   [profile.default]
   remappings = [
     "forge-std/=node_modules/forge-std/src/",
     "@fhevm/forge-std/=node_modules/@fhevm/forge-std/src/",
     "@fhevm/solidity/=node_modules/@fhevm/solidity/",
     "encrypted-types/=node_modules/encrypted-types/",
   ]
   ```

   Keep your existing `forge-std/` remapping if you already have one, as long as it uses exactly that prefix.

3. **Set the compiler options** in `foundry.toml`: `solc_version = "0.8.24"` (or later) and
   `evm_version = "cancun"`.

4. **Switch your FHE tests** from `is Test` to `is TestFhevm`, importing it from
   `@fhevm/forge-std/TestFhevm.sol`.

## 5. Writing tests: encrypt, call, decrypt

Every FHE test has the same three steps.

### 5.1 Encrypt an input

```solidity
(externalEuint32 v, bytes memory proof) = encryptUint32(42, address(myContract), alice);
```

There is one helper per type. Each returns the `externalEXXX` handle and the `bytes` input proof, which you
pass straight to your contract.

| helper                               | encrypts  | returns                     |
| ------------------------------------ | --------- | --------------------------- |
| `encryptBool(value, contract, user)` | `bool`    | `(externalEbool, bytes)`    |
| `encryptUint8(...)`                  | `uint8`   | `(externalEuint8, bytes)`   |
| `encryptUint16(...)`                 | `uint16`  | `(externalEuint16, bytes)`  |
| `encryptUint32(...)`                 | `uint32`  | `(externalEuint32, bytes)`  |
| `encryptUint64(...)`                 | `uint64`  | `(externalEuint64, bytes)`  |
| `encryptUint128(...)`                | `uint128` | `(externalEuint128, bytes)` |
| `encryptUint256(...)`                | `uint256` | `(externalEuint256, bytes)` |
| `encryptAddress(...)`                | `address` | `(externalEaddress, bytes)` |

The two addresses matter, exactly as on the real network:

- `contract` is the contract that calls `FHE.fromExternal`.
- `user` must be `msg.sender` of that call, so `vm.prank(user)` before calling.

To pass several inputs under a single proof, use `encryptValues(...)`.

### 5.2 Call your contract

Use regular Solidity calls and forge cheats such as `vm.prank` and `vm.startPrank`. Nothing changes here.

### 5.3 Read the result

Choose a helper based on what your contract allows:

| helper                               | use it when                                                                    | checks permissions? |
| ------------------------------------ | ------------------------------------------------------------------------------ | ------------------- |
| `decryptPublic(handle)`              | the contract called `FHE.makePubliclyDecryptable(handle)`                      | yes                 |
| `decrypt(handle, contract, userKey)` | the contract called `FHE.allow(handle, user)`: user decryption, as in a dApp UI | yes                 |
| `decrypt(handle, contract, "alice")` | same, naming the user by their `makeAddr` label instead of a private key       | yes                 |
| `plaintextOf(handle)`                | you only want to check the arithmetic, whatever the permissions                | no                  |
| `hasPlaintext(handle)`               | you want to know whether a value can be read, without reverting                | no                  |

A user-decryption test looks like this:

```solidity
(address alice, uint256 aliceKey) = makeAddrAndKey("alice");
// ... the contract ran FHE.allowThis(result) and FHE.allow(result, alice) ...
assertEq(decrypt(myContract.result(), address(myContract), aliceKey), 203);
```

Use `decryptPublic` or `decrypt` to check that the right people can read a value. They revert when the
contract forgot an `FHE.allow` or a `makePubliclyDecryptable`, which is a bug worth catching. Use
`plaintextOf` when only the math matters.

## 6. Running the tests

```sh
forge test
```

No flags or environment variables are needed. By default every test runs against the **in-memory stack**
deployed in the test's own EVM. Nothing needs to be started, funded, or torn down.

Common variations:

```sh
forge test --match-path "test/Counter.t.sol"   # one file
forge test --match-test test_increment         # one test
forge test -vvv                                # show traces, useful when a test fails
```

## 7. Choosing where your tests run

By default, tests use the in-memory stack. To run against a real node, fork it in `setUp`. The rest of the
test (encrypt, call, decrypt) stays the same.

| where                                     | how you fork                                         | FHEVM stack used                             | section |
| ----------------------------------------- | ---------------------------------------------------- | -------------------------------------------- | ------- |
| in memory (default)                       | nothing                                              | cleartext, deployed in the test EVM          | §6      |
| local `anvil`                             | `fhevm.createSelectFork(getFhevmChain("anvil"))`     | cleartext, deployed onto the node if missing | §8      |
| remote node with the cleartext stack      | same, with `ANVIL_RPC_URL` or an alias               | the node's existing cleartext stack          | §9      |
| chain without FHEVM (Arbitrum, Base, ...) | `fhevm.createSelectFork(cleartextChain("arbitrum"))` | cleartext, deployed into the fork            | §10     |
| mainnet, Sepolia                          | `fhevm.createSelectFork(getFhevmChain("mainnet"))`   | the **real** deployed protocol               | §11     |

Always fork through **`fhevm.createSelectFork`**, not `vm.createSelectFork`. The rule is: fork and read logs
through `fhevm`, and do everything else through `vm`. Import the handle with:

```solidity
import {fhevm} from "@fhevm/forge-std/FhevmVm.sol";
```

## 8. Run on a local `anvil` node

When you point a test at a local node, the cleartext stack is already there. If the node has it, the library
uses it. If not, the library **deploys it on first contact**. You don't deploy or configure anything by hand.

**Step 1: start a node** in a separate terminal:

```sh
anvil
```

**Step 2: fork it in `setUp`.** This is the only change from the in-memory test:

```solidity
import {fhevm} from "@fhevm/forge-std/FhevmVm.sol";

function setUp() public override {
    super.setUp();
    fhevm.createSelectFork(getFhevmChain("anvil")); // the stack is ready when this returns
    counter = new Counter();
}
```

**Step 3: run the tests:**

```sh
forge test --match-path "test/Counter.t.sol"
```

**If anvil runs on another port** (for example `anvil --port 8546`), give the URL when you run the tests.
The test doesn't change:

```sh
ANVIL_RPC_URL=http://127.0.0.1:8546 forge test --match-path "test/Counter.t.sol"
```

Or set it once in `foundry.toml` and keep running plain `forge test`:

```toml
[rpc_endpoints]
anvil = "http://127.0.0.1:8546"
```

**What happens on first contact:**

1. The library finds no code at the stack's addresses.
2. It deploys the same cleartext stack the in-memory run uses, with the same deployer and the same addresses.
3. It writes the stack onto the node itself (`anvil_setCode`, `anvil_setStorageAt`, `anvil_setNonce`), so the
   stack stays there after the test ends.

A second test run, a script, or a teammate using the same node then finds the stack and deploys nothing. All
tests that fork the same node share one deployment.

## 9. Run against a remote node that already has the cleartext stack

This works like §8, with a URL in place of `localhost`: a shared devnet, a teammate's machine, a staging anvil
in CI. If the stack is already deployed there **at the canonical addresses** (the same deployment used
locally and on a fresh anvil), the library uses it as-is and redeploys nothing.

**Option A: reuse the `anvil` alias** and override its URL:

```solidity
fhevm.createSelectFork(getFhevmChain("anvil"));
```

```sh
ANVIL_RPC_URL=https://your-shared-node:8545 forge test
```

**Option B: give the node its own alias** in `foundry.toml`:

```toml
[rpc_endpoints]
staging = "https://staging-node.internal:8545"
```

```solidity
fhevm.createSelectFork(cleartextChain("staging"));
```

If the remote stack is **not** at the canonical addresses (a custom deployment), register its addresses
explicitly. See [§14](#14-stdfhevmchains-naming-a-chain).

## 10. Run against a chain with no FHEVM protocol (e.g. Arbitrum)

Arbitrum, Base, and many other chains have no FHEVM protocol deployed, so there's no real stack to fork. The
library deploys its own cleartext stack straight into the fork and keeps the fork's real chain id.

**Step 1: fork the chain by alias with `cleartextChain`:**

```solidity
fhevm.createSelectFork(cleartextChain("arbitrum")); // URL from [rpc_endpoints] arbitrum, else ARBITRUM_RPC_URL
```

Why not `getFhevmChain("arbitrum")`? `getFhevmChain` *looks up* a known FHEVM deployment, and Arbitrum has
none. `cleartextChain` *builds* a stack at the canonical cleartext addresses, so the alias only has to
resolve to a URL.

**Step 2: build against the debug config.** A production dApp finds its coprocessor addresses from
`block.chainid`, through `@fhevm/solidity`'s `ZamaConfig`. That table has no entry for Arbitrum (chain
42161), so the dApp's constructor would revert.

To fix this, add a build profile that remaps just that one file to this library's `DebugZamaConfig.sol`,
which knows about the cleartext stack:

```toml
# foundry.toml — NEVER deploy from this profile
[profile.fhevm-debug]
out = "out-fhevm-debug"
remappings = ["@fhevm/solidity/config/ZamaConfig.sol=node_modules/@fhevm/forge-std/src/config/DebugZamaConfig.sol"]
```

**Step 3: run with that profile:**

```sh
ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com FOUNDRY_PROFILE=fhevm-debug forge test --match-path "test/fork/*"
```

Your contract's source doesn't change:

- Under `fhevm-debug`, it deploys with a plain `new`.
- Under the default profile, on the same chain, it reverts, which is correct for a real deployment.
- `DebugZamaConfig` refuses to construct anywhere the library isn't present, so it can't be deployed by
  mistake. The profile's own `out` folder keeps its artifacts away from your deploy scripts.
- Mainnet and Sepolia always get the *real* stack, never this one. The library refuses to substitute a mock
  where the real protocol exists.

## 11. Run against mainnet, Sepolia, or any production FHEVM stack

Fork the real chain. The library uses the real deployed protocol with no substitution. It replays the fork's
FHE events so your test can still decrypt what it computed.

**Step 1: set an RPC endpoint** in `foundry.toml`:

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
```

**Step 2: fork in `setUp`:**

```solidity
fhevm.createSelectFork(getFhevmChain("mainnet"));            // Ethereum mainnet
fhevm.createSelectFork(getFhevmChain("testnet", "sepolia")); // Sepolia
```

**Step 3: run:**

```sh
MAINNET_RPC_URL=https://your-endpoint forge test --match-path "test/fork/*"
```

From here, you encrypt, call, and decrypt exactly as in the in-memory test. The exception is values the
replay never computed, such as a balance that existed before the fork. See §12.

> **Use your own RPC endpoint for a real test suite.** Without one, `getFhevmChain(alias)` falls back to a
> shared public RPC. That's fine for a quick experiment, but public RPCs rate-limit fast.

**Pin a block** with `fhevm.createSelectFork(chain, blockNumber)`, or `--fork-block-number` (§15). Re-runs are
then served from Forge's on-disk cache instead of the RPC.

## 12. The `forkUnknown` problem: values the fork never computed

When you fork a real chain, you get the real contracts and their real ciphertexts. But the library only knows
the plaintext of values it saw being computed, replayed from events emitted **after** the fork. A value that
someone computed before you forked is a real ciphertext with **no known plaintext** in your test.

In a dApp test, it looks like this:

```solidity
interface IConfidentialERC20 {
    function confidentialBalanceOf(address account) external view returns (euint64);
}

function test_readAnExistingHoldersBalance() public {
    fhevm.createSelectFork(getFhevmChain("mainnet"));
    IConfidentialERC20 token = IConfidentialERC20(realTokenAddress);

    euint64 balance = token.confidentialBalanceOf(someExistingHolder);
    plaintextOf(balance); // reverts: only the real coprocessor ever computed this value
}
```

**The fix:** tell the test what you know to be true with `forkUnknown`. You might know it from a block
explorer, from an earlier off-chain decryption, or because it's a wallet you just funded. After that, every
read of that exact handle returns the value you stated.

A self-contained, runnable version, using a made-up handle to stand in for a real ciphertext:

```solidity
import {euint64} from "encrypted-types/EncryptedTypes.sol";
import {TestFhevm} from "@fhevm/forge-std/TestFhevm.sol";
import {fhevm} from "@fhevm/forge-std/FhevmVm.sol";

contract ForkUnknownTest is TestFhevm {
    function test_forkUnknown() public {
        fhevm.createSelectFork(getFhevmChain("mainnet"));

        // Stands in for a real token's `confidentialBalanceOf(...)`: a well-formed handle that nothing
        // here ever computed, like an existing holder's balance right after you fork.
        euint64 balance = euint64.wrap(bytes32(uint256(1) << 16 | uint256(1)));

        assertFalse(hasPlaintext(balance)); // check without reverting: the value is unknown
        // plaintextOf(balance);           // would revert here

        forkUnknown(balance, uint64(1_000_000));   // "this handle decrypts to 1_000_000"
        assertEq(plaintextOf(balance), 1_000_000); // now it does
    }
}
```

> Only state values you can justify. `forkUnknown` declares ground truth for the test. It isn't a way to make
> an assertion pass.

## 13. HCU metering: limits, and measuring what a call cost

Every FHE operation costs Homomorphic Complexity Units (HCU). The protocol caps HCU at three levels:

- per block,
- per transaction,
- per sequential chain of dependent operations ("depth").

### 13.1 Lifting the caps

```solidity
disableHCUDepthLimit(); // lifts only the depth cap (the per-transaction cap still applies)
disableHCULimits();     // lifts all three caps: block, per-transaction and depth
```

Try `disableHCUDepthLimit()` first. The depth cap is the one a long chain of dependent FHE calls in a single
test trips (a loop of forty `FHE.add`s, for example), and this cheat changes the least. Use
`disableHCULimits()` when your test's *setup*, not the code under test, would otherwise hit a cap.

### 13.2 Measuring HCU

Assert on HCU the way you assert on gas:

```solidity
import {FhevmHCUMeter} from "@fhevm/forge-std/FhevmVm.sol";

vm.prank(alice);
counter.increment(v, proof); // the call under test

FhevmHCUMeter memory hcu = lastHCU(); // read AFTER the call

assertLt(hcu.transaction, 20_000_000); // total HCU of the transaction
assertLt(hcu.maxHandle, 5_000_000);    // its deepest chain of dependent operations: what the depth cap checks
```

Things to know:

- **Read after the call.** Both numbers reset at the first metered operation of a new transaction, so a
  reading taken before the call shows the previous transaction's cost.
- **`lastHCU()` needs the metering stack**, which only the library's own deployment carries: the in-memory
  stack, or one it deployed onto a node (§8, §9). A cleartext stack deployed by other means runs the plain,
  non-metering implementation like the real network. There, `lastHCU()` reverts with an explicit error
  instead of returning zero.
- The caps themselves (`getMaxHCUPerTx` and friends) are ordinary getters on the `HCULimit` contract, and you
  can read them on any stack.

## 14. `StdFhevmChains`: naming a chain

Every chain the library forks is described by one struct. It resolves a chain the same way forge-std's
`getChain` does: first `foundry.toml`, then an environment variable, then a built-in default.

```solidity
getFhevmChain("mainnet");            // one argument: when exactly one FHEVM group serves that chain
getFhevmChain("testnet", "sepolia"); // two arguments: name the group explicitly
cleartextChain("arbitrum");          // a chain with NO real FHEVM protocol: uses the library's own stack
```

**Groups.** Sepolia is served by two FHEVM groups, `testnet` (the public one) and `devnet`.
`getFhevmChain("sepolia")` picks `testnet` by default. Use `getFhevmChain("devnet", "sepolia")` to get the
other one.

**RPC URL lookup.** For an alias like `sepolia`, the URL comes from:

1. `[rpc_endpoints] sepolia = "..."` in `foundry.toml`, else
2. the `SEPOLIA_RPC_URL` environment variable (`<ALIAS>_RPC_URL`, upper-cased), else
3. a built-in public default, where one exists (for quick experiments only, see §16).

**Registering your own chain**, such as a custom devnet or a remote cleartext deployment at non-canonical
addresses (§9):

```solidity
setFhevmChain("my-devnet", FhevmChainData({
    fhevmGroup: "local",
    chainId: 123456,
    rpcUrl: "https://my-devnet.internal:8545",
    relayerUrl: "",
    acl: 0x0000000000000000000000000000000000000001,
    fhevmExecutor: 0x0000000000000000000000000000000000000002,
    inputVerifier: 0x0000000000000000000000000000000000000003,
    kmsVerifier: 0x0000000000000000000000000000000000000004,
    protocolConfig: 0x0000000000000000000000000000000000000005,
    decryption: 0x0000000000000000000000000000000000000006,
    inputVerification: 0x0000000000000000000000000000000000000007
}));

fhevm.createSelectFork(getFhevmChain("local", "my-devnet"));
```

**Skipping when no network is configured.** `fhevm.hasRpcUrlFor("sepolia")` checks whether an alias has a URL
(through `[rpc_endpoints]` or `<ALIAS>_RPC_URL`) without forking. Use it to skip fork tests where no RPC is
configured, instead of failing CI:

```solidity
function setUp() public override {
    super.setUp();
    if (!fhevm.hasRpcUrlFor("sepolia")) {
        vm.skip(true); // no Sepolia RPC configured: skip instead of failing
        return;
    }
    fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"));
}
```

## 15. Fork mode with `forge test --fork-url`

Instead of forking inside `setUp`, you can have Forge start every test on a fork, before any constructor
runs. The library treats this like a fork made from a URL alone: it resolves the stack at the first call that
names a contract.

```sh
forge test --fork-url https://ethereum-sepolia-rpc.publicnode.com --fork-block-number 11743572 --match-path "test/fork/*"
```

- `--fork-block-number` pins the block. After the first run, state is cached on disk, so re-runs are cheap.
- Don't confuse it with `--block-number`. That flag only changes what `block.number` reports, still forks at
  the latest block, and caches nothing.

Two things to watch for:

- **Chains served by several FHEVM groups** (Sepolia again). The library must know which group to use, so
  either the test's *first* library call names the dApp (`encryptUint32(..., address(dapp), ...)` reads the
  dApp's own coprocessor config), or the test calls `fhevm.useStack(getFhevmChain("testnet", "sepolia"))`
  first. Otherwise the call reverts as ambiguous.
- **`--fork-url` applies to every test in the run.** Use `--match-path` or `--no-match-path` to keep
  in-memory-only tests out of it.

## 16. Tips: public RPC endpoints and Forge's parallelism

Forge runs test contracts in parallel, and every fork test fetches state over JSON-RPC as it runs. A suite of
fork tests against a public endpoint can quickly hit its rate limit (HTTP `429`). Try these, cheapest first:

1. **Pin the block** with `--fork-block-number` or `fhevm.createSelectFork(chain, block)`. After the first run,
   every storage slot comes from Forge's on-disk cache, and the endpoint is never asked twice.
2. **Use your own RPC endpoint**, set in `[rpc_endpoints]` in `foundry.toml` or `<ALIAS>_RPC_URL`, instead of
   the shared public default.
3. **Throttle Forge** with `--threads 2`, which caps how many test contracts (and so how many forks) run at
   once.
4. **Clear a bad cache** if you suspect one: `forge cache clean sepolia --blocks 11743572`, or
   `forge test --no-storage-caching` for a single uncached run.

## 17. Troubleshooting

**`Source "forge-std/Vm.sol" not found`.** `forge-std` isn't remapped as exactly `forge-std/`. Fix the
remapping (§2).

**The contract call reverts right after `encryptXXX`.** Either the sender isn't the user the input was
encrypted for, or the contract address doesn't match. Add `vm.prank(user)` before the call, and pass the
address of the contract that calls `FHE.fromExternal`.

**`decryptPublic` reverts.** The contract never called `FHE.makePubliclyDecryptable` on that handle. Fix the
contract, or use `plaintextOf` if you only want to check the math.

**`decrypt(..., user)` reverts.** The contract must call both `FHE.allowThis(handle)` and
`FHE.allow(handle, user)`. Also check that the key or label matches that user.

**`plaintextOf` reverts on a fork.** The value was computed before the fork. See §12.

**A long test hits an HCU limit.** Call `disableHCUDepthLimit()`, or `disableHCULimits()` (§13).

**The dApp constructor reverts on a chain without FHEVM.** Build with the `fhevm-debug` profile (§10).

**An "ambiguous" error on Sepolia.** Name the group with `getFhevmChain("testnet", "sepolia")`, or call
`fhevm.useStack(...)` when using `--fork-url` (§15).

**HTTP `429` on fork tests.** You hit a rate limit. See §16.

**VS Code shows `File outside of allowed directories` on `@fhevm/forge-std/...` imports.** This happens when
`@fhevm/forge-std` is installed from a local `file:` path. `node_modules/@fhevm/forge-std` is then a symlink
to a folder outside your project, and the Solidity extension refuses to follow it. Install a copy instead
with `npm install --install-links`, then reload the window. `forge` itself isn't affected.
