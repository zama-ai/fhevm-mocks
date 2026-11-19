---
id: FR-19b
tag: CONFLICT
group: Runtime
title: Every forked stack becomes a cleartext stack
short: On first contact, the SDK points every forked stack at the cleartext implementations, and reads values from them.
old: "2.15.2"
check: missing
evidence:
  - "`CleartextForgeHCULimit.sol:63` declares its own storage, so the claim that the subclasses declare no state is false. Fix: correct the rule text."
issues:
  - I-12
  - I-13
  - I-21
---

On first
contact `createSelectFork` re-points the fork's own proxies at this package's cleartext implementations
(`LibForgeFhevmUpgrade.upgradeToCleartext`), so the chain holds the plaintext of everything it computes
and `stack.plaintexts` is always the executor. It replaced an event processor that rebuilt those values
by replaying the executor's announcements — a second implementation of every operator, living in the
test process, which had to see every event or lose track of a value.

IN MEMORY, ON THE FORK. Nothing is broadcast. The real chain keeps answering its own version, which the
fork suites assert by taking a second plain fork afterwards.

THE LOGIC IS STILL THE CHAIN'S. Each cleartext contract EXTENDS the production one it replaces —
`CleartextFHEVMExecutor is FHEVMExecutor` — and every override runs `super` first, so handle derivation,
ACL checks and HCU accounting are the deployed code's. What is added is the bookkeeping beside it. That
is also why the swap is layout-safe with no reinitializer: the subclasses declare no state of their own.

THE FORGE VARIANTS WHERE THEY EXIST (ACL, executor, HCULimit, arithmetic), because a fork should behave
like a local stack: metering paused around the mock's own work, forge's randomness, the per-handle record
of [FR-19c](FR-19c.md). They call cheatcodes, and forge grants those per address to what IT created — a forked chain's
proxy is not that, so each is granted explicitly. Miss one and the stack reverts at its first FHE
operation.

A STACK THAT IS ALREADY CLEARTEXT keeps its own store, and the upgrade preserves it: only code changes.

[FORK_AND_LOCAL.md](../../FORK_AND_LOCAL.md) explains how one API works on a local stack and on a fork.
