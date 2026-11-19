---
id: FR-19c
tag: CONFLICT
group: Runtime
title: A handle the stack did not compute is answered by policy
short: A handle that the stack did not compute gets a stated value or a value from a per-type policy, or is refused, and is never invented silently.
old: "2.15.3"
check: missing
evidence:
  - Conflicts with FR-25.
  - "FR-25 states this rule again for a handle minted before the fork: the test states its value or picks a per-type policy. Fix: merge FR-25 into this rule."
  - "`foundry/forge-fhevm-std/pkg/src/StdFhevmCheats.sol:312` shows `forkUnknown(euint32 value, uint32 clear)`, and the rule writes `forkUnknown(handle, value)`. Fix: write `forkUnknown(value, clear)`."
issues:
  - I-13
  - I-21
---

On a fork most store misses are handles minted before the cleartext layer existed, and a test
says what they are: `forkUnknown(handle, value)` states one, or a per-type default or `keccak(handle)`
derivation answers for all of that type (`CleartextForgeArithmetic`). Per TYPE, not globally: one number
cannot mean an address and a `euint8` at once, and the width would silently truncate it.

A MISS IS NOT ALWAYS AN OLD HANDLE, and the difference must not be guessed. The HCU limit meters every
handle the executor computes, so a reading there means THIS stack produced it — and a handle it produced
that the cleartext layer did not record is an operator the mirror does not override, which no policy may
cover. Checked before any policy, and refused by its own name.
