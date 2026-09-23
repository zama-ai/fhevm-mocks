# forge-fhevm-std

FHEVM standard library for [Forge](https://getfoundry.sh). A companion to `forge-std`: encrypt inputs, run your
contract, decrypt the result — in a normal `forge test`, no node to start, no mocks to wire up.

| directory | contents                                                       |
| --------- | --------------------------------------------------------------- |
| `src/`    | Solidity sources: the cheat-code helpers and their interfaces   |

## 1. Setup

### 1.1 Install

Pick one.

```sh
# npm
npm install @fhevm/forge-std
```

### 1.2 Remappings

```toml
# foundry.toml — npm
remappings = ["@fhevm/forge-std/=node_modules/@fhevm/forge-std/src/"]
```

### 1.3 Dependencies

- **`forge-std`** — remapped exactly as `forge-std/` (not `forge-std-1.11.0/`), matching `import {Vm} from "forge-std/Vm.sol";`.
- **`@fhevm/solidity`** 
- **`encrypted-types`** 

## 2. Quickstart: a contract, encrypted, in one minute using npm

Copy these four files into an empty folder and run `forge test`. That's the whole thing.

#### 2.1 `package.json`

```json
// package.json
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

#### 2.2 `foundry.toml`

```toml
# foundry.toml
[profile.default]
src = "src"
test = "test"
libs = []
solc_version = "0.8.24"
evm_version = "cancun"
```

#### 2.3 `remappings.txt`

```text
# remappings.txt
forge-std/=node_modules/forge-std/src/
@fhevm/forge-std/=node_modules/@fhevm/forge-std/src/
@fhevm/solidity/=node_modules/@fhevm/solidity/
encrypted-types/=node_modules/encrypted-types/
```

#### 2.4 `src/Counter.sol`

```solidity
// src/Counter.sol
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
        euint32 value = FHE.fromExternal(inputEuint32, inputProof);
        _count = FHE.add(_count, value);
        FHE.allowThis(_count);
        FHE.makePubliclyDecryptable(_count);
    }
}
```

#### 2.5 `test/Counter.t.sol`

```solidity
// test/Counter.t.sol
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
        (externalEuint32 v, bytes memory proof) = encryptUint32(5, address(counter), alice);
        vm.prank(alice);
        counter.increment(v, proof);
        assertEq(decryptPublic(counter.getCount()), 5);
    }
}
```

#### 2.6 Install

```sh
npm install
```

#### 2.7 Run the test

```sh
forge test
```

## 3. Run the tests, locally

```sh
forge test
```

That's it — no flags, no environment variables. This runs against the **in-memory stack**: the constructor of
`TestFhevm` deploys the whole cleartext FHEVM stack (ACL, executor, verifiers, KMS) into the test's own EVM
before `setUp` runs, at the fixed addresses `@fhevm/solidity`'s `ZamaEthereumConfig` already points at
(chain id `31337`). Nothing to start, nothing to fund, nothing to tear down.

```sh
forge test --match-path "test/Counter.t.sol"     # one file
forge test --match-test test_increment           # one test
forge test -vvv                                  # with traces, when something fails
```

## 5. Run on a fresh `anvil` — works out of the box

Point a test at a real node instead of the in-memory one, and the cleartext stack is simply *there*: found if
the node already has it, **deployed for you on first contact** if not. Nothing to deploy by hand, nothing to
configure — this is the one thing that "just works" the moment you fork.

**1. Start a node**, in one terminal:

```sh
anvil
```

**2. Fork it in `setUp`.** The only line that differs from the in-memory test above:

```solidity
import {fhevm} from "@fhevm/forge-std/FhevmVm.sol";

