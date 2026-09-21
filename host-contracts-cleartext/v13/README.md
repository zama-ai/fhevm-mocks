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
| `src/FhevmCleartextDeploy.sol` | the deploy tool, and the **only** file a consumer imports                       |
| `script/`             | forge scripts (`*.s.sol`) — run by path, not imported, so outside the remapping |
| `src/_internal/`      | everything generated — addresses, bytecode blobs, bootstrap args, interfaces    |

It is the Foundry counterpart to `pkg/ts/`: both are optional conveniences, and the Solidity under
`pkg/src/` is still the product. The layout is deliberately Foundry-shaped — `src` and `script` where the
toolchain expects them — so `forge build` and `forge script` work with default config from inside
`pkg/forge`. There is no `test/` here: rule 14 keeps tests out of the payload, so the forge tests for these
tools live in the harness at `test/forge/FhevmCleartextDeploy.t.sol`.

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
    'fhevm-config-0.13.0/=config/',
    'host-contracts-cleartext-forge/=lib/host-contracts-cleartext/forge/src/',
]
```

Then:

```solidity
import {FhevmCleartextDeploy, IACL, ACL_ADDRESS} from "host-contracts-cleartext-forge/FhevmCleartextDeploy.sol";

contract MyTest is Test, FhevmCleartextDeploy {
    function setUp() public { deployLocalFhevm(); }
    function test_x() public view { IACL(ACL_ADDRESS).getVersion(); }
}
```

Everything comes through `FhevmCleartextDeploy.sol`: Solidity re-exports imported symbols, so the interfaces and
address constants it pulls in are reachable from it, and `ACL_ADDRESS` stays a compile-time constant rather
than a getter. `src/_internal/` is not API — reaching into it works, since Solidity has no directory
visibility, but nothing there is stable. `LocalHostBytecode.sol` especially: those blobs are pre-compiled
against the canonical addresses, so deploying them by hand bypasses `FhevmCleartextDeploy`'s nonce-ordering guards
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

## 1. Move the pin

One command, run from the workspace root, moves every pin THIS generation takes from upstream — its
contracts and its config together, and nothing of the previous generation's:

```sh
make bump-vendored PKG=./host-contracts-cleartext/v13 TAG=v0.13.6
# = fhevm-npm bump vendored ./host-contracts-cleartext/v13 --tag v0.13.6
```

It resolves the tag to its commit (a tag can be moved later; the commit is what makes the record
verifiable, rule 7), downloads `host-contracts/contracts` and `library-solidity/config` at that commit,
computes the digest each implies, and writes all of it: `npm-manifest.json` (tag, commit, digest, for
both pins), the copies under `pkg/src/contracts` and `internal/zama-config` (formatted by `forge fmt`
on the way in, upstream-only files adopted, dropped files removed), and `fhevm.vendoredFrom` in both
`package.json` files. Add `--check` to see what would move without writing.

Choosing _which_ tag is still a manual decision: numbering on a line is not reliably monotonic — a
higher patch number can be an **ancestor** of a lower one (rule 6). List and compare before you pick:

```sh
git tag --list 'v0.13.[0-9]*'
git merge-base --is-ancestor v0.13.3 v0.13.2 && echo "v0.13.3 is behind v0.13.2"
```

## 2. Read what changed

The command's report says, per pin, whether any copy was rewritten. `copies unchanged` for
`pkg/src/contracts` means steps 3, 4 and 7 are no-ops for this bump; `CHECK=1` gives that answer before
anything is written. Otherwise `git diff pkg/src/contracts`
is the list of upstream changes the rest of this checklist responds to. Cleartext may carry a **subset**
of upstream, so a newly adopted file is a decision to review, not a side effect to accept (rule 6).

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

## 5. If the protocol minor changed (0.13 → 0.14)

If the protocol minor changed (0.13 → 0.14)

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

This section is the AUTHORING side: what the NEW generation must point at. For the other side — what
THIS generation deletes once it stops being V(N) — see [ROTATION.md](ROTATION.md).

The upgrade path and its e2e are hardcoded to a specific pair of generations. For version N the
previous generation becomes N-1 everywhere:

```sh
# excludes build output (_cjs/_esm/_types) and the tarball fixture under test/ts/node_modules
grep -rln --exclude-dir=node_modules --exclude-dir=_types --exclude-dir=_cjs --exclude-dir=_esm \
  'V12\|v12' --include='*.ts' --include='*.sol' internal pkg test
