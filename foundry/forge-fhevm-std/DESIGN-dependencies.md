# forge-fhevm-std: dependency and packaging design

Status: research report, 2026-09-16. Sources: foundry `master` @ b7ab8b6 (2026-09-15), `foundry-compilers` 0.20,
`soldeer-core` 0.10.1, and experiments run with the installed `forge 1.5.1`. Every claim is tagged
**[exp]** (reproduced with forge 1.5.1), **[src]** (read in source only) or **[src+exp]**.

## 1. Hard constraint

`forge-fhevm-std` and `@fhevm/solidity` must resolve `encrypted-types/EncryptedTypes.sol` to the **same file**.
`EncryptedTypes.sol` contains only `type euintN is bytes32` declarations. Two copies from two paths are two
distinct Solidity types, so a vendored copy would not interoperate with any contract using `@fhevm/solidity`.
Consequences:

- Never vendor or inline encrypted-types. Import it exactly as `@fhevm/solidity` does: `import "encrypted-types/EncryptedTypes.sol"`.
- `@fhevm/solidity` is npm-only, imports encrypted-types via npm `dependencies`, and ships **no** consumer remappings
  (`library-solidity/package.json`, `lib/FHE.sol:8`). Every forge dApp using it therefore already has
  `node_modules/encrypted-types/`. That copy is the one we must bind to.
- encrypted-types: npm `encrypted-types@0.0.4`, one flat file at the package root, `pragma ^0.8.24`, zero imports,
  not on the Soldeer registry.

## 2. How forge resolves a dependency (facts that drive the design)

1. **Remapping precedence** (first wins, `crates/config/src/providers/remappings.rs:196-262`) [src+exp]:
   CLI `--remappings` > `DAPP_REMAPPINGS`/`FOUNDRY_REMAPPINGS` > root `remappings.txt` > root `foundry.toml remappings`
   > dependency `foundry.toml remappings` (and, since v1.8.0, dependency `remappings.txt`) > auto-detected.
   Same-name duplicates: shortest path wins, tie-break prefers a path ending in `src` (`insert_closest`).
2. **Auto-detection** (`foundry-compilers-artifacts-solc/src/remappings/find.rs`) [src+exp]:
   alias = dependency folder name + `/`. Under `lib/`: target is `<dep>/src/` if a `src/` exists, else the folder
   containing `.sol` files. Under `node_modules/`: target is always the **package root**. Nested `lib/x/lib/y/` is
   found and flattened into the global namespace. Folders named `test`, `tests`, `demo` are never scanned.
   `node_modules` is auto-added to `libs` when it exists. `package.json` is **never** read.
3. **A dependency's `foundry.toml` `[profile.default]` is read** by the consumer's forge (since 2023, all forge 1.x)
   [src+exp]. Its `remappings` are **rebased under the dependency path**: a shipped
   `encrypted-types/=node_modules/encrypted-types/` becomes `encrypted-types/=lib/forge-fhevm-std/node_modules/encrypted-types/`
   in the consumer. Its `libs` are also walked (master). Since v1.8.0 the dependency's `remappings.txt` is read too.
4. **`forge install`** (`crates/cli/src/install.rs`) [src]: `git submodule add` into `libs[0]` (default `lib/`), then
   `git submodule update --init --recursive` **inside the dependency**, so every nested submodule of the library is
   cloned into every consumer. Writes `foundry.lock` (tag/branch/rev), never `remappings.txt`. No ref given: picks the
   highest semver tag. If the installed dependency contains a `soldeer.lock`, forge runs `soldeer install` inside it.
   `--no-git` clones without `.git`/`.gitmodules`/lockfile entry.
5. **Soldeer** [src]: installs to `dependencies/<name>-<version>/`, generates `<name>-<version>/=dependencies/<name>-<version>/`
   (package root, version in alias). Never reads the dependency's `foundry.toml`/`remappings.txt`. `recursive_deps`
   (consumer opt-in, default off) installs the dependency's `[dependencies]` **nested** under it and generates **no**
   remapping for them. No npm/node_modules support. Registry zips honour `.gitignore`/`.soldeerignore`; git deps keep `.git`.
