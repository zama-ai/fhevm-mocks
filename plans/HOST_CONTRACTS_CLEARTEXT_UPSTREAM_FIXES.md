# Plan — Two `@fhevm/host-contracts-cleartext` issues found while integrating it into the Hardhat plugin

Both were hit wiring `deploy()` into `packages/hardhat-plugin/src/internal/deploy/setup.ts`. Both are
worked around on the consumer side today. Both are better fixed in the package, because every consumer
will hit them exactly once and neither failure names its own cause.

| # | Symptom for the consumer | Root cause | Where it should be fixed | Status |
| - | ------------------------ | ---------- | ------------------------ | ------ |
| 1a | `@fhevm/host-contracts-cleartext/ts` resolves to the package's `.ts` sources (`node10`) | `ts/` had no `package.json` | package | ✅ **fixed upstream** — see below |
| 1b | …or to a `.d.ts` TypeScript refuses to `require()` (`node16`) | `exports` map has no per-condition `types` | package | ⬜ open |
| 2 | `nonce has already been used` on the 2nd transaction of `deploy()` | `deploy()` requires a contiguous nonce sequence but nothing in its API expressed or supplied it | package (consumer can only paper over it) | ✅ **addressed upstream** via 2b + 2c — see below |

> **Update — 1a has landed.** A rebuilt `0.13.0` tarball now ships `ts/package.json`:
>
> ```json
> { "type": "module", "main": "./_cjs/index.js", "module": "./_esm/index.js",
>   "types": "./_types/index.d.ts", "typings": "./_types/index.d.ts", "sideEffects": false }
> ```
>
> plus a root `typesVersions` entry mapping `ts` → `./ts/_types/index.d.ts`. Verified: under
> `moduleResolution: node10` the plugin now resolves to `ts/_types/index.d.ts` and typechecks clean
> with **no `paths` override**, so that workaround has been removed from
> `packages/hardhat-plugin/tsconfig.base.json`.
>
> **1b is still open.** `ts/package.json` declares `"type": "module"`, so `_types/*.d.ts` is still
> ESM-flavoured, and the `"./ts"` export still puts `types` above `import`/`require`. A `node16`
> consumer therefore still gets `TS1479`. Fix 1b below is unchanged; only Fix 1a is done.

---

## Problem 1 — `@fhevm/host-contracts-cleartext/ts` cannot be typed from a CommonJS consumer

### What the consumer looks like

`@fhevm/hardhat-plugin` must build to CommonJS — Hardhat loads plugins with `require()`. Its
`tsconfig.base.json` therefore sets `"module": "CommonJS"`, and it wants to write the obvious thing:

```ts
import { deploy } from "@fhevm/host-contracts-cleartext/ts";
```

There are only two module-resolution modes available to it, and **both are broken** — for different
reasons.

### Mode A — `moduleResolution: "node10"`: resolves to the package's ESM *sources*

`node10` (the classic algorithm) ignores `exports` maps entirely and resolves by filesystem path.
From `tsc --traceResolution`:

```
File '.../@fhevm/host-contracts-cleartext/ts/package.json' does not exist.
File '.../@fhevm/host-contracts-cleartext/ts.ts' does not exist.
File '.../@fhevm/host-contracts-cleartext/ts.d.ts' does not exist.
File '.../@fhevm/host-contracts-cleartext/ts/index.ts' exists - use it as a name resolution result.
======== Module name '@fhevm/host-contracts-cleartext/ts' was successfully resolved to
         '.../@fhevm/host-contracts-cleartext/ts/index.ts' ========
```

It lands on `ts/index.ts` — the **TypeScript source**, shipped because `files` lists `"ts"` wholesale.
TypeScript then pulls the entire package source tree into the consumer's compilation: it typechecks
files the consumer does not own, applies the consumer's `target`/`lib` to them (producing spurious
errors such as `TS2737: BigInt literals are not available when targeting lower than ES2020`), and
tries to emit them into the consumer's `outDir`.

Note the first line: the resolver looks for `ts/package.json` **before** trying `ts/index.ts`. That is
the hook for the fix.

### Mode B — `moduleResolution: "node16"`: `TS1479`

```
error TS1479: The current file is a CommonJS module whose imports will produce 'require' calls;
however, the referenced file is an ECMAScript module and cannot be imported with 'require'.
```

