---
kind: definitions
prefix: N
---

# fhevm-npm definitions

The rules of the npm workspace use these terms with the meanings below.

<!-- BEGIN GENERATED INDEX. Edit the entry files, then run generate-index.mjs. -->

The IDs in this file start with `ND-`.

| Definition tag | Meaning                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `[STABLE]`     | The definition does not depend on the protocol design. It holds as long as the term exists.                               |
| `[EVOLVING]`   | The definition describes how the protocol works today. If the protocol design changes, the definition can change with it. |
| `[RETIRED]`    | The term is no longer used, or another definition replaces it. Keep the ID, and never give it to another term.            |

Before you write a rule that depends on an `[EVOLVING]` definition, read the definition again. A change to the definition can make the rule stale.

To read the full text of every live definition on one page, open [groups/all.md](groups/all.md).

| ID                                     | Name                    | Aliases                 | Short definition                                                                                | Issues                 |
| -------------------------------------- | ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| [ND-01](entries/ND-01.md) `[EVOLVING]` | Generation family       |                         | A set of dev packages, one for each generation, whose payloads share one published name.        | I-27                   |
| [ND-02](entries/ND-02.md) `[EVOLVING]` | Live generation         |                         | A generation of a family that `npm-manifest.json#generations` names as `current` or `previous`. | I-27                   |
| [ND-03](entries/ND-03.md) `[STABLE]`   | Published package       | published payload       | A package that leaves the workspace, through npm, a mirror repository, or both.                 | I-02, I-03, I-04, I-27 |
| [ND-04](entries/ND-04.md) `[STABLE]`   | npm-distributed payload | npm-distributed package | A published package that npm distributes, because its `distribution` names `npm` or is omitted. | I-03, I-27             |

<!-- END GENERATED INDEX -->
