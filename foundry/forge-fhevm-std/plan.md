# Plan — automatic fork wiring

Status: IMPLEMENTED, steps 1–11 all landed on 2026-09-20 against `devex/alexb/v13/forge-fhevm-std-v2`
(uncommitted). Each step's "Status" paragraph records what was built, what was found, and the mutation that
proved it. Open items are in §8. Written 2026-09-20.

## Goal, measured at the user's line

Today a fork test wires three things by hand (`test/fork/SepoliaFHETestAdd.t.sol`, `setUp`):

```solidity
sepolia = getFhevmChain("testnet", "sepolia");
vm.createSelectFork(sepolia.rpcUrl, 11_743_572);
forked = true;
super.setUp();                                                        // setUpFhevm override → setProtocol(...)
LibForgeFhevmContexts.defineCleartextContexts(sepolia.inputVerifier, sepolia.protocolConfig, sepolia.acl);
eventProcessor().addExecutor(sepolia.fhevmExecutor);
```

After this plan it is:

```solidity
function setUp() public override {
    vm.createSelectFork(getFhevmChain("testnet", "sepolia").rpcUrl, 11_743_572);
    super.setUp();
}
```

or, the taught form, one call through the FHEVM VM handle (§2.5) that forks and wires in one go so a bad
RPC fails in `setUp` rather than in the first assertion:

```solidity
fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"), 11_743_572);
```

Every helper afterwards just works, including after a second `createSelectFork`, or a `selectFork` back
to an earlier fork. This is rule 2.10 applied to
forking: protocol steps are the SDK's, the user names a chain once.

## 1. Constraints that shape the design

- **Cheatcodes cannot be intercepted.** Forge answers `vm.createSelectFork` before any of our code runs
  (see `StdFhevmReplay.vmGetRecordedLogs` for the same fact about `getRecordedLogs`). The SDK cannot
  hook the fork itself. Two answers, both in this plan: a second VM handle, `fhevm`, whose overridden
  cheats do the FHEVM work (§2.5) — the path a user is taught; and lazy detection at every public entry
  (§2.1) as the safety net for a test that calls `vm.createSelectFork` directly. `activeFork()` reverts
  when no fork is active, so the detection check is a try/catch on the external VM call.
- **Contracts do not survive a fork switch.** `ForgeFhevmEventProcessor` and its
  `ForgeFhevmEventProcessorDB` are deployed in the test's EVM; on a second fork they are gone unless
  `vm.makePersistent` is called on both. The test contract's own storage — the protocol slot of
  `LibFhevmProtocol`, the processor address in `StdFhevmReplay` — is persistent already. This is the bug
  that makes "switch chains dynamically" fail today even with the manual wiring.
- **Recording must be armed before the dApp emits.** `vm.recordLogs` is armed when the processor is
  created. A dApp call made after the fork but before any SDK entry emits into nothing if the processor
  does not exist yet. So the processor must exist before the first dApp call, i.e. from `setUp`.
- **anvil is a fork with nothing on it.** A test pointed at a running anvil (`vm.createSelectFork("http://127.0.0.1:8545")`)
  is on the fork path — a real RPC, chain id 31337 — but the cleartext stack the local path deploys in
  memory is not there unless something put it there. The fork machinery and the local deploy both exist;
  what is missing is the SDK noticing the situation and joining them (§2.6).
- **One host chain, several groups.** Sepolia is in `testnet` and `devnet` (`fhevm-chains.config.json`).
  A chain id alone does not name a stack.

## 2. Design

### 2.1 A fork tracker: `StdFhevmFork` (new, owned by this package)

A mixin under `StdFhevmReplay` with one internal function `_ensureForkPrepared(address
contractAddressOrZero)`, called from every `unmetered` entry of `StdFhevmEncrypt`, `StdFhevmDecrypt`,
`StdFhevmDecryptPublic` and `StdFhevmCheatsSafe`. The `forkId → prepared` and `forkId → protocol` maps,
and the preparation steps below, live in `FhevmVm` (§2.5); the mixin only asks it.

**The current stack is the local cleartext one by default, and EVERY fork operation on `fhevm` moves it
(decided 2026-09-20, superseding the "nothing on a fork" idea of the same day).** `StdFhevm`'s CONSTRUCTOR
deploys the local stack and declares it. `fhevm.createSelectFork(chain, …)` and `fhevm.selectFork(id)`
point the protocol at the fork's stack THE MOMENT THEY RETURN — version gate, signer swap, replay
selection included — and a URL-only `createSelectFork` (or a `selectFork` to a never-resolved fork)
CLEARS it: unknown until the first SDK entry resolves it, never stale. Consequences: `LibFhevmProtocol`'s
storage moved INTO `FhevmVm` (the §8 fold, done — `fhevm.protocol()` / `setProtocol`), all preparation
moved into `FhevmVm` (`_pointAt`), and `StdFhevmFork` kept only the drift check and the URL-only
resolution. `fhevm.registerFork` refuses a fork that is not the active one. Proven online: URL-only not
clearing → the "unknown until resolved" assertion fails; `selectFork` not pointing → "sepolia again, at
once" fails with mainnet's ACL. (Folded into rule 2.12 at step 11.)

**Before ANY switch — drain first.** The recorded-log buffer is one per test, across forks. Events emitted
on fork A and still undrained when the test moves to fork B would be replayed while B is active, and a
replay is not fork-neutral: a store's read for a handle it never saw `staticcall`s its upstream, "whatever
the fork happens to hold" (`ForgeFhevmEventProcessorDB.get`), so on a cleartext-stack fork (anvil, §2.6)
an operand would be looked up on the wrong chain. So `fhevm.selectFork`, `fhevm.createSelectFork` and
`fhevm.rollFork` call `_replayPendingFheEvents()` BEFORE forwarding to `vm`: the store is up to date for
the fork that produced the events, then the switch happens. This is rule 2.9 extended: replay at every
decryption AND at every fork switch.

A direct `vm.createSelectFork` / `vm.selectFork` cannot be drained — forge has already switched by the
time the SDK sees anything — and so it is not tolerated: it is FORK DRIFT, refused by name at the next SDK
entry (`FhevmForkDrift(active, expected)`, decided at step 5). The safety net detects; it never repairs.
`fhevm.createSelectFork` / `fhevm.selectFork` are therefore not the taught form but the ONLY form.

On a fork id not seen before, in order:

1. **Resolve the stack.** Two sources, in this priority:
   - the dApp's own coprocessor config, read with `LibForgeFhevmConfig.getCoprocessorConfig(contractAddress)`
     when the entry has a `contractAddress` (encrypt, decrypt). This is what `LibFhevmProtocol`'s docs
     already claim happens and the code does not do — align them;
   - otherwise `StdFhevmChains`, by `block.chainid`.
   The `protocolConfig` address — needed for the KMS swap, and pointed to by nothing on chain — always
   comes from the chain table.
2. **Disambiguate the group.** The dApp's ACL picks the group when a dApp is at hand. Without one, a chain
   id present in exactly one group is unambiguous. Otherwise revert with a custom error naming the
   candidate groups and the two ways out: `setProtocol(...)` or `fhevm.createSelectFork(FhevmChain)`.
2b. **Version gate — LOUD.** Before touching the fork's contracts, read `getVersion()` on the five the
   `FhevmChain` names (ACL, executor, input verifier, KMS verifier, protocol config) and compare each,
   as a whole string, with what this SDK vendors: `LocalHostVersions` (v13, generated from the vendored
   sources — "ACL v0.4.0", "ProtocolConfig v0.1.0", …). Any difference, or a contract that does not
   answer, reverts with
   `FhevmChainVersionMismatch(string fhevmGroup, string chainAlias, string contractName, string expected, string actual)`
   whose docstring spells the fix out: this forge-fhevm-std (`StdFhevmVersion.VERSION`) is built against
   the vendored versions; the stack at (group, alias) runs another; upgrade the SDK or point the test at a
   group it supports. Never a silent attempt: an ABI drift between versions fails deep inside a signer
   swap or a digest with an empty revert, far from the cause — devnet Sepolia did exactly that during
   step 5 (`ProtocolConfig v0.2.0` / `ACL v0.5.0` against vendored v0.1.0 / v0.4.0; the symptom was a bare
   `EvmError: Revert` in `defineNewKmsContext`). Five `staticcall`s, once per fork; skipped for a
   cleartext stack whose executor answers `IS_CLEARTEXT` (it is this package's own, by construction).
3. **Swap both signer sets** with `LibForgeFhevmContexts.defineCleartextContexts`, guarded by the
   existing `hasCleartextCoprocessorContext` / `hasCleartextKmsContext` so a revisited fork is not swapped
   twice. Fork state persists across switches, so once per fork id is correct.
4. **Register the executor** on the processor if not already registered (see 2.3).
5. **Point the protocol** at this fork's stack — on EVERY switch, not just the first visit, because the
   protocol slot is shared. The `forkId → protocol` map makes switching back cost three storage words.
   And `selectExecutor(this fork's executor)` on the processor in the same breath: its reads go to the
   selected store, its writes to the emitter's (step 3 finding).

### 2.2 Eager processor, persistent (`StdFhevmReplay`, `TestFhevm`)

- The processor is created eagerly and made persistent — since 2026-09-20 in `StdFhevmReplay`'s
  CONSTRUCTOR (not `setUp`), like `fhevm`: a fork test's `setUp` is the test's own, it forks and calls
  nothing of ours afterwards. Consequence: `super.setUp()` is never needed on a fork; `TestFhevm.setUp`
  exists for the LOCAL stack only. The one exception is an INTERNALS test that reads
  `LibFhevmProtocol.currentConfig()` raw before any SDK entry (`ForkEncryptIntoEventProcessor`), which
  prepares in its own `setUp` and says why.
- The plaintext source is RESOLVED, not set: `LibFhevmProtocol.currentConfig()` answers the executor when
  `isCleartext`, the processor otherwise. `setPlaintexts` leaves the user's vocabulary (kept internal or
  deleted).
- `setUpFhevm` notices an active fork and skips `deployLocalFhevm`. Fork tests stop overriding it.

### 2.3 Executor registration — pre-register from the table, then per fork

Agreed amendment (discussion of 2026-09-20): when the processor is created, `StdFhevmReplay` registers
every executor `StdFhevmChains` knows. The processor filters events by emitter and handles carry their
chain id, so extra executors are harmless, and a fork switch needs no re-registration for any chain in
the table.

Direction matters: `StdFhevmReplay` PULLS the list at processor creation. `StdFhevmChains` stays a
standalone mixin like forge-std's `StdChains` (no processor dependency, and its lazy initializer only runs
on the first `getFhevmChain` call, which a test forking by URL never makes). Rule 2.3: the processor is
owned by `StdFhevmReplay`.

Not sufficient alone: a stack registered with `setFhevmChain` or named with `setProtocol` on a chain the
table does not know still needs its executor added, so step 4 of 2.1 stays.

Rejected alternative: drop emitter filtering and accept the FHE event signatures from any emitter. It
removes registration everywhere, but a test contract emitting a same-signature event would be consumed
silently. Keep the filter.

### 2.4 Chain table additions (`StdFhevmChains`)

- a lookup by chain id alone, returning the entries across groups — consumed by 2.1 step 2;
- an internal iterator over all entries — consumed by 2.3.

### 2.5 The `fhevm` VM — the second cheatcode handle

`vm.createSelectFork` is the second cheat this SDK has to stand in front of, after `vm.getRecordedLogs`
(rule 2.3). Two one-off wrappers with made-up names (`vmGetRecordedLogs`, `forkFhevm`) is the wrong
shape; one handle that reads like forge's is the right one:

```solidity
uint256 forkId = fhevm.createSelectFork(getFhevmChain("testnet", "sepolia").rpcUrl, 11_743_572);
fhevm.selectFork(forkId);
Vm.Log[] memory logs = fhevm.getRecordedLogs();
```