#   internal/upgrade/runUpgradeE2e.ts         pkg/ts/types/public.ts
#   internal/constants.ts                     pkg/ts/upgrade.ts
#   pkg/src/cleartext/CleartextArithmetic.sol pkg/ts/utils.ts
#   pkg/src/cleartext/ICleartextArithmetic.sol test/ts/upgrade/library.test.ts
#   pkg/ts/addresses.ts                       test/ts/utils/viemEthereumLib.ts
#   pkg/ts/deploy.ts                          test/ts/upgrade/vitest.config.ts
#   pkg/ts/index.ts                           pkg/ts/types/private.ts
```

Three groups, in increasing order of effort:

1. **The previous-generation edge** — the devDependency pin in `package.json`, the import specifier
   `@fhevm/host-contracts-cleartext-v12-dev/pkg/ts/index.ts` in `test/ts/upgrade/library.test.ts`, and
   `PREVIOUS_GENERATION_DIR_ABS_PATH` in `test/e2e/upgrade/create2.test.ts`. Every one of them lives in
   an `upgrade/` directory that the rotation deletes whole.

   Much smaller than it used to be. The e2e once built v(N-1), packed it, and extracted it under an
   alias in `test/ts/node_modules` just to obtain an importable copy — a whole `prepareTestV12Consumer`
   plus fixture guards plus two skip paths. v(N-1) is a workspace member, so it is now simply imported
   through the link npm creates, and all of that is gone. A tarball is for testing a PUBLISH CONTRACT;
   using one to read a sibling's source bought nothing.

2. **The public API** — `pkg/ts/upgrade.ts` exports `updateV12ToV13`, and `pkg/ts/types/public.ts`
   declares `FhevmAddressesV12`, `FhevmAddresses` and `UpdateV12ToV13MigrationConfig`. Renaming these
   is a breaking change for consumers, so decide deliberately whether N-1→N gets new names or the old
   ones are kept.
3. **The Solidity** — `pkg/src/cleartext/CleartextArithmetic.sol` and `ICleartextArithmetic.sol` carry
   generation references too.

Also update `test/ts/upgrade/library.test.ts`, which imports the previous generation by its published name
(`@fhevm/host-contracts-cleartext-v12/ts`), and the v13-named tests (`deploy-v13.test.ts`, and the `v13`
strings in the other `test/ts` specs).

The e2e is designed to **skip rather than fail** when the sibling package is missing, so a half-finished
rename here is silent: `npm run test` still passes while the upgrade path is no longer covered. Confirm
the e2e actually ran rather than assuming a green suite means it did.

## 7. Check the reinitializer versions (do not "fix" them)

Only relevant if existing deployments must be upgraded. This is a **verification**, not an edit: five of
the six contracts carrying a reinitializer are vendored, so rule 6 forbids touching them here — a bump
arrives with the upstream sync (step 2) or not at all.

```sh
grep -rl 'function reinitializeV' pkg/src --include='*.sol'
#   pkg/src/contracts/{ACL,FHEVMExecutor,HCULimit,InputVerifier,KMSVerifier}.sol  ← VENDORED
#   pkg/src/cleartext/CleartextArithmetic.sol                                     ← cleartext-owned
```

`internal/listUpgradeOps.ts` does the comparison for you — point it at the previous generation and it
reports, per contract, whether the bytecode changed and whether the reinitializer moved:

```sh
npm run list:upgrade-ops -- ../host-contracts-cleartext-v12
#   contract                 bytecode  initializer                              verdict
#   ACL                      CHANGED   reinitializeV3 -> reinitializeV4         reinitialize
#   CleartextInputVerifier   same      reinitializeV2 -> reinitializeV2         no op
#   CleartextDB              same      - -> -                                   no op
#   KMSGeneration            -         initializeFrom{EmptyProxy,Migration}()   materialize
#   PauserSet                -                                                  not a proxy target
#
#   2 materializations, 5 reinitializations
```

It reads only committed JSON (`templates/` and `abi/`), so it needs no compilation and works against a
published tarball as easily as a sibling checkout. Two details make it trustworthy: it patches both
generations' placeholders to a **common** address set before comparing (the marker values differ per
generation, so a raw comparison would call everything changed), and it keys "is this a proxy target" off
`initializeFromEmptyProxy` rather than off the reinitializer — `CleartextDB`, `KMSGeneration` and
`ProtocolConfig` are proxy targets with no reinitializer at all.

Its output is a starting point, not a spec. It cannot tell you _which_ materializer to call — for
v12→v13 `updateV12ToV13` calls `initializeFromMigration` on `ProtocolConfig` (it seeds the migrated KMS
context) but `initializeFromEmptyProxy` on `KMSGeneration` — nor what arguments to pass, and it says
nothing about ordering. Compare its op list against `pkg/ts/upgrade.ts`; for v12→v13 the two agree
exactly (2 materializations, 5 reinitializations).

The helper takes the previous generation as an argument and hardcodes no version, so step 6's rename
does not touch it — only the path you pass changes.

A `⚠` verdict means the two signals disagree. `REINITIALIZER_VERSION` is a compile-time constant, and
the rule is two-sided:

| Bytecode changed? | Expected                                                   | If it is wrong                                                             | Reported as             |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------- |
| yes               | `REINITIALIZER_VERSION` bumped, `reinitializeV<n>` renamed | upgrading that proxy has no replay guard and no on-chain generation marker | `⚠ CHANGED, NOT BUMPED` |
| no                | **both untouched**                                         | a gratuitous bump forces a pointless upgrade op and burns a version number | `⚠ BUMPED, UNCHANGED`   |

So a missing bump is not automatically a defect. `InputVerifier` is the worked example: between v12 and
v13 its source changed by 11 lines — five doc-comment lines, named mapping parameters, and one private
constant renamed with an identical value — none of which reach the bytecode. It kept
`MINOR_VERSION = 2` / `REINITIALIZER_VERSION = 3` and is therefore **deliberately absent** from
`updateV12ToV13`'s op list. `pkg/ts/upgrade.ts` says so directly: _"its v13 bytecode is identical and its
version did not bump"_.

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
- `pkg/package.json` `fhevm.vendoredFrom`: written by step 1; verify with `make check-vendored-origin` (rule 7).

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
#   🔎 rule 6: src/contracts must match host-contracts/contracts at v0.13.2 (07fb05fb75f0)
#      ✅ 21 vendored files identical to upstream (21 upstream files scanned)
```

It reads the tag and commit from `pkg/package.json` → `fhevm.vendoredFrom`, so it can never drift from
what the package claims. `--verbose` also lists upstream files that are not vendored here. It skips
(exit 0) outside a git checkout or when the commit is not fetched, and fails if either side of the
comparison is empty — an extraction that produced nothing would otherwise look like success.

The rules 15/17 gate — the localhost address set still being the one `ZamaConfig.sol` hands out:

```sh
npm run check:zama-config         # also runs inside `npm run build`
#   🔎 rules 15 and 17: ZAMA_LOCAL_CONFIG must match ZamaConfig.sol _getLocalConfig()
#      host-contracts-cleartext/v13/internal/zama-config/ZamaConfig.sol
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

It reads this generation's own copy of upstream's `library-solidity/config/ZamaConfig.sol`, vendored into
`internal/zama-config/` at the same commit `pkg/src/contracts` is pinned to (rule 5.1.3c): the localhost
addresses are graded against the config the vendored contracts were released with, not against whatever
`@fhevm/solidity` happens to be installed. `fhevm-npm sync vendored` writes the copy; it is never edited.

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