**The cause is the declarations' module flavour, not the `exports` map.** The package ships exactly
one declaration set, `ts/_types/*.d.ts`. TypeScript decides what module format a `.d.ts` is in by
walking up to the nearest `package.json`:

```
ts/_cjs/package.json    {"type":"commonjs"}       ← correct, but contains no .d.ts
ts/_esm/package.json    {"type":"module"}         ← correct, but contains no .d.ts
ts/_types/              (no package.json)
ts/package.json         {"type":"module"}         ← so _types/*.d.ts is ESM
```

So the only declarations in the package are ESM-flavoured, and a CommonJS module may not `require()`
an ES module. **No `exports` condition can select a CJS-flavoured declaration file, because the
package does not contain one.**

This was verified with three fixture packages, resolved under `--module Node16
--moduleResolution Node16`:

| Fixture | `types` placement | `.d.ts` flavour | Result |
| ------- | ----------------- | --------------- | ------ |
| A | nested under `require` | ESM (in a `type: module` dir) | **TS1479** |
| B | nested under `require` | CJS (in a `type: commonjs` dir) | passes |
| C | unconditional, top-level (ordering untouched) | CJS | passes |

A vs. B isolates the flavour; C shows that leaving the ordering exactly as the package has it today
still passes once the declarations are CJS-flavoured. Condition ordering is **not** the deciding
factor.

> An earlier revision of this document, and of the comment in
> `packages/hardhat-plugin/tsconfig.base.json`, blamed `types` sitting above `import`/`require`.
> That was wrong — fixture C disproves it.

This is a **types-only** failure. At runtime everything is fine: Node does not recognise `types`, skips
`import` under `require()`, lands on `default` → `ts/_cjs/index.js`, and `ts/_cjs/package.json`
correctly marks it CommonJS. The package ships working CJS code that it then types as ESM.

(`"module": "CommonJS"` with `"moduleResolution": "node16"` is rejected outright by TypeScript —
`TS5110` — so the consumer cannot mix and match its way out.)

### Current workaround in this repo

`packages/hardhat-plugin/tsconfig.base.json` stays on `node10` and pins the declarations by hand:

```jsonc
"paths": {
  "@fhevm/host-contracts-cleartext/ts": [
    "./node_modules/@fhevm/host-contracts-cleartext/ts/_types/index.d.ts",
    "../../node_modules/@fhevm/host-contracts-cleartext/ts/_types/index.d.ts"
  ]
}
```

It works — the plugin typechecks clean and resolves to `_types/index.d.ts` — but it is bad in three
ways: it hardcodes the package's internal directory layout, it guesses at the install location (hoisted
to the workspace root vs. local, hence two candidates), and it silently stops applying the day the
package changes its layout.

### Fix on the `@fhevm/host-contracts-cleartext` side

Two independent changes. Each fixes one mode; do both so consumers can use either.

**Fix 1a — add `pkg/ts/package.json`.** Three lines, fixes `node10` completely:

```json
{
  "main": "./_cjs/index.js",
  "module": "./_esm/index.js",
  "types": "./_cjs/index.d.ts"
}
```

The resolver checks this file before falling through to `ts/index.ts`, so sources stop being reachable
by accident. Deliberately **no `"type"` field**: `_cjs/package.json` and `_esm/package.json` are nearer
and already carry the right markers, and adding one here only creates a second place to get it wrong.

This also means the raw `.ts` sources can keep shipping. Dropping them from `files` would fix `node10`
too, but `build:types` runs with `--declarationMap`, so the `.d.ts.map` files point at those sources —
removing them breaks go-to-definition for every consumer. Keeping the sources and making them
unreachable-by-default is strictly better.

**Fix 1b — emit a CJS-flavoured declaration set (and, while there, nest `types` per condition).**

The one *required* change is that a CommonJS consumer must be able to reach a `.d.ts` that TypeScript
reads as CommonJS. The cheapest way to get that is to stop putting declarations in a third directory
that carries no `"type"` marker, and emit them into `_cjs` and `_esm` instead — those two already have
the correct markers, so each declaration set gets the right flavour for free:

