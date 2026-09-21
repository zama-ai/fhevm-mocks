# forge-fhevm-std — rule book

Short rules, each with the reason it exists. When a rule and a convenience disagree, the rule wins.

---

## 1. Where code lives, and which way it flows

Everything under `pkg/src/_host/` is **generated**. It is a copy of
`host-contracts-cleartext/v13/pkg/forge/src/`, and the generator deletes the destination before
copying (`rmSync(pkg/src/_host)`), so an edit made there is lost on the next `npm run generate` —
silently, with no conflict and no warning.

```
host-contracts-cleartext/v13/pkg/src/cleartext/shared/   ← SOURCE of the shared libraries
        │  generate:forge-shared   (rm -rf destination, then copy)
        ▼
host-contracts-cleartext/v13/pkg/forge/src/shared/       ← generated
host-contracts-cleartext/v13/pkg/forge/src/*.sol         ← SOURCE of the forge payload
        │  generate:forge-payload  (rm -rf destination, then copy)
        ▼
foundry/forge-fhevm-std/pkg/src/_host/                   ← generated
```

**1.1 — edit at the source, then regenerate.**

| to change | edit | then run |
|---|---|---|
| a shared library (`LibKmsVerifier`, `LibFheType`, …) | `v13/pkg/src/cleartext/shared/` | `generate:forge-shared` in v13, then `generate` here |
| the forge payload (`ForgeFhevm*`, `LibForgeFhevm*`) | `v13/pkg/forge/src/` | `generate` here |
| the public API (`StdFhevm*`, `TestFhevm`, `LibFhevmProtocol`) | `forge-fhevm-std/pkg/src/` | nothing — this package owns it |

**1.2 — never add a file to a generated directory.** `pkg/forge/src/shared/` and `pkg/src/_host/`
are both wiped and rebuilt. A generator that writes into one of them is a race: whichever runs last
wins. Write to the source directory and let the sync carry it.

**1.3 — v12 is frozen.** Touch it only when a shared generator forces it, and say so.

---

## 2. Golden rules

**2.1 — `shared/` never touches the forge VM.** No `IForgeVm`, no `FORGE_VM_ADDRESS`, no cheatcodes.
Those files are compiled into the *deployed* contracts; a cheatcode there is a contract that cannot
exist on chain. Anything needing the VM goes in `pkg/forge/src/` (payload) or `pkg/src/` (this
package), and carries `Forge` in its name — see §5. Which of the two may import `forge-std` is rule 2.16.

**2.2 — symmetry, wherever it costs nothing.** The three decryption paths, the two user paths, the
`Args` structs, the `OnForkStack` / `OnCleartextStack` pairs: if two things do the same job they take
the same shape, in the same order, with the same names. A reader who learns one has learned the
other. Break symmetry only for a measured reason — a stack-too-deep, a gas cost — and write that
reason where the asymmetry is.

**2.3 — one owner per piece of global state.** Forge's cheatcode state is shared by everything in a
test; two owners is a bug that surfaces far from its cause.

- **Gas metering** — owned by `ForgeVmBase.unmetered`, applied at every public entry of
  `StdFhevmEncrypt` / `StdFhevmDecrypt` / `StdFhevmDecryptPublic`. Nothing below an entry point may
  call `pauseGasMetering` / `resumeGasMetering`: an inner `resume` re-enables metering in the middle
  of the outer scope and nothing reports it (measured: 0 gas before the inner call, 93k after). The
  modifier is depth-counted because entry points call each other, and its counter is in transient
  storage because a cold `SSTORE` is itself charged to the test.
- **The recorded-log buffer** — owned by `fhevm.getRecordedLogs()`. `vm.getRecordedLogs()` is one
  buffer per test and reading it EMPTIES it for everyone: a test that reads it directly starves the
  replay, and the next decryption fails on a handle it never saw.
