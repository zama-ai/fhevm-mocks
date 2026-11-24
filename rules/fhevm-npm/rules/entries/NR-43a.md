---
id: NR-43a
tag: GAP
group: Tooling
title: The artifact verb is compile
short: The artifact verb is `compile`; `build` is the optional gated sweep.
old: 5.1.4a
check: script
checked-by: './fhevm-npm-cli check scripts'
evidence:
  - 'Gap, loose check: A `compile` that rewrites a tracked file (e.g. emitting into a committed pkg/ts/index.ts) leaves a dirty tree that no gate in build-ci or ci reports. Fix: issue I-96.'
issues:
  - I-07
  - I-21
  - I-96
---

Every dev owner of a published payload
defines `compile` (writes only gitignored output, never tracked files). A `build` script on a `dev`, `shared-helper` or
`internal-consumer` package must reach `fmt:check`, `lint` and `compile` through same-package `npm run` references.

```jsonc
// ✅ compile emits artifacts; build gates them behind formatting and lint, in lifecycle order.
"scripts": {
  "build": "npm run fmt:check && npm run lint && npm run compile",
  "compile": "npm run compile:pkg:ts:cjs && npm run compile:pkg:ts:esm"
}

// ❌ A `build` that skips the gates silently redefines the sweep.
"scripts": { "build": "npm run compile" }
```
