# A cleartext stack on a fork of a chain that has no FHEVM protocol

Status: IMPLEMENTED THROUGH §5 (2026-09-22). §1.1–1.4, §2.1–2.6, §3, §4 landed; §5 run with `ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com` under both profiles — results in the closing note of this file. confidential-defi is re-run under its default profile only: its soldeer pin predates `DebugZamaConfig.sol`, so its own `fhevm-debug` profile waits for a re-pin.
tree; each ends with the command that proves it.

## 0. What this is, and what it is not

The SDK forks natively: `fhevm.createSelectFork(chain)` points a test at the forked chain's LIVE host
contracts and replays their events. That is the right target wherever the protocol is deployed, and it is
proven on mainnet (confidential-defi, 20 fork tests, 2026-09-22).

It leaves one case with no answer: a fork of a chain that has NO FHEVM protocol — Arbitrum, Base, or mainnet
as it was before the deployment — where a test wants to add FHE on top of DeFi that exists there. The live
mode has nothing to point at, and the old `forge-fhevm` trick (rewrite the chain id to 31337 in `setUp`,
deploy the mock, leave the lie in place) is exactly what the SDK refuses to do.

Two things are missing, plus one small one behind them:

1. **Provision the cleartext stack INSIDE an in-memory fork.** Today the SDK deploys it onto a fork only
   when the node behind the fork is anvil (`_provisionLocalStack` → `LibForgeFhevmAnvil.isAnvilNode()`);
   a fork straight from a chain's RPC stops with `stackMissing`.
2. **Let production dApp code find that stack.** A dApp built on upstream `ZamaConfig` reverts in its
   constructor on a chain id the config does not list. The answer is a DEBUG config, reached only through a
   dedicated build profile, that resolves to the cleartext stack under the SDK and REVERTS AT CONSTRUCTION
   on every real chain — so a debug artifact deployed by mistake cannot exist on chain. The dApp source is
   untouched; only the build differs, and the build says so in four independent ways (§2).
3. Render the RPC-alias resolution failure in the SDK's own style (rules.md 2.11).

### Decisions taken as defaults

| Decision | Default | Why |
|---|---|---|
| Where the mock may go | **Only where no live stack exists.** Refused, by chain-table lookup, on any chain id the table lists under a network group. | The mock over mainnet or Sepolia would shadow the real protocol; the live mode already serves them. |
| Chain id | **Never touched.** The fork keeps its real chain id for the whole test, constructors included. | Handles, input verification, EIP-712 domains and anything a constructor snapshots all read `block.chainid`; the OLD harness's defect was changing it. A "construction window" that flips it around `new` was considered and dropped: too much state to maintain across every SDK entry, and it breaks constructors that mint handles. |
| Mirroring | **Off for an in-memory fork** (nothing to mirror onto); unchanged for anvil. | `provision(mirror)` already takes the flag. |
| Naming | `cleartextChain(alias)` for step 1; `DebugZamaConfig.sol` and profile `fhevm-debug` for step 2. | The word "debug" must be in the file, the profile, the marker and the error, so nothing about this build looks like production. |
| Debug build divergence | **Config library only.** Same library and contract names, same functions, upstream branches verbatim; one added branch and one added revert. | The property "bytecode under test == bytecode deployed" is given up ONLY for the address table, and the build carries a marker so a CI step can prove which one it holds. |
| What the user types | **One alias, the one forge already knows.** `cleartextChain("arbitrum")` reads `[rpc_endpoints] arbitrum` / `ARBITRUM_RPC_URL`; the chain id, the group and the canonical addresses are the SDK's business. | A dApp developer must never learn where the cleartext stack lives or that `local` is a group. |

### Facts these steps rest on (verified 2026-09-22)

- No host chain id is baked into the cleartext bytecode: no `31337` in the sources; the executor mints
  handles and signs computations with `block.chainid` at runtime; the input verifier compares against
  `block.chainid`; the verifiers' EIP-712 domains pin the GATEWAY chain id, a constant, by protocol design.
- The bootstrap deployer `0x8B8f…0DF4` has nonce 0 on Arbitrum One and on Ethereum mainnet, so the canonical
  local addresses are free there (`DEPLOYER_START_NONCE = 0`).