- **The event processor** — owned by `fhevm`, ONE PER EXECUTION CONTEXT (the in-memory chain, each
  fork), created INSIDE the context when a stack is pointed there, NEVER persistent. A replay is the
  reconstruction of one chain's state and must live and die with it: switch context and it is gone with
  the chain, switch back and it is there, roll and it is discarded — persistence is for what must survive
  a switch, and a replay must not. Each knows the executors of the stacks pointed in its context, nothing
  else. Whether it is READ is the stack's property (`IS_CLEARTEXT`), never the context's.
- **The current stack** — owned by `fhevm` (`protocol()` / `setProtocol`). The local cleartext stack by
  default, from `StdFhevm`'s constructor; moved by every fork operation on `fhevm` (2.12).
- **The gas-metering depth counter** — owned by `fhevm` (`enterUnmetered` / `exitUnmetered`), in ITS
  transient storage. `TSTORE` is per address, so a counter per contract is two counters, and the inner
  scope's exit resumes metering inside the outer one. `StdFhevmBase` routes the modifier's hooks there.
- **Everything fork- and replay-related** — drift check, stack resolution, preparation, pointing, the
  drain, the cheats' access to the replay — is `fhevm`'s (`ensureForkPrepared`, `drainFheEvents`, …). A
  `StdFhevm*` mixin inherits `StdFhevmBase` alone and makes ONE `fhevm` call at each entry; there is no
  mixin that knows the processor. `fhevm` holds a COPY of the chain table's addresses, pushed by
  `StdFhevm` at construction and after every `setFhevmChain`, for resolving a URL-only fork; the table
  itself (RPC URLs, overrides) stays the test's.

**2.4 — addresses are resolved, never hardcoded.** Everything asks `LibFhevmProtocol.currentConfig()`:
ACL, executor, KMS verifier, input verifier (read off the executor) and the plaintext source. A
compile-time constant is correct for exactly one deployment and silently wrong on every fork — and
the ACL address is mixed into every handle, so a wrong one produces handles no chain will recognise.

**2.5 — a cheat must be unmistakable.** `StdFhevmCheatsSafe.plaintextOf` bypasses permits, the ACL
and the KMS. It proves nothing about access; `decrypt` is what tests that. Keep that distinction in
the names and in the docs.

**2.6 — group helpers by family.** One concern, one library, and the name says which concern:
`LibFhevmHandle` owns the internal handle format (chain id, index, type byte, version), `LibFheType`
owns the type enum and its widths, `LibKmsVerifier` owns EIP-712 digests and decryption payloads,
`LibInputVerifier` owns input proofs. A helper that fits an existing family goes there, even when it
is one line; a helper that fits none is a sign a family is missing, not a reason to put it anywhere.
The same rule split `LibFheType` out of two duplicate `FheType` declarations and merged
`CleartextHandle` into `LibFhevmHandle` — both had produced silent drift first.

**2.7 — say what is not true.** If a helper ignores an argument, cannot enforce something, or holds
only under a condition, the declaration says so. Silent divergence is the failure mode this codebase
keeps hitting.

**2.8 — a user never hears the word "handle".** The public API speaks in encrypted types — `euint32`,
`ebool`, `eaddress` — and in clear values. A `bytes32` handle is how the stack stores a value, not how
a test talks about one: `plaintextOf(euint32)`, `forkUnknown(euint32, uint32)`, `decrypt(euint32, …)`.
An entry point that takes or returns a `bytes32` is a leak, and the fix is a typed overload, not a doc
comment — the only exception is a case where the type genuinely cannot be known at the call site, and
that case says so in its name. `unwrap` in a test is the symptom; `seedCleartext(bytes32, uint256)`
on the processor is what this rule was written after.

**2.9 — FHE event processing is automatic at every decryption.** `decrypt`, `decryptPublic` and the
cheats drain the recorded logs into the event processor before they answer, through
`_replayPendingFheEvents()`. A test never calls `processFheEvents()` itself: a dApp call, then a
decryption, is the whole protocol. An entry point that reads a value without replaying first fails on
a fork with `CleartextEventUnknownHandle`, far from the line that forgot — `decryptPublic` did exactly
that until this rule was written. New entry point that reads a value: replay first, then answer.
AND AT EVERY FORK SWITCH: `fhevm.selectFork` / `createSelectFork` / `rollFork` drain before forwarding to
forge, because a store answers a handle it never saw by asking its upstream ON THE ACTIVE FORK — fork
A's events replayed after moving to fork B would look A's operands up on B's chain.

