# forge-fhevm-std

FHEVM standard library for [Forge](https://getfoundry.sh). A companion to `forge-std`: helpers to encrypt inputs and
decrypt handles from Foundry tests and scripts.

| directory | contents                                                     |
| --------- | ------------------------------------------------------------ |
| `src/`    | Solidity sources: the cheat-code helpers and their interfaces |

## Install

The library has one dependency, `encrypted-types`, which holds the `euint*` / `externalE*` type declarations. It must
resolve to the **same** file that `@fhevm/solidity` resolves, otherwise the encrypted types of the two libraries are
distinct Solidity types and will not interoperate. Installing `@fhevm/solidity` with npm already puts that file in
`node_modules/encrypted-types/`, where Forge finds it without configuration.

### forge install

```sh
forge install zama-ai/forge-fhevm-std
```

No remapping to add: Forge maps `forge-fhevm-std/` to `lib/forge-fhevm-std/src/` on its own.

### npm

```sh
npm install @fhevm/forge-std
```

```toml
# foundry.toml
remappings = ["@fhevm/forge-std/=node_modules/@fhevm/forge-std/src/"]
```

### soldeer

```sh
forge soldeer install forge-fhevm-std~0.13.0
```

```toml
# foundry.toml
remappings = ["forge-fhevm-std/=dependencies/forge-fhevm-std-0.13.0/src/"]
```

## Use

```solidity
import {Test} from "forge-std/Test.sol";
import {euint64} from "encrypted-types/EncryptedTypes.sol";
import {StdFhevm} from "forge-fhevm-std/StdFhevm.sol";
```

## Run a test against a fresh anvil

A test can run against a real node instead of the in-memory stack. Anvil is the simplest case: fork it, and the
cleartext FHEVM stack is there — found if the node already has it, deployed by the library on first contact if not.
Nothing to deploy by hand, nothing to configure.

**1. Start a node** in one terminal. A plain `anvil` is enough; the default chain id (31337) is the one the FHE
library's config routes to the local addresses, so a contract compiled against `ZamaEthereumConfig` finds the stack.

```bash
anvil --port 8546
```

**2. Fork it from the test.** The only line that differs from an in-memory test is the fork, in `setUp`. The rest —
encrypt, call the contract, decrypt — is the same five lines as everywhere else.

```solidity
import {TestFhevm} from "forge-fhevm-std/TestFhevm.sol";
import {fhevm} from "forge-fhevm-std/FhevmVm.sol";

contract CounterOnAnvilTest is TestFhevm {
    Counter counter;
    address alice = makeAddr("alice");

    function setUp() public override {
        fhevm.createSelectFork(getFhevmChain("local", "anvil")); // the stack is ready when this returns
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

`getFhevmChain("local", "anvil")` resolves the RPC URL like forge-std's `getChain` does: an `[rpc_endpoints] anvil`
entry in `foundry.toml`, else the `ANVIL_RPC_URL` environment variable, else `http://127.0.0.1:8545`. Calling
`super.setUp()` is neither required nor harmful: the in-memory stack is deployed by the constructor, before any
`setUp` runs, and once a fork is selected the fork's stack is the current one — as in forge-std, the in-memory
chain is simply no longer where the test executes.

**3. Run it**, naming the node if it is not on the default port:

```bash
ANVIL_RPC_URL=http://127.0.0.1:8546 forge test --match-contract CounterOnAnvil
```

**What happens on first contact.** The library sees no code at the stack's addresses on the fork, checks the node
answers anvil's RPC namespace, deploys the cleartext stack into the fork (the same deploy the in-memory run does,
same deployer, same addresses), and then writes the result onto the node itself with `anvil_setCode`,
`anvil_setStorageAt` and `anvil_setNonce`, so the stack outlives the test: a second run, a script, or a relayer
pointed at the same node finds it and deploys nothing. A fresh anvil sits at block 0, which the executor's handle
derivation cannot use; the library moves the fork to block 1 and asks the node to mine one.

**Keeping the node untouched.** `fhevm.setAnvilMirror(false)` before the fork deploys the stack into the fork only.
The node then never changes, and every test that forks it pays the deploy again.

**A used node.** The stack deploys from one account at nonce 0, because every address derives from that sequence.
If the node has already used that account for something else, the fork refuses with a message that names the
account, the nonce it found and the fix: restart anvil, or fork a node that already holds the stack.

**Several tests, one node.** Forge runs the tests of one contract in parallel, and the node is shared between them.
The stack is deployed at most once per node whichever test gets there first, and every test then finds it; only an
assertion about the node's *own* state (its code, its nonces) would race, so make those about the fork instead.

Repository checkout only: `npm run test:anvil` starts a throwaway anvil on port 8546, runs the library's own anvil
suite, and stops it.

## Run the whole suite on a fork: `forge test --fork-url`

Forge can start every test on a fork before any constructor runs. The library handles that mode as a fork
nobody had to announce: `fhevm` takes the context it is born in as its baseline (no drift refusal), deploys
no in-memory stack onto the real chain, and resolves the chain's stack at the first call that names a
contract, exactly as after `fhevm.createSelectFork(url)` with a URL only. Anvil behind `--fork-url` is
provisioned like any anvil fork.

```bash
forge test --fork-url https://ethereum-sepolia-rpc.publicnode.com --fork-block-number 11743572 --match-contract MyForkTests
```