- Experiment on an anvil forked from Arbitrum One (chain id 42161): the SDK provisioned the stack on first
  contact; the production `FHECounterPublicDecrypt` reverted on plain `new`, deployed under a scoped
  `vm.chainId(31337)` / `vm.chainId(42161)`, then encrypt → increment → `decryptPublic` passed and the
  resulting handle carried chain id 42161 in bytes 22..29.
- `LibForgeFhevmAnvil.provision` already splits "deploy in the fork" from "mirror onto the node": the deploy
  is `LibForgeFhevmStack.deployLocalFhevm()` under a state-diff recording; the mirror replays the diff.

## 1. Provision the cleartext stack in an in-memory fork

Kernel only (`FhevmVm.sol`), plus one fail message.

1. Split `_provisionLocalStack(chain)` into the decision and the deploy:
   - Keep the canonical-address check and the deployer-nonce check as they are.
   - Replace `if (!canonical || !isAnvilNode()) revert stackMissing` by: canonical or revert; then
     `isAnvilNode() ? provision(!_anvilMirrorOff) : provision(false)`. An in-memory fork of a real chain gets
     the fork-only deploy. Nothing else in `_pointAt` changes: a cleartext stack needs no version gate and
     registers its own signers.
2. Add the guard that makes this safe: before deploying, `_candidatesFor(block.chainid)` must be EMPTY
   under every network group (`mainnet`, `testnet`, `devnet`); the `local` group does not count. A hit
   reverts with a new rendered message, `liveStackExists(chainId, group, alias)`: "chain N carries the
   FHEVM protocol (group/alias); fork it with `getFhevmChain(group, alias)` to test against the real stack,
   or point at anvil to get a cleartext one".
3. `cleartextChain(string alias)` on `StdFhevmChains`, the ONLY thing a user writes to name such a chain:
   ```solidity
   fhevm.createSelectFork(cleartextChain("arbitrum"));            // or (cleartextChain("arbitrum"), blockNumber)
   ```
   It returns an `FhevmChain` with group `local`, the alias as given, the canonical local addresses (the
   same the `anvil` entry carries), `relayerUrl` empty, and the URL resolved exactly as `getFhevmChain`
   resolves one: `[rpc_endpoints] <alias>` in `foundry.toml`, else `<ALIAS>_RPC_URL`, else the rendered
   failure of step 3. There is no default URL: a foreign chain is the user's to name. `chainId` is left 0 —
   the kernel never reads an entry's chain id when entering a fork (only the table lookup does), so
   `_enterFork` records `block.chainid` into `_forkChain[forkId]` once the fork is active, and the entry then
   states the truth rather than a value the user typed. No registration, no `FhevmChainData`, no patched
   `anvil` entry: the `setFhevmChain` path stays what it is, for chains that HAVE a protocol.
4. Tests, `test/fork/CleartextOnForeignChain.t.sol`, opt-in on `ARBITRUM_RPC_URL` like the Sepolia suite:
   - `createSelectFork(cleartextChain("arbitrum"))` provisions on first contact, `isCleartext`, deployer
     nonce moved, `block.chainid == 42161`, and `fhevm.protocol()` names the canonical addresses;
   - a second `createSelectFork` of the same alias provisions AGAIN (fresh fork, nothing mirrored) and the
     stack works on it;
   - `cleartextChain("nowhere")`, an alias no config and no variable defines, fails with step 3's rendered
     message and nothing is forked;
   - refused on mainnet: `getFhevmChain("mainnet","mainnet")` with its executor code deleted by `vm.etch`
     must revert with `liveStackExists`, not deploy (rules.md 7.1: prove the guard by breaking it);
   - refused when the deployer nonce is not 0 (`vm.setNonce`), with `localStackCannotDeploy`.
   ```sh
   ARBITRUM_RPC_URL=... forge test --match-path test/fork/CleartextOnForeignChain.t.sol
   ```
   Not carried over from the first draft: registering a `local`-group entry with non-canonical addresses,
   and the guard against it. With no registration form there is nothing to guard.

## 2. `DebugZamaConfig.sol`: a config that works under the SDK and cannot exist on a real chain

Shipped by the SDK at `pkg/src/config/DebugZamaConfig.sol`; the dApp never changes; the consumer adds one
build profile. Four layers, each catching what the previous one misses.