```diff
-"build:types": "tsc --project ./tsconfig.build.esm.json --declarationDir ./pkg/ts/_types --emitDeclarationOnly --declaration --declarationMap",
+"build:types:esm": "tsc --project ./tsconfig.build.esm.json --declarationDir ./pkg/ts/_esm --emitDeclarationOnly --declaration --declarationMap",
+"build:types:cjs": "tsc --project ./tsconfig.build.cjs.json --module commonjs --moduleResolution node --declarationDir ./pkg/ts/_cjs --emitDeclarationOnly --declaration --declarationMap",
+"build:types": "npm run build:types:esm && npm run build:types:cjs",
```

`build:types:cjs` repeats `--module commonjs --moduleResolution node` because `tsconfig.build.cjs.json`
does not set them — `build:cjs` passes them on the command line, so a `--project`-only invocation would
silently inherit the ESM settings from `tsconfig.base.json`.

Then make the export conditional. This second half is *good practice rather than the fix* — fixture C
shows the current unconditional `types` would already work once a CJS-flavoured `.d.ts` exists — but
nesting is still worth doing, so an ESM consumer gets ESM declarations and a CJS consumer gets CJS
ones instead of both sharing whichever set `types` happens to name:

```diff
 "./ts": {
-  "types": "./ts/_types/index.d.ts",
-  "import": "./ts/_esm/index.js",
-  "require": "./ts/_cjs/index.js"
+  "import": {
+    "types": "./ts/_esm/index.d.ts",
+    "default": "./ts/_esm/index.js"
+  },
+  "require": {
+    "types": "./ts/_cjs/index.d.ts",
+    "default": "./ts/_cjs/index.js"
+  }
 }
```

Ordering matters: within each condition object `types` must come first, and `import`/`require` must
come before `default` in the outer object. `_types/` can then be deleted, or kept unreferenced for one
release if anything depends on the path.

Sequencing note: `build:cjs`/`build:esm` write their `package.json` markers with `printf` after `tsc`
runs. `tsc --emitDeclarationOnly` does not clean its output directory, so running `build:types:*` after
those steps is safe — but keep that order, and keep the `printf` steps where they are.

### Verification

Publish a tarball and, from a scratch CommonJS consumer, confirm all three of these typecheck with no
`paths` entry:

```
tsc --module CommonJS  --moduleResolution node10    # → ts/package.json → _cjs/index.d.ts
tsc --module Node16    --moduleResolution Node16    # → require condition → _cjs/index.d.ts
tsc --module ESNext    --moduleResolution bundler   # → import condition → _esm/index.d.ts
```

`arethetypeswrong` (`npx @arethetypeswrong/cli <tarball>`) flags exactly this class of problem and is
worth adding to the package's CI.

---

## Problem 2 — `deploy()` requires a contiguous nonce sequence but never supplies one

### Symptom

First integration attempt, using a plain ethers `Wallet` as the `AbstractEthereumSigner`:

```
EmptyUUPSProxyACL = 0x34e3eD8472e409dbF8FDf933cA996DC75e4Be126     ← nonce 0, fine
FAILED: nonce has already been used (code=NONCE_EXPIRED)           ← nonce 0 again
```

Transaction 1 succeeded, transaction 2 reused nonce 0. Reduced to a three-line repro against anvil:

```
before #0: latest=0 pending=0
  deployed #0 at 0x34e3eD8472e409dbF8FDf933cA996DC75e4Be126
before #1: latest=0 pending=0      ← still 0, after the deploy was mined
FAILED: nonce has already been used
```

### Root cause

`ethers` v6 `AbstractProvider` de-duplicates identical RPC requests inside a time window
(`lib.commonjs/providers/abstract-provider.js`):

```js
const defaultOptions = { cacheTimeout: 250, pollingInterval: 4000 };

// Shares multiple identical requests made during the same 250ms
async #perform(req) {
  const timeout = this.#options.cacheTimeout;
  if (timeout < 0) { return await this._perform(req); }   // caching disabled
  const tag = getTag(req.method, req);
  let perform = this.#performCache.get(tag);
  if (!perform) {
    perform = this._perform(req);
    this.#performCache.set(tag, perform);
    setTimeout(() => { /* evict */ }, timeout);
  }
  return await perform;
}
```

