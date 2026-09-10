# Install

```sh
# remove all node_modules and dependencies etc., only keep package-lock.json
# re-install all
./scripts/install.sh --reset --lockfile=keep
```

# Test

```sh
npm run test
```

# Anvil

Start a new anvil with a fresh deployed cleartext

```sh
./scripts/anvil.sh
```

# Consuming `pkg/forge` from Foundry

`pkg/forge/` holds the forge-only artifacts — everything needed to stand the stack up from Foundry:

| Path                  | Contents                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| `src/FhevmDeploy.sol` | the deploy tool, and the **only** file a consumer imports                       |
| `script/`             | forge scripts (`*.s.sol`) — run by path, not imported, so outside the remapping |
| `src/_internal/`      | everything generated — addresses, bytecode blobs, bootstrap args, interfaces    |

It is the Foundry counterpart to `pkg/ts/`: both are optional conveniences, and the Solidity under
`pkg/src/` is still the product. The layout is deliberately Foundry-shaped — `src` and `script` where the
toolchain expects them — so `forge build` and `forge script` work with default config from inside
`pkg/forge`. There is no `test/` here: rule 14 keeps tests out of the payload, so the forge tests for these
tools live in the harness at `test/FhevmDeploy.t.sol`.

The two `LocalHost*.sol` files are halves of one artifact — the bytecode is compiled against exactly those
addresses — so they are regenerated together and `test/templates.test.ts` fails if they drift apart. The
deploy order is not a convenience listing: each address is fixed by `CREATE(deployer, nonce)`, so deploying
in a different order, or from a different account or start nonce, moves every address while the bytecode
keeps pointing at the old ones. The nonces with no named address are the empty-proxy implementations each
proxy is constructed over.

It sits **outside** `foundry.toml`'s `src`, deliberately. Forge therefore never compiles it here, so these
files cannot become inputs to the build that produces them, their pragma is free of the harness's pinned
solc, and a consumer sweeping `src/` does not compile ~139 KB of hex it may never use.

The cost is that forge's automatic `<name>/` → `lib/<name>/src/` mapping cannot reach outside `src/`, so
the consuming layer (`forge-fhevm`) declares one more remapping:

```toml
[profile.default]
remappings = [
    'fhevm-config-0.14.0/=config/',
    'host-contracts-cleartext-forge/=lib/host-contracts-cleartext/forge/src/',
]
```

Then:

```solidity
import {FhevmDeploy, IACL, ACL_ADDRESS} from "host-contracts-cleartext-forge/FhevmDeploy.sol";

contract MyTest is Test, FhevmDeploy {
    function setUp() public { deployFhevm(); }
    function test_x() public view { IACL(ACL_ADDRESS).getVersion(); }
}
```

Everything comes through `FhevmDeploy.sol`: Solidity re-exports imported symbols, so the interfaces and
address constants it pulls in are reachable from it, and `ACL_ADDRESS` stays a compile-time constant rather
than a getter. `src/_internal/` is not API — reaching into it works, since Solidity has no directory
visibility, but nothing there is stable. `LocalHostBytecode.sol` especially: those blobs are pre-compiled
against the canonical addresses, so deploying them by hand bypasses `FhevmDeploy`'s nonce-ordering guards
and produces a stack whose bytecode points at addresses nothing lives at.

Note `_internal/LocalHostAddresses.sol` declares the same constant names as the
`fhevm-config-<version>/addresses.sol` you supply for compiling `pkg/src` — import one or the other into a
given file, or alias.

Two constant flavors, and the difference matters:

- **`_CREATION_CODE`** must be deployed — the constructor either takes arguments or writes storage.
  Deploying these in order from account index 5 of the anvil mnemonic, starting at nonce 0, reproduces
  exactly the addresses in the file's header (rule 17). The bytecode and the addresses are two halves of
  one artifact; mixing in another deployer silently breaks every baked-in reference.
- **`_RUNTIME_CODE`** may be etched at its address, being equivalent to constructing the contract. Only
  `PauserSet` qualifies: everything else either takes constructor arguments, carries an immutable, or calls
  `_disableInitializers()` — a storage write that etching skips, leaving an implementation directly
  initializable where a constructed one is not.

