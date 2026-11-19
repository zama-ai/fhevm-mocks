---
id: FR-19a
tag: STALE
group: Runtime
title: One generation back is upgraded on the fork
short: A stack one generation back is upgraded in memory on the fork instead of refused, in forge-fhevm-std only.
old: "2.15.1"
check: missing
evidence:
  - "`host-contracts-cleartext/v14/pkg/forge/src/LibForgeFhevmHostVersions.sol:108-121` shows the floors and ceilings of the previous line, which the rule places in `LibFhevmVersion`. Fix: name `LibForgeFhevmHostVersions`."
  - "`foundry/forge-fhevm-std/pkg/src/FhevmVm.sol:935` shows `_upgradeCleartextIfOneGenerationBehind`, which also upgrades a cleartext stack one generation back, through `host-contracts-cleartext/v14/pkg/forge/src/LibForgeFhevmUpgrade.sol:292`. Fix: add the cleartext case."
issues:
  - I-21
---

A stack whose versions are all on the PREVIOUS line — that line's own floors and ceilings,
hand-written in `LibFhevmVersion` and compared on major.minor only, since a generation is the shape of an
ABI and not a patch number — is brought forward in memory, on the fork, by
`LibForgeFhevmUpgrade.upgradeFromPreviousGeneration`: the same implementations and the same reinitializers
`pkg/ts/upgrade.ts` sends on a real chain, deployed patched for the fork's own addresses ([FR-26](FR-26.md)) and pranked
as `ACL.owner()`. Then rule [FR-19](FR-19.md)'s gate runs, unchanged, and an upgrade that half worked is refused by it
exactly as an unupgraded stack would be. This reaches exactly one generation: `<vN-2>` is refused, because
chaining two upgrades would rehearse a path nothing else rehearses. It does NOT loosen [FR-19](FR-19.md) in the other
direction — an older SDK on a newer chain stays refused, because it cannot know what the newer line does —
and no other SDK gets it: a Hardhat test is not on a copy of the chain, and the upgrade would be real.