**2.10 — this is an SDK: user friendly, always.** forge-fhevm-std is what a dApp developer types in a
test, not an internal of the mock stack. Every public entry is judged by the line a user writes: one
call, typed arguments, the vocabulary of the FHE library they already use (`euint32`, `encryptUint32`,
`decrypt`), nothing to wire and nothing to know about how the stack works underneath. The measure is
the fork test that reads as five lines — get, `forkUnknown`, encrypt, call, `decryptPublic` — where the
same work once took an `eventProcessor()`, an `unwrap`, a manual replay and three hardcoded addresses.
When a step is needed for the protocol, the SDK does it (the replay, the signer swap, the address
resolution); when a step is needed from the user, one call with a plain name does it. A helper that is
correct but awkward is not done — 2.8 and 2.9 are this rule applied twice.

**2.12 — forking is automatic, and the default stack is the local cleartext one.** A test forks with
`fhevm.createSelectFork(getFhevmChain(group, alias), block)` and the SDK does the rest THE MOMENT THE
CALL RETURNS: version gate, signer sets swapped so proofs built here are accepted, executor selected on
the replay, protocol pointed. `fhevm.selectFork` re-points on every switch. By default — before any fork,
from `StdFhevm`'s constructor — the current stack is the local cleartext one; a URL-only fork CLEARS it
until the first SDK entry resolves the stack from the dApp that entry names or from the chain table. A
user never writes `setProtocol`, `defineCleartextContexts`, `addExecutor` or `registerFork`; `setUp` on a
fork needs nothing from us, and `super.setUp()` is not required. BORN ON A FORK (`forge test --fork-url`)
is the one fork nobody announces: `fhevm` takes its birth context as the drift baseline, `StdFhevm`'s
constructor deploys nothing on it (the chain is real; the deployer account may have history), and the
stack is resolved at the first entry like a URL-only fork's. `test/forkurl/` runs only in that mode
(`npm run test:fork-url`).

**2.13 — two VMs, and which cheat goes through which.** `fhevm` for the cheats this SDK has to stand in
front of — the fork family (`createSelectFork`, `createFork`, `selectFork`, `rollFork`, `activeFork`, `useStack`) and
`getRecordedLogs` — `vm` for everything else. A fork entered or switched through `vm` is FORK DRIFT and
is refused loudly at the next SDK entry, never repaired by guessing: forge cannot tell `fhevm` that
`vm.createSelectFork` ran, so its FHE events were not drained and its stack was never named. A new
override goes on `fhevm`, never as a free function with a made-up name; `FhevmVm.sol`'s table is the
list. `fhevm` is a contract etched at `keccak256("fhevm cheat code")`, persistent and cheat-enabled
(`allowCheatcodes`: an etched account is neither the test nor something it created), and a call to it is
a REAL frame — it consumes a pending `vm.prank` / `vm.expectRevert` (7.7).

**2.14 — anvil is a first-class target.** A fork of a running anvil gets the cleartext stack on first
contact: found at the canonical local addresses, or deployed into the fork (the local run's deploy,
verbatim) and mirrored onto the node with anvil's setters unless `fhevm.setAnvilMirror(false)`. Anvil is
the `local` group in the chain table, an SDK-only name outside the closed set of network groups. Two
facts the code carries: forge's `rpc` cheat encodes a bare JSON `true` as one word, not ABI `bytes`, so
anvil's setters are called raw and the mirror is verified by reading the node back; and a fresh anvil is
at block 0 while the executor derives handles from `blockhash(block.number - 1)`, so the SDK rolls the
fork to block 1 and mines one on the node.