Regenerate with `npm run generate:local-host-bytecode`, which also runs as the last step of
`npm run build:templates`. `test/templates.test.ts` checks the committed output against the templates, so a
stale file fails the suite.

# How to migrate to new host-contracts

The obvious path for any new version. Exceptions are the norm — treat this as the checklist you start
from, not one you can follow blindly.

## 1. Pick the upstream tag and resolve it to a commit

Pick the upstream tag and resolve it to a commit

This package lives _inside_ the fhevm repo, so plain `git` here already targets the right repository.

```sh
# stable tags on the 0.14 line (the [0-9] pattern skips prereleases like v0.14.1-1)
git tag --list 'v0.14.[0-9]'
#   v0.14.0  v0.14.1

# resolve the chosen tag to the commit it points at
git rev-list -n 1 v0.14.1
#   e7e7fecf10ea7a59c68603376caac2a308e18cca
```

Both values go into `pkg/package.json` → `fhevm.vendoredFrom` (step 8). The commit matters because a
tag can be moved or re-pointed later, so the commit is what makes the record verifiable (rule 7).

Choosing _which_ tag is a manual decision: numbering on a line is not reliably monotonic — `v0.13.3` is
an **ancestor** of `v0.13.2`, so the highest patch number is not necessarily the newest code (rule 6).
Confirm with:

```sh
git merge-base --is-ancestor v0.13.3 v0.13.2 && echo "v0.13.3 is behind v0.13.2"
```

## 2. Sync the vendored sources

Sync the vendored sources

Copy `host-contracts/contracts` into `pkg/src/contracts` — but only the files already vendored here.
Cleartext may carry a **subset**, so adopting a new upstream file is a decision, not a side effect of the
copy (rule 6).

On the 0.14 line the first judgment call arrived: `contracts/bridge/` is new, and its three
LayerZero-dependent sources (`ConfidentialBridge`, `HandlesSender`, `HandlesReceiver`) import packages a
local cleartext stack has no use for. They are vendored anyway, so the mirror stays complete at 27 files,
and listed under `skip` in `foundry.toml` so they are never compiled; `ACL` only needs the dependency-free
`bridge/interfaces/IConfidentialBridge.sol`, and reads a literal `confidentialBridgeAdd = address(0)` from
`pkg/src/addresses/FHEVMHostAddresses.sol`, upstream's convention for "no bridge on this chain".

## 3. Update the cleartext variants

Update the cleartext variants

Anything in `pkg/src/cleartext/` that extends a synced contract may need the same change —
`CleartextFHEVMExecutor extends FHEVMExecutor`, so an upstream signature change lands here too.

## 4. Addresses, if the host address set changed

Addresses, if the host address set changed

1. `pkg/src/addresses/FHEVMHostAddresses.sol` — add/remove the `*Add` aliases.
2. `ADDRESS_NAMES` in `internal/generateTemplates.ts` — the single definition; `generatePlaceholders.ts`
   imports it.
3. `TARGET_CONTRACTS` in `internal/generateTemplates.ts` — add/remove contracts to template.
4. `internal/placeholders/addresses.sol` is **generated** — do not hand-edit it. Run
   `npm run generate:placeholders` (also runs as the first step of `build:templates`).

## 5. If the protocol minor changed (0.14 → 0.15)

If the protocol minor changed (0.14 → 0.15)

The config remapping prefix is version-pinned, so find every occurrence rather than trusting a list:

```sh
grep -rn --exclude-dir=node_modules --exclude-dir=_cjs --exclude-dir=_esm --exclude-dir=_types \
  'fhevm-config-' .
```

Sweep the whole tree, not just `remappings.txt` and `pkg/src`: there are **four** executable sites —
those two plus `internal/constants.ts` (`FHEVM_CONFIG_REMAPPING_PREFIX`) and `scripts/deploy.sh`
(`CONFIG_PREFIX`) — and two more in prose, the `FOUNDRY_REMAPPINGS=` usage lines in
`pkg/forge/script/FhevmDeployScript.s.sol` and `VerifyFhevmDeploy.s.sol`. A narrower grep found only the
first two and left `deploy.sh` pointing at the previous generation, which fails at _run_ time rather than
compile time. The consuming layer (`forge-fhevm`) declares the new prefix for its own consumers — see
RULES.md rule 11.