6. **Nothing lets a library act on the consumer's behalf** [src]: no hooks, no "install if missing". Only the
   remapping layer decides which copy of a duplicated dependency is used.

## 3. Experiments (forge 1.5.1, dApp with `@fhevm/solidity` + `encrypted-types` in `node_modules`)

Library layout `src/FhevmStd.sol` importing `encrypted-types/EncryptedTypes.sol`. `@fhevm/solidity/=node_modules/@fhevm/solidity/`
must be written by the dApp in every case (its sources live in a folder named `lib`, which forge treats as a barrier).

| # | Install channel / library ships | Resulting `encrypted-types/` | Import of our lib | Build |
|---|---|---|---|---|
| A | git, `src/` only, no foundry.toml | `node_modules/encrypted-types/` (auto) | `forge-fhevm-std/X.sol` | OK |
| B | git, foundry.toml with `remappings=[encrypted-types/=node_modules/...]` | same as A (dApp copy wins) | same | OK |
| B' | as B, dApp has **no** node_modules copy | `lib/forge-fhevm-std/node_modules/encrypted-types/` (rebased, missing) | same | **FAIL** |
| C | git, foundry.toml with `src="src"`, no remappings | same as A | same | OK |
| F | git, nested submodule `lib/encrypted-types`, dApp has node_modules copy | `node_modules/encrypted-types/` (shorter path wins) | same | OK |
| F' | as F, dApp has no node_modules copy | `lib/forge-fhevm-std/lib/encrypted-types/` | same | OK |
| N1 | npm, `src/` layout | auto | `forge-fhevm-std/X.sol` | **FAIL** (alias points at package root) |
| N2 | npm, `src/` layout | auto | `forge-fhevm-std/src/X.sol` | OK |
| N3 | npm, flat layout (`.sol` at root) | auto | `forge-fhevm-std/X.sol` | OK |
| G2 | git, flat layout | auto | `forge-fhevm-std/X.sol` | OK |
| G3 | git, `src/` layout | auto | `forge-fhevm-std/src/X.sol` | **FAIL** (with or without shipped foundry.toml) |
| S1 | soldeer, `src/` layout, soldeer `remappings.txt` | auto | `forge-fhevm-std-0.1.0/src/X.sol` | OK |
| S2 | soldeer, autodetect only | auto (`forge-fhevm-std-0.1.0/=.../src/`) | `forge-fhevm-std/X.sol` | FAIL (alias mismatch, expected) |
| E | git, dApp `auto_detect_remappings=false` + 3 explicit lines | explicit | `forge-fhevm-std/X.sol` | OK |

Dev setup check: library repo with `node_modules/encrypted-types` (npm) and `forge install foundry-rs/forge-std@v1.11.0 --no-git`
into a gitignored `lib/`: no `.gitmodules`, no `foundry.lock`, no `lib/forge-std/.git`; remappings auto-detected;
`forge test` passes. `forge install` appends `libs = ["node_modules", "lib"]` to foundry.toml.

## 4. Options

### 4.1 Shipped `foundry.toml`

Under git it is always shipped (whole repo). Under npm/soldeer we choose. Whatever it contains in `[profile.default]`
is read by consumers (§2.3).