Pin the block with `--fork-block-number`: forge then caches every slot it fetches for that block on disk, and
the second run is served from the cache. `--block-number` is a different flag — it forks at the latest block
and only overrides the `block.number` the EVM reports, so nothing reusable is cached.

Two things follow. On a chain that carries several FHEVM stacks (Sepolia: `testnet` and `devnet`), a test's
FIRST library call must be one that names the dApp (`encryptUint32(…, address(dapp), …)`), or it is refused
as ambiguous; `fhevm.useStack(getFhevmChain("testnet", "sepolia"))` names the stack explicitly instead. And
tests written for the in-memory stack are not meant to run this way: pick them out with `--match-path`.

## Test on a chain that has no FHEVM protocol

Arbitrum, Base, or mainnet as it was before the deployment: a fork of a chain the SDK's chain table lists under
no network group. There is no live stack to point at, so the SDK brings its own — the cleartext stack, deployed
INTO THE FORK on first contact, at the canonical local addresses, with the fork's real chain id untouched.
Mainnet and Sepolia are refused here on purpose: a chain that has the protocol gets the live stack, never the
mock.

**1. Name the chain.** One alias, the one forge already knows — `[rpc_endpoints] arbitrum` in `foundry.toml`, or
`ARBITRUM_RPC_URL`. There is no default endpoint for a foreign chain.

```solidity
fhevm.createSelectFork(cleartextChain("arbitrum"));
```

**2. Build the dApp against the debug config.** A production dApp resolves its coprocessor addresses from
`block.chainid` in its constructor, through `@fhevm/solidity/config/ZamaConfig.sol`, and that table has no
entry for 42161. The dApp source is not touched; instead a dedicated build profile remaps that ONE file to this
package's `DebugZamaConfig.sol`, which resolves to the cleartext stack under the SDK — and reverts at
construction, on every chain, wherever the SDK's kernel is absent.

```toml
# foundry.toml — NEVER deploy from this profile
[profile.fhevm-debug]
out = "out-fhevm-debug"
cache_path = "cache-fhevm-debug"
remappings = ["@fhevm/solidity/config/ZamaConfig.sol=node_modules/@fhevm/forge-std/src/config/DebugZamaConfig.sol"]
```

```sh
ARBITRUM_RPC_URL=https://... FOUNDRY_PROFILE=fhevm-debug forge test --match-path "test/fork/*"
```

Then the test is the usual five lines: fork, `new`, encrypt, call, decrypt. The constructor runs under the real
chain id, so an `immutable` that copies `block.chainid` is right, and a handle minted in a constructor carries
42161 and reads back normally.

The debug build guards itself with forge alone, not with this package's kernel, so a dApp constructs the same
from `setUp`, from a test contract's field initializer, or from a factory the test deployed. And it is usable ONLY
where it was meant to be reached: under forge AND with `FOUNDRY_PROFILE=fhevm-debug`; a default build that imports
the file directly reverts at construction too.

**3. Keep the debug build out of production.** Its bytecode differs from the production build by the config
library and nothing else, and it defends itself: outside forge every constructor reverts with
`DebugConfigOnProductionChain`, under forge in any other profile with `DebugConfigOutsideDebugProfile`, and
every contract compiled against it carries the marker
`forge-fhevm-std DEBUG config: never deploy` in its bytecode. Add the check to the step that publishes
artifacts, against the `out/` a deploy script reads:

```sh
! grep -rl "$(printf 'forge-fhevm-std DEBUG config' | xxd -p | tr -d '\n')" out/ || { echo "debug config in production artifacts"; exit 1; }
```

On a chain the upstream table knows, the debug build resolves the same addresses as upstream, so a suite that
forks mainnet passes under either profile.

## Public RPC endpoints and forge's parallelism

Forge runs test contracts in parallel, and each forking test fetches the slots it touches over JSON-RPC as
it goes, so a suite of fork tests against a public endpoint can hit its rate limit (HTTP 429). Three things
help, in this order:

- **Pin the block** (`--fork-block-number`, or a block in `fhevm.createSelectFork(chain, block)`): after the
  first run every slot comes from forge's on-disk cache and the endpoint is not asked again.
- **Throttle forge**: `--threads 2` caps how many test contracts run at once, and so how many forks fetch in
  parallel; `npm run test:fork` and `npm run test:fork-url` set it. (`--compute-units-per-second`,
  `--fork-retries` and `--fork-retry-backoff` exist too, but forge accepts them only next to `--fork-url`, so
  they help the fork-url mode and not forks created by cheatcodes.)
- **Re-run without the cache**, when you suspect it: `forge test --no-storage-caching …` bypasses it for one
  run, `forge cache clean sepolia --blocks 11743572` deletes one block's entry, `forge cache clean sepolia`
  the chain's. A cold run against a public endpoint is where the 429s come from; a cached run never asks.
- **Use your own endpoint**, the forge-native way: an `[rpc_endpoints]` entry in `foundry.toml`
  (`sepolia = "https://…"`, or `sepolia = "${SEPOLIA_RPC_URL}"`), or the `SEPOLIA_RPC_URL` variable.
  `getFhevmChain` reads them in that order, like forge-std's `getChain`, before its built-in default. The
  library's own fork tests treat either as the opt-in to go online (`fhevm.hasRpcUrlFor("sepolia")`), and skip
  otherwise — the shared defaults are for a quick experiment, not a suite.

