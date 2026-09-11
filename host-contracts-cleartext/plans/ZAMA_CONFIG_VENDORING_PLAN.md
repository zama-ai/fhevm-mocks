# Plan: vendor ZamaConfig.sol at each generation's own commit

A plan, not a policy — nothing here has been applied yet. It lives at the family level because each
generation gets its own copy, but two of the steps land in `fhevm-npm` and `common`, which are shared.

## The failure this fixes

```
❌ ZamaConfig.sol not found. Tried:
     /Users/alex/src/me/zama-ai/library-solidity/config/ZamaConfig.sol
     /Users/alex/src/me/zama-ai/fhevm-mocks-v14/library-solidity/config/ZamaConfig.sol
make[2]: *** [check-post] Error 1
```

`zamaConfigAbsPath()` in `common/src/paths.ts` guesses a layout that no longer exists. Both candidates
assume the workspace sits at `<fhevm repo>/sdk/` with `library-solidity/` as a sibling inside the same
repository: one tries `dirname(workspaceRoot)`, the other the git repository root, and under the old
layout those were the same directory — which is why the `new Set` dedupes them to one. Now that the
workspace IS the repository root, the first climbs out of the checkout entirely and the second looks for
a directory that was never extracted here. This is the same `<repo>/sdk/` fossil as the `./sdk/…`
prefixes in the vendored sources and the repo-root-versus-workspace-root split in the vendored check.

## Why vendor rather than resolve from npm

`@fhevm/solidity` ships the same file and is already a dependency of the Hardhat packages, so reading
it from `node_modules` looks simpler. It is wrong here. The installed version is **0.13.3**, while this
workspace vendors host contracts from `zama-ai/fhevm` at **v0.13.2** (v13) and **v0.14.1** (v14) — a
different artifact on a different version line, matching neither generation. Validating
`ZAMA_LOCAL_CONFIG` against it would be a green check against a config nothing here builds, which is
worse than today's loud failure.

The authoritative values are upstream's, at the commit each generation already vendors. Pinning
ZamaConfig.sol at **that same commit** is not a second pin: it is the existing pin covering one more
directory of the same tree. One commit per generation, contracts and config alike.

## Where the copies land, and why not elsewhere

`host-contracts-cleartext/<gen>/internal/zama-config/`.

Only `pkg/` is published, so `internal/` never ships — the copy must not reach a published package. The
generation's dev package also already pins the commit for its contracts, so keeping the config beside it
makes "these came from one commit" structural rather than a convention to remember at rotation time, and
a retired generation takes its config with it.

Rejected: `pkg/src/` (would ship). `common-vendored/src/` (is the source of the local copy fan-out, so it
would also ship). `common-vendored/` or `common/` as a sibling directory (works and never ships, but one
shared copy forces picking a single commit for a file that is genuinely per-generation).

## Constraints found in the code

- **One pinned entry per package, and `package.json#fhevm.vendoredFrom` is mandatory and singular.**
  `base/checks/vendored.ts` reports "N pinned vendored sources, which singular
  `package.json#fhevm.vendoredFrom` cannot represent". The dev packages have no `fhevm` block today, so
  each needs one. This is also why the config cannot join `pkg`'s existing entry.
- **The destination directory must exist before the first sync.** `base/sync-vendored.ts` fails with
  `destination missing`, and `base/checks/inventory.ts` separately requires `vendored[].relPath` to
  exist. The directory and the manifest entry have to arrive together.
- **No published-only filter.** `pinnedVendoredTargets` and `vendoredPackageKeys` walk every package, so
  a `dev` owner needs no prior refactor.
- **A pinned copy is a whole directory, reformatted.** `syncPinnedTarget` writes every `.sol` under
  `from` and `removeStale` prunes the rest; each file goes through `forge fmt`, so the copy is not
  byte-identical to upstream. Harmless for this consumer — `checkZamaLocalConfig` strips comments and
  parses fields — but it belongs in the entry's `reason` so nobody later "fixes" the diff.

## Steps

### 1. Cache the pinned tree by commit

`base/vendored-download.ts`: `withPinnedTree` currently makes an `mkdtemp` scratch directory, downloads,
and removes it in a `finally`, so every run re-downloads. Key the extracted tree by commit instead.