`getTransactionCount` goes through `#getAccountValue` → `#perform`, so it is cached under this rule.
The window is **250 ms of wall clock**, not a block — mining a new block does not invalidate it.

`deploy()` sends 26 transactions and the whole run takes ~2 s against anvil, i.e. roughly 80 ms per
transaction. Every send therefore falls inside the previous one's 250 ms window and receives the same
cached count. viem has an equivalent request-dedupe layer, so this is not an ethers quirk to route
around — it is what a well-behaved client library does.

### Why this is the package's problem, not the adapter's

`deploy()`'s correctness rests on an invariant that its API never states:

> every transaction `deploy()` sends must occupy the next nonce of the deployer, with no gaps and no
> reuse

That is not a preference. `precomputeAddresses` derives every address as
`CREATE(deployer, startNonce + k)`, and the implementations' bytecode is patched with those addresses
before it is deployed. A single skipped or reused nonce moves the entire stack out from under bytecode
that cannot adapt.

But `AbstractEthereumSigner` says only:

```ts
// Signer/account-based transaction. Deployer is msg.sender in constructor.
deploy(parameters: DeployParameters): Promise<DeployReturnType>;
// Signer/account-based transaction. msg.sender is the signer/account.
writeContract(parameters: unknown): Promise<unknown>;
```

Nothing about nonces. So the natural implementation — hand the parameters to ethers/viem and let it
pick — is the one that breaks, and it breaks *silently until it doesn't*: on a slow network the 250 ms
window never overlaps and the same adapter works fine, which makes this look like a flake.

The failure is at least loud rather than corrupting: it aborts on transaction 2 instead of producing a
stack at wrong addresses. But `nonce has already been used` points nowhere near the real explanation.

### Current workaround in this repo

`packages/hardhat-plugin/src/internal/deploy/ethersAdapters.ts` reads the count once and advances it
locally, sending every transaction with an explicit nonce:

```ts
let nextNonce: number | undefined = undefined;

async function takeNonce(): Promise<number> {
  if (nextNonce === undefined) {
    nextNonce = await provider.getTransactionCount(await signer.getAddress(), "latest");
  }
  return nextNonce++;
}
```

Correct, and arguably what any adapter for this API should do — but every consumer has to independently
discover that, and rediscover why.

(The other consumer-side option, constructing the provider with `cacheTimeout: -1`, is unavailable to
the Hardhat plugin: the provider belongs to Hardhat, not to us.)

### Fix on the `@fhevm/host-contracts-cleartext` side

**Fix 2a (recommended) — pass the nonce explicitly.** The package *already computes every one of these
numbers*; that is precisely what `precomputeAddresses` does. Handing them to the signer instead of
recomputing them by RPC makes the invariant unbreakable rather than merely documented, and costs one
optional field:

```diff
 export type DeployParameters = {
   readonly abi?: readonly unknown[];
   readonly bytecode: string;
   readonly args?: readonly unknown[];
+  /**
+   * Nonce this creation must occupy. Every host address is CREATE(deployer, nonce), so an
+   * implementation MUST send with exactly this nonce rather than letting its web3 library choose.
+   */
+  readonly nonce?: bigint;
 };
```

with the same field threaded into the `writeContract` parameter object. `deploy()` allocates from the
same counter `precomputeAddresses` walks, so addresses and nonces cannot drift apart by construction.

Two details worth getting right:

- `deployPauserSetContract` takes a separate `pauserSetDeployer`, which has its own nonce sequence.
  Allocate per signer, not globally.
- Keep the field optional so existing adapters keep working; an adapter that ignores it is no worse off
  than today.

**Fix 2b (minimum) — state the invariant on the interface.** Even with 2a, `AbstractEthereumSigner`
should carry a doc comment saying implementations must not rely on a provider-queried nonce, and naming
why (ethers' 250 ms `cacheTimeout`, viem's request dedupe). This is the single most surprising thing
about implementing the interface and currently nothing hints at it.

**Fix 2c (optional) — make the failure self-explaining.** Wrap the sends in `deployEmptyProxiesV12/V13`
so a failure from the underlying library is re-thrown with the likely cause attached:

```
Failed to deploy <name> at nonce <n>. If this is a nonce error, the AbstractEthereumSigner
implementation is probably letting its web3 library choose nonces; it must send with the nonce this
package supplies. See <link>.
```