## 6. Re-point the previous generation (V(N-1))

Re-point the previous generation (V(N-1))

The upgrade path and its e2e are hardcoded to a specific pair of generations. For version N the
previous generation becomes N-1 everywhere:

```sh
# excludes build output (_cjs/_esm/_types) and the tarball fixture under test/ts/node_modules
grep -rln --exclude-dir=node_modules --exclude-dir=_types --exclude-dir=_cjs --exclude-dir=_esm \
  'V13\|v13' --include='*.ts' --include='*.sol' internal pkg test
#   about thirty files at v14, most of them prose; the ones that matter are the three groups below:
#   internal/constants.ts                     pkg/ts/upgrade.ts
#   package.json                              pkg/ts/types/public.ts
#   test/ts/upgrade/library.test.ts           pkg/src/cleartext/{CleartextArithmetic,ICleartextArithmetic}.sol
#   test/e2e/upgrade/create2.test.ts          create2-deploy/upgrade/{testnet.ts,anvil-config.json}
```

Three groups, in increasing order of effort:

1. **The previous-generation edge** — `internal/constants.ts` (`PREVIOUS_GENERATION_DIR_ABS_PATH`),
   the devDependency pin in `package.json`, and the import specifier
   `@fhevm/host-contracts-cleartext-v13-dev/pkg/ts/index.ts` in `test/ts/upgrade/library.test.ts`,
   plus the CREATE2 side: `create2-deploy/upgrade/anvil-config.json`'s `previousAbiDir` and the default in
   `create2-deploy/upgrade/testnet.ts`.

   Much smaller than it used to be. The e2e once built v(N-1), packed it, and extracted it under an
   alias in `test/ts/node_modules` just to obtain an importable copy — a whole `prepareTestV13Consumer`
   plus fixture guards plus two skip paths. v(N-1) is a workspace member, so it is now simply imported
   through the link npm creates, and all of that is gone. A tarball is for testing a PUBLISH CONTRACT;
   using one to read a sibling's source bought nothing.

2. **The public API** — `pkg/ts/upgrade.ts` exports `updateV13ToV14`, and `pkg/ts/types/public.ts`
   declares `FhevmAddressesV13`, `FhevmAddresses` and `UpdateV13ToV14MigrationConfig`. Renaming these
   is a breaking change for consumers, so decide deliberately whether N-1→N gets new names or the old
   ones are kept. v14 renamed: a v13 consumer calling `updateV12ToV13` gets a compile error, not a
   silently different upgrade.
3. **The Solidity** — `pkg/src/cleartext/CleartextArithmetic.sol` and `ICleartextArithmetic.sol` carry
   generation references too.

Also update `test/ts/upgrade/library.test.ts`, which imports the previous generation by its published name
(`@fhevm/host-contracts-cleartext-v13/ts`), and the v14-named tests (`deploy-v14.test.ts`, and the `v14`
strings in the other `test/ts` specs).

The e2e is designed to **skip rather than fail** when the sibling package is missing, so a half-finished
rename here is silent: `npm run test` still passes while the upgrade path is no longer covered. Confirm
the e2e actually ran rather than assuming a green suite means it did.

## 7. Check the reinitializer versions (do not "fix" them)

Only relevant if existing deployments must be upgraded. This is a **verification**, not an edit: seven of
the eight contracts carrying a reinitializer are vendored, so rule 6 forbids touching them here — a bump
arrives with the upstream sync (step 2) or not at all.

```sh
grep -rl 'function reinitializeV' pkg/src --include='*.sol'
#   pkg/src/contracts/{ACL,FHEVMExecutor,HCULimit,InputVerifier,KMSVerifier,ProtocolConfig,KMSGeneration}.sol  ← VENDORED
#   pkg/src/cleartext/CleartextArithmetic.sol                                                                  ← cleartext-owned
```

