---
kind: rules
prefix: ""
---

# Global rules

Rules that apply to every package of the repository.

<!-- BEGIN GENERATED INDEX. Edit the entry files, then run generate-index.mjs. -->

The IDs in this file start with `R-`.

| Rule tag     | Meaning                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `[HOLD]`     | The text is accurate, and the code follows it. Nothing needs a fix.                                                                   |
| `[STALE]`    | The rule is still wanted, but its text names files, symbols, commands, or versions that changed. The fix goes to the rule text.       |
| `[RETIRED]`  | The rule is withdrawn: what it governs no longer exists, or another rule replaces it. Delete the rule text and keep the ID.           |
| `[VIOLATED]` | The text is accurate and still wanted, but the code does not follow it. The fix goes to the code.                                     |
| `[CONFLICT]` | The rule contradicts or repeats another rule. The fix is a decision, then one rule changes or merges.                                 |
| `[GAP]`      | The rule is wanted and the repository follows it today, but no check, or only a weaker check, enforces it. The fix goes to the check. |

To read the full text of every live rule on one page, open [groups/all.md](groups/all.md).

| ID                                   | Rule                                   | Short rule                                                                             | Old number | Check   | Issues           |
| ------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------- | ---------- | ------- | ---------------- |
| [R-01](entries/R-01.md) `[VIOLATED]` | Public text never cites a rule         | Public text never refers to a rule.                                                    |            | missing | I-18, I-124      |
| [R-02](entries/R-02.md) `[HOLD]`     | Never edit a generated file            | Edit the source of a generated file, never the file itself.                            |            | missing | I-01, I-14, I-18 |
| [R-03](entries/R-03.md) `[HOLD]`     | Never write into a generated directory | Never write into a directory that a generator owns, by hand or from another generator. |            | missing | I-14, I-18       |
| [R-04](entries/R-04.md) `[HOLD]`     | The previous generation is frozen      | Change the previous generation only on its release branch, never in place.             |            | missing | I-14, I-18       |
| [R-05](entries/R-05.md) `[VIOLATED]` | Name a generation by its place         | Internal text names a generation by its place, never by its number.                    |            | missing | I-18             |
| [R-06](entries/R-06.md) `[GAP]`      | Register definitions with the skill    | A registered definition wins over every loose definition of the same term.             |            | missing | I-18             |

<!-- END GENERATED INDEX -->