**Fix 2d (optional, cheap) — assert the sequence advanced.** After each phase, re-read the deployer's
nonce and check it moved by the expected count. `assertDeployedAddress` already catches divergence a
step later; this would catch it at the source with a better message. Largely subsumed by 2a.

### Verification

A regression test that deploys against anvil through an adapter that lets ethers pick nonces, with
`cacheTimeout` left at its default. It fails today; with 2a it passes.

### Update — upstream took 2b + 2c, not 2a

The rebuilt `0.13.0` implements the two documentation/diagnostic fixes and leaves the interface
signature alone. `DeployParameters` and `AbstractEthereumSigner` are byte-for-byte unchanged; there is
no `nonce` field.

**2b** — `AbstractEthereumSigner` now carries a doc block stating the contract outright: the adapter
owns the whole transaction lifecycle, must read the count *once per signer* and advance it locally,
must not let its web3 library choose per send (naming ethers' 250 ms `cacheTimeout` and viem's
dedupe), and must resolve only once mined. It also records that the package reads the deployer's nonce
exactly once — deliberately never re-reading it to check progress, since that read is subject to the
same cache — and detects drift by comparing deployed addresses instead.

**2c** — `utils.ts` adds `sendStep({ label, send })`, which labels the failing step and appends
`ADAPTER_NONCE_HINT` *only when the underlying error mentions a nonce*, so a revert or out-of-gas is
not buried under a paragraph about nonces. `assertDeployedAddress` carries the same hint, because a
nonce that drifts without colliding shows up there instead.

**2d, unplanned and better than any of the above — upstream now ships a reference adapter** at
`<host-contracts-cleartext>/test/ts/utils/ethersEthereumLib.ts`, headed "Copy this file into your own
project and change the imports — it depends on nothing from this test suite."

This repo's hand-written `ethersAdapters.ts` has been **replaced by a verbatim copy** of it, at
`packages/hardhat-plugin/src/internal/deploy/ethersEthereumLib.ts`, listed in `.prettierignore` so
re-syncing stays a plain `cp`. The reference implementation is a strict superset of what was here and
corrects a real defect plus three latent ones:

| | hand-written version | reference version |
| - | -------------------- | ----------------- |
| nonce commit | `nextNonce++` at reserve time — **a failed broadcast left a permanent gap**, and every later address inherits it | reserve, then commit only after the node accepts the broadcast |
| concurrency | none; correct only because `deploy()` happens to be sequential | all sends serialized through one promise chain |
| first read | `latest` — misses a transaction already in flight | `pending` |
| receipt | address/`wait()` only | also asserts `receipt.status === 1`, so a mined-but-reverted step stops here rather than three steps later |
| `readContract` | would call `undefined` if the ABI lacked the function | explicit "not in the supplied ABI" error |
| `setCodeAt` | threw | implemented against `anvil_setCode` |

Re-verified end-to-end after the swap: all ten addresses match `LocalHostAddresses.sol`, `ACL.owner()`
is the standing `ACLOwner`, the ACL→FHEVMExecutor cross-reference resolves, 2.07 s cold / 21 ms
idempotent, and it typechecks under this package's `strict` + `exactOptionalPropertyTypes` settings.

**Standing rule: track the upstream sample.** Do not hand-edit the vendored file; anything this
project needs on top belongs in `setup.ts`.

2a (passing the nonce explicitly) would still be the strongest fix — it would make the invariant
unbreakable rather than merely documented and correctly implemented — but with 2b + 2c + a reference
implementation to copy, the remaining risk is small.

---

---

## Problem 3 — `@fhevm/sdk`: `core/`-backed subpaths are unresolvable under `node10`

Found while wiring step 3 of the migration. Same shape as problem 1, different package.

`@fhevm/sdk`'s subpaths split into two groups by whether the directory they are *imported from* exists
in the package:

| subpath | node10 marker | resolves under `node10`? |
| ------- | ------------- | ------------------------ |
| `./ethers`, `./ethers/cleartext`, `./viem`, `./viem/cleartext` | `ethers/package.json` etc., at the imported path | ✅ |
| `./base`, `./chains`, `./types`, `./actions/*` | `core/<name>/package.json` — **not** at the imported path | ❌ |

