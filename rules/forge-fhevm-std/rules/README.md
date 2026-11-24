---
kind: rules
prefix: F
groups:
  Layers: Read these rules before you edit a `.sol` file, to learn whether it is generated and what it may import.
  Design: Read these rules before you add or change a helper, a public entry, a name, or a setup error.
  Runtime: Read these rules before you change how a stack is found, prepared, upgraded, or read, on a fork or locally.
  Tests: Read these rules when you write or review a test under `test/`.
  Workflow: Read these rules before you push, or when you change the workspace, a profile, the consumer project, a host cleartext contract, or a host generator.
---

# forge-fhevm-std rules

Contributors to forge-fhevm-std follow these rules, and when a rule and a convenience disagree, the rule wins.

## Related documents

- [FORK_AND_LOCAL.md](../FORK_AND_LOCAL.md): how one API works on a local stack and on a fork.
- [PUBLIC_API.md](../PUBLIC_API.md): which files of `pkg/src/` are public, for [R-01](../../global/rules/entries/R-01.md).
- `host-contracts-cleartext/<vN>/GENERATE.md`: host bytecode generation. The host generation is `npm-manifest.json#generations["host-contracts-cleartext"].current`.
- `host-contracts-cleartext/<vN>/BUILD.md` and `ROTATION.md`: the host build scripts and the generation rotation.
- [The npm rules](../../fhevm-npm/rules/README.md): the workspace rules.
- `foundry/forge-fhevm-std/pkg/README.md`: the user guide.

<!-- BEGIN GENERATED INDEX. Edit the entry files, then run generate-index.mjs. -->

The IDs in this file start with `FR-`.

| Rule tag     | Meaning                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `[HOLD]`     | The text is accurate, and the code follows it. Nothing needs a fix.                                                                   |
| `[STALE]`    | The rule is still wanted, but its text names files, symbols, commands, or versions that changed. The fix goes to the rule text.       |
| `[RETIRED]`  | The rule is withdrawn: what it governs no longer exists, or another rule replaces it. Delete the rule text and keep the ID.           |
| `[VIOLATED]` | The text is accurate and still wanted, but the code does not follow it. The fix goes to the code.                                     |
| `[CONFLICT]` | The rule contradicts or repeats another rule. The fix is a decision, then one rule changes or merges.                                 |
| `[GAP]`      | The rule is wanted and the repository follows it today, but no check, or only a weaker check, enforces it. The fix goes to the check. |

To read the full text of every live rule on one page, open [groups/all.md](groups/all.md).

## Groups