1. **The file.** A copy of upstream `ZamaConfig.sol` (same `library ZamaConfig`, same `ZamaEthereumConfig`,
   same function names, so a remapping swaps it in with no source change), with the known-chain branches
   verbatim and the fallback rewritten:
   Landed with one rule MORE than drafted here, and a different probe: every debug constructor's first
   statement is `ZamaConfig.requireDebugBuild()`, which requires FORGE's VM address to hold code (forge puts
   one byte there for the run; nothing can on a real chain) AND `FOUNDRY_PROFILE == "fhevm-debug"`, read
   through the environment cheatcode — on EVERY chain. So a debug build crashes at construction on mainnet
   too, and a default build that imports the file directly crashes as well. Probing forge rather than this
   package's kernel makes the guard answer from a field initializer or a factory-created contract, both
   verified. Under the guard the known-chain branches are still upstream's. The marker rides in the revert's arguments so it is in the
   bytecode of every contract compiled against the file (verified by `forge inspect`).
   ```solidity
   error DebugConfigOnProductionChain(uint256 chainId, string marker);
   string internal constant FHEVM_DEBUG_CONFIG = "forge-fhevm-std DEBUG config: never deploy";
   address constant FORGE_VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));   // file-level, forge's own

   function getEthereumCoprocessorConfig() internal view returns (CoprocessorConfig memory config) {
       if (block.chainid == 1) config = _getEthereumConfig();                 // upstream, verbatim
       else if (block.chainid == 11155111) config = _getSepoliaConfig();      // upstream, verbatim
       else if (block.chainid == 80002) config = _getPolygonAmoyConfig();     // upstream, verbatim
       else if (block.chainid == 31337) config = _getLocalConfig();           // upstream, verbatim
       else if (FHEVM_VM_ADDRESS.code.length != 0) config = _getLocalConfig(); // the cleartext stack the SDK provisioned (§1)
       else revert DebugConfigOnProductionChain(block.chainid);
   }
   ```
   `getConfidentialProtocolId` gets the same two branches. The kernel address holds code only where
   `StdFhevmBase`'s constructor etched it, i.e. under forge-fhevm-std, so on ANY real chain — the targeted
   one included — an unknown chain id reverts at construction. On a known chain the debug build behaves as
   upstream does, which is what makes the divergence config-only. The SDK's offline suite asserts the inlined
   address equals `FhevmVm.sol`'s, so the two cannot drift.

   Variant a project may prefer: pin the targeted chain id (`else if (block.chainid == 42161 && kernel)`) in a
   copy of its own, so the file names the one chain it is for. Same guard, one more line, project-owned.
2. **The profile.** In the consumer's `foundry.toml`, selected by `FOUNDRY_PROFILE=fhevm-debug` — Solidity
   has no compile-time access to the environment, so the profile IS the environment switch:
   ```toml
   [profile.fhevm-debug]
   out = "out-fhevm-debug"
   cache_path = "cache-fhevm-debug"
   remappings = ["@fhevm/solidity/config/ZamaConfig.sol=node_modules/@fhevm/forge-std/src/config/DebugZamaConfig.sol"]
   ```
   The longer prefix wins over `@fhevm/solidity/=`, so only that one file is swapped. Own `out` and
   `cache_path`: a deploy script run without the variable cannot find a debug artifact. To verify while
   implementing: that a profile-level `remappings` MERGES with `remappings.txt` rather than replacing it —
   if not, the docs show the full list.
3. **The guard, again, at construction.** Already in 2.1: the kernel-presence check is what turns "resolves
   to three empty addresses and fails at the first FHE call" into "reverts in the constructor with an error
   whose name says DEBUG and PRODUCTION". Nothing gets deployed.
4. **The marker and the check.** `FHEVM_DEBUG_CONFIG` ends up in the bytecode of every contract compiled
   with the debug config. Documented one-liner for a consumer's CI, run against the artifacts a deploy
   script uses:
   ```sh
   ! grep -rl "$(printf 'forge-fhevm-std DEBUG config' | xxd -p | tr -d '\n')" out/ || { echo "debug config in production artifacts"; exit 1; }
   ```
   (`forge verify-contract` would also reject a debug build, since its bytecode and metadata differ.)
