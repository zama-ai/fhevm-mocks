---
id: NR-43b
tag: GAP
group: Tooling
title: Generators expose the full round trip
short: A package that generates exposes the full round trip.
old: 5.1.4b
check: script
checked-by: "./fhevm-npm-cli check scripts"
evidence:
  - "Gap, wrong check: Wrong: verified, `clean:generate:exports` = `rm -rf pkg/ts ...` deletes the export-manifest output ./pkg/ts/index.ts yet fails 5.1.4b, since cleanRemoves (:499-501) wants the literal file path, not a parent directory or glob. Loose as well: a generator output not listed in export.manifest.json (e.g. pkg/templates written by generate:templates) can be dropped from clean:generated and nothing fails. Fix: issue I-97."
issues:
  - I-21
  - I-97
---

Any package with `generate:*` scripts also defines a
non-empty `generate` aggregate and a non-empty `clean:generated` deleting every file the generators write; the
reverse holds too — `generate` or `clean:generated` with no `generate:*` leaf is dead wiring and is rejected.

Wiring is checked by name: every `generate:*` leaf must be reachable from `generate` through same-package `npm run`
references (exempt: `generate:genesis`, a stateful anvil deploy, and `generate:patch-sites`, a committed baseline a
test compares against), and every `export.manifest.json` output must be deleted by `clean:generated`.

This exists because a regenerate-and-diff gate cannot see a generator that silently _stops_ emitting a file: the
committed copy sits untouched, so nothing looks dirty. Deleting first turns that into a visible deletion, and the
delete list lives beside the generators — the only place it stands a chance of being kept current.

```jsonc
// ✅ Every path the generate:* scripts write is removable, and one verb rewrites everything.
// (Here the export manifest names only pkg/ts/index.ts.)
"scripts": {
  "clean:generated": "rm -rf pkg/abi pkg/templates pkg/ts/index.ts",
  "generate": "npm run generate:exports && npm run generate:templates",
  "generate:exports": "node ../../fhevm-npm/fhevm-npm.ts generate exports ./export.manifest.json",
  "generate:templates": "node ./internal/cli/generateTemplates.ts"
}
```

```jsonc
// ❌ Generators with no way to prove they still emit everything.
"scripts": { "generate:exports": "node ../../fhevm-npm/fhevm-npm.ts generate exports ./export.manifest.json" }
```