First because the new entries are at commits the same run already downloads: with the cache they cost
nothing, without it they add two fetches of 40.7 MB / ~5.8 s each. It also roughly halves today's
`sync vendored` (measured 17.4 s, of which ~12 s is two downloads of the same repository). Independent of
everything below and worth shipping on its own.

Verify: `sync vendored -vv` reports the same destinations, fewer downloads, lower wall clock.

### 2. Let the caller name the file

`checkZamaLocalConfig(sourcePath)` already accepts a path; the per-generation CLI
`internal/cli/checkZamaLocalConfig.ts` calls it with no argument and falls through to the layout guess.
Add a resolver that returns the generation's own vendored copy. Leave `zamaConfigAbsPath()` in place
until step 5 so the tree keeps building.

Verify: a unit test asserting the resolver returns the manifest-declared path.

### 3. Land the copies

For **each** of `./host-contracts-cleartext/v13` and `./host-contracts-cleartext/v14`:

1. Create `<gen>/internal/zama-config/`, satisfying both preconditions above.
2. Add the `vendored` entry to the **dev** package in `npm-manifest.json`:

```json
{
  "relPath": "./internal/zama-config",
  "source": {
    "repository": "https://github.com/zama-ai/fhevm",
    "tag": "v0.14.1",
    "commit": "e7e7fecf10ea7a59c68603376caac2a308e18cca",
    "from": "library-solidity/config"
  },
  "reason": "The localhost address set is upstream's, and the check must read it at the same commit this generation vendors its contracts from. Reformatted by `forge fmt` on the way in, like every pinned copy."
}
```

The `tag` and `commit` MUST equal that generation's existing `pkg` entry. That equality is what makes
this one pin rather than two, and it is the thing to re-check at every rotation.

3. Add the matching `fhevm.vendoredFrom` block to `<gen>/package.json`, same shape as `pkg`'s, with
   `"to": "internal/zama-config"`.
4. `./fhevm-npm-cli sync vendored --digest`, and record each digest in its entry.
5. `./fhevm-npm-cli sync vendored` writes the copies.

Verify: `check vendored-origin`, `sync vendored --check`, `check manifest-coverage`, `check package-json`.

### 4. Point the check at the copies

Each generation's `internal/cli/checkZamaLocalConfig.ts` passes its own
`internal/zama-config/ZamaConfig.sol`.

`ZAMA_LOCAL_CONFIG` is a single workspace-wide constant and `check-post` already runs `check` on both
generations, so this yields two independent assertions for free: the one constant must satisfy both
commits. If upstream ever moves the local address set between generations, that disagreement surfaces
instead of being averaged away.

Verify: `make check-post` — the failure at the top of this file is gone.

### 5. Delete the layout guess

Remove `zamaConfigAbsPath()`'s `dirname(findWorkspaceRootAbsPath(...))` candidate, its git-root fallback,
and `_gitRepoRoot` if nothing else uses it. This retires the third instance of the `<repo>/sdk/`
assumption rather than repairing it again.

Verify: full `fhevm-npm` suite, `make ci`.

### 6. Write it down, then back-port

- A rule beside 5.1.3a: a generation pins ONE commit, and every copy taken from upstream — contracts and
  config alike — rides it.
- A line in each `ROTATION.md`: `internal/zama-config/` goes with the generation.
- Back-port `fhevm-npm` and `fhevm-npm-docs` wholesale, as both must be identical across release
  branches. `npm-manifest.json` and the copies are branch-specific: apply the same shape to
  `release/0.13.x`'s own generations at their own commits.

## Open questions to settle before step 3

1. **v12 on `release/0.13.x`.** Does the commit that generation vendors still resolve upstream? If it has
   no usable tag, that generation cannot take a copy and its `check:zama-config` needs a decision —
   skip it, or let it read V(N)'s copy and accept that it is checking a neighbouring commit.
2. **What else is in `library-solidity/config/` upstream.** The npm payload ships only `ZamaConfig.sol`,
   but a pinned copy takes the whole directory. `sync vendored --digest` in step 3.4 shows the contents
   before anything is written.
