---
name: reg-issues
description: How to open, track, and close an issue on the rules and definitions, and how to mark the rules and definitions it affects with their `issues` field. Use together with the `reg` skill, which holds the layout, the script, and the steps, whenever you find a problem in a rule or a definition that you cannot fix now, close or answer an issue, or for /reg-issues.
disable-model-invocation: true
---

# Track an issue

Issues live in a registry folder of the kind `issues`, `rules/__issues__/`. The `reg` skill, in `.claude/skills/reg/SKILL.md`, gives the layout of the folder, the script, the checks, groups, IDs, and the steps to add, change, and retire an entry. This skill gives what only issues have. Read both.

This folder holds the settings of the kind:

- `KIND.json`: the letter `I`, and the fields `title`, `short`, and `old`
- `TAGS.json`: the issue tags and their meanings

Apply the `unslop` and `technical-writing` skills to every issue you write.

## Open an issue

Open an issue for a problem in a rule or a definition that you cannot fix now: a decision that only the owner can make, a cleanup left for later, or a change to the code.

```markdown
---
id: I-12
tag: QUESTION
group: Decisions
title: Three ESLint layers or four parts
short: The short rule of NR-46 says "three layers", and its text lists four parts.
old: N4
---

Decide which is right, then align the title, the short rule, and the text.

Affects [NR-46](../../fhevm-npm/rules/entries/NR-46.md).
```

- `title`: the name of the issue, short. Two live issues never share a title.
- `short`: the problem, one sentence that ends with a period.
- `old`: optional. The number the issue had in an earlier list, as in `T55` or `Q1`.
- The tag is `QUESTION` when the owner must decide, with each answer and what it changes. It is `TODO` when the work is known, with what is left to do.
- The group is `Decisions`, `Cleanup`, or `Code`, as the `README.md` of the folder describes.
- The text ends with "Affects", followed by a link to each rule or definition that the issue affects.

## Mark what the issue affects

Add the ID of the issue to the `issues` field of each rule or definition it affects, sorted by number:

```yaml
issues:
  - I-12
```

The field and the "Affects" line of the issue must name the same entries. The script checks neither, so compare them by hand.

An issue that affects no entry, such as a question about the skills, has no "Affects" line.

## Close an issue

1. Apply the decision or do the work.
2. Remove the ID of the issue from the `issues` field of every entry it affects. Delete the field when it becomes empty.
3. Retire the issue, as the `reg` skill says: the tag `RETIRED`, the short "No longer used.", or "Merged into <ID>." when another issue replaces it, and the same line as the only text, as a quote: `> No longer used.`
4. Run the script on the folder of the issues and on the folder of every entry you changed.