**2.15 — a wrong protocol LINE fails by name, before anything else; any release of the vendored line is
accepted.** On first contact with a fork, every host contract's `getVersion()` must fall within the line
this SDK vendors: from what the line first shipped (`LibFhevmVersion.*_FLOOR`, hand-written from the
v0.13.0 tag) up to what this SDK vendors (`LocalHostVersions`, generated), inclusive. Chains do not all
upgrade the same day — Sepolia ran `FHEVMExecutor v0.4.0` after this SDK vendored 0.13.6's `v0.5.0` — and
every release of a line speaks the ABI this SDK speaks, so an exact match would refuse stacks that work.
Outside the line it is the UNSUPPORTED PROTOCOL VERSION box, floor and ceiling against actual per
contract, never an attempt that dies in an ABI mismatch with an empty revert (devnet Sepolia: `ACL v0.5.0`
against the 0.13 line's `v0.4.0`). New vendored release → regenerate `LocalHostVersions` (v13
`generate:contract-versions`); new LINE → move the floors too, and `LibFhevmVersion.t.sol` pins both.

**2.11 — a setup failure tells the user how to fix it, loudly.** Everything that can go wrong because a
test is SET UP wrong — the `fhevm` handle missing, a fork entered through `vm` instead of `fhevm` (drift),
a fork whose stack was never named, a chain running a protocol version this SDK does not vendor, a
deployer nonce that is not where the local deploy expects it, a cheat called on the wrong kind of stack —
reverts with an ASCII-decorated, multi-line message that says WHAT happened, WHY it is refused, and the
exact line that FIXES it. Never a bare `EvmError: Revert`, never "call to non-contract address", never a
custom error whose selector the user has to decode. The measure: a developer who has never read this
package's source pastes the message and knows what to type next. Detect at the point closest to the
cause — `setUp`, a constructor, the first SDK entry — not where the consequence surfaces. All such
messages go through one helper so they look alike; tests match them with the same helper, so a reworded
message is a one-line change. (Errors that are NOT setup issues — a permit the ACL refuses, a handle the
replay never saw — stay typed custom errors: they are what a test asserts on.)

**2.16 — forge-std stops at `pkg/src/`; `_host/` speaks only `IForgeVm`.** Two layers, two rules,
and the boundary is the directory:

- `pkg/src/_host/**` — the payload and its shared libraries — imports NOTHING from `forge-std`. The forge
  VM is reached through the vendored `IForgeVm` / `FORGE_VM_ADDRESS` (`_host/IForgeVm.sol`) and nothing
  else. The payload is copied into other packages and consumed by projects whose `lib/forge-std` wins the
  remapping; a `forge-std` import there would pin every consumer to one forge-std version for a file that
  is declarations only.
- `pkg/src/*.sol` — `StdFhevm*`, `TestFhevm`, `FhevmVm`, the `Lib*` this package owns — MAY and, where
  forge-std has the type, MUST use `forge-std`: `Vm`, `VmSafe`, `Test`, `Vm.Log`. This package IS a
  forge-std extension; `TestFhevm is Test, StdFhevm` is its whole reason to exist, and a test that
  inherits it already depends on `forge-std`. Hiding that behind the vendored interface would give the
  same code two spellings of one VM and two `Log` types to convert between at every boundary.

The original goal was "no forge-std dependency anywhere". It is not reachable: `TestFhevm` must inherit
forge-std's `Test`, so the dependency exists the moment a test is written. The rule is therefore about
WHERE it lives, not whether. Mechanical check: `grep -rl forge-std pkg/src/_host` must list only comment
mentions (`IForgeVm.sol`, `ForgeVmBase.sol` explain their own vendoring), never an `import`.

---

## 3. Fork and no-fork

Two worlds, and almost all of the design exists to keep one API working in both.

**LOCAL (no fork).** `StdFhevm`'s constructor deploys the whole cleartext stack in memory and declares it
the current stack — before `setUp`, so a fork test that never calls `super.setUp()` still starts from a
defined stack (and `TestFhevm.setUp` is now an empty hook). The cleartext
verifier can be asked what any handle is worth, the executor implements `IPlaintexts`, and the ACL is
ours. This is the default and the cheapest path: `fhevm.useCleartextVerifier()` returns
true, and the `…OnCleartextStack` entry points let the deployed contracts answer for themselves — so
a local test exercises the code a dApp actually calls.

