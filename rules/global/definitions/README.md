---
kind: definitions
prefix: ''
groups:
  Versions: The protocol generations, their hotfixes, and their version numbers.
  Rules: The rule books, the definitions, and the folders that hold them.
  Chains: The FHEVM groups, and the chains that host them.
---

# Definitions

The global rules and every rule book use these terms with the meanings below.

<!-- BEGIN GENERATED INDEX. Edit the entry files, then run generate-index.mjs. -->

The IDs in this file start with `D-`.

| Definition tag | Meaning                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `[STABLE]`     | The definition does not depend on the protocol design. It holds as long as the term exists.                               |
| `[EVOLVING]`   | The definition describes how the protocol works today. If the protocol design changes, the definition can change with it. |
| `[RETIRED]`    | The term is no longer used, or another definition replaces it. Keep the ID, and never give it to another term.            |

Before you write a rule that depends on an `[EVOLVING]` definition, read the definition again. A change to the definition can make the rule stale.

To read the full text of every live definition on one page, open [groups/all.md](groups/all.md).

## Groups

| Group                 | Description                                                          | Definitions | Full text                         |
| --------------------- | -------------------------------------------------------------------- | ----------- | --------------------------------- |
| [Versions](#versions) | The protocol generations, their hotfixes, and their version numbers. | 3           | [versions.md](groups/versions.md) |
| [Rules](#rules)       | The rule books, the definitions, and the folders that hold them.     | 7           | [rules.md](groups/rules.md)       |
| [Chains](#chains)     | The FHEVM groups, and the chains that host them.                     | 4           | [chains.md](groups/chains.md)     |

## No group

| ID                                 | Name          | Aliases  | Short definition             | Issues |
| ---------------------------------- | ------------- | -------- | ---------------------------- | ------ |
| [D-01](entries/D-01.md) `[STABLE]` | Zama protocol | protocol | The Zama backend as a whole. |        |

## Versions

| ID                                   | Name                | Aliases    | Short definition                                                                        | Issues |
| ------------------------------------ | ------------------- | ---------- | --------------------------------------------------------------------------------------- | ------ |
| [D-02](entries/D-02.md) `[EVOLVING]` | Protocol generation | generation | One iteration of the Zama protocol, named today by its major and minor version numbers. |        |
| [D-03](entries/D-03.md) `[STABLE]`   | Protocol hotfix     | hotfix     | A fix to one protocol generation that leaves the generation unchanged.                  |        |
| [D-04](entries/D-04.md) `[STABLE]`   | Protocol version    | version    | A name that usually means the protocol generation.                                      |        |

## Rules

| ID                                 | Name                  | Aliases            | Short definition                                                                                                                            | Issues |
| ---------------------------------- | --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| [D-05](entries/D-05.md) `[STABLE]` | Registered definition |                    | A definition that lives in the `entries/` folder of a definition folder and appears in its index.                                           |        |
| [D-06](entries/D-06.md) `[STABLE]` | Loose definition      |                    | A definition that explains a term only where the term is used, outside any definition folder.                                               |        |
| [D-07](entries/D-07.md) `[STABLE]` | Definition folder     | definitions folder | A registry folder, usually named `definitions/`, that holds registered definitions.                                                         |        |
| [D-08](entries/D-08.md) `[STABLE]` | Rule folder           | rules folder       | A registry folder of the kind `rules`, usually named `rules/`, that holds one rule book.                                                    |        |
| [D-09](entries/D-09.md) `[STABLE]` | Definition tag        |                    | The tag in the front matter of a registered definition that says whether the definition can change or is retired.                           |        |
| [D-10](entries/D-10.md) `[STABLE]` | Rule tag              | status tag         | The tag of a rule that says whether the rule text and the code agree.                                                                       |        |
| [D-11](entries/D-11.md) `[STABLE]` | Registry folder       | registry           | A folder that holds one kind of entry, such as definitions or rules, with a generated index, one file per entry, and generated group pages. |        |

## Chains

| ID                                   | Name                | Aliases                                     | Short definition                                                                                                      | Issues |
| ------------------------------------ | ------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| [D-12](entries/D-12.md) `[EVOLVING]` | FHEVM group         | FHEVM chain group, FHEVM network            | One deployment of the Zama protocol, with one gateway, one relayer, and one KMS, that serves one or more host chains. |        |
| [D-13](entries/D-13.md) `[EVOLVING]` | Host chain          | host                                        | An EVM chain on which an FHEVM group deploys its host contracts.                                                      |        |
| [D-14](entries/D-14.md) `[EVOLVING]` | Canonical chain     | canonical host chain, FHEVM canonical chain | The one host chain that an FHEVM group designates among its host chains, so that each group has exactly one.          |        |
| [D-15](entries/D-15.md) `[EVOLVING]` | Non-canonical chain | non-canonical host chain                    | A host chain of an FHEVM group that is not the canonical chain of that group.                                         |        |

<!-- END GENERATED INDEX -->