| Group                 | Description                                                                                                                                          | Rules | Full text                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------- |
| [Layers](#layers)     | Read these rules before you edit a `.sol` file, to learn whether it is generated and what it may import.                                             | 5     | [layers.md](groups/layers.md)     |
| [Design](#design)     | Read these rules before you add or change a helper, a public entry, a name, or a setup error.                                                        | 14    | [design.md](groups/design.md)     |
| [Runtime](#runtime)   | Read these rules before you change how a stack is found, prepared, upgraded, or read, on a fork or locally.                                          | 15    | [runtime.md](groups/runtime.md)   |
| [Tests](#tests)       | Read these rules when you write or review a test under `test/`.                                                                                      | 7     | [tests.md](groups/tests.md)       |
| [Workflow](#workflow) | Read these rules before you push, or when you change the workspace, a profile, the consumer project, a host cleartext contract, or a host generator. | 4     | [workflow.md](groups/workflow.md) |

## Layers

| ID                                     | Rule                                      | Short rule                                                                                                               | Old number | Check   | Issues     |
| -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- | ---------- |
| [FR-01](entries/FR-01.md) `[RETIRED]`  | Edit at the source, then regenerate       | Merged into R-02.                                                                                                        | 1.1        | missing |            |
| [FR-02](entries/FR-02.md) `[RETIRED]`  | Never add a file to a generated directory | Merged into R-03.                                                                                                        | 1.2        | missing |            |
| [FR-03](entries/FR-03.md) `[CONFLICT]` | `<vN-1>` is frozen                        | Do not change `<vN-1>` unless a shared generator forces the change, and say so when it does.                             | 1.3        | missing | I-13       |
| [FR-05](entries/FR-05.md) `[CONFLICT]` | `shared/` never touches the forge VM      | Code in `shared/` never uses the forge VM or a cheatcode.                                                                | 2.1        | missing | I-13, I-29 |
| [FR-20](entries/FR-20.md) `[VIOLATED]` | forge-std stops at `pkg/src/`             | Files in `pkg/src/_host/` import nothing from forge-std, and files in `pkg/src/` use forge-std wherever it has the type. | 2.16       | missing |            |

## Design

| ID                                     | Rule                                          | Short rule                                                                                                         | Old number | Check      | Issues           |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- | ---------- | ---------------- |
| [FR-06](entries/FR-06.md) `[HOLD]`     | Symmetry wherever it costs nothing            | Two things that do the same job take the same shape, order, and names.                                             | 2.2        | impossible |                  |
| [FR-09](entries/FR-09.md) `[HOLD]`     | A cheat must be unmistakable                  | The names and the docs of a cheat show that it proves nothing about access.                                        | 2.5        | impossible |                  |
| [FR-10](entries/FR-10.md) `[VIOLATED]` | Group helpers by family                       | Each library owns one concern, and its name says which.                                                            | 2.6        | impossible | I-16             |
| [FR-11](entries/FR-11.md) `[HOLD]`     | Say what is not true                          | A declaration says when its helper ignores an argument, cannot enforce something, or holds only under a condition. | 2.7        | impossible |                  |
| [FR-12](entries/FR-12.md) `[VIOLATED]` | A user never hears the word handle            | The public API speaks in encrypted types and clear values, never in `bytes32` handles.                             | 2.8        | missing    | I-12, I-33       |
| [FR-14](entries/FR-14.md) `[VIOLATED]` | The SDK is user friendly, always              | Each public entry is one typed call in the vocabulary of the FHE library, with nothing for the user to wire.       | 2.10       | impossible | I-16, I-33       |
| [FR-15](entries/FR-15.md) `[VIOLATED]` | A setup failure tells the user how to fix it  | A setup failure reverts with a loud message that says what happened, why, and the line that fixes it.              | 2.11       | missing    | I-34             |
| [FR-29](entries/FR-29.md) `[CONFLICT]` | `Forge` in a name means it touches cheatcodes | A name contains `Forge` only when its code uses cheatcodes.                                                        | 5.1        | missing    | I-13, I-29       |
| [FR-30](entries/FR-30.md) `[HOLD]`     | Name what a function returns                  | A function name says what it returns, not how it got the result.                                                   | 5.2        | impossible |                  |
| [FR-31](entries/FR-31.md) `[HOLD]`     | A handle is always a `bytes32`                | A handle is always a `bytes32`, and a parameter of an encrypted type is a `value`.                                 | 5.3        | missing    | I-14             |
| [FR-32](entries/FR-32.md) `[VIOLATED]` | Match forge-std                               | The public API follows the conventions of forge-std.                                                               | 6.1        | missing    | I-34             |
| [FR-33](entries/FR-33.md) `[CONFLICT]` | The public API takes no addresses             | A test names a stack once, and no `StdFhevm*` helper takes an address.                                             | 6.2        | missing    | I-13, I-39       |
| [FR-34](entries/FR-34.md) `[CONFLICT]` | Pausing is invisible to the caller            | Every public entry is `unmetered`, so a test measures only the gas of its dApp call.                               | 6.3        | missing    | I-13, I-36, I-37 |
| [FR-35](entries/FR-35.md) `[HOLD]`     | The API costs the test nothing                | Encrypt, user decrypt, and public decrypt each stay under 20k gas, and the dApp call is still measured.            | 6.4        | script     |                  |

## Runtime

| ID                                       | Rule                                                     | Short rule                                                                                                                                    | Old number | Check   | Issues                       |
| ---------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- | ---------------------------- |
| [FR-07](entries/FR-07.md) `[CONFLICT]`   | One owner per piece of global state                      | Each piece of forge cheatcode state has exactly one owner.                                                                                    | 2.3        | missing | I-12, I-13, I-35, I-36, I-37 |
| [FR-08](entries/FR-08.md) `[STALE]`      | Addresses are resolved, never hardcoded                  | The SDK resolves every protocol address at run time and never hardcodes one.                                                                  | 2.4        | missing | I-12, I-36                   |
| [FR-13](entries/FR-13.md) `[CONFLICT]`   | A value is read from the stack that computed it          | Decryptions and cheats read a value from the executor that computed it.                                                                       | 2.9        | missing | I-13, I-35, I-36             |
| [FR-16](entries/FR-16.md) `[CONFLICT]`   | Forking is automatic                                     | One `fhevm.createSelectFork` call prepares the fork, and the default stack is the local cleartext one.                                        | 2.12       | missing | I-13, I-39                   |
| [FR-17](entries/FR-17.md) `[STALE]`      | Two VMs, and which cheat goes through which              | Fork cheats and `getRecordedLogs` go through `fhevm`, and every other cheat goes through `vm`.                                                | 2.13       | missing | I-12                         |
| [FR-18](entries/FR-18.md) `[HOLD]`       | Anvil is a first-class target                            | A fork of a running anvil gets the cleartext stack on first contact.                                                                          | 2.14       | missing | I-14                         |
| [FR-19](entries/FR-19.md) `[VIOLATED]`   | A wrong protocol line fails by name                      | On first contact with a fork, a host contract outside the vendored line fails by name, and any release of that line is accepted.              | 2.15       | missing | I-12, I-30                   |
| [FR-19a](entries/FR-19a.md) `[STALE]`    | One generation back is upgraded on the fork              | A stack one generation back is upgraded in memory on the fork instead of refused, in forge-fhevm-std only.                                    | 2.15.1     | missing | I-21                         |
| [FR-19b](entries/FR-19b.md) `[CONFLICT]` | Every forked stack becomes a cleartext stack             | On first contact, the SDK points every forked stack at the cleartext implementations, and reads values from them.                             | 2.15.2     | missing | I-12, I-13, I-21             |
| [FR-19c](entries/FR-19c.md) `[CONFLICT]` | A handle the stack did not compute is answered by policy | A handle that the stack did not compute gets a stated value or a value from a per-type policy, or is refused, and is never invented silently. | 2.15.3     | missing | I-13, I-21                   |
| [FR-21](entries/FR-21.md) `[VIOLATED]`   | The mock never shadows a live stack                      | The SDK deploys the cleartext stack only on a chain with no FHEVM protocol, and never changes the chain ID.                                   | 2.17       | missing | I-31                         |
| [FR-22](entries/FR-22.md) `[VIOLATED]`   | A debug build cannot exist on a real chain               | A debug build of a dApp reverts at construction wherever the forge VM or the debug profile is absent.                                         | 2.18       | missing | I-32                         |
| [FR-23](entries/FR-23.md) `[HOLD]`       | The predicate is local in-memory cleartext               | The fast path depends on whether a stack is local, in memory, and cleartext, not only on whether it is cleartext.                             | 3.1        | missing | I-14                         |
| [FR-24](entries/FR-24.md) `[STALE]`      | A fork needs signers, and the SDK swaps them             | On first contact with a fork, and after each roll, the SDK swaps in signer sets that the test can sign as.                                    | 3.2        | missing |                              |
| [FR-25](entries/FR-25.md) `[CONFLICT]`   | A handle minted before the fork has no events            | A test states the value of a handle minted before the fork, or picks a policy for it.                                                         | 3.3        | missing | I-13                         |

## Tests

| ID                                  | Rule                                        | Short rule                                                                                                    | Old number | Check      | Issues     |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ---------- |
| [FR-36](entries/FR-36.md) `[HOLD]`  | Prove a guard by breaking it                | Show that an assertion fails when the thing it guards is removed.                                             | 7.1        | impossible |            |
| [FR-37](entries/FR-37.md) `[HOLD]`  | Never compare a function against itself     | Build the expected value from a source that is independent of the function under test.                        | 7.2        | impossible |            |
| [FR-38](entries/FR-38.md) `[STALE]` | Fork tests skip without a configured RPC    | A fork test skips unless an RPC URL is configured for its chain.                                              | 7.3        | missing    |            |
| [FR-39](entries/FR-39.md) `[HOLD]`  | Assert events with `vm.expectEmit`          | Assert events with `vm.expectEmit`, and record logs only where a test needs the array.                        | 7.4        | missing    | I-14, I-35 |
| [FR-40](entries/FR-40.md) `[HOLD]`  | No `vm.setEnv` in a test that asserts on it | A test never sets with `vm.setEnv` a value that it asserts on, because forge runs test contracts in parallel. | 7.5        | missing    | I-14       |
| [FR-41](entries/FR-41.md) `[HOLD]`  | `setUp` runs once per contract              | Forge runs `setUp` once per test contract and restores its state before each test.                            | 7.6        | impossible |            |
| [FR-42](entries/FR-42.md) `[HOLD]`  | Hoist calls out of argument position        | Move an external call out of the arguments of a call that a pending `vm.prank` or `vm.expectRevert` targets.  | 7.7        | missing    | I-14       |

## Workflow

| ID                                  | Rule                                                    | Short rule                                                                                                                  | Old number | Check   | Issues                 |
| ----------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- | ---------------------- |
| [FR-04](entries/FR-04.md) `[STALE]` | This package is a workspace member driven from the root | This package is a member of the workspace, and every verb runs from the root through a `make` target.                       | 1.4        | missing | I-28, I-36             |
| [FR-26](entries/FR-26.md) `[STALE]` | Two different address techniques                        | Templates keep placeholder markers that the deploy patches, and `LocalHostBytecode.sol` is rebuilt with the real addresses. | 4.1        | missing | I-36, I-38, I-122      |
| [FR-27](entries/FR-27.md) `[HOLD]`  | `patch-sites.json` is a tripwire                        | `patch-sites.json` is a baseline that a person refreshes after reading the diff, never a build input.                       | 4.2        | missing | I-14, I-122            |
| [FR-28](entries/FR-28.md) `[HOLD]`  | After touching a cleartext contract                     | After you change a cleartext contract, regenerate and test the host package, then regenerate this package.                  | 4.3        | missing | I-01, I-14, I-15, I-36 |

<!-- END GENERATED INDEX -->
