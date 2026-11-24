---
id: NR-42b
tag: VIOLATED
group: Vendoring
title: Declare vendored copies only in the manifest
short: '`npm-manifest.json` is the only place a vendored copy is declared.'
old: 5.1.3b
check: script
evidence:
  - '`fhevm-npm/base/checks/inventory.ts:128-130` shows a vendored `source` resolved from the git root, while `fhevm-npm/base/sync-vendored.ts:64` resolves it from the workspace root. Fix: issue I-55.'
issues:
  - I-01
  - I-21
  - I-55
---

What is copied, where it lands, which
files, and what is rewritten on arrival all live on the destination package's `vendored` entry. Nothing else declares
a copy, and no second file restates one.

This was two files once: `common-vendored/manifest.json` said which files went where, and the manifest restated the
same destinations and file lists per package. Two files describing one thing can only agree by luck, and eventually
did not — each side was resolved against a different base, so moving the workspace out of `<repo>/sdk/` failed a
comparison that was never about the bytes. The manifest wins because it already owns what a package CONTAINS: the
schema refuses `vendored` on a non-package or a workspace root, and the lint-policy, script and inventory checks
already read it there.

A `rewrite` belongs to the destination for the same reason. It exists because THIS package resolves an import
differently from the package the bytes came from — a fact about the consumer, not about the source.

So does a `renamed` entry, destination name to source name, for a copy that changes name on arrival. It exists for one
case: each generation's `pkg/ts/cleartext-config.ts` is common-vendored's `cleartext-config-<gen>.ts`, so the module a
consumer imports keeps one stable name while the generation lives in the source file's name — and in nothing a
consumer writes. Keyed by the destination so `files` keeps meaning "what sits in relPath"; every key must be listed
there, and only a local copy can be renamed.

The copy map `sync vendored` walks is derived from the manifest, grouping entries by the file set they carry, so
"these generations receive an identical copy" is still one destination with several `to` paths and rule [NR-23](NR-23.md) can
still ask whether every live generation is among them.

```jsonc
// ✅ One entry says everything: the source, the files, and the edit this package needs on arrival.
"vendored": [{
  "relPath": "./src/internal/vendored",
  "files": ["ethersEthereumLib.ts", "fhevm-chains.ts"],
  "source": "./common-vendored/src",
  "rewrites": [{ "file": "ethersEthereumLib.ts", "from": "from './ethereumLibTypes.ts';", "to": "from '@fhevm/host-contracts-cleartext/ts';" }],
  "reason": "A published package cannot depend on a private workspace member."
}]

// ❌ A second manifest repeating the destination and its files. It can only ever drift from this one.
```

Every manifest path resolves against the workspace root ([NR-73a](NR-73a.md)).