`internal/listUpgradeOps.ts` does the comparison for you — point it at the previous generation and it
reports, per contract, whether the bytecode changed and whether the reinitializer moved:

```sh
npm run list:upgrade-ops -- ../v13
#   contract                 bytecode  initializer                              verdict
#   ACL                      CHANGED   reinitializeV4 -> reinitializeV5         reinitialize
#   CleartextArithmetic      CHANGED   reinitializeV2 -> reinitializeV3         reinitialize
#   CleartextInputVerifier   same      reinitializeV2 -> reinitializeV2         no op
#   CleartextDB              same      - -> -                                   no op
#   KMSGeneration            CHANGED   - -> reinitializeV2                      reinitialize
#   ProtocolConfig           CHANGED   - -> reinitializeV2                      reinitialize
#   PauserSet                -                                                  not a proxy target
#
#   0 materializations, 7 reinitializations
```

It reads only committed JSON (`templates/` and `abi/`), so it needs no compilation and works against a
published tarball as easily as a sibling checkout. Two details make it trustworthy: it patches both
generations' placeholders to a **common** address set before comparing (the marker values differ per
generation, so a raw comparison would call everything changed), and it keys "is this a proxy target" off
`initializeFromEmptyProxy` rather than off the reinitializer — `CleartextDB`, `KMSGeneration` and
`ProtocolConfig` are proxy targets with no reinitializer at all.

Its output is a starting point, not a spec. It cannot tell you what arguments a reinitializer takes — for
v13→v14 `updateV13ToV14` passes `ProtocolConfig.reinitializeV2` the re-declared KMS node set, the software
version and the PCR values, while `KMSGeneration.reinitializeV2()` takes nothing — and it says nothing
about ordering. Compare its op list against `pkg/ts/upgrade.ts`; for v13→v14 the two agree on the seven
reinitializations.

The helper takes the previous generation as an argument and hardcodes no version, so step 6's rename
does not touch it — only the path you pass changes.

A `⚠` verdict means the two signals disagree. `REINITIALIZER_VERSION` is a compile-time constant, and
the rule is two-sided:

| Bytecode changed? | Expected                                                   | If it is wrong                                                             | Reported as             |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------- |
| yes               | `REINITIALIZER_VERSION` bumped, `reinitializeV<n>` renamed | upgrading that proxy has no replay guard and no on-chain generation marker | `⚠ CHANGED, NOT BUMPED` |
| no                | **both untouched**                                         | a gratuitous bump forces a pointless upgrade op and burns a version number | `⚠ BUMPED, UNCHANGED`   |

So a missing bump is not automatically a defect. `InputVerifier` is the worked example: its v14 bytecode
is identical to v13's, it kept `MINOR_VERSION = 2` / `REINITIALIZER_VERSION = 3`, and it is therefore
**deliberately absent** from `updateV13ToV14`'s op list. `pkg/ts/upgrade.ts` says so directly: _"its v14
bytecode is identical and its version did not bump"_.

`CleartextArithmetic` is the other kind of worked example. Before v14 implemented `fheMulDiv` the helper
reported it `⚠ CHANGED, NOT BUMPED`: its source had not changed, but it takes `FHEVMExecutor.Operators` as
a parameter and that enum had gained `fheMulDiv`, so the enum range check moved and nothing else. That was
a correct "no bump" — until the operator was implemented (`recordMulDiv`, a new selector), which is a real
change and got the bump above: `reinitializeV3`, v0.5.0, and a seventh op in the upgrade.

What to check, per contract whose bytecode changed: that upstream bumped it, and that the op list in the
upgrade path matches. A contract whose bytecode did not change should not appear there at all.

Two things that trip people up:

- **The name and the counter differ by one.** `reinitializeV2` is gated by `reinitializer(3)`, because
  `initializeFromEmptyProxy` also consumes `reinitializer(REINITIALIZER_VERSION)`. The function name
  tracks the contract's _minor_ version (`MINOR_VERSION = 2`), not the counter.
- **The bodies are empty.** `function reinitializeV4() public virtual reinitializer(REINITIALIZER_VERSION) {}`
  initializes nothing; its only effect is advancing the counter. The bump is bookkeeping and a replay
  guard, not initialization — which is why an upgrade with empty `initData` is mechanically legal, just
  outside this codebase's convention (see `plans/FORGE_DEPLOY_SCRIPT_PLAN.md`).

