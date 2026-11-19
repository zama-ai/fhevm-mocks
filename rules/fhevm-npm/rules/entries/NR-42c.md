---
id: NR-42c
tag: GAP
group: Vendoring
title: One upstream commit per generation
short: A generation pins ONE upstream commit, and every copy taken from upstream rides it.
old: 5.1.3c
check: missing
evidence:
  - "Gap, no check: `fhevm-npm/base/checks/vendored.ts:362-397` checks each pinned entry alone; no check compares the tag and commit of a generation's entries. Only `fhevm-npm/base/bump-vendored.ts:8-10` keeps them together. Fix: add the comparison."
issues:
  - I-09
  - I-21
  - I-61
---

A generation's
published package pins `host-contracts/contracts` at a tag and commit; anything else the generation copies from the
same upstream — today `library-solidity/config`, which its dev package vendors into `internal/zama-config/` so
`check:zama-config` reads the localhost address set at the commit the contracts came from — names the SAME tag and
commit. Two entries, one pin: the second is the existing pin covering one more directory of the same tree, not a
second version to keep in step by hand.

The copy sits on the dev package, not the published one, because only `pkg/` ships and a file that exists to grade
a workspace constant must never reach a consumer. `package.json#fhevm.vendoredFrom` is singular, so a package can
carry one pinned entry — which is also why the config cannot join `pkg`'s entry and lives on the dev owner. A
retired generation takes its copy with it (see each generation's `ROTATION.md`).

The same one-commit thinking governs `cleartext-config.json`'s `generations` field: a constant only one generation's
contracts have a field for is scoped to it, and the generator renders every face COMPLETE for its generation — one
`cleartext-config-<gen>.ts` per generation in common-vendored/src, each generation's Solidity and shell faces — so a
shared constant appears in each generation's faces as generated duplication from one JSON, never as a forked copy.

Reading the file from `@fhevm/solidity` in `node_modules` instead is wrong even though it is the same file: the
installed version is whatever the Hardhat packages pin, not the version line either generation vendors, so a green
check there would be a check against a config nothing in the generation builds.

```jsonc
// ✅ The dev package's entry repeats its pkg's tag and commit exactly. Rotating one means rotating both.
"./host-contracts-cleartext/<vN>": {
  "kind": "dev",
  "vendored": [{
    "relPath": "./internal/zama-config",
    "source": { "repository": "https://github.com/zama-ai/fhevm", "tag": "<vN>.1", "commit": "e7e7fec…", "from": "library-solidity/config", "digest": "sha256-…" },
    "reason": "…"
  }]
},
"./host-contracts-cleartext/<vN>/pkg": {
  "kind": "published",
  "vendored": [{
    "relPath": "./src/contracts",
    "source": { "repository": "https://github.com/zama-ai/fhevm", "tag": "<vN>.1", "commit": "e7e7fec…", "from": "host-contracts/contracts", "digest": "sha256-…" },
    "reason": "…"
  }]
}

// ❌ The config at a newer tag than the contracts. The check now grades a constant against addresses no contract
//    in this generation was compiled with.
"source": { "tag": "<vN>.2", "commit": "…", "from": "library-solidity/config" }
```