5. **What the user writes.** Nothing in the dApp. In the test, with the profile active:
   ```solidity
   fhevm.createSelectFork(cleartextChain("arbitrum"));   // fork, provision the cleartext stack, point at it
   DApp dapp = new DApp(args);                            // debug config: 42161 + kernel present → the local stack
   (externalEuint64 v, bytes memory p) = encryptUint64(5, address(dapp), alice);
   ```
   ```sh
   FOUNDRY_PROFILE=fhevm-debug forge test --match-path "test/fork/*.arbitrum.t.sol"
   ```
   The constructor runs under the REAL chain id: an `immutable` that copies `block.chainid` is right, a
   handle minted in a constructor carries 42161 and reads back normally. This is what the dropped window
   could not offer.
6. **Tests.** The SDK gets a `[profile.fhevm-debug]` of its own, remapping the example dApps' config to the
   debug file, and `test/fork/CleartextOnForeignChain.t.sol` runs under it:
   - on the Arbitrum fork, the example counter deploys with plain `new`, then encrypt → op → `decryptPublic`
     and `plaintextOf` pass under 42161; the handle's chain-id bytes are 42161;
   - a contract whose constructor mints a handle: the handle carries 42161 and `plaintextOf` reads it;
   - on the mainnet fork (`getFhevmChain("mainnet","mainnet")`), the debug build resolves the REAL mainnet
     addresses, identical to upstream — asserted against the chain table;
   - the guard, broken on purpose (rules.md 7.1): save the kernel's code, `vm.etch(FHEVM_VM_ADDRESS, "")`,
     `vm.chainId(42161)` in memory, expect `DebugConfigOnProductionChain(42161)` from `new`, re-etch;
   - `test/internal`: the inlined kernel address equals `FHEVM_VM_ADDRESS`; the marker is present in the
     debug artifact's bytecode and absent from the default build's (read both `out/` trees with `vm.readFile`
     via `fs_permissions`, or compare `vm.getCode` under the two profiles from a small script).
   Under the DEFAULT profile the same file must still compile and the counter must still revert on 42161
   with `ZamaProtocolUnsupported`, which is the existing behaviour and stays asserted.

## 3. Render the alias-resolution failure

`StdFhevmChains.getFhevmChainWithUpdatedRpcUrl`, one branch.

1. When `vm.rpcUrl(alias)` fails and the error is not "invalid rpc url: <alias>" (alias absent), it is today
   re-raised raw: `environment variable MAINNET_RPC_URL not found`. Keep the behaviour — forge-std's rule
   that a configured alias which cannot be read is a misconfiguration is right — but render it:
   "`[rpc_endpoints] <alias>` in foundry.toml needs `<VAR>`; set it in `.env`, or remove the alias to use the
   SDK's default endpoint for <alias>". Fix lines per rules.md 2.11.
2. Test in `test/internal`: register an alias bound to an unset variable through a scratch `foundry.toml`
   is not possible from Solidity, so test the classifier directly: feed the two upstream error encodings and
   the env-not-found encoding to the (extracted) classification function and assert the rendered message.
   ```sh
   forge test --match-path test/internal/StdFhevmChainsAlias.t.sol
   ```

## 4. Rule book and docs

1. rules.md: two new rules under §2 — "the mock never shadows a live stack": the cleartext stack is
   deployed on a fork only where the chain table lists no network-group entry for the chain id, and the
   chain id is never changed by the SDK; and "a debug build cannot exist on a real chain": anything the SDK
   ships for a non-production build must revert at construction outside forge-fhevm-std, carry a marker in
   its bytecode, and be reachable only through a dedicated profile. Cross-reference 2.14 (anvil) and 3.1
   (the predicate).
2. `FhevmVm.sol` header: amend the "BORN ON A FORK" paragraph: an in-memory fork of a chain with no
   protocol gets the cleartext stack on first contact, like anvil, minus the mirror.
   `StdFhevmChains` header: `cleartextChain(alias)` next to `getFhevmChain`, with the one-line difference —
   the former names a chain that has NO stack and gets ours, the latter a chain that has one.
3. README / consumer docs: one section, "Testing on a chain that has no FHEVM protocol": the profile of
   2.2, the `[rpc_endpoints]` line it expects, the three-line pattern of 2.5, the CI one-liner of 2.4, the
   refusal on mainnet, and the one sentence of policy — the debug build differs from production in its
   config library and nowhere else, and it cannot be deployed.

