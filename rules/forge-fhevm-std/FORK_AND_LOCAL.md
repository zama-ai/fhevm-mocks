# Fork and local

One API works in two worlds: a local stack in memory, and a real stack on a fork. Most of the design of forge-fhevm-std exists to keep that true. The rules of the Runtime group, in [rules-new/](rules/README.md), say what each world must do.

## Local, with no fork

The constructor of `StdFhevm` deploys the whole cleartext stack in memory and declares it the current stack. It does so before `setUp`, so a fork test that never calls `super.setUp()` still starts from a defined stack, and `TestFhevm.setUp` is an empty hook. The cleartext verifier can say what any handle is worth, the executor implements `IPlaintexts`, and the ACL is ours.

This is the default and the cheapest path. `fhevm.useCleartextVerifier()` returns true, and the `…OnCleartextStack` entry points let the deployed contracts answer for themselves. So a local test exercises the code that a dApp calls.

## Forked, on a real stack

`fhevm.createSelectFork(getFhevmChain("testnet", "sepolia"), block)` is one line. The SDK names the addresses of the chain, checks their version, swaps the signer sets, and creates the replay of that fork ([FR-16](rules/entries/FR-16.md)).

Every execution context, the in-memory chain and each fork, is a context like any other, with its own replay. "Cleartext" is a property of the stack that the context points at, and `IS_CLEARTEXT` decides it on chain. A non-cleartext stack in memory reads the replay of its context exactly as a fork does. `fhevm.useStack(desc)` is the entry point for it, though no deploy calls it yet.

Nothing on a real chain holds a cleartext, and the production verifiers have no `userDecrypt`. So the `…OnForkStack` entry points rebuild the answer instead: permissions from the real ACL, digests from the `eip712Domain` of the real verifier, and values from the stack itself. The fork was upgraded to a cleartext stack on first contact ([FR-19b](rules/entries/FR-19b.md)), so the executor holds the cleartext of everything it computed. `stack.plaintexts` is always that executor, and there is no second source to resolve against.

Once a fork is selected, there is no way back to the in-memory stack, because forge has no "deselect". A suite that needs both worlds is two contracts, or forks a local anvil ([FR-18](rules/entries/FR-18.md)).