function setUp() public override {
    fhevm.createSelectFork(getFhevmChain("anvil")); // stack is ready when this returns
    counter = new Counter();
}
```

**3. Run it:**

```sh
forge test --match-path "test/Counter.t.sol"
```

If anvil is on a different port — `anvil --port 8546` — name it when you run the tests. Nothing in the test
changes:

```sh
ANVIL_RPC_URL=http://127.0.0.1:8546 forge test --match-path "test/Counter.t.sol"
```

Or set it once and keep running plain `forge test`:

```toml
# foundry.toml
[rpc_endpoints]
anvil = "http://127.0.0.1:8546"
```

What actually happens on first contact: the library sees no code at the stack's addresses, deploys the same
cleartext stack the in-memory run uses (same deployer, same addresses), then writes it onto the node itself
(`anvil_setCode` / `anvil_setStorageAt` / `anvil_setNonce`) so it survives — a second test run, a script, or a
teammate pointed at the same node finds it already there and deploys nothing. Every test that forks the same
node shares one deployment.

## 6. Run against a remote node that already has the Cleartext stack

Exactly the pattern above, pointed at a URL instead of `localhost` — a shared devnet, a teammate's machine, a
staging anvil in CI. If the stack is already deployed there **at the canonical addresses** (the same deploy
used locally and on a fresh anvil), nothing gets redeployed: the library finds it and uses it as-is.

```solidity
fhevm.createSelectFork(getFhevmChain("anvil")); // ANVIL_RPC_URL=https://your-shared-node:8545
```

or register your own alias so the URL has a name of its own:

```toml
# foundry.toml
[rpc_endpoints]
staging = "https://staging-node.internal:8545"
```

```solidity
fhevm.createSelectFork(cleartextChain("staging"));
```

If the remote stack is **not** at the canonical addresses (a custom deployment), name it explicitly instead —
see [§11, `StdFhevmChains`](#11-stdfhevmchains-naming-a-chain).

## 7. Run against a chain with no FHEVM protocol (e.g. Arbitrum)

Arbitrum, Base, or any chain the FHEVM protocol was never deployed to. There is no real stack to fork, so the
library brings its own cleartext one — deployed straight into the fork, keeping the fork's real chain id.

```sh
ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com FOUNDRY_PROFILE=fhevm-debug forge test --match-path "test/fork/*"
```

Two things make this work:

**1. Name the chain** by alias, in the fork:

```solidity
fhevm.createSelectFork(cleartextChain("arbitrum")); // ARBITRUM_RPC_URL, or [rpc_endpoints] arbitrum
```

Why this works where `getFhevmChain("arbitrum")` would not: `cleartextChain` *builds* a stack at the
canonical cleartext addresses instead of looking one up, so the alias only has to resolve a URL —
`[rpc_endpoints] arbitrum`, else `ARBITRUM_RPC_URL`, and Arbitrum has neither a chain-table entry nor a
default.

**2. Build against the debug config.** A production dApp resolves its coprocessor addresses from
`block.chainid` through `@fhevm/solidity`'s `ZamaConfig`, and that table has no entry for chain 42161. Add a
build profile that remaps *just that one file* to this library's `DebugZamaConfig.sol`, which knows about the
cleartext stack — and refuses to construct anywhere the library isn't present, so it can never be deployed by
mistake.

```toml
# foundry.toml — NEVER deploy from this profile
[profile.fhevm-debug]
out = "out-fhevm-debug"
remappings = ["@fhevm/solidity/config/ZamaConfig.sol=node_modules/@fhevm/forge-std/src/config/DebugZamaConfig.sol"]
```

Your contract's own source does not change at all. Under this one profile it deploys with a plain `new`;
under the default profile, on the same chain, it reverts — which is the correct behaviour for real deployments.
Mainnet and Sepolia always get the *real* stack, never this one: the library refuses to substitute a mock where
the real protocol exists.

## 8. HCU metering: caps, and reading what a call cost

Every FHE operation costs Homomorphic Complexity Units (HCU), capped per block, per transaction, and per
sequential handle chain ("depth"). Two cheats, one line each:

```solidity
disableHCUDepthLimit(); // only the depth cap is lifted, up to the per-tx cap
disableHCULimits();     // block, per-tx AND depth caps are all lifted — nothing is capped
```

Reach for `disableHCUDepthLimit()` first: it is the one that trips on a long dependent chain of FHE calls in a
single test (a loop of forty `FHE.add`s, say) and has the smallest blast radius. `disableHCULimits()` is for
when the test's own setup, not the thing being measured, would otherwise blow a cap.

**Reading what it cost.** One cheat, nothing to declare — assert on HCU the way you assert on gas:

```solidity
import {FhevmHCUMeter} from "@fhevm/forge-std/FhevmVm.sol";

