---
id: NR-43c
tag: GAP
group: Tooling
title: A package can delete its build output
short: A private source-owning package can delete its own build output.
old: 5.1.4c
check: script
evidence:
  - "Gap, wrong check: Compliant change that fails: remove `clean` from hardhat/v2/fhevm-hardhat-template/package.json, the dev owner of a mirror-only payload. The rule exempts it; scripts.ts:56 reports `package must define a non-empty 'clean' script` under the label package-scripts. Fix: issue I-98."
issues:
  - I-21
  - I-43
  - I-98
---

Every `dev`, `shared-helper` and
`internal-consumer` package that is not a mirror owner defines a non-empty `clean`. Its content requirements are
derived from what the package actually does, never listed centrally:

- a package whose scripts invoke `tsc` must delete `*.tsbuildinfo`, because a surviving build-info file lets the
  next typecheck resume from stale state;
- a Forge project must delete the directories `forge config --json` reports (`cache_path`, `out`, `broadcast`).

Those directory names are **asked of forge, never assumed** — `hardhat/v2/e2e` sets `cache_path = "cache-forge"`, so
any rule hard-coding `cache` is already wrong for some projects. Anywhere this repo needs a Foundry answer,
`forge config --json` (which resolves `extends`, profiles and defaults) is the source, never a parsed `foundry.toml`.

```jsonc
// ✅ Derived from what the package does: it runs tsc, and forge reports cache/out/broadcast.
"scripts": {
  "clean": "rm -rf cache out broadcast *.tsbuildinfo pkg/ts/_esm pkg/ts/_cjs",
  "compile:forge": "forge build --skip test"
}
```

```jsonc
// ❌ A rebuild resumes from stale incremental state.
"scripts": { "clean": "rm -rf out", "lint": "eslint && tsc -p ./tsconfig.json --noEmit" }
```