**FORKED (a real stack).** `fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"), block)` — one
line, and the SDK names the chain's own addresses, checks their version, swaps the signer sets and creates
that fork's own replay (2.12). Every execution context — the in-memory chain, each fork — is a context
like any other, with its own replay; "cleartext" is a property of the STACK pointed there, decided on
chain by `IS_CLEARTEXT`, and a non-cleartext stack in memory reads its context's replay exactly as a fork
does (`fhevm.useStack(desc)` is the entry point, not yet wired to any deploy). Nothing on that chain holds a cleartext, and the production verifiers have no
`userDecrypt` at all, so the `…OnForkStack` entry points rebuild the answer instead: permissions from the
real ACL, digests from the real verifier's `eip712Domain`, and values from a **replay** —
`ForgeFhevmEventProcessor` reconstructs each cleartext from the events the real executor emits. The
plaintext source is RESOLVED, never named: a cleartext executor answers for itself, anything else reads
the processor `fhevm` holds. Once a fork is selected there is no way back to the in-memory stack — forge
has no "deselect" — so a suite that needs both is two contracts, or forks a local anvil (2.14).

**3.1 — the predicate is "local in-memory cleartext", not "cleartext".** The same cleartext contracts
deployed on a testnet are reached over RPC, where a user decryption is an expensive call.
`FHEVM_FORCE_FORK_STACK=true` (or `fhevm.setForceProductionPath(true)` in a test — never `vm.setEnv`,
7.5) forces the reconstructing path for every stack; nothing on chain can distinguish a local node from a
distant one, so that is a declared choice, not a detection. The decision is `fhevm`'s alone; the payload
libraries take it as data (`EncryptStack.cleartextVerifier`, `decryptPublicWithProof(…, bool)`) and read
no environment.

**3.2 — a fork needs signers it can sign as, and the SDK swaps them.** A production `InputVerifier` is
registered against coprocessor signers nobody here holds a key for. On first contact with a fork,
`fhevm` swaps both sets — `LibForgeFhevmContexts.defineCleartextContexts`, pranking `ACL.owner()`, no
storage patching, both levers `onlyACLOwner` — once per fork, and again after `fhevm.rollFork` — a roll resets the fork's local state, the swap and the
fork's replay with it, so a rolled fork is prepared like a fresh fork at that block (pre-roll handles are
unknown to it; `forkUnknown` states them again). A cleartext stack (anvil) is skipped: it registers the
cleartext signers itself.

**3.3 — a handle minted before the fork has no events.** Nothing can reconstruct it. Either
`forkUnknown(value, clear)` to state what it is worth, or pick a policy
(`useDeterministicUnknownHandles`, `useFixedUnknownHandles`, `useRandomUnknownHandles`); the default
refuses by name rather than inventing.

---

## 4. The cleartext core, and why a source edit is not enough

**Where it lives.** `host-contracts-cleartext/v13/pkg/src/`:

| path | what |
|---|---|
| `contracts/` | the VENDORED production contracts — `ACL`, `FHEVMExecutor`, `KMSVerifier`, `InputVerifier`, `ProtocolConfig`. Do not edit; they are what mainnet and Sepolia actually run. |
| `cleartext/` | the mocks that subclass them — `CleartextFHEVMExecutor`, `CleartextKMSVerifier`, `CleartextArithmetic`, `CleartextDB`, plus the `…Forge*` variants |
| `cleartext/shared/` | portable libraries, compiled into both the contracts and the forge payload (§2.1) |

`foundry.toml` sets `src = 'pkg/src'`, so `forge build` compiles all of it. The forge payload lives
in a second profile (`FOUNDRY_PROFILE=forgefhevmcore`, `src = pkg/forge/src`).