## 8. Version and provenance

Version and provenance

- `pkg/package.json` `version`: major.minor must equal the fhevm line, patch is free (rule 5).
- `pkg/package.json` `fhevm.vendoredFrom`: update `tag` and `commit` to step 1 (rule 7).

## 9. Rebuild, then refresh the baseline

Rebuild, then refresh the baseline

Order matters — `generate:patch-sites` reads the templates that `build:templates` produces.

```sh
npm run build:templates      # forge build + abi/ + templates/ + ts/artifacts/ + signers
npm run generate:patch-sites # refresh internal/placeholders/patch-sites.json
```

Review the patch-sites diff rather than accepting it. A count falling to **0** for an address the
contracts still use means the deploy would bake in a placeholder.

## 10. Check the size budget

Check the size budget

New upstream code can breach EIP-170, and the margin is thin — `CleartextFHEVMExecutor` sits ~1.5 KB
under the 24,576 B cap. There is no `--code-size-limit` escape hatch (rule 12).

```sh
forge build --sizes
```

## 11. Verify

Verify

```sh
npm run lint
npm run test                 # includes the forge-vs-template equivalence test
./scripts/anvil.sh           # deploys, then checks the stack matches ZamaConfig.sol
```

The rule 6 gate — vendored sources byte-identical to the declared commit:

```sh
npm run check:vendored-origin             # validate npm-manifest.json vendored sources
#   🔎 rule 6: src/contracts must match host-contracts/contracts at v0.14.1 (e7e7fecf10ea)
#      ✅ 27 vendored files identical to upstream (27 upstream files scanned)
```

It reads the tag and commit from `pkg/package.json` → `fhevm.vendoredFrom`, so it can never drift from
what the package claims. `--verbose` also lists upstream files that are not vendored here. It skips
(exit 0) outside a git checkout or when the commit is not fetched, and fails if either side of the
comparison is empty — an extraction that produced nothing would otherwise look like success.

The rules 15/17 gate — the localhost address set still being the one `ZamaConfig.sol` hands out:

```sh
npm run check:zama-config         # also runs inside `npm run build`
#   🔎 rules 15 and 17: ZAMA_LOCAL_CONFIG must match ZamaConfig.sol _getLocalConfig()
#      library-solidity/config/ZamaConfig.sol
#      ✅ ACLAddress           aclAddress             0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D
#      ✅ CoprocessorAddress   fhevmExecutorAddress   0xe3a9105a3a932253A70F126eb1E3b589C643dD24
#      ✅ KMSVerifierAddress   kmsVerifierAddress     0x901F8942346f7AB3a01F6D7613119Bca447Bb030
```

This is the one direction the other address checks do not cover. `generateLocalHostBytecode.ts` asserts
the _derived_ addresses equal `ZAMA_LOCAL_CONFIG`, and `test/templates.test.ts` asserts the generated
forge constants do too — but all of them compare against that same hand-written constant in
`internal/constants.ts`. An upstream edit to `_getLocalConfig()` therefore leaves the whole chain
self-consistent and collectively wrong. This one parses the Solidity instead, so the transcription is
checked against its source.

It reads the file, compiles nothing, and refuses to pass vacuously: an absent `ZamaConfig.sol`, a 31337
branch that no longer routes to `_getLocalConfig()`, a renamed field, or a **new** field are all
failures rather than skips. A new field especially — that is an address the cleartext stack has to place,
and quietly ignoring it would narrow the check to the three fields we happen to know about.

Note it verifies the address _set_, not where a deploy actually lands; that is `./scripts/anvil.sh`
below (and still not part of `npm run test` — see RULES.md rule 17).

## Things that bite

- `test/templates.test.ts` has its own `ALTERNATE_ADDRESSES` fixture; a new host address must be added
  there too or the patching tests fail.
- The bootstrap config types (`BootstrapConfig` and friends in `pkg/ts/types/public.ts`) change
  whenever upstream adds an initializer parameter.