## 5. Proof

```sh
cd foundry/forge-fhevm-std
npm run lint && forge fmt --check && forge clean && forge test               # offline suite, unchanged count + new internal tests
ARBITRUM_RPC_URL=... FOUNDRY_PROFILE=fhevm-debug forge test --match-path test/fork/CleartextOnForeignChain.t.sol   # steps 1–2 live
ARBITRUM_RPC_URL=... forge test --match-path test/fork/CleartextOnForeignChain.t.sol   # default profile: the counter still refuses 42161
make test-forge-std-anvil                                                     # anvil path unchanged
```
Then re-run confidential-defi's mainnet fork tests under BOTH profiles: they must resolve the LIVE stack
either way (the debug config's known-chain branches are upstream's), and the default build must carry no
marker.

## 6. Out of scope, on purpose

- The construction window (`vm.chainId(31337)` around `new`, opened by the fork call, closed by the first
  SDK entry). Dropped: it dispatches state into every SDK entry, and a constructor that mints a handle
  minted it under the wrong chain id. The debug config keeps the real chain id throughout.
- Any change to upstream `ZamaConfig.sol` itself, or a debug config reachable from the default profile.
- Mock over a chain that has the protocol. Rejected: the live mode is the honest target there, and the
  debug config returns upstream's addresses on those chains anyway.
- A registration form for foreign chains (`setFhevmChain` with a `local`-group entry). The alias helper
  covers the need with less to know and nothing to get wrong.
- A `FHE.setCoprocessor` test subclass as an SDK feature. It tests a different contract than the one
  deployed, with a larger divergence than the config library, so the SDK does not recommend it.

## 7. Closing note: §5 as run (2026-09-22)

`ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com`, `MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com`,
no anvil anywhere but in its own suite.

| Run | Result |
|---|---|
| offline suite, default profile (71 suites, new internal tests included) | 520 passed, 0 failed, 15 skipped (the debug-only internal test) |
| `test/fork/CleartextOnForeignChain.t.sol`, default profile | 9 passed, 3 skipped (the debug-only ones; no chain-id flip anywhere in the suite) |
| the same, `FOUNDRY_PROFILE=fhevm-debug` | 10 passed, 2 skipped (the default-only ones) |
| `test/internal/*`, `fhevm-debug` profile | 31 passed, 0 failed, 15 skipped (the default-only ones); `TestIsolation.t.sol` unchanged, its field-initializer dApp constructs fine since the guard is forge's, not the kernel's |
| anvil suite (`make test-forge-std-anvil`) | 3 passed |
| `forge fmt --check`, `forge lint` | clean, 0 warnings |
| confidential-defi mainnet fork tests, default profile, live stack | 20 passed |

What the runs proved, beyond green: the stack is provisioned into an in-memory fork of Arbitrum with no anvil;
the mock is refused on mainnet by name, both with a foreign entry pointed at mainnet's RPC and with
`cleartextChain("mainnet")` itself; a used deployer account is refused by name; under the debug profile a
production dApp deploys with plain `new` and a constructor that mints does so under chain id 42161; on mainnet
both builds resolve the same real addresses; outside the debug profile the debug build reverts at construction on
every chain (and outside forge, by construction: its guard is forge's own VM address, which holds code under
forge only — usable from a field initializer or a factory-created contract alike); the marker is in the bytecode exactly when the debug config compiled it; `cleartextChain` with an
unknown alias, or a declared-but-unreadable one, fails with the rendered message and forks nothing.

Two things the runs taught, kept for the next reader. `remappings.txt` gained `@fhevm/solidity-upstream/`, a
second name for upstream that the debug remapping does not touch, so one test file holds a debug-built and an
upstream-built dApp side by side and proves the marker rule in BOTH directions in every run (a relative path
to `node_modules` does not work: forge normalises it against the project root). And two `forge test`
processes on the same project at once — the default and the debug profile, or two default runs — can leave
one of them reporting nothing; run them one after the other, as `npm run test:fork` then `test:fork-debug` do.

Left for the consumer: confidential-defi's own `[profile.fhevm-debug]` waits for a re-pin of the soldeer
dependency, since its pinned commit predates `DebugZamaConfig.sol`.