A reader who knows `vm` knows `fhevm`; the rule is "fork and read logs through `fhevm`, everything else
through `vm`".

**Shape — a contract at a deterministic address, like `vm` itself.** `FhevmVm` is a contract, and `fhevm`
a constant of its interface type at `address(uint160(uint256(keccak256("fhevm cheat code"))))`, the same
derivation forge uses for `vm`. `TestFhevm.setUp` puts it there with `vm.etch(address(fhevm),
type(FhevmVm).runtimeCode)` followed by one `fhevm.initialize()` (etch runs no constructor), then
`vm.makePersistent(address(fhevm))` so the same instance, with its state, is present in every fork.

Why a contract and not an inlined library: **state**. The fork maps of §2.1, the processor address, the
per-fork protocol, the executor set — all become ordinary state variables of one object that every
mixin AND every library can reach through the constant, in any fork. The ERC-7201-slot design this
replaces spread that state across the test contract's storage and had each library re-derive the slot;
this puts it where a reader expects it. It also opens a follow-up: the event processor, its DB, and the
protocol slot of `LibFhevmProtocol` could move INTO `FhevmVm`, leaving one persistent object instead of
three (not in this plan; noted in §7).

Three costs of a real call frame, each with its mitigation:

| cost | mitigation |
|---|---|
| **gas** — a call to `fhevm` is a real `CALL` the test pays for | every `FhevmVm` function is `unmetered` (reuse `ForgeVmBase`'s depth-counted modifier, first thing in the frame), so the test's figure shows only the dApp's call; `UnmeteredApi.t.sol` guards it |
| **rule 7.7** — an external call consumes a pending `vm.prank` / `vm.expectRevert` | true of `eventProcessor()` today, and of every helper contract; documented on the handle, and `fhevm` calls sit in `setUp` or between dApp calls, never in argument position. Forge special-cases only its own address, so this cannot be avoided, only stated |
| **cheats from a non-test contract** — `createSelectFork`, `recordLogs`, `prank` are issued by `fhevm`, not by the test | all are allowed from any address (forge-std `Script` contracts fork this way); `prank` from inside `fhevm` applies to `fhevm`'s next call, which is what the signer swap wants |

`initialize` is idempotent and `setUp` is snapshotted, so the etch happens once per test contract.

**Surface — only what is overridden, plus its fork family.**

| `fhevm.` | does |
|---|---|
| `createSelectFork(FhevmChain memory chain)`, `(chain, block)`, `(chain, txHash)` | DRAIN first, `vm.createSelectFork(chain.rpcUrl, …)`, then prepare the fork from the struct — no group to guess, no table in `fhevm` (7.2) |
| `createSelectFork(url)`, `(url, block)`, `(url, txHash)` | DRAIN first, forward; the fork is marked unprepared and the first SDK entry resolves it through the safety net |
| `createFork(...)` | forward to `vm` (creates without switching: nothing to drain) |
| `selectFork(id)`, `rollFork(...)` | DRAIN pending FHE events first (§2.1), forward to `vm`, then re-point the protocol and re-select the executor (§2.1 step 5) |
| `getRecordedLogs()` | today's `vmGetRecordedLogs`: drain once, feed the replay, return everything |
| `activeFork()` | forward; here so a fork test never needs `vm` for the fork family |

Nothing else is forwarded. A cheat that is not on the table is not overridden, and `vm` is where it lives;
a forwarding surface for all of `Vm` would hide which ones matter. `vmGetRecordedLogs` and the planned
`forkFhevm` are dropped in favour of this.

**The chain overloads are the taught form.** `fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"),
11_743_572)` is the shortest user line and carries the group, so §2.1 step 2 never has to disambiguate
and `fhevm` needs no chain table of its own (7.2).

### 2.6 anvil: the stack is deployed on first contact, if it is not already there

**Rule (→ 2.14).** forge-fhevm-std works cleanly against anvil. When a test's fork points at an anvil node,
the SDK finds the cleartext stack there or deploys it, on first contact, without the user knowing which
of the two happened. A dApp developer starts `anvil`, forks it, and tests — the same five lines as on
Sepolia.

**Detection.** In `prepareFork` (§2.1), before resolution: `block.chainid == 31337` is a hint, not the
test — anvil can run any chain id and a fork of Sepolia is not anvil. The test is a `vm.rpc("anvil_nodeInfo",
"[]")` (or `web3_clientVersion` containing `anvil`) in a try/catch against the fork's own endpoint. On
success the fork is an anvil node; otherwise it is a real chain and §2.1 proceeds unchanged.

**Presence.** `ACL_ADDRESS.code.length != 0` (the deterministic local address from `LocalHostAddresses`)
AND `LibCleartextProbe.isCleartext(FHEVM_EXECUTOR_ADDRESS)`: the stack is there — point the protocol at
the local addresses (they are a cleartext stack, so the executor answers `plaintexts` itself; no
replay, no signer swap: §3.1 "the predicate is local in-memory cleartext, not cleartext" — this IS a
cleartext stack reached over RPC, so `useCleartextVerifier` is true unless `FHEVM_FORCE_FORK_STACK`).

**Deploy, if absent — two levels, "if possible" made precise.**
1. **Into the fork** (always possible): `deployLocalFhevm()` runs against the forked state exactly as it
   runs against the empty in-memory state — same deployer, same nonce sequence, same addresses — provided
   `DEPLOYER_ADDRESS` is at `DEPLOYER_START_NONCE` on the node, which a fresh anvil satisfies and a used one
   is checked for (the existing `require`, reworded to name anvil). The stack then exists for this test
   run, in the fork, not on the node.
2. **Onto the node** (possible when the RPC accepts anvil's cheats): after (1), mirror the fork's new
   accounts onto the node with `anvil_setCode` / `anvil_setStorageAt` / `anvil_setNonce` through `vm.rpc`,
   for the fixed address list `LocalHostAddresses` names. Then the stack survives the test, and a second
   process — a js-sdk relayer, a hardhat test, a script — finds it. This is what "auto-deployed on anvil"
   means for the user; (1) alone is what a plain fork gives. Opt-out, not opt-in: a test that must NOT
   touch the node says so (`FHEVM_ANVIL_READONLY=true`, read once — rule 7.5 keeps it out of assertions).

   Why not `DeployLocalStack.s.sol`'s broadcast path: it needs `forge script --broadcast` and the
   deployer's key, outside a test. The RPC mirror needs neither and produces byte-identical state, because
   the fork already computed it. `VerifyFhevmDeploy.s.sol`'s checks are reused as the post-condition.

**Chain table entry.** `anvil` at 31337, `http://127.0.0.1:8545`, the same alias forge-std uses, with the
local deterministic addresses. Its group: the network groups are a closed set (`mainnet` / `testnet` /
`devnet`, `fhevm-network-groups.config.json`), and anvil is none of them — it is `"local"`, an SDK-only
group name that the table documents as such and that never reaches the relayer-URL logic (`relayerUrl`
empty). Decision recorded; alternative rejected: forcing anvil under `devnet` would make "devnet" mean two
things.

**Interaction with the local path.** `setUpFhevm` with no fork active still deploys in memory (today's
default, untouched). With an anvil fork active it goes through §2.6 instead. A test that forks anvil
AFTER the local deploy finds the addresses empty in the fork (the in-memory contracts are not persistent,
§8) and §2.6 deploys again — correct, if surprising; the docstring says so.

**Tests** (`test/anvil/AnvilFork.t.sol`, skipped unless `ANVIL_RPC_URL` is set; CI starts `anvil` first):
- fresh anvil: fork, encrypt, dApp add, `decryptPublic` — five lines, no wiring. **Mutation:** skip the
  deploy → the encrypt reverts on an empty input verifier.
- second test contract against the SAME node: finds the stack, deploys nothing (assert the deployer nonce
  on the node did not move). **Mutation:** drop the presence check → the nonce `require` fires.
- readonly opt-out: fork, run, then `cast code ACL_ADDRESS` on the node is still empty (asserted via
  `vm.rpc("eth_getCode", …)` against the endpoint, which reads the NODE, not the fork).
- used anvil (deployer nonce moved): the reworded `require` names anvil and the fix (`anvil --state` reset
  or a fresh node).

### 2.7 Loud setup errors (rules.md 2.11)

Every setup-class failure goes through ONE helper, `LibFhevmFail` (owned), that builds the message and
reverts with it as a plain string — forge prints revert strings verbatim, and a string is the only
payload that survives to the user's terminal unchanged:

```
+==============================================================================+
|  forge-fhevm-std  ·  FORK DRIFT                                              |
+------------------------------------------------------------------------------+
|  The active fork (id 0) was entered through `vm`, not `fhevm`.               |
|  Its FHE events were not drained and its stack was never named, so the SDK   |
|  cannot know what to encrypt against or decrypt from.                        |
|                                                                              |
|  FIX  replace  vm.createSelectFork(url, block)                               |
|       with     fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"), block)
|       and      vm.selectFork(id)  with  fhevm.selectFork(id)                 |
+==============================================================================+
```

`LibFhevmFail.setupError(string title, string[] what, string[] fix)` renders the box (fixed width, wrapped
by the caller: one line per array element) and reverts. Tests assert with
`vm.expectRevert(bytes(LibFhevmFail.render(title, what, fix)))` — same helper, so a reworded line changes
one place.

**What becomes loud** (each was found the hard way in steps 1–5):

| failure | today | after |
|---|---|---|
| `fhevm` handle missing (test inherits neither `TestFhevm` nor a `StdFhevm*` mixin, or bypassed the constructor) | forge's "call to non-contract address 0xC719…" | checked at every funnel: `FHEVM_VM_ADDRESS.code.length == 0` → box "FHEVM HANDLE MISSING", fix: inherit `TestFhevm`, or call `setUpFhevmVm()` first |
| fork drift | `FhevmForkDrift(0, 1.157e77)` | box "FORK DRIFT", fix: `fhevm.createSelectFork` / `fhevm.selectFork` |
| fork switched through `fhevm` but stack never named | `ForkNotPrepared(0, 11155111)` | box "FORK STACK UNKNOWN", fix: `fhevm.registerFork(id, getFhevmChain(group, alias))`, listing the groups the table has for that chain id |
| protocol version mismatch (§2.1 2b) | bare `EvmError: Revert` deep in `defineNewKmsContext` | box "UNSUPPORTED PROTOCOL VERSION", expected vs actual per contract, fix: upgrade forge-fhevm-std or use group X |
| deployer nonce moved (local deploy on a used chain) | `require` string, one line | box "LOCAL STACK CANNOT DEPLOY HERE", fix: fresh anvil / `--state` reset / fork a chain that has the stack |
| `forkUnknown*` on a cleartext stack | `ForkUnknownOnCleartextStack(executor)` | box "NOT A FORK", fix: this stack knows every value — use `plaintextOf`, or fork a real chain |
| `fhevm.registerFork` for a fork that is not active | silent (drift later) | box at `registerFork`: "REGISTERED FORK IS NOT ACTIVE" |
| RPC URL empty / env var unset when a test forks | forge's "invalid rpc url" | box "NO RPC URL", fix: `SEPOLIA_RPC_URL=… forge test` or `[rpc_endpoints]` |

Typed custom errors stay for everything a test legitimately asserts on (ACL refusals, unknown handles,
duplicate executor): rule 2.11's parenthesis.

## 3. Files

| where | change |
|---|---|
| `pkg/src/StdFhevmFork.sol` (new) | `_ensureForkPrepared` (the safety net); the preparation itself lives in `FhevmVm` so both paths share one implementation |
| `pkg/src/StdFhevmReplay.sol` | eager processor, `makePersistent` on processor and DB, pre-register table executors, processor address held by `FhevmVm`, `vmGetRecordedLogs` removed |
| `pkg/src/FhevmVm.sol` (new) | the `FhevmVm` contract at the keccak address, `IFhevmVm`, the `fhevm` constant; holds the fork maps, processor address, per-fork protocol |
| `pkg/src/StdFhevm.sol`, `pkg/src/TestFhevm.sol` | inherit `StdFhevmFork`, declare `fhevm`, fork-aware `setUpFhevm` |
| `pkg/src/StdFhevmChains.sol` | lookup by chain id across groups, iterator over entries, `anvil` entry in the `local` group |
| `pkg/src/LibFhevmFail.sol` (new, owned) | the one renderer for setup-error boxes (§2.7); every setup failure reverts through it |
| `pkg/src/StdFhevmAnvil.sol` (new, owned) | anvil detection, presence check, deploy-into-fork, mirror-onto-node via `vm.rpc` |
| `pkg/src/LibFhevmProtocol.sol` | resolve plaintext source by `isCleartext`; fix the docs that describe behaviour the code lacks |
| `pkg/src/StdFhevmEncrypt.sol`, `StdFhevmDecrypt.sol`, `StdFhevmDecryptPublic.sol`, `StdFhevmCheats.sol` | one `_ensureForkPrepared(...)` per entry |
| `host-contracts-cleartext/v13/pkg/forge/src/` | nothing expected — `LibForgeFhevmContexts` already has the idempotency checks. If something is needed, edit there and `npm run generate` (rule 1.1) |

## 4. Tests — each proven by breaking it (rule 7.1)

- **Sepolia, single fork.** `SepoliaFHETestAdd.t.sol` with its `setUp` reduced to two lines, still one
  test. Sanity mutation: removing `makePersistent` must still pass here (one fork needs none) and fail in
  the two-fork test below.
- **Two forks, switching.** Sepolia at two block numbers gives two fork ids on one RPC. Encrypt and add on
  fork A; `selectFork(B)`, same; `selectFork(A)`; decrypt A's sum. Mutations, each must fail by name:
  drop `makePersistent`; drop the re-point on switch; drop the per-fork signer swap.
- **Ambiguous group.** `vm.createSelectFork` on Sepolia with no dApp config, call `plaintextOf`: expect the
  naming error. Then `fhevm.createSelectFork(getFhevmChain("devnet", "sepolia"))`: expect devnet's ACL in
  `currentConfig()`.
- **Drain before switch.** Add on fork A, do NOT decrypt, `fhevm.selectFork(B)`, add on B, `fhevm.selectFork(A)`,
  decrypt A's sum. Passes on Sepolia either way (production stack: replay is fork-neutral), so the proof
  lives in step 8: TWO anvil forks, where A's operand is only known through A's cleartext upstream.
  **Mutation:** remove the drain from `selectFork` → the replay on B asks B's upstream for A's operand
  and the decrypt on A is wrong or reverts.
- **`fhevm` is one object everywhere.** Write a value into `FhevmVm` state before a fork, read it back
  after `createSelectFork` and after `selectFork` to another fork. Mutation: drop `makePersistent` on
  `fhevm`, the read fails with empty code at the address.
- **`fhevm` vs `vm`.** The two-fork test written once with `fhevm.createSelectFork` and once with
  `vm.createSelectFork` + a first SDK call; both pass, proving the safety net.
- **Table pre-registration.** With no `addExecutor` anywhere, a Sepolia decryption works; with the table
  iterator emptied, it fails with `CleartextEventUnknownHandle`.
- **Local stack unaffected.** Full offline suite green; one test asserting the plaintext source is the
  executor when it is cleartext, never the processor.
- **Gas guard.** `test/gas/UnmeteredApi.t.sol` still under 20k per entry — detection runs inside
  `unmetered`, so it must not show up.
- **Skipping.** Fork tests keep the `SEPOLIA_RPC_URL` opt-in guard (rule 7.3); `SepoliaFork.t.sol` should
  move to the same guard and to `getFhevmChain` for its addresses.

## 5. Rules (`rules.md`)

- Amend **2.9** — "…at every decryption AND at every fork switch": `fhevm.selectFork` / `createSelectFork` /
  `rollFork` drain before forwarding, because a replay reads its upstream on the ACTIVE fork.
- Add **2.12 — forking is automatic, and the default protocol is nothing or the local stack**: a test
  forks with `fhevm.createSelectFork`, and the SDK prepares the stack at the first entry that needs it —
  resolves it, checks its version, swaps signers, selects the executor, points the protocol — and re-points
  on every switch. Never in `setUp`: by default `currentConfig()` is nothing (fork) or the local cleartext
  stack (local), and a fork's addresses are current only as the consequence of a call. A user never writes `setProtocol`,
  `defineCleartextContexts`, `addExecutor` or `setPlaintexts`.
- Add **2.13 — two VMs, and which cheat goes through which**: `fhevm` for the cheats this SDK has to stand
  in front of — the fork family and `getRecordedLogs` — `vm` for everything else. A new override goes on
  `fhevm`, never as a free function with a made-up name; the table in `FhevmVm.sol` is the list.
- Add **2.15 — a wrong protocol version fails by name, before anything else**: on first contact with a
  fork, every host contract's `getVersion()` is compared with the vendored `LocalHostVersions`; a mismatch
  is `FhevmChainVersionMismatch(group, alias, contract, expected, actual)` with the fix in the docstring,
  never an attempt that dies in an ABI mismatch with an empty revert. New vendored version → regenerate
  `LocalHostVersions` (v13 `generate:contract-versions`), nothing else to update.
- Add **2.14 — anvil is a first-class target**: forge-fhevm-std works cleanly against a running anvil.
  A fork that points at an anvil node gets the cleartext stack on first contact — found if it is there,
  deployed into the fork if not, and mirrored onto the node when the node accepts anvil's cheats — with
  no wiring from the user and no difference in the test's five lines. Anvil is the `local` group in the
  chain table, an SDK-only name outside the closed set of network groups.
- Amend **2.3** (recorded-log buffer owner → `fhevm.getRecordedLogs()`) and **7.4** (`vmGetRecordedLogs()`
  → `fhevm.getRecordedLogs()`); amend **§3 LOCAL** to mention the anvil variant.
- Rewrite the FORKED paragraph of §3 and 3.2 to describe the automatic path; keep the mechanism
  description as "what the SDK does", not "what the test does".
- Amend **2.3**: the processor is created in `setUp` by `StdFhevmReplay` and is persistent across forks.

## 6. Implementation roadmap

Eleven steps, each one commit, each leaving the suite green (offline: `forge test`; online:
`SEPOLIA_RPC_URL=… forge test --match-path 'test/fork/*'`) and lint/fmt clean (rules.md §8). Every step
names its mutation proof (rule 7.1). No step edits `pkg/src/_host/` — if one turns out to need the v13
payload, it edits `host-contracts-cleartext/v13/pkg/forge/src/` and runs `npm run generate` (rule 1.1).

Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 6b → 7 → 8 → 9 → 10 → 11. Steps 3 and 4 could swap, and 8 (anvil) only needs 5–7; nothing else can move.

---

### Step 1 — `FhevmVm` skeleton: the address, the etch, the persistence

**Why first.** Every later step stores state in it. Nothing user-visible changes yet.

**Changes**
- `pkg/src/FhevmVm.sol` (new): `contract FhevmVm` with `initialize()` (idempotent, sets an `initialized`
  flag), `interface IFhevmVm`, constant `FHEVM_VM_ADDRESS = address(uint160(uint256(keccak256("fhevm cheat code"))))`,
  constant `IFhevmVm fhevm = IFhevmVm(FHEVM_VM_ADDRESS)`. Docstring written for the user (rule 2.10),
  with the §2.5 surface table — empty rows filled as steps land.
- `pkg/src/TestFhevm.sol`: `setUp` does `vm.etch(FHEVM_VM_ADDRESS, type(FhevmVm).runtimeCode)`,
  `fhevm.initialize()`, `vm.makePersistent(FHEVM_VM_ADDRESS)` BEFORE `setUpFhevm()` (7.5). Re-export `fhevm`.
- `test/internal/ContractSizeLimits.t.sol`: explicit exemption row for `FhevmVm` (7.3).

**Tests** — `test/internal/FhevmVm.t.sol`
- `fhevm` has code and is initialized after `setUp`; `initialize()` twice is a no-op.
- (online) "one object everywhere": write a probe value into `FhevmVm` state, `vm.createSelectFork`
  Sepolia, read it back; `createSelectFork` again at another block, `selectFork` the first, read again.
  **Mutation:** remove `makePersistent` → the read reverts with no code at the address.

**Done when** offline suite green, `FhevmVm` in the size exemption, the two tests pass online.

**Status: DONE (2026-09-20).** No size-limit test exists in this package (v13's covers the deployed
stack), so the exemption is stated in the `FhevmVm` docstring instead of a test row.

---

### Step 2 — One gas counter, owned by `FhevmVm`

**Why now.** Before any `fhevm` entry is called from inside an `unmetered` scope (7.1). Step 1's
`initialize` is called from `setUp`, outside any scope, so it was safe to land first.

**Changes**
- `FhevmVm`: `uint256 unmeteredDepth` + `enterUnmetered() returns (bool outermost)` /
  `exitUnmetered() returns (bool outermost)`.
- `pkg/src/_host/ForgeVmBase.sol` is generated — so the modifier's HOME moves: a new owned
  `pkg/src/StdFhevmUnmetered.sol` declares `unmetered` calling `fhevm.enterUnmetered()` / `exitUnmetered()`,
  and `StdFhevm*` mixins inherit it instead of `ForgeVmBase`'s modifier. `ForgeVmBase` stays in `_host` for
  the payload's own use (it must not call `fhevm`: rule 2.1 territory — the payload is compiled without
  this package). Check every `unmetered` site compiles against the new base.
- `FhevmVm`'s own future entries use the same counter through an internal modifier.

**Tests**
- `test/gas/UnmeteredApi.t.sol` unchanged and green (encrypt / decrypt / decryptPublic < 20k; dApp call
  still measured).
- New in `UnmeteredApi.t.sol`: an `unmetered` entry that calls into `fhevm` twice reports 0 gas for the
  inner work. **Mutation:** give `FhevmVm` its own transient counter (the two-counter design) → the inner
  `exit` resumes metering and the figure jumps (the 93k symptom).

**Scope note (found on review).** Nothing under `pkg/src/_host/` uses `unmetered` besides `ForgeVmBase`
itself (`ForgeFhevmDeploy` inherits it but only for `fvm`). The DEPLOYED Forge-variant contracts —
`CleartextForgeACL`, the Forge executor and arithmetic (v13 `pkg/src/cleartext/CleartextForge*.sol`) —
call raw `pauseGasMetering` / `resumeGasMetering` around their own extra checks. That is a third owner
of the same cheat, pre-existing, and outside this step: when the SDK's paused scope calls into the local
stack, one of their `resume`s re-enables metering inside it. `UnmeteredApi.t.sol` stays green today, so
either the paths do not cross or the cost is small; measure it in step 2 and, if it shows, open a v13
item (a depth-aware pause in the Forge variants) rather than growing this step.

**Done when** both gas tests pass, no `pauseGasMetering` / `resumeGasMetering` call exists in `pkg/src`
outside the one modifier (grep; the `_host` payload has none, the deployed variants are v13's).

**Status: DONE (2026-09-20).** Landed as: v13 `ForgeVmBase` modifier pause-first with `internal virtual`
hooks (regenerated); owned `StdFhevmBase is ForgeVmBase` overriding both hooks onto `fhevm`'s transient
counter; `StdFhevm` names the winner at the join point with `ForgeFhevmDeploy`. Measured: the deployed
Forge variants' raw pause/resume does not show — encrypt 7.6k, decrypt paths under 20k, unchanged. The
mutation "every exit resumes" fails the new nested-scope test at 450k and the user-decrypt guard at 62k.

---

### Step 3 — Eager, persistent event processor; resolved plaintext source

**Changes**
- `pkg/src/StdFhevmReplay.sol`: `eventProcessor()` unchanged as accessor, but `TestFhevm.setUp` calls it
  eagerly; on creation `vm.makePersistent` on the processor AND `processor.db()`; processor address stored
  in `FhevmVm` (`fhevm.eventProcessor()` / `setEventProcessor`), no longer a mixin state variable.
- `pkg/src/LibFhevmProtocol.sol`: `currentConfig()` resolves `plaintexts` = executor when `isCleartext`,
  else `fhevm.eventProcessor()`; `setPlaintexts` becomes private/removed; docs corrected (they describe
  reading the dApp's config — step 6 makes that true; until then say what IS true, rule 2.7).
- `StdFhevmReplay.eventProcessor()` no longer calls `setPlaintexts`.

**Tests**
- Offline: full suite (the local stack must still answer through its executor). New assertion in
  `test/protocol/LibFhevmProtocol.t.sol`: on the local stack `currentConfig().plaintexts == executor`
  even after `eventProcessor()` was created. **Mutation:** drop the `isCleartext` branch → it points at the
  processor and the cheats read zeros.
- Online — `test/fork/TwoForks.t.sol` (new, ONE test): Sepolia at block A and block B as two forks;
  wire by hand for now (this step predates automation) — encrypt+add on A, `selectFork(B)`, encrypt+add,
  `selectFork(A)`, `decryptPublic` A's sum. **Mutation:** drop `makePersistent` on the processor → the
  decrypt on A after visiting B reverts with no code at the processor.

**Done when** offline suite green, `TwoForks` passes online, `setPlaintexts` has zero call sites in `test/`.

**Status: DONE (2026-09-20).** Landed as: processor address in `FhevmVm` (`eventProcessor` /
`setEventProcessor`, a second processor refused); `StdFhevmReplay.eventProcessor()` persists the
processor; the PROCESSOR persists each per-executor store it creates (v13 source, `IForgeVmPersistence`
mini-interface, regenerated) — a store is created inside `addExecutor`, which tests call directly, so its
creator is the only place that can do it; `LibFhevmProtocol.currentConfig()` resolves the source
(`isCleartext` → executor, else `fhevm.eventProcessor()`), `setPlaintexts` and its storage field gone,
docs corrected to say what is true today; `StdFhevm.setUpFhevm` arms the processor eagerly. The
`ForkEncrypt` refusal test was removed: the situation it staged can no longer arise. Mutations, each
failing `TwoForks` online: processor not persistent ("does not exist on active fork"), stores not
persistent (revert on read); and the protocol test fails without the `isCleartext` branch.

**Found for steps 4–5 — read routing.** The processor WRITES by emitter (`processFheEvents` selects
`logs[i].emitter`'s store per event) but READS from `_selected`, the FIRST executor added, unless
`selectExecutor` is called. Today every fork test adds one executor, so it is right by accident. With
step 4's table pre-registration `_selected` becomes whichever table entry is added first, and a Sepolia
read would go to mainnet's store. Step 5's per-fork preparation must call `selectExecutor(fork's
executor)` on every switch, alongside the protocol re-point — and step 4 must not break the fork tests
in between: register the table executors AFTER the fork's own, or select explicitly at registration.

---

### Step 4 — Executor pre-registration from the chain table

**Changes**
- `pkg/src/StdFhevmChains.sol`: `internal` iterator over all default+override entries
  (`fhevmChains() returns (FhevmChain[] memory)`), plus `getFhevmChains(uint256 chainId)` returning the
  entries across groups (used by step 6).
- `StdFhevmReplay`: on processor creation, `addExecutor` for every table entry's `fhevmExecutor` (dedup),
  and — because reads go to `_selected` (see step 3's finding) — `selectExecutor` for the executor
  `LibFhevmProtocol.currentConfig()` names, whenever a protocol is declared. Until step 5 makes that
  automatic on switch, `setProtocol` is the moment to select.
- `test/fork/*`: remove the `addExecutor` lines from `SepoliaFHETestAdd`, `SepoliaFork`, `TwoForks`.

**Tests**
- `test/protocol/StdFhevmChains.t.sol`: iterator returns 8 entries + overrides; by-chain-id lookup returns
  both Sepolia groups and one for mainnet.
- Online: the three fork tests pass with no `addExecutor` anywhere. **Mutation:** empty the iterator →
  `CleartextEventUnknownHandle`.

**Done when** `grep -rn addExecutor test/` hits only `test/internal/`.

**Status: DONE (2026-09-20).** Landed as: `StdFhevmChains.fhevmChains()` / `getFhevmChains(chainId)` over
an insertion-ordered key list (rpcUrl as stored, not resolved — said in the docs); `StdFhevmReplay is
StdFhevmBase, StdFhevmChains` registers every table executor at processor creation and selects the
declared stack's executor; `LibFhevmProtocol.setProtocol` selects through `selectExecutorOnReplay`, a
no-op for an unknown executor, and tolerant of `fhevm` not being etched yet (a one-mixin test declaring
its stack before its first `unmetered` entry hit "call to non-contract address" — the library now asks
`FHEVM_VM_ADDRESS.code.length` first). Zero `addExecutor` in `test/`. Mutations: empty table walk →
`CleartextEventNoExecutor` online and "0 != 8" offline; `setProtocol` not selecting → the offline
registration test fails (online tests all create the processor AFTER declaring, so creation-time
selection covers them — the `setProtocol`-time path is proven offline only).

---

### Step 5 — Fork state in `FhevmVm`; the safety net that re-points on switch

**Changes**
- `FhevmVm`: `mapping(uint256 forkId => FhevmChain) forkChain`, `mapping(uint256 => bool) forkPrepared`,
  `lastSeenForkId`; `currentForkId()` (try/catch on `vm.activeFork()`, sentinel when none);
  `prepareFork(uint256 forkId, FhevmChain memory chain)` doing §2.1 steps 3–5 (signer swap guarded by the
  `hasCleartext…Context` checks, executor registered if unknown, protocol pointed); `pointProtocol(forkId)`
  for a revisit.
- `pkg/src/StdFhevmFork.sol` (new): `_ensureForkPrepared(address contractAddressOrZero)` — if the active
  fork changed since last seen: prepared → `pointProtocol`; not prepared → resolve (step 6; for now: revert
  `ForkNotPrepared(forkId)` naming `fhevm.createSelectFork(FhevmChain)`) → `prepareFork`.
- One `_ensureForkPrepared(...)` call at the top of every `unmetered` entry in `StdFhevmEncrypt`,
  `StdFhevmDecrypt`, `StdFhevmDecryptPublic`, `StdFhevmCheats` (pass `contractAddress` where the entry
  has one, else zero).
- `StdFhevm.setUpFhevm`: if `fhevm.currentForkId()` says a fork is active → skip `deployLocalFhevm`.

**Tests**
- Online `TwoForks`: replace the manual re-`setProtocol` on switch with nothing; passes. **Mutations:**
  drop `pointProtocol` on revisit → A's decrypt after B uses B's ACL and fails the ACL check; drop the
  per-fork signer swap → B's input proof is rejected by B's `InputVerifier`.
- Offline: `test/gas/UnmeteredApi.t.sol` still under 20k (the detection is inside the scope).
- Offline: local stack: `_ensureForkPrepared` is a no-op with no active fork (assert `currentForkId()`
  sentinel; assert the local suite untouched).

**Done when** the fork tests' `setUp` contain no `setProtocol` / `defineCleartextContexts`, only the
`fhevm.prepareFork`-equivalent call that step 7 will hide.

**Status: DONE (2026-09-20), with a design change decided mid-step — FORK DRIFT FAILS LOUDLY.** The
safety net does not repair a fork entered through `vm`; it refuses it. `fhevm` keeps `lastSwitchedForkId`
(set only by `fhevm.selectFork` and `fhevm.registerFork`) and `activeForkChecked()` reverts with
`FhevmForkDrift(active, expected)` when `vm.activeFork()` disagrees. `_ensureForkPrepared` calls that
first, then points/prepares against `lastPointedForkId`. Consequences for later steps: step 6's
resolution applies to `fhevm.createSelectFork(url…)` forms only, never to a raw `vm.createSelectFork`
(that is drift by definition); step 7 loses its "url forms mark unprepared for the safety net" rows.
`fhevm.selectFork(id)` (drain → `vm.selectFork` → mark) was pulled forward from step 7 because the
tests switch forks and every raw switch is now drift.

Landed as: fork bookkeeping in `FhevmVm` (`registerFork`, `forkChain`, `isForkRegistered/Prepared`,
`markForkPrepared`, `lastPointedForkId`, `currentForkId`, `activeForkChecked`, `selectFork`);
`StdFhevmFork is StdFhevmReplay` with `_ensureForkPrepared()` under every funnel (encrypt ×3, decrypt,
decryptPublic, `_plaintextOf`, `_requireForkStack`); `StdFhevm.setUpFhevm` fork-aware (no local deploy on
a fork; prepares immediately so a mis-set fork fails in `setUp`); `forkUnknownDeterministic()` added so the
cheats-only Sepolia suite sets its policy THROUGH the SDK (which prepares first) rather than on whichever
store the processor registered first. Two things found:
- **an etched account has no cheatcode access** — forge grants cheats to the test and what it CREATES;
  `activeFork()` from `fhevm` reverted, the `try` answered `NO_FORK`, and `setUpFhevm` deployed the local
  stack onto Sepolia (the nonce `require` caught it). `setUpFhevmVm` now calls `vm.allowCheatcodes`;
- **`fhevm` must exist before `setUp`** — a test forks and talks to `fhevm` before `super.setUp()`, and
  a direct call to an empty address cannot self-heal. The etch moved to `StdFhevmBase`'s CONSTRUCTOR
  (idempotent re-calls kept).
Mutations, online: point only on first contact → "Contract … does not exist on active fork" back on A
(two-stack test, Sepolia + mainnet); no drift check → both drift tests fail; no signer swap →
`UnknownCoprocessorSigner` on the first encrypt.

**Found: devnet Sepolia runs a NEWER protocol than this SDK vendors** — `ACL v0.5.0`, `ProtocolConfig
v0.2.0` against vendored `v0.4.0` / `v0.1.0` (`cast call … "getVersion()(string)"`). Its
`defineNewKmsContext` reverts with no data, so preparation dies far from the cause. The two-stack test uses
MAINNET as the second stack (skipped without `MAINNET_RPC_URL`). The `devnet` table entries stay
(addresses are correct); the VERSION GATE (§2.1 step 2b, step 6) turns that bare revert into
`FhevmChainVersionMismatch("devnet", "sepolia", "ACL", "ACL v0.4.0", "ACL v0.5.0")`, and devnet Sepolia is
its test case.

---

### Step 6 — Resolution: dApp config first, chain table second, group rule

**Scope after step 5's drift decision.** Resolution never runs on a fork entered through `vm` — that is
drift and is refused. It runs for `fhevm.createSelectFork(url, …)` (step 7) — a fork entered through the
handle but without a `FhevmChain` — and for `fhevm.registerFork`-less flows the handle itself starts. So
`_resolveChain` is called from the pointing path when the active, legitimately-entered fork has no
registered chain; the raw-`vm` test cases below are REPLACED by `fhevm.createSelectFork(sepolia.rpcUrl)`
cases.

**Changes**
- `StdFhevmFork._resolveChain(address contractAddressOrZero) returns (FhevmChain memory)`:
  1. `contractAddress != 0` and `LibForgeFhevmConfig.hasCoprocessorConfig` → match its ACL against
     `getFhevmChains(block.chainid)`; hit → that entry (its `protocolConfig` from the table).
  2. else `getFhevmChains(block.chainid)`: one entry → it; several → revert
     `AmbiguousFhevmGroup(chainId, groups)` naming `fhevm.createSelectFork(FhevmChain)` and `setProtocol`;
     none → revert `UnknownFhevmChain(chainId)`.
- `LibFhevmProtocol` docs now true; the sentence about "not by chain id" softened to "by the dApp's
  config first, the chain table second".
- **Version gate** (§2.1 step 2b): `StdFhevmFork._requireSupportedVersions(FhevmChain memory)` — five
  `staticcall`s to `getVersion()`, each compared with `LocalHostVersions.{ACL, FHEVM_EXECUTOR,
  INPUT_VERIFIER, KMS_VERIFIER, PROTOCOL_CONFIG}`; `FhevmChainVersionMismatch(group, alias, contract,
  expected, actual)` names the first difference (a non-answering contract reports `actual = ""`). Called
  in `_ensureForkPrepared` BEFORE the signer swap, on first contact only. `LocalHostVersions` is already
  generated in v13 and lands under `_host/_internal/` with the payload — nothing new to generate.

**Tests** — online, `test/fork/ForkResolution.t.sol`
- `fhevm.createSelectFork(sepolia.rpcUrl)` (URL only, no chain), then `encryptUint32(…, address(FHE_TEST), …)`:
  the dApp's ACL picks testnet; `currentConfig().acl == testnet ACL`.
- `fhevm.createSelectFork(sepolia.rpcUrl)`, then `plaintextOf(...)` with no dApp in sight: expect
  `AmbiguousFhevmGroup` naming `testnet` and `devnet`. **Mutation:** default to the first group → the
  error is not raised and the assertion on it fails.
- mainnet (skipped without `MAINNET_RPC_URL`): unambiguous by chain id.
- **Version gate**, online on Sepolia: `fhevm.registerFork(forkId, getFhevmChain("devnet", "sepolia"))`
  then any entry → expect exactly
  `FhevmChainVersionMismatch("devnet", "sepolia", "ACL", "ACL v0.4.0", "ACL v0.5.0")` (ACL is checked
  first). **Mutation:** remove the gate → the bare `EvmError: Revert` from `defineNewKmsContext` comes
  back, i.e. the test's `expectRevert` on the named error fails. And testnet Sepolia + mainnet still
  prepare: the gate passes on a matching stack (covered by every other fork test).

**Done when** `SepoliaFHETestAdd` passes with `fhevm.createSelectFork(sepolia.rpcUrl, block)` — URL only —
and NO other wiring line.

**Status: DONE (2026-09-20), "done when" amended.** URL-only on SEPOLIA cannot be the taught form: Sepolia
carries two stacks and `SepoliaFHETestAdd`'s first entry (`forkUnknown`) names no dApp, so it is
ambiguous by design. Its `setUp` is the one-line CHAIN form,
`fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"), 11_743_572)`, and URL-only is covered by
`ForkResolution.t.sol`: dApp picks the stack (first entry `encryptUint32(…, FHE_TEST, …)` → testnet),
no dApp on a two-group chain → `AmbiguousFhevmGroup(11155111, ["testnet","devnet"])`, one-group chain
(mainnet) → resolved by chain id, and the VERSION GATE on devnet Sepolia →
`FhevmChainVersionMismatch("devnet","sepolia","ACL","ACL v0.4.0","ACL v0.5.0")`. Live versions checked
with `cast` first: testnet Sepolia and mainnet match all five vendored strings exactly; devnet differs on
four. `fhevm.createSelectFork` in its four forms (chain / chain+block / url / url+block) was pulled
forward from step 7 to make this testable; every fork test now forks in one line and `test/fork/` has zero
`registerFork` / `setProtocol` / `defineCleartextContexts` calls. `setUpFhevm` on a fork prepares
immediately only when the stack is named; URL-only defers to the first entry so the dApp can decide.
Mutations, online: no gate → bare revert instead of the named error; ambiguity resolved by picking the
first group → the ambiguity test fails; dApp config ignored → the dApp test gets `AmbiguousFhevmGroup`.

---

### Step 6b — Loud setup errors (§2.7)

Right after step 6, before the fork family lands, so every later error is born loud.
- `pkg/src/LibFhevmFail.sol`: `render(title, what[], fix[])`, `setupError(...)` (renders + reverts).
- Convert the table of §2.7: drift, fork stack unknown, version mismatch (born loud in step 6), deployer
  nonce (`ForgeFhevmDeploy` is generated → the check moves up into `StdFhevm.setUpFhevm` before
  `deployLocalFhevm`, where the message can name anvil), `forkUnknown*` on cleartext, missing handle
  (funnel check), `registerFork` on an inactive fork, empty RPC URL (in `fhevm.createSelectFork`, step 7).
- Tests: every converted case asserts the FULL rendered message through `LibFhevmFail.render`; one
  snapshot test prints each box (`-vv`) so a human reads them once. **Mutation:** wrong fix line → the
  test fails on the string.
- `FhevmVm` and `StdFhevmFork` docstrings point at 2.11.

**Status: DONE (2026-09-20).** `pkg/src/LibFhevmFail.sol`: `render` / `setupError` plus one builder per
failure — `forkDrift`, `ambiguousGroup`, `unknownChain`, `versionMismatch`, `registeredForkNotActive`,
`noRpcUrl`, `notAFork`, `localStackCannotDeploy`, `noCurrentStack`, `handleMissing` — ASCII only (solc
refuses non-ASCII in plain literals), ragged right on purpose, `pure` so it renders from any context.
Every one of those sites now `revert(LibFhevmFail.x(...))`; the typed errors they replaced are gone
(`FhevmForkDrift`, `FhevmChainVersionMismatch`, `FhevmRegisteredForkNotActive`, `AmbiguousFhevmGroup`,
`UnknownFhevmChain`, `ForkUnknownOnCleartextStack`, `FhevmProtocolNotConfigured`). The deployer-nonce
check moved up into `StdFhevm`'s constructor, before the deploy, so the message can name anvil; the
payload's `require` stays as a backstop. Tests expect the rendered string through the same builder
(`vm.expectRevert(bytes(LibFhevmFail.forkDrift(a, b)))`), and `test/internal/LibFhevmFail.t.sol` prints
every box under `-vv` and checks brand, title and a `FIX` line. Mutations: a site reverting with a bare
string → the drift tests fail on the message; a builder losing its fix line → the rendering test fails.

---

### Step 7 — `fhevm.createSelectFork` and the fork family

**Changes**
- `FhevmVm`: `createSelectFork(FhevmChain memory)`, `(chain, uint256 block)`, `(chain, bytes32 txHash)`
  → DRAIN (`processFheEvents` on the processor `fhevm` holds), `vm.createSelectFork(chain.rpcUrl, …)`,
  `registerFork(id, chain)` (= mark switched + name the stack; the mixin points at the next entry, or
  `setUpFhevm` does); `createSelectFork(string url)` and its two siblings → drain + forward + mark
  switched WITHOUT a chain, so the pointing path resolves (step 6); `createFork(...)` (no drain: no
  switch); `selectFork(id)` exists since step 5; `rollFork(...)` → drain, forward, mark; `activeFork()`.
  All `unmetered` via the shared counter. Fill the surface table in the docstring.
- `SepoliaFHETestAdd.t.sol` reduced to the goal form (`fhevm.createSelectFork(getFhevmChain("testnet",
  "sepolia"), 11_743_572); super.setUp();`), guard kept.

**Tests**
- Online `TwoForks` rewritten with `fhevm.createSelectFork(chain, blockA/B)` and `fhevm.selectFork`;
  the direct-`vm` variant from step 5 kept as a second test in the same file (proves the safety net).
- Online `ForkResolution`: `fhevm.createSelectFork(getFhevmChain("devnet", "sepolia"))` →
  `currentConfig().acl == devnet ACL` (no ambiguity error).
- Offline: `fhevm.createSelectFork` on the local stack with no RPC → the forge error bubbles unchanged.

**Done when** the goal snippet at the top of this plan is the literal `setUp` of `SepoliaFHETestAdd`.

**Status: DONE (2026-09-20).** `createSelectFork` (four forms) and `selectFork` landed in steps 5–6; this
step added `createFork` (chain and URL forms — no switch, so no drain and no preparation; the chain form
remembers the stack for the first `selectFork`), `rollFork` (drain, roll, then prepare AGAIN: a roll
resets the fork's state and the signer swap with it — proven by the mutation "no re-prepare after roll"
→ `UnknownCoprocessorSigner` on the next encrypt) and `activeFork`. The goal snippet is the literal
`setUp` of `SepoliaFHETestAdd`, with no `super.setUp()`. 34 fork tests online.

---

### Step 8 — anvil: find or deploy the stack on first contact (§2.6)

**Changes**
- `StdFhevmChains`: `anvil` entry (31337, `http://127.0.0.1:8545`, group `local`, the `LocalHostAddresses`
  constants, empty `relayerUrl`); the group rule of step 6 treats `local` like any other.
- `pkg/src/StdFhevmAnvil.sol` (new): `_isAnvilFork()` (try/catch `vm.rpc("anvil_nodeInfo", "[]")`),
  `_hasLocalStack()` (code at `ACL_ADDRESS` + `isCleartext(FHEVM_EXECUTOR_ADDRESS)`),
  `_deployIntoFork()` (= `deployLocalFhevm()`, its nonce `require` reworded to name anvil and the fix),
  `_mirrorOntoNode()` (`anvil_setNonce` for the deployer, then `anvil_setCode` + `anvil_setStorageAt` for
  every address in `LocalHostAddresses` — storage keys enumerated with `vm.getStateDiff`/`accesses` around
  the deploy, or the known ERC-1967/OZ slots; decide when reached), gated by `FHEVM_ANVIL_READONLY`.
- `FhevmVm.prepareFork`: anvil branch before resolution — found → point protocol at local addresses;
  absent → deploy into fork, mirror onto node, then point.
- `TestFhevm.setUpFhevm`: with an anvil fork active, goes through the branch above instead of the
  in-memory deploy.

**Tests** — `test/anvil/AnvilFork.t.sol`, the four cases of §2.6, opt-in via `ANVIL_RPC_URL`; a
`package.json` script `test:anvil` that starts `anvil --silent`, runs them, stops it. Mutations as listed
in §2.6. PLUS the drain-before-switch proof (§4): two anvil forks (two nodes, or one node at two blocks),
an operation on A whose operand is known only through A's cleartext upstream, `fhevm.selectFork(B)`
without decrypting, back to A, decrypt. **Mutation:** no drain in `selectFork` → wrong value or revert.

**Done when** a fresh `anvil` + the five-line test pass with no wiring, twice in a row (second run finds
the stack), and the offline suite is untouched.

**Status: DONE (2026-09-20).** Landed INSIDE `FhevmVm` (which now `is ForgeFhevmDeploy`, so it can run the
local deploy itself) rather than in a separate mixin: `_pointAt` → executor has no code → `_provisionLocalStack`
(anvil? canonical addresses? deployer nonce 0? → `deployLocalFhevm()` under `startStateDiffRecording`,
then `_mirrorOntoNode(diff)` unless `setAnvilMirror(false)` → `anvil_setCode` / `anvil_setNonce` for every
CREATE, `anvil_setStorageAt` for every write, `PauserSet` set explicitly (etched, so absent from the diff),
deployer nonce last, then READ BACK `eth_getCode(ACL)` on the node → `ANVIL MIRROR FAILED` box if empty).
A cleartext stack skips the version gate and the signer swap. `anvil` is in the table as group `local`
(9 entries now). v13: `deployLocalFhevm` idempotent by PRESENCE (`ACL_ADDRESS.code.length`) instead of a
flag, so one contract can deploy on several forks. Three findings, all in the code's comments:
- **forge's `rpc` cheat encodes a JSON `true` as one 32-byte word**, not as ABI `bytes` — so a typed
  `vm.rpc` call REVERTS on `anvil_setStorageAt`'s success result, and Solidity cannot `catch` a
  return-data decoding failure. Every anvil call is a raw `FORGE_VM_ADDRESS.call(abi.encodeWithSignature(
  "rpc(string,string)", …))`, result ignored; the mirror is verified by reading the node back. A quantity
  (`eth_getTransactionCount`) comes back as the hex string's BYTES, big-endian, ABI-`bytes`-encoded.
- **a fresh anvil is at block 0** and the production executor derives handles from `blockhash(block.number - 1)`
  → the first FHE op panics with an arithmetic underflow, 1176 gas in. The SDK rolls the fork to block 1
  and asks the node to mine one (`anvil_mine`). Forge's in-memory chain starts at block 1, which is why
  no local test ever saw it.
- **the deployed Forge variants' raw `pauseGasMetering` / `resumeGasMetering`** (step 2's third owner) are
  visible in the traces on anvil and cost nothing measurable; still not this plan's.
Tests `test/anvil/AnvilFork.t.sol` (opt-in `ANVIL_RPC_URL`; `npm run test:anvil` starts a node on 8546):
fork → stack there (fork AND node) → counter encrypt/increment/decryptPublic; a second fork FINDS it
(deployer nonce on the node unchanged); mirror off leaves the node untouched (skipped when another test
already mirrored: the node is shared state, tests run in no fixed order). Mutations: no provisioning →
the fork test fails at once; no mirror → "on the NODE, not just in the fork: 0 <= 0". NOT done: the
drain-before-switch proof with two anvil forks (§4) — a single-node setup cannot make A's operand
unknown to B, since the mirror puts A's stack on the node B forks; it needs two nodes, left for step 11.

---

### Step 9 — `fhevm.getRecordedLogs`; retire `vmGetRecordedLogs`

**Changes**
- `FhevmVm.getRecordedLogs() returns (Vm.Log[] memory)`: drain once via `vm.getRecordedLogs()`, forward
  to the processor, return everything (today's `vmGetRecordedLogs` body).
- Remove `StdFhevmReplay.vmGetRecordedLogs`; `test/internal/DiamondState.t.sol` → `fhevm.getRecordedLogs()`.

**Tests**
- `DiamondState` green. New: a dApp event and an FHE event in one buffer; `fhevm.getRecordedLogs()`
  returns both AND a following `decrypt` still works. **Mutation:** call `vm.getRecordedLogs()` in the
  test instead → the decrypt fails on an unseen handle (the rule 2.3 footgun, proven).

**Done when** `grep -rn "vm.getRecordedLogs\|vmGetRecordedLogs" pkg/src test/` hits only `FhevmVm.sol`.

**Status: DONE (2026-09-20).** `fhevm.getRecordedLogs()` drains once, feeds the replay, returns everything;
`StdFhevmReplay.vmGetRecordedLogs` removed; its one user converted. `test/internal/RecordedLogs.t.sol`:
a dApp call's FHE events and the test's own event in one buffer → the array holds both AND the replay's
store holds the announced handle. Mutation: the test reads through `vm.getRecordedLogs()` → "the replay
saw the FHE events the read drained" fails. The remaining raw `vm.getRecordedLogs()` calls are in the
event-processor internals suite, on purpose (the footgun demonstration).

---

### Step 10 — Migrate the remaining tests (7.4)

- `test/fork/SepoliaFork.t.sol`: `fhevm.createSelectFork(getFhevmChain("testnet","sepolia"))`, drop the
  five address constants, drop the `SEPOLIA_RPC_URL` default (rule 7.3 opt-in guard like the others).
- `test/fork/ForkEncryptIntoEventProcessor.t.sol`: decide on reaching it — (a) move to
  `test/internal/EventProcessorReplay.t.sol` as the processor's internals test, keeping its direct
  `processor.*` calls, or (b) rewrite to the public API. Default (a): it documents the mechanism.
- Grep gate: `grep -rnE "registerFork|setProtocol\(|defineCleartextContexts|addExecutor|setPlaintexts" test/`
  → zero hits outside `test/internal/` (WIRING calls). `eventProcessor()` is allowed in a fork test's
  ASSERTIONS (`eventProcessor().selectedExecutor()` proves the replay follows the fork) — it is a read,
  not wiring; the gate as first written was too broad.

**Status: DONE (2026-09-20).** `ForkEncryptIntoEventProcessor.t.sol` → `test/internal/EventProcessorReplay.t.sol`
(option (a): it stays the processor's internals test, docstring says why it lives there; 14 tests pass on
mainnet). `SepoliaFork.t.sol` lost its five hardcoded host addresses for the chain table. Gate: one hit
outside `test/internal/`, `test/protocol/LibFhevmProtocol.t.sol:70` — the unit test OF `setProtocol`,
which is the API under test there, not wiring; accepted. Test counts: 253 offline, 20 in `test/fork/`
online, 14 in the moved suite, 3 on anvil.

---

### Step 11 — Rules, docs, version

- `rules.md`: add 2.12 (forking is automatic), 2.13 (two VMs, which cheat goes through which), 2.14
  (anvil is a first-class target) and 2.15 (version gate); amend
  2.3 (buffer owner → `fhevm.getRecordedLogs()`; processor created in `setUp`, persistent), 3 FORKED
  paragraph and 3.2 (what the SDK does), 7.4 (`fhevm.getRecordedLogs()`), 4.3 (size exemption now covers
  `FhevmVm`).
- `FhevmVm.sol` docstring final pass as the user-facing text (no README in this package).
- `pkg/package.json` version bump → `npm run generate:version`.
- Final: rules.md §8 checklist in both packages; all fork suites online; `plan.md` deleted or marked done.

**Status: DONE (2026-09-20).** rules.md: 2.3 rewritten (four owners: buffer → `fhevm.getRecordedLogs()`,
processor from the constructor and persistent, the current stack, the gas counter), 2.9 extended to fork
switches, 2.12–2.15 added, §3 LOCAL/FORKED rewritten, 3.2, 4.3, 7.4 and the §8 checklist amended (fork
runs, `npm run test:anvil`, the incremental-cache "No tests found" note). `FhevmVm.sol`'s docstring is
the user-facing text. Version `0.13.0-0` → `0.13.0-1`, `StdFhevmVersion` regenerated. `plan.md` kept as
the record, marked implemented.

---

### Per-step checklist (copy into each commit)

```
forge fmt --check && forge lint && forge build --force        # 0 notes, 0 warnings
forge test                                                    # offline green
SEPOLIA_RPC_URL=… forge test --match-path 'test/fork/*'       # online green
mutation(s) of the step run and seen FAILING, then reverted
```

## 7. Gaps found on review (2026-09-20) — now part of the plan

**7.1 — Gas metering has two counters once `fhevm` is a contract. MUST be designed, not discovered.**
`ForgeVmBase.unmetered` keeps its depth in TRANSIENT storage, and `TSTORE` is per contract address. So the
test contract and `FhevmVm` would each have a counter of their own. A test entry (`decrypt`, paused at
depth 1) that calls into `fhevm` (its counter at 0 → pauses → returns → RESUMES) re-enables metering in
the middle of the outer scope — exactly the bug rule 2.3 documents at 93k gas. Resolution: ONE counter,
owned by `FhevmVm` as an ordinary state variable; the test's `unmetered` modifier asks
`fhevm.enterUnmetered()` / `fhevm.exitUnmetered()` (cheap external calls; the outermost enter is the only
metered one and is ~2k). `FhevmVm`'s own entry points use the same counter. `ForgeVmBase` keeps the
modifier's shape; only the counter's home changes. `UnmeteredApi.t.sol` plus a NEW test: an `unmetered`
entry that calls `fhevm` twice must still report 0 gas for the inner work.

**7.2 — One chain table, not two: `fhevm` holds none.** The table stays where forge-std puts it — `StdFhevm`
inherits `StdFhevmChains` as `Test` inherits `StdChains`, and that is the only copy, overrides included.
`FhevmVm` never resolves a chain; it only RECEIVES a resolved `FhevmChain` and stores it per fork:
- `fhevm.createSelectFork(FhevmChain memory chain, …)` has everything in the argument;
- the safety net `_ensureForkPrepared` runs in the test contract, so it reads the test's table, applies
  the group rule (§2.1 step 2) there, and hands `fhevm` the result;
- the URL-only forms `fhevm.createSelectFork(url, …)` are plain forwards that mark the fork unprepared;
  the first SDK entry resolves through the safety net, exactly as after a direct `vm.createSelectFork`.
Ownership is then clean — chains: the test mixin; fork state: `fhevm` — with nothing forwarded and
`StdFhevmChains` keeping its forge-std shape (no VM or processor dependency). Rejected: the table inside
`FhevmVm` with the test's accessors forwarding over external calls — every `getFhevmChain` would consume
a pending prank (rule 7.7) and the mixin would stop mirroring `StdChains`.

**7.3 — Etched code and EIP-170.** `vm.etch` places runtime code without the 24 KB create-time check, so
`FhevmVm` may legitimately exceed it — like the `…Forge` executor variant (rule 4.3). State that in
`ContractSizeLimits.t.sol` with an explicit exemption rather than letting a size test catch it by surprise.

**7.4 — Migration of existing tests.** Surfaces this plan changes are used by: `test/fork/ForkEncryptIntoEventProcessor.t.sol`
(drives `eventProcessor()` and `processFheEvents` directly — stays as an INTERNALS test of the processor,
renamed under `test/internal/`, or is rewritten to the public API; decide when reached), `test/fork/SepoliaFork.t.sol`
(migrates to `fhevm.createSelectFork` + `getFhevmChain`, drops its constants), `test/internal/DiamondState.t.sol`
(`vmGetRecordedLogs` → `fhevm.getRecordedLogs`), `test/fork/SepoliaFHETestAdd.t.sol` (reduced to the goal).
Grep `vmGetRecordedLogs|eventProcessor\(\)|setProtocol|defineCleartextContexts|addExecutor` under `test/`
before calling it done: zero hits outside `test/internal/`.

**7.5 — `setUp` order and the etch.** DONE in step 2, one level lower than written: the etch lives in
`StdFhevmBase.setUpFhevmVm()`, called first thing by `StdFhevm.setUpFhevm` AND lazily by the two counter
hooks when the code is missing — because nine suites inherit `StdFhevm` directly and never run
`TestFhevm.setUp`, and they broke the moment the counter moved. The handle puts itself in place; a test
cannot forget it. Fork-first `super.setUp()` still works (persistent account carried into later forks; one
etched inside a fork exists only there, fine since no test returns to the no-fork state).

**7.6 — Package surface.** `pkg/package.json` exports `./src/*`, so `FhevmVm.sol` is published by path
with no change; `TestFhevm.sol` re-exports `fhevm` so a user imports one file. No README exists in this
package — the docstring of `FhevmVm.sol` is the user-facing text and is written as such (rule 2.10),
with the §2.5 table in it. Version: bump `pkg/package.json` and regenerate `StdFhevmVersion.sol`.

**7.7 — `initialize` is callable by anyone.** Idempotent, and there is nothing to protect in a test EVM;
noted so it is not "fixed" with an owner check later.

## 8. Open decisions

- **Local stack then fork.** A test that starts on the local cleartext stack and then forks loses the local
  contracts in the fork (they are not persistent). This plan leaves that alone and documents it: a fork
  test has no reason to deploy locally first. Making the local stack persistent is possible but changes
  every fork's state — not unless a test needs it.
- **Fold the processor into `FhevmVm`.** DONE in Part II: `fhevm` owns lifecycle, registry and selection
  of one processor per execution context, created inside the context, never persistent. The processor and
  its stores remain separate contracts by necessity (per-context state cannot live in the one persistent
  `fhevm`); what folded is ownership.
- **Leaving a fork for the in-memory stack is not possible in forge.** Once a fork is selected the pre-fork
  state is unreachable: `vm.selectFork` only moves between created forks, and there is no "deselect". So
  a test that needs both the local stack and a fork is two test contracts, or — after step 8 — forks a
  local anvil, which then IS a fork the test can `fhevm.selectFork` back to. A `fhevm.selectLocal()` is
  therefore not implementable without anvil; noted so nobody looks for it.
- **The replay's store is per CHAIN, not per fork (found 2026-09-20; RESOLVED by Part II — one processor
  per context, `rollFork` back; kept for the record).** Two forks of Sepolia at different
  blocks share one store (`dbOf(executor)`), so a handle announced on fork A is known to fork B, where the
  chain has never heard of it; only a cheat (`plaintextOf`) could observe it, a real decryption is refused
  by B's ACL. `rollFork` made the same hole obvious — a rolled-back chain and a store that cannot
  un-record — and is REFUSED for that reason (`ROLLFORK IS NOT SUPPORTED`). The clean fix is a store per
  (fork, executor) in the processor (v13), selected on every switch like the executor is today; until
  then, one fork per chain per test is the safe pattern, and the two-fork tests use handles that cannot
  collide.
- **`FHEVM_FORCE_FORK_STACK`.** Unchanged: the fork predicate stays "local in-memory cleartext"
  (rule 3.1). Detection decides WHICH stack; the predicate decides HOW to serve it.

---

# Part II — the event processor exists PER EXECUTION CONTEXT (one per fork, one in memory)

Status: IMPLEMENTED (2026-09-20), all six steps, uncommitted. Follows Part I.

**The unit is a CONTEXT, not a fork.** Forge runs a test in exactly one execution context at a time: the
in-memory chain (`NO_FORK`) or one of the created forks. Every context has its own chain state, so every
context gets its own replay. The in-memory context is not special-cased as "the cleartext one": a test may
deploy a NON-cleartext stack in memory — the production `FHEVMExecutor`, `ACL`, verifiers, from bytecode
or from source — and then the in-memory context needs a replay exactly as a fork does, because nothing in
that stack holds a cleartext. That is not supported today (nothing deploys such a stack), but the
architecture below is written so that it is a matter of a descriptor, not a redesign: the processor is
created per context whenever a protocol is pointed there, whatever the stack is, and it is READ whenever
that stack is not cleartext. `NO_FORK` is just the context id of the in-memory chain.

## 1. The problem, analysed

**What is shared today, and why that is wrong.** Part I made ONE `ForgeFhevmEventProcessor` per test
contract, created in `StdFhevmReplay`'s constructor, persistent, its address held by `fhevm`. It keeps
one store per EXECUTOR ADDRESS (`dbOf(executor)`), and the processor persists each store too. Writes are
routed by emitter, reads go to the selected executor's store. Consequences:

1. **Two forks of one chain share one store.** Sepolia at block A and Sepolia at block B have the same
   executor address, so the same store. A handle announced on A is "known" on B, where the chain has
   never heard of it. Only a cheat (`plaintextOf`, `forkUnknown` reads) can observe the ghost — a real
   decryption is refused by B's ACL — but the model is wrong, and a test that seeds `forkUnknown` on A
   has seeded B.
2. **`rollFork` is impossible.** A roll resets the chain to an earlier block; the persistent store cannot
   un-record what was announced after it. Part I refuses `rollFork` for this reason.
3. **Persistence is the wrong tool.** `makePersistent` exists so state SURVIVES a fork switch. The
   replay's state should do the opposite: it is a reconstruction OF a fork's chain and should live and die
   with that fork — exist only where the chain it mirrors exists.
4. **Table pre-registration is a workaround.** Every table executor is registered on the one processor
   at creation because no one knows yet which fork the test will visit. With a processor per fork, the
   fork's own executor is known at creation, and nothing else needs registering.
5. **The processor is owned in two places.** `StdFhevmReplay` creates it (constructor) and `fhevm` holds
   its address; `fhevm` already owns everything else per fork (chain, prepared flag, protocol).

**The key observation.** Forge already gives us "state per fork" for free: a contract deployed INSIDE a
fork, not made persistent, has code and storage only in that fork. Switch away and it is gone; switch back
and it is there, exactly as left. `rollFork` discards it with the rest of the fork's local modifications
(Part I step 7 measured that: the signer swap was lost on roll). So the design is not "clear the store on
switch", it is "stop making the replay persistent, and create one per fork, inside the fork".

**What stays global, and is correct as global.** `vm.recordLogs` is one buffer per test, across forks.
That is fine PROVIDED the buffer is drained into the active fork's processor before every switch — which
Part I's drain-before-switch already does — and armed once, before the first dApp call.

## 2. Design

### 2.1 `fhevm` owns the processors (the fold), one per context

`fhevm` creates, registers and hands out processors; `StdFhevmReplay` stops creating anything.

- One record per context, keyed by context id (`vm.activeFork()`, or `NO_FORK` in memory):
  `struct Context { FhevmChain chain; bool prepared; address processor; }` — Part I's three per-fork maps
  become one map, and the in-memory context is an entry like any other (`chain` = the local stack's
  descriptor, built from `LocalHostAddresses`; a future in-memory production stack is another descriptor).
- `fhevm.eventProcessor()` returns the ACTIVE context's processor, creating it on first need.
  `StdFhevmReplay.eventProcessor()` becomes a thin typed wrapper over it.
- Creation happens in `_setProtocol` (which every pointing path ends in, in memory and on a fork alike):
  if the active context has no processor, `new ForgeFhevmEventProcessor()` FROM `fhevm`, INSIDE the
  context, then `allowCheatcodes` on it explicitly (it calls `getRecordedLogs` / `randomUint`; do not rely
  on create-propagation), then `addExecutor(protocol.executor)` and `selectExecutor(it)`. NOT
  `makePersistent`. The processor's own `makePersistent(store)` in v13 `addExecutor` is REMOVED — that was
  Part I's mistake, now understood.
- WHETHER THE PROCESSOR IS READ is decided by the stack, not by the context: `LibFhevmProtocol` already
  resolves `plaintexts` = executor when `IS_CLEARTEXT`, else the active context's processor. A
  non-cleartext stack in memory is read from `_processorOf[NO_FORK]` with no further code.
- `setEventProcessor` / `FhevmVmEventProcessorAlreadySet` go: there is no single processor to protect.
- Recording is armed ONCE, in `fhevm.initialize()` (`vm.recordLogs()`), never by a processor. Re-arming
  `recordLogs` may reset the buffer; nothing but `initialize` and drains touch it.
- `getRecordedLogs()` / `_drainFheEvents()` feed the ACTIVE context's processor.

### 2.1b Pointing a stack is one path for every context

`_pointAt(contextId)` — version gate and signer swap when the stack is not cleartext, then `_setProtocol`
— runs for a fork today. It must accept the in-memory context too, driven by a descriptor:

- `fhevm.setProtocol(acl, executor, kmsVerifier)` stays for the local cleartext stack and for a manual
  declaration (no descriptor → no gate, no swap, processor created and pointed);
- `fhevm.useStack(FhevmChain memory chain)` (new; name to settle) points the ACTIVE context at a described
  stack with the full preparation — the same call `createSelectFork(chain, …)` makes after forking. In
  memory, that is how a non-cleartext stack deployed by a test would be adopted: deploy it, describe it,
  `fhevm.useStack(desc)`, and encrypt/decrypt/`forkUnknown` work as on a fork. Not wired to any deploy
  yet — the entry point exists so the day it is needed nothing else moves.
- The cheats' guard stays "is the stack cleartext", not "is there a fork": `forkUnknown` on an in-memory
  non-cleartext stack is legitimate (nothing knows the value), and the NAME `forkUnknown` is then the
  only fork-specific thing left — accepted, documented in the cheat's docstring as "a stack whose values
  nothing can know; today that is a fork".

**What "folding into `fhevm`" means and does not mean.** The processor and its stores remain separate
contracts (the replay IS `CleartextArithmeticBase` and needs its own storage layout; and per-fork state
cannot live in the one persistent `fhevm`). What folds is OWNERSHIP: lifecycle, registry, selection and
routing are `fhevm`'s, per fork, next to the chain and the protocol it already keeps per fork. Rule 2.3's
processor owner becomes `fhevm`, and "never two processors" becomes "one per fork, never two per fork".

### 2.2 What each fork operation does

| operation | processor |
|---|---|
| `StdFhevm` constructor (`setProtocol(local)`) | creates the `NO_FORK` context's processor, executor = local — the in-memory context is entry zero, not a special case |
| (future) `fhevm.useStack(desc)` in memory | same as the chain form of `createSelectFork` minus the fork: gate, swap, processor for `NO_FORK` re-pointed at the described stack |
| `createSelectFork(chain, …)` | drain into the fork being left; fork; `_pointAt` → `_setProtocol` → create this fork's processor, executor = `chain.fhevmExecutor` |
| `createSelectFork(url, …)` | drain; fork; nothing yet — the first SDK entry resolves and points, which creates |
| `selectFork(id)` | drain into the fork being left; switch; `_pointAt` → processor exists in this fork's state (not recreated) — `_setProtocol` re-selects |
| `rollFork([id,] block)` | RE-ENABLED: drain; roll (fork state reset ⇒ this fork's processor and stores are GONE); `_forkPrepared = false`, `_processorOf[id] = 0`; `_pointAt` → prepare again, create again. A roll IS a fresh fork at another block, and now behaves like one: pre-roll handles are unknown, `forkUnknown` states them again |
| `registerFork(id, chain)` | as the chain form |
| local, no fork | as today |

### 2.3 Chain table pre-registration goes

`StdFhevmReplay` no longer registers the table's executors (Part I step 4). Each processor knows exactly
one executor: its fork's. A test that declares a stack the table does not know gets its executor
registered by the same `_setProtocol` path (`addExecutor` if unknown, then select) — the "declare a stack
→ select its store" rule survives, with "add" folded in. `StdFhevmChains` iterators stay (resolution uses
`getFhevmChains`).

### 2.4 Anvil

Unchanged in shape: the in-fork deploy and the mirror do not touch the processor. The anvil fork's
processor is created in the fork like any other, executor = the canonical local executor, whose store gets
the cleartext upstream (the processor probes `IS_CLEARTEXT` at `addExecutor`, in the fork, where the stack
now exists).

### 2.5 What this fixes, stated as tests

- **Isolation:** add on fork A, `fhevm.selectFork(B)` (same chain, other block): `plaintextOf(sumA)` on B
  is REFUSED (`CleartextEventUnknownHandle`, B's default policy) — the ghost is gone. Back on A it is 1337.
  **Mutation:** make the processor persistent again → B answers 1337.
- **`rollFork`:** add on A, `fhevm.rollFork(earlier)`: the old handle is unknown, an encrypt is accepted
  (signer swap redone), `forkUnknown` + add + `decryptPublic` work at the new block. **Mutation:** skip
  the recreate → the first read hits an address with no code.
- **Per-fork processor:** `fhevm.eventProcessor()` differs between A and B, is the same on A before and
  after visiting B, and has exactly one executor. **Mutation:** return `_processorOf[NO_FORK]` for every
  fork → the isolation test fails.
- **Drain-before-switch, finally provable:** with a per-fork store, A's operand seeded on A is NOT in B's
  store; emit on A, switch WITHOUT draining (mutation) → the events land in B's processor, and A's decrypt
  fails. No anvil needed: Sepolia proves it now, because the stores are no longer shared.
- **Recording armed once:** a dApp call BEFORE the first SDK entry on a URL-only fork is still replayed
  (buffer global, armed in `initialize`). **Mutation:** arm per processor → the re-arm drops the pending
  events.
- **Local run unaffected:** full offline suite; `EventProcessorRegistration` rewritten to "one executor
  per processor, the declared stack's".
- **The in-memory context is a context:** `fhevm.eventProcessor()` in memory returns a processor whose
  executor is the local one; on the local cleartext stack it is NOT the plaintext source (executor answers),
  but it exists and records — `RecordedLogs.t.sol` already proves the recording half. A minimal
  non-cleartext in-memory case: point the in-memory context at a stack whose executor is a stub that does
  not answer `IS_CLEARTEXT` (a `setProtocol` with an address that has no code), and assert `plaintexts`
  resolves to the `NO_FORK` processor — the read path for a future production stack in memory, proven
  without deploying one. **Mutation:** resolve `plaintexts` by "is a fork active" instead of "is the
  stack cleartext" → the in-memory non-cleartext case points at the executor and the test fails.
- **Gas guard** unchanged.

## 3. Files

| where | change |
|---|---|
| `pkg/src/FhevmVm.sol` | `Context` map keyed by context id (`NO_FORK` included), creation in `_setProtocol`, `eventProcessor()` = active context's, `useStack(FhevmChain)` for the active context, `rollFork` re-enabled (drain, roll, forget, re-point), `initialize` arms recording, drop `setEventProcessor` |
| `pkg/src/StdFhevmReplay.sol` | constructor and creation logic removed; `eventProcessor()` wraps `fhevm.eventProcessor()`; `_replayPendingFheEvents` unchanged in shape |
| `pkg/src/LibFhevmProtocol.sol` | `plaintexts` = active fork's processor (already reads `fhevm.eventProcessor()`) |
| `pkg/src/LibFhevmFail.sol` | `rollForkUnsupported` removed |
| v13 `pkg/forge/src/ForgeFhevmEventProcessor.sol` | remove `fvmPersistence.makePersistent(store)` and the mini-interface (Part I step 3); regenerate |
| tests | `TwoForks` (isolation, roll, drain proof), `FhevmVm.t.sol` (per-fork processor), `EventProcessorRegistration` (rewritten), `RecordedLogs`, `LibFhevmFail.t.sol` (row removed), `AnvilFork` (unchanged, rerun) |
| `rules.md` | 2.3 (owner: `fhevm`, one per CONTEXT — in memory or a fork — NOT persistent: persistence is for what must survive a switch, and a replay must not), §3 (the in-memory chain is a context like a fork; "cleartext" is a property of the STACK, decided by `IS_CLEARTEXT`, never of the context), 3.2 (`rollFork` back), 2.13 table |

## 4. Steps, each one commit, each green

1. **v13: stores not persistent.** Remove the `makePersistent` in `addExecutor`; regenerate. Offline
   green; `TwoForks` now FAILS on the return to A (proves the change bites) — expected, fixed by step 2.
2. **Per-context processors in `fhevm`.** The `Context` map (in-memory context included), creation in
   `_setProtocol`, `eventProcessor()` per active context, recording armed in `initialize`,
   `StdFhevmReplay` reduced, pre-registration removed. `TwoForks` green again; add the isolation,
   per-context-processor and in-memory-non-cleartext tests with their mutations.
   **Status: DONE (2026-09-20).** `_processorOf[contextId]`, created in `_setProtocol` inside the active
   context with `allowCheatcodes`, never persistent; recording armed once in `initialize` (which required
   granting cheats BEFORE `initialize` in `setUpFhevmVm`); `StdFhevmReplay` is a wrapper that says NO
   CURRENT STACK when there is no processor; pre-registration gone (one executor per processor, plus
   whatever a manual `setProtocol` declares). `TwoForks` needed its fork-B seed back — B has its own
   replay now, which IS the point. Mutations: persistent processor → "and it is not persistent" fails;
   plaintext source decided by "is a fork active" → the in-memory non-cleartext test reads the executor.
2b. **`fhevm.useStack(FhevmChain)`** for the active context — the fork's pointing path exposed to the
   in-memory context; `createSelectFork(chain, …)` becomes "fork, then `useStack`". One test in memory
   pointing at the local stack's own descriptor (a no-op change, proving the path runs there).
   **Status: DONE (2026-09-20).** `fhevm.useStack(chain)` points the ACTIVE context — `createSelectFork(chain, …)`
   is fork-then-`useStack` in effect; tested on a URL-only Sepolia fork (unknown → pointed and prepared →
   the five-line flow works) and in memory (the local descriptor from the table: a no-op change, the path
   runs, same processor).
3. **`rollFork` re-enabled.** Drain, roll, forget, re-point; the refusal message goes; the roll test
   returns, now asserting the old handle is unknown after the roll.
   **Status: DONE (2026-09-20).** `_forgetForkState` drops the prepared flag AND the fork's processor
   (created inside the fork, gone with the roll); `_pointAt` prepares afresh. The test asserts a NEW
   replay, the pre-roll handle unknown, the encrypt accepted (swap redone), the flow at the new block.
   Mutation: roll without forgetting → "a new replay for what is a new fork" fails.
4. **Drain-before-switch proof** on Sepolia (§2.5), replacing Part I's "needs two anvil nodes" note.
   **Status: DONE (2026-09-20).** `test_pendingEventsAreDrainedIntoTheForkTheyBelongTo`: add on A without
   decrypting, `createSelectFork(B)`, back to A, decrypt → 1337. Mutation: `createSelectFork(chain, block)`
   without its drain → `CleartextEventUnknownHandle` on A. Proven on Sepolia; no anvil needed, because
   the stores are per context now.
5. **Anvil rerun**, `EventProcessorRegistration` rewritten, `RecordedLogs` rechecked.
   **Status: DONE (2026-09-20).** Anvil: 3/3, twice on reset nodes. Found: forge runs the tests of ONE
   contract in parallel, and the anvil node is shared mutable state — the mirror-off test's assertion on
   the node's code raced (and lost once); it now asserts in the fork alone, and the suite's docstring says
   why. `EventProcessorRegistration` rewritten in step 2 (one executor per processor; declaring registers
   and selects; the in-memory non-cleartext read path). `RecordedLogs` unchanged and green.
6. **Rules and plan.** 2.3, §3, 3.2, 2.13; this part marked done; Part I §8's two processor items closed.
   **Status: DONE (2026-09-20).** See rules.md 2.3 (owner `fhevm`, one per context, never persistent),
   §3 (contexts; cleartext is the stack's property), 3.2 (`rollFork` back), 2.13 (surface).

## 4f. Follow-up done: BORN ON A FORK — `forge test --fork-url` (2026-09-20)

Found by asking what happens when forge itself forks before any constructor: `vm.activeFork()` answers 0
from the first instruction (probed), so `fhevm`'s baseline of `NO_FORK` made every entry FORK DRIFT, and
the constructor tried to deploy the local stack onto Sepolia — where the deployer account is at nonce 87,
so it died with LOCAL STACK CANNOT DEPLOY HERE. Fix: `initialize()` takes the birth context as the
baseline; `StdFhevm`'s constructor returns before the deploy when born on a fork; the first entry resolves
the stack as for a URL-only fork. `test/forkurl/ForkUrl.t.sol` (runs only under `--fork-url`; `npm run
test:fork-url`): nothing deployed or pointed at birth — asserted through "no processor, no protocol", NOT
through code at the local addresses, which Sepolia happens to hold (same deployer, same sequence, once);
the dApp resolves the stack and the five-line flow works; no dApp → AMBIGUOUS FHEVM GROUP;
`fhevm.createSelectFork` / `selectFork` work from the birth fork. Mutations: baseline `NO_FORK` → FORK
DRIFT; unconditional deploy → LOCAL STACK CANNOT DEPLOY HERE.

## 4e. Follow-up done: `setUpFhevm` REMOVED (2026-09-20)

The empty hook that `TestFhevm.setUp` called, and that eight `StdFhevm`-direct suites called from their own
`setUp`, is gone with all its callers: everything it once did happens in `StdFhevm`'s constructor. An empty
function named like a setup step says something is set up there (rule 2.7 violation). `TestFhevm.setUp` is
now an empty `virtual` function kept only so a test may `override` it and call `super.setUp()` as with
forge-std's `Test` — proven harmless on a fork by an assertion in `ForkResolution.t.sol`. Compile break for an
external test overriding `setUpFhevm`; taken at the prerelease version.

## 4d. Follow-up done: `LibForgeFhevmFork` DELETED, the decision is `fhevm`'s (2026-09-20)

The payload's fork-named predicate is gone. `fhevm.useCleartextVerifier()` (= not forced AND the current
executor answers `IS_CLEARTEXT`) is THE ONE PREDICATE of rule 3.1; `fhevm.setForceProductionPath(bool)`
overrides `FHEVM_FORCE_FORK_STACK` for tests (7.5: never `vm.setEnv`). The payload libraries take the
decision AS DATA and read no environment: `EncryptStack.cleartextVerifier`, `decryptPublicWithProof(…,
bool cleartextVerifier)`; the local no-arg forms pass `true`. User decryption's "local in-memory cleartext"
predicate is `protocol.isCleartext && fhevm.currentForkId() == NO_FORK`. v13: `LibForgeFhevmFork.sol` and
its test deleted, the predicate cases dropped from `ForkCleartextContext.t.sol` (152 tests, from 158).
New tests: the predicate follows the stack and the flag; the rebuilt path WORKS on the cleartext stack
when forced (encrypt + public decrypt agree). `LibForgeFhevmContexts` (renamed from `…ForkContext`) is
now the only payload file with fork-era naming, and its name is the host contracts' own word. What
still carries "fork" for the stack KIND: the `…OnForkStack` entry points in the shared `LibKmsVerifier`
and the `FHEVM_FORCE_FORK_STACK` flag — a wider rename, for the user to decide.

## 4c. Follow-up done: `StdFhevmFork` and `StdFhevmReplay` DELETED (2026-09-20)

Everything they held is `fhevm`'s now: `ensureForkPrepared(dApp)` (drift check + URL-only resolution +
prepare + point), `drainFheEvents()`, and the cheat forwards `seedCleartext` / `useFixedUnknownHandles` /
`useDeterministicUnknownHandles` on the active context's replay. The one thing `fhevm` lacked — the chain
table's addresses — is pushed in by `StdFhevm`'s constructor (`setChainTable(fhevmChains())`) and again
after every `setFhevmChain` override, so the table stays the test's (RPC URLs, overrides) and `fhevm`
resolves from its copy. Every `StdFhevm*` mixin inherits `StdFhevmBase` only and makes ONE `fhevm` call at
each funnel; no mixin references the processor, the fork logic or the replay. Tests that inspect the
replay wrap `ForgeFhevmEventProcessor(fhevm.eventProcessor())` themselves. A cheats-only suite (no
`StdFhevm` constructor) has no table copy in `fhevm`: the chain form of `createSelectFork` works, URL-only
resolution answers UNKNOWN FHEVM CHAIN — accurate. Supersedes 4b.

## 4b. Follow-up done: `StdFhevmFork` reduced to the seam (2026-09-20)

Drift check and URL-only resolution moved INTO `fhevm` (`activeForkNeedsStack()`, `useResolvedStack(dApp,
candidates)`); the mixin is three lines: `if (fhevm.activeForkNeedsStack()) fhevm.useResolvedStack(dApp,
getFhevmChains(block.chainid))`. What stays in the mixin is the test contract's by nature — the hook into
its own entries, and the chain table (7.2), whose candidates are handed over on the cold path only. Hot
path: one external call, gas guard unchanged (encrypt 7.6k). Resolution tests unchanged and green.

## 5. Risks and how each is handled

- **Cheatcode access for a contract `fhevm` creates.** Forge may or may not propagate access on CREATE
  from an allowed non-test contract; do not find out in production — `allowCheatcodes(processor)` right
  after `new`, always.
- **`recordLogs` re-arm semantics.** If re-arming resets the buffer, per-processor arming would drop
  events emitted between a fork switch and the new processor's creation. Arm once in `initialize`; never
  in a processor. (`startRecordingFheEvents` stays in v13 for standalone use of the processor; the SDK
  does not call it.)
- **Creation cost per fork.** One processor + one store per fork (~2 deploys), against Part I's one
  processor + nine stores once. Cheaper, not dearer.
- **A `selectFork` to a fork whose processor was never created** (URL-only, never resolved): nothing to
  select; the first entry resolves and creates, as today.
- **`vm.snapshot` / `revertTo` inside a fork** roll the processor back with the fork state — correct by
  construction, no code.
- **Anvil mirror and the processor.** The mirror copies the STACK onto the node, never the processor; a
  second fork of the same node gets its own fresh processor, which is what "per fork" means.
