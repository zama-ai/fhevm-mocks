# Global rules and definitions

This folder holds the rules and the definitions that apply to every package of the repository.

| Path                                         | What it is                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| [rules/](rules/)                             | The global rules, `R-<NN>`: a registry folder, with its index in `README.md`       |
| [rules/entries/](rules/entries/)             | One file per global rule                                                           |
| [rules/groups/](rules/groups/)               | Every live global rule on one page, in `all.md`, built by a script                 |
| [definitions/](definitions/)                 | The global definitions, `D-<NN>`: a registry folder, with its index in `README.md` |
| [definitions/entries/](definitions/entries/) | One file per global definition                                                     |
| [definitions/groups/](definitions/groups/)   | One page per group, and every live definition in `all.md`, built by a script       |

## A change to a rule or a definition is critical

Every package follows the global rules, and every rule book uses the global definitions. A change here changes the work of every package at once.

- **People and agents apply a rule as written.** An agent does not ask what the author meant. It follows the new text from its next run on, in every package.
- **A changed definition changes every rule that uses the term.** No rule text moves, so the change does not show in the diff of any rule. A reader sees one edited definition, and dozens of rules now mean something else.
- **Rules and definitions are cited by ID.** A rule that cites `R-04` or `D-02` assumes that the ID keeps its meaning. A careless rewrite breaks that promise without breaking any link.

## Review every change seriously before you approve it

Approve a change to a rule or a definition only after a serious review. A typo fix counts as a change, because a typo fix can change a meaning.

1. Put each change in a PR of its own, or in a PR that changes nothing else. Say in its description which rules and definitions change, and why.
2. For a definition, search the rule books for its ID, its name, and every alias. Read each rule that uses the term, and check that the rule still says what its author meant. Give the rule tag `[STALE]` to each rule that the change makes wrong, with the evidence line that the `reg-rules` skill requires.
3. For a rule, read the rules it cites and the rules that cite it. Check that none of them now contradicts it.
4. Check that the change keeps every ID with its meaning. To change a meaning, retire the old ID and add a new one.
5. Run the checks: `generate-index.mjs --check --base <target branch>` on each registry folder, as [the `reg` skill](../../.claude/skills/reg/SKILL.md) describes. `--base` catches a definition deleted together with its index row, which the files alone cannot show.
6. Get the approval of the owner of the rules. A review by the author of the change, or by the agent that wrote it, does not count.