The second group has a second, independent bug: those markers' legacy fields drop the `core/` segment.
`core/chains/package.json` reads

```json
{ "types": "../../_types/chains/index.d.ts", "main": "../../_cjs/chains/index.js" }
```

but the real files are at `_types/core/chains/index.d.ts` and `_cjs/core/chains/index.js`. Verified:
`_types/chains/`, `_cjs/chains/` and `_esm/chains/` do not exist. So even importing the deep path
`@fhevm/sdk/core/chains` would not work — and the `exports` map blocks it anyway.

Node is unaffected: `require('@fhevm/sdk/chains')` resolves correctly through `exports` to
`_cjs/core/chains/index.js`. This is types-only.

**Fix:** for each `core/`-backed subpath, either (a) correct the three fields in
`core/<name>/package.json` to include the `core/` segment *and* add a node10 marker at the imported
path (`chains/package.json`, `types/package.json`, `base/package.json`, `actions/<name>/package.json`),
or (b) do what `ethers/` already does and place the built output at the path it is imported from.
Option (b) is what makes the `ethers` subpaths work today and needs no extra files.

**Workaround here:** explicit `paths` entries in `packages/hardhat-plugin/tsconfig.base.json` for
`@fhevm/sdk/chains`, `/types`, `/base` and `/actions/*`.

## Problem 4 — `@fhevm/sdk` does not export `FhevmClient` or `FheType`

Two types the SDK defines and returns, but does not re-export from any public entry point:

- **`FhevmClient`** — the return type of both `createFhevmClient` and `createFhevmCleartextClient`.
  `@fhevm/sdk/types` exports `FhevmEncryptClient` and `FhevmDecryptClient` but not the combined type,
  which lives in `core/types/fhevmClient.d.ts`. A consumer that stores a client in a field cannot name
  its type. Worked around in `internal/sdkTypes.ts` via
  `ReturnType<typeof createFhevmCleartextClient>`.
- **`FheType`** — the `'ebool' | 'euint8' | … | 'eaddress'` union in `core/types/fheType.d.ts`, plus
  `FheTypeToValueTypeMap` / `FheTypeToIdMap`. `encryptValue` takes `value.type` as a bare `string`, so
  callers work without it but get no compile-time checking of the one field most likely to be wrong.

**Fix:** re-export both from `core/types/index.d.ts`. Two lines, and every typed consumer needs them.

## Problem 5 — `@fhevm/sdk` misdiagnoses the uninitialized (zero) handle

A Solidity FHE variable that has never been assigned reads back as `bytes32(0)`. This is not an edge
case — it is probably the single most common reason a decryption call fails, and it means exactly one
thing: *the value was never written*.

The SDK decodes the zero word structurally and reports the first field that fails validation:

```
Handle (0x0000000000000000000000000000000000000000000000000000000000000000)
  has chainId 0, expected 31337
```

That is true, and it points the reader at the wrong thing entirely — it reads like a network or
configuration mismatch. `@fhevm/mock-utils` special-cased it as `Handle is not initialized`, which is
the diagnosis that actually applies.

**Fix:** check for the all-zero handle before structural decoding and report it as uninitialized.

**Workaround here:** `assertHandleIsInitialized` in `internal/fhevmHandle.ts`, called at every
decryption entry point before the handle reaches the SDK.

## What this repo deletes once the upstream fixes land

| Upstream fix | Removed here | Status |
| ------------ | ------------ | ------ |
| 1a | the `paths` block in `packages/hardhat-plugin/tsconfig.base.json` and its 12-line comment | ✅ done |
| 1b | the remaining `node10` pin in `tsconfig.base.json`; the plugin could then move to `moduleResolution: "node16"` | ⬜ blocked on upstream |
| 2a | the local nonce counter in the ethers adapter, which would become "use the nonce you were given" | ⬜ not taken upstream. 2b + 2c landed, plus a reference adapter — so the whole adapter is now vendored from upstream rather than maintained here |

Neither workaround is load-bearing beyond this: `setup.ts` itself is unaffected, and the deploy it
performs is already verified correct end-to-end against anvil (all 10 addresses match
`LocalHostAddresses.sol`, `ACL.owner()` is the standing `ACLOwner`, 2.07 s cold / 23 ms idempotent).