**Why regeneration matters.** A forge test does not compile the cleartext stack — it deploys it from
`pkg/forge/src/_internal/LocalHostBytecode.sol`, a committed blob of creation bytecode. **Editing a
cleartext contract changes nothing a test sees until that blob is regenerated.** This has produced
false conclusions here more than once: a security check was disabled at the source, the suite stayed
green, and the check was still live in the deployed bytecode.

```
npm run generate
  generate:pre   → forge-shared, exports, contract-versions, compute-addresses,
                   placeholders, signers          ← placeholders MUST precede the build
  compile:forge  → forge build --skip test        ← solc bakes the marker addresses in as literals
  generate:post  → templates, local-host-bytecode
```

**4.1 — two different address techniques, do not confuse them.**

- **Templates** (`generate:templates`) keep placeholder markers — addresses derived as
  `keccak256("fhevm.placeholder.<NAME>")[0:20]` — compiled in as literals, and record the byte
  offsets where they land so the TS deploy can overwrite them at deploy time. Hence the ordering: the
  placeholder file is written *before* `forge build`, or the previous run's markers stay baked in at
  the recorded offsets.
- **`LocalHostBytecode.sol`** (`generate:local-host-bytecode`) deliberately does NOT patch. It
  derives the deployer from the mnemonic, precomputes the nonce sequence's addresses, writes them as
  a real config, rebuilds, and reads the creation bytecode straight out of the artifacts.

**4.2 — `patch-sites.json` is a tripwire, not a build input.** It records how many bytecode sites each
placeholder is patched at, per contract. A count falling to zero means a deploy would bake in a
marker. `generate:patch-sites` is deliberately outside every chain: refreshing the baseline is a
human decision, made after reading the diff.

**4.3 — after touching a cleartext contract**: `npm run generate` in v13, `forge test` there, then
`npm run generate` here. If the contract is `CleartextFHEVMExecutor`, also check
`ContractSizeLimits.t.sol` — it must stay under EIP-170, while the `…Forge` variant is exempt and
deliberately over. `FhevmVm` is exempt too: it is ETCHED (`vm.etch` skips the creation-time check) and may
grow past 24 KB by design; write no size test against it.

---

## 5. Naming

Follow forge-std first; where it is silent, follow these.

| kind | pattern | example |
|---|---|---|
| library | `Lib<Name>.sol` | `LibKmsVerifier`, `LibFheType` |
| library that uses cheatcodes | `LibForgeFhevm<Name>.sol` | `LibForgeFhevmEncrypt`, `LibForgeFhevmSigners` |
| contract that uses cheatcodes | `ForgeFhevm<Name>.sol` | `ForgeFhevmDeploy`, `ForgeFhevmEventProcessor` |
| public API mixin | `StdFhevm<Name>.sol` | `StdFhevmEncrypt`, `StdFhevmDecrypt` |
| cheats mixin | `…CheatsSafe`, with `…Cheats is …CheatsSafe` once a footgun appears | forge-std's `StdCheatsSafe` |
| interface | `I<Name>.sol` | `IForgeVm`, `IPlaintexts` |
| argument bundle | `<Function>ArgsV1` | `UserDecryptPayloadArgsV1` |
| pinned to an ABI shape | `V1`, last | `userDecryptV1OnForkStack` |

**5.1 — `Forge` in a name means "touches cheatcodes".** A reader must be able to tell from the file
list alone which code can never run on chain.

**5.2 — name what a function returns, not how it got there** — `plaintextOf`, not `read`. Use the
vocabulary already in the stack: `plaintexts`, `handle`, `cleartext`, `permit`.

**5.3 — a handle is always a `bytes32`.** A parameter of an encrypted type is a `value`.

---

## 6. API shape

**6.1 — match forge-std.** `internal` members on abstract contracts, inherited through `TestFhevm`;
overloads rather than `…Uint8`/`…Uint16` suffix soup where the type can carry it; custom errors over
`require` strings; cheats grouped in a `…Cheats` mixin.