| Option | Verdict |
|---|---|
| Ship with `remappings` for encrypted-types/forge-std | **No.** Rebased to a non-existent path, breaks consumers without node_modules (B'), pollutes namespace. |
| Ship with `[dependencies] forge-std` + `soldeer.lock` | **No.** `forge install` of our lib then runs soldeer inside `lib/forge-fhevm-std/`, downloading forge-std into every consumer. |
| Ship with dev remappings in a non-default profile (`[profile.dev]`) | Works (nested read uses the default profile), but adds a mode consumers see and can misuse. Acceptable fallback. |
| Ship a minimal `[profile.default]` (`src`, `libs`, solc pins), no remappings, no soldeer | **Yes.** Harmless to consumers, needed for our own build. Keep it consumer-safe by construction. |

### 4.2 Shipped `package.json`

Needed for npm. Include `dependencies: { "encrypted-types": "^0.0.4" }` so npm hoists/dedups it against
`@fhevm/solidity`'s requirement. This is the only channel with real transitive resolution. Forge never reads it, so it
has no effect on remapping. `files` should be `src`, `README.md`, `LICENSE` only. Do not ship `foundry.toml` in the
tarball (nothing in forge needs it under node_modules, and consumers should not think it configures them).

### 4.3 `auto_detect_remappings = false`

Consumer-side switch. Not something the library can set for them. Worth documenting as the deterministic mode
(case E): three explicit lines, no surprises. Never set it in our shipped foundry.toml: it would only affect our
own build.

### 4.4 Getting encrypted-types to the consumer

| Option | git (`forge install`) | npm | soldeer | Verdict |
|---|---|---|---|---|
| Rely on dApp's `node_modules/encrypted-types` (they have it via `@fhevm/solidity`) | auto (A) | auto | auto if `node_modules` exists | **Primary.** Zero config, single shared type. |
| Nested submodule `lib/encrypted-types` in our repo | shadowed by dApp copy when present (F), used otherwise (F') | not in tarball | not in zip; git dep only with `recursive_deps` | **Optional safety net.** Gives the "installed? use theirs, else mine" behaviour on git. Cost: always cloned; risk of version skew is masked, not prevented. |
| Shipped `remappings.txt` | rebased into consumer (v1.8+), same path problem as B' | ignored | ignored | No. |
| Vendor into `src/` | — | — | — | **Forbidden** (§1). |

Recommendation: primary only. Skip the nested submodule unless a forge-only, npm-free dApp is a real target. Such a
dApp cannot use `@fhevm/solidity` either, so it is not a realistic FHEVM consumer today.

### 4.5 Source layout and canonical import

| Layout | git import | npm import | soldeer import |
|---|---|---|---|
| `src/` (forge-std style) | `forge-fhevm-std/X.sol` | `forge-fhevm-std/src/X.sol` (N2) | `forge-fhevm-std-<v>/src/X.sol` (S1) |
| flat root | `forge-fhevm-std/X.sol` | `forge-fhevm-std/X.sol` (N3) | `forge-fhevm-std-<v>/X.sol` |

`src/` matches forge-std, keeps `test/` and `script/` out of the shipped surface, and is what `forge init` users expect.
The npm and soldeer forms are the same ones forge-std users already live with. Canonical import:
`import {X} from "forge-fhevm-std/X.sol";`. npm and soldeer users add one alias line to reach it:
`forge-fhevm-std/=node_modules/forge-fhevm-std/src/` or `forge-fhevm-std/=dependencies/forge-fhevm-std-<v>/src/`.

### 4.6 Names

- npm: `forge-fhevm-std` (unscoped, free as of 2026-09-16). A scoped name would auto-alias to `@fhevm/` instead of
  `forge-fhevm-std/` and make the npm import differ from git and soldeer. forge-std is unscoped for the same reason.
- soldeer: `forge-fhevm-std` matches the registry regex; free as of 2026-09-16.
- git: `zama-ai/forge-fhevm-std`, tags `vX.Y.Z` (plain semver, no pre-release suffix, so a ref-less `forge install`
  resolves to the newest).

## 5. Recommended deliverables

**Published package content (`pkg/`, = npm tarball = git channel = soldeer zip). The dev root around it is private and
keeps its own `foundry.toml`, `remappings.txt` and `soldeer.lock`, as every other forge package in this repo does:**

```
src/                 shipped Solidity, imports "encrypted-types/EncryptedTypes.sol" and relative paths only
package.json         name forge-fhevm-std, files ["src","LICENSE","README.md"], dependencies { encrypted-types }
LICENSE  README.md   README carries the per-channel install and the one alias line for npm and soldeer
```

Nothing else. No `foundry.toml` (§4.1), no `remappings.txt` (§4.4), no lockfile, no `.gitmodules`. A `.soldeerignore`
is only needed at the dev root if the package is ever pushed to the Soldeer registry from there.

**Dev setup:**

```
npm install            # encrypted-types -> node_modules/, auto-detected by forge from libs
forge soldeer install  # forge-std -> dependencies/forge-std-1.11.0/, per repo convention
forge test
```

forge-std is a soldeer dependency of the dev root only. It is not a git submodule and is not part of `pkg/`, so
consumers never receive it and `forge install` of the published repo has no nested submodules to recurse into.

**Per-channel consumer instructions:**

| Channel | Command | Extra lines in dApp foundry.toml |
|---|---|---|
| git | `forge install zama-ai/forge-fhevm-std` | none (needs `npm i @fhevm/solidity`, which brings encrypted-types) |
| npm | `npm i forge-fhevm-std` | `forge-fhevm-std/=node_modules/forge-fhevm-std/src/` |
| soldeer | `forge soldeer install forge-fhevm-std~X.Y.Z` | `forge-fhevm-std/=dependencies/forge-fhevm-std-X.Y.Z/src/` |
| deterministic | any | `auto_detect_remappings = false` + explicit `@fhevm/solidity/`, `encrypted-types/`, `forge-fhevm-std/` |

**Compile-time version guard (optional):** import one symbol from `EncryptedTypes.sol` that only exists from the
minimum supported encrypted-types version, so an outdated dApp copy fails with a clear error instead of type mismatches.

## 6. Implemented layout

The folder follows the repo's dev/pkg split (model: `host-contracts-cleartext/v13`). The dev root is private and never
published; `pkg/` is the published artifact. It is deliberately **not** wired into the workspace yet: it is absent from
the root `package.json` workspaces, `npm-manifest.json`, `versions.json` and the `Makefile`.

```
package.json         @fhevm/forge-std-dev, private, workspace verbs (build check clean compile fmt lint test)
foundry.toml         extends ../../foundry.base.toml, src = "pkg/src", [dependencies] forge-std (soldeer)
remappings.txt       soldeer-generated forge-std-1.11.0/ line + the forge-std/ alias used by test/
prettier.config.js   re-export of ../../prettier.base.mjs
.prettierignore      Solidity is formatted by forge fmt, never prettier
test/  script/       dev only, never published
pkg/package.json     forge-fhevm-std, published, dependencies { encrypted-types }
pkg/src/             the shipped Solidity
pkg/LICENSE          pkg/README.md
```

`pkg/src/_host/` is generated, not written: `generate:forge-payload` duplicates the current generation's Forge
payload (`host-contracts-cleartext/<current>/pkg/forge/src`) into it, reading `<current>` from
`npm-manifest.json#generations`. Copied rather than depended on, for the reason this whole document exists: a Forge
dependency of a Forge dependency is what the package refuses to have, and a copy keeps it a leaf on every channel. The
payload is self-contained apart from one import, `FheType`, which reaches outside it; the generator copies that file to
`_host/shared/` and repoints the three interfaces at it. That single line in three files is the only content
difference from the origin, so drift is a byte comparison. The directory is owned outright by that generator and wiped
on every run, which is why the version constant sits in `pkg/src/`, not inside it. Lints are ignored for the tree since
upstream owns the code.

`encrypted-types` is a `dependencies` entry of `pkg/` and a `devDependencies` entry of the dev root, the same pairing
`v13` uses for `@openzeppelin/contracts`. No remapping is declared for it: forge auto-detects it from `node_modules`
(`libs` covers the local and the future hoisted workspace location), which is what binds it to the dApp's copy.

`pkg/` ships no `foundry.toml` and no `remappings.txt`, per §4.1 and §4.4.

Open items before wiring: an entry in `npm-manifest.json` (kind `dev` + `published`), `versions.json` and the `Makefile`;
`.soldeerignore` if the package is ever pushed to the Soldeer registry; the published version `0.13.0-0` is a placeholder
that `versions.json` should own.