vm.prank(alice);
counter.increment(v, proof); // the call under test

FhevmHCUMeter memory hcu = lastHCU();

assertLt(hcu.transaction, 20_000_000); // what the transaction cost in total
assertLt(hcu.maxHandle, 5_000_000);    // its deepest handle chain — the number the depth cap checks
```

Read *after* the call: both numbers clear on the first metered operation of a new transaction, so a
reading taken before it is the previous transaction's.

`lastHCU()` needs the meter, which only the variant this library deploys itself carries — the in-memory
stack, or one it auto-provisioned onto a node (§5, §6). A cleartext stack that came from somewhere else
runs the plain, non-metering implementation, exactly like the real network; there `lastHCU()` is refused
by name rather than quietly answering zero. The caps (`getMaxHCUPerTx` and friends) are ordinary getters
on the `HCULimit` and can be read directly on any stack.

## 9. Run against mainnet, or any production-ready FHEVM stack

Fork the real chain. The library resolves the real, deployed protocol there — no mock, no substitution — and
replays the fork's FHE events so your test can still decrypt what it computed.

```sh
MAINNET_RPC_URL=https://your-endpoint forge test --match-path "test/fork/*"
```

```solidity
fhevm.createSelectFork(getFhevmChain("mainnet")); // or getFhevmChain("testnet", "sepolia") for Sepolia
```

From here, everything is the same five lines as the in-memory test — encrypt, call, decrypt — *except* for
values the fork's replay never computed (a balance from before your test forked, say): see §10.

**Do not use a public endpoint for a real test suite.** `getFhevmChain(alias)` falls back to a shared public
RPC only as a convenience for a quick experiment; it rate-limits fast. Set your own:

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
```

Pin a block (`fhevm.createSelectFork(chain, blockNumber)`, or `--fork-block-number` in §12) so a re-run is
served from Forge's on-disk cache instead of asking the RPC again.

## 10. The `forkUnknown` problem: reading a balance the fork never computed

Forking a real chain gives you the real contracts and their real ciphertexts — but the mock's plaintext
*database* only knows values it watched get computed, replayed from events emitted after the fork was made. A
value some other user computed before you forked is a real ciphertext with **no known plaintext here**.

In your dApp it looks like this — a real confidential ERC-20, on a real fork:

```solidity
interface IConfidentialERC20 {
    function confidentialBalanceOf(address account) external view returns (euint64);
}

function test_readAnExistingHoldersBalance() public {
    fhevm.createSelectFork(getFhevmChain("mainnet"));
    IConfidentialERC20 token = IConfidentialERC20(realTokenAddress);

    euint64 balance = token.confidentialBalanceOf(someExistingHolder);
    plaintextOf(balance); // reverts — only the real coprocessor ever computed this value
}
```

Here it is self-contained and runnable, with a fabricated handle standing in for "a real ciphertext this
stack never saw computed" — copy it, run it, see the revert become a value:

```solidity
import {euint64} from "encrypted-types/EncryptedTypes.sol";
import {TestFhevm} from "@fhevm/forge-std/TestFhevm.sol";
import {fhevm} from "@fhevm/forge-std/FhevmVm.sol";

contract ForkUnknownTest is TestFhevm {
    function test_forkUnknown() public {
        fhevm.createSelectFork(getFhevmChain("mainnet"));

        // Stands in for a real token's `confidentialBalanceOf(...)`: a well-formed handle nothing here
        // ever computed, exactly what an existing holder's balance looks like right after you fork.
        euint64 balance = euint64.wrap(bytes32(uint256(1) << 16 | uint256(1)));

        assertFalse(hasPlaintext(balance)); // known, without reverting: nothing here computed this value
        // plaintextOf(balance); // would revert here — only the real coprocessor ever computed it

        // `forkUnknown` is how you tell the test what you already know to be true (from an explorer, a
        // prior off-chain decryption, or simply "this is a wallet I just funded, it's zero"). Once
        // stated, every later read of this exact handle agrees with it.
        forkUnknown(balance, uint64(1_000_000)); // "trust me, this decrypts to 1_000_000"
        assertEq(plaintextOf(balance), 1_000_000); // now it does
    }
}
```

