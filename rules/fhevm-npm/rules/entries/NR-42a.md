---
id: NR-42a
tag: HOLD
group: Vendoring
title: A pinned vendored copy records a digest
short: A pinned vendored copy records a content digest, and every build verifies it.
old: 5.1.3a
check: script
issues:
  - I-21
---

A pinned `source` names an
upstream repository and commit; `source.digest` records what the copies hash to once written. `sync vendored --check`
recomputes it from the files on disk and fails on any difference, so a build proves the copies are untouched without
git, a network call, or the upstream repository being present anywhere. That last point is the reason the digest exists:
reading the commit itself only ever worked in the upstream repository, because the workspace then vendored from the
repository it lived in. Copied out — which is how a mocks workspace is made — every pinned entry failed.

The digest is never typed by hand, and `sync vendored` never writes it: a value that gates every build belongs in a
diff somebody read, and the sync's job is to make the copies match the manifest, not the other way round.
`sync vendored --digest` downloads each pinned tree and prints the digest it implies; `--check` prints the one the
local copies produce. THE ONE WRITER is `bump vendored <package> --tag <tag>`: it moves every pin under that package
key (a generation and its nested `pkg`) to the tag — commit resolved from the tag, digest computed from upstream,
copies rewritten, each owning `package.json#fhevm.vendoredFrom` regenerated — as ONE change, which is the diff to
read. Scoped by package on purpose, and all of a package's pins together: a generation's contracts and config must
sit at one commit (two pins from one upstream at two commits is the drift a hand edit produces), while two
GENERATIONS pin that same upstream at deliberately different tags, so "every pin from this repository" would be wrong.

Two consequences worth knowing. The digest proves the copies match what was RECORDED, not what upstream holds — the
provenance check is `sync vendored` itself, which fetches the pinned trees, from upstream or from its cache, unless run
with `--check`, so a release should run it and fail if it rewrites anything. And because the copies are formatted before
hashing, the digest is tied to `foundry.version`: a forge release that changes `forge fmt` invalidates every digest at
once, and the failure reads as tampering unless you know to re-run the sync after a toolchain bump.

```jsonc
// ✅ The pin says where the copies came from; the digest says what they are.
"source": {
  "repository": "https://github.com/zama-ai/fhevm",
  "tag": "v0.12.5",
  "commit": "ac18e49ea85dd3c26788fc66f9ac0ea7cfe48519",
  "from": "host-contracts/contracts",
  "digest": "sha256-AAWuLw11xwMmEiFB0skWiKwIhOOYf6bDaP3ssnp/pzA="
}

// ❌ A pin with no digest. The copies are unverified, and the check says so rather than passing quietly.
"source": { "repository": "…", "tag": "v0.12.5", "commit": "ac18e49…", "from": "host-contracts/contracts" }
```