**6.2 — the public API takes no addresses.** A test names a stack once — the constructor's local stack by default, `fhevm.createSelectFork(chain, …)` on a fork, or
`fhevm.setProtocol(...)` for a manual declaration — and every helper resolves from there. Address-taking
overloads belong to the libraries, not to `StdFhevm*`.

**6.3 — pausing is invisible to the caller.** Every public entry is `unmetered`, so a test's gas
figure measures only its dApp's call. That makes those entries non-`view`; do not add `view` back.

**6.4 — the API costs the test nothing.** Guarded by `test/gas/UnmeteredApi.t.sol`: encrypt, user
decrypt and public decrypt each stay under 20k gas, and the dApp's own call is still measured.

---

## 7. Tests

**7.1 — prove a guard by breaking it.** An assertion meant to catch something must be shown to fail
when that thing is removed. A green suite after a deliberate mutation means the test proves nothing.
This has caught real gaps here repeatedly: a disabled signature check, a skipped replay, a
reintroduced plaintext-source bug.

**7.2 — never compare a function against itself.** Build the expectation from an independent source —
`LocalHostBootstrap`, a hand-computed digest, a second code path — not from the function under test.
Otherwise the assertion holds however wrong that function is.

**7.3 — fork tests skip without a CONFIGURED RPC.** `fhevm.hasRpcUrlFor("sepolia")` — true for an `[rpc_endpoints]`
entry in `foundry.toml` or a `SEPOLIA_RPC_URL` variable, never for the built-in default — plus `vm.skip`, so
the offline suite stays green and either forge-native way to name a URL opts a suite in. Assert `block.chainid` in `setUp` when the addresses are chain-specific.

**7.4 — assert events with `vm.expectEmit`, not `vm.getRecordedLogs()`.** `expectEmit` consumes
nothing; reading the buffer takes the FHE events with it. If a test truly needs the array, use
`fhevm.getRecordedLogs()`, which feeds the replay before handing it over.

**7.5 — no `vm.setEnv` in a test that asserts on it.** It mutates the process environment and forge
runs test contracts in parallel, so such a test races every other suite. Test the rule through a
parameter instead.

**7.6 — `setUp` runs ONCE per contract.** Forge snapshots the state it produced and restores that
before each test. Cheatcode state armed there (a log recorder) is restored with it; a side effect
outside the snapshot — a file write, an env write — happens once, not once per test.

**7.7 — hoist calls out of argument position.** An external call in an argument consumes a pending
`vm.prank` or `vm.expectRevert` before the intended call sees it. (A *cheatcode* call does not —
that one is safe.)

---

## 8. Before you call it done

```bash
# host package (the source)
cd host-contracts-cleartext/v13
npm run generate && npm run forge:fmt && npm run forge:lint && forge test
MAINNET_RPC_URL=… forge test --match-contract Fork

# this package (the consumer)
cd foundry/forge-fhevm-std
npm run generate && forge fmt && forge lint && forge test
SEPOLIA_RPC_URL=… MAINNET_RPC_URL=… npm run test:fork
SEPOLIA_RPC_URL=… npm run test:fork-url  # the born-on-a-fork suite, under `forge test --fork-url`
MAINNET_RPC_URL=… forge test --match-contract EventProcessorReplay
npm run test:anvil                       # starts a throwaway anvil on 8546, runs test/anvil, stops it
```

Use v13's npm scripts, not bare `forge fmt` / `forge lint`: v13 keeps the payload under a second profile
(`src = pkg/forge/src`), so a bare command formats and lints only `pkg/src` and reports a clean payload it
never looked at. `forge:fmt` and `forge:lint` run all three profiles. The gap is invisible in v13 and
surfaces here, on the generated copy.

A test that says "No tests found in project!" right after a file was restored or renamed is forge's
incremental cache, not the test: `forge build --force`, then run again.

Zero lint notes, zero unused imports, `forge fmt --check` clean in both.

`forge build --skip test` (~0.7s) is the loop for a stack-too-deep check. `forge test` alone will not
see a source change that has to pass through `generate` to reach the deployed bytecode — the stack is
deployed from pre-generated bytecode, so an unregenerated edit tests nothing.