Only state what you can actually justify — this is a test doubling as ground truth, not a way to make an
assertion pass.

## 11. `StdFhevmChains`: naming a chain

Every chain the library forks is named through this one struct, resolved the same way `forge-std`'s
`getChain` resolves a chain — `foundry.toml`, then an environment variable, then a built-in default:

```solidity
getFhevmChain("mainnet");                 // one argument: works when exactly one group serves the alias
getFhevmChain("testnet", "sepolia");      // two arguments: pick the group explicitly (Sepolia has two)
cleartextChain("arbitrum");               // a chain with NO real FHEVM protocol — the library's own mock
```

Sepolia is served by two FHEVM groups (`testnet` and `devnet`), so `getFhevmChain("sepolia")` picks one
default (`testnet`, the public one) — `getFhevmChain("devnet", "sepolia")` for the other, explicitly.

Registering your own chain — a custom devnet, or a remote cleartext deployment at non-canonical addresses
(§6) — uses the same struct:

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

`hasRpcUrlFor("sepolia")` checks whether an alias is actually configured (`[rpc_endpoints]` or
`<ALIAS>_RPC_URL`) without forking — the right guard for a test that should silently skip when nobody set up
a network to fork against:

```solidity
function setUp() public override {
    if (!fhevm.hasRpcUrlFor("sepolia")) return; // vm.skip(true) the tests instead of failing CI
    fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"));
}
```

## 12. Fork mode with `forge test --fork-url`

Forge can start every test on a fork before any constructor runs, instead of forking from inside `setUp`. The
library treats that exactly like a fork made with a URL alone: it resolves the stack at the first call that
names a contract.

```sh
forge test --fork-url https://ethereum-sepolia-rpc.publicnode.com --fork-block-number 11743572 --match-path "test/fork/*"
```

`--fork-block-number` pins the block (cached on disk after the first run — cheap re-runs). `--block-number` is
a different flag: it only overrides what `block.number` reports and forks at the latest block regardless, so
nothing is cached.

Two things to know:

- On a chain served by several FHEVM groups (Sepolia again), the test's *first* library call must either name
  the dApp (`encryptUint32(..., address(dapp), ...)`, which reads the dApp's own coprocessor config) or the
  test must call `fhevm.useStack(getFhevmChain("testnet", "sepolia"))` first — otherwise it's refused as
  ambiguous.
- `--fork-url` runs **every** test in the suite against that one fork, so keep in-memory-only tests out with
  `--match-path`/`--no-match-path`.

## Tips: public RPC endpoints and Forge's parallelism

Forge runs test contracts in parallel, and every forking test fetches over JSON-RPC as it goes — a suite of
fork tests against a public endpoint can hit its rate limit fast (`429`). In order of effort:

1. **Pin the block** (`--fork-block-number`, or `fhevm.createSelectFork(chain, block)`) — after the first run
   every slot is served from Forge's on-disk cache and the endpoint is never asked twice.
2. **Use your own RPC endpoint** — `[rpc_endpoints]` in `foundry.toml`, or `<ALIAS>_RPC_URL` — instead of the
   shared public default `getFhevmChain` falls back to.
3. **Throttle Forge**: `--threads 2` caps how many test contracts (and so how many forks) run at once.
4. **Clear a bad cache**, if you suspect one: `forge cache clean sepolia --blocks 11743572`, or
   `forge test --no-storage-caching` for one uncached run.
