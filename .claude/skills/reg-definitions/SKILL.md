---
name: reg-definitions
description: How to write, rename, alias, or retire a definition: the fields of a definition, its aliases, its definition tag, registered and loose definitions, and how a rule cites one. Use together with the `reg` skill, which holds the layout, the script, and the steps, whenever you write or edit a definition, or a rule needs a term that has no definition yet, or for /reg-definitions.
disable-model-invocation: true
---

# Write a definition

Definitions live in registry folders of the kind `definitions`, such as `rules/global/definitions/`. The `reg` skill, in `.claude/skills/reg/SKILL.md`, gives the layout of the folder, the script, the checks, groups, IDs, and the steps to add, change, and retire an entry. This skill gives what only definitions have. Read both.

This folder holds the settings of the kind:

- `KIND.json`: the letter `D`, and the fields `name`, `aliases`, `short`, and `issues`
- `TAGS.json`: the definition tags and their meanings

Apply the `unslop` and `technical-writing` skills to every definition you write.

## Fill the fields

```markdown
---
id: D-02
tag: EVOLVING
group: Versions
name: Protocol generation
aliases:
  - generation
short: One iteration of the Zama protocol, named today by its major and minor version numbers.
---
```

- `name`: the name of the term, in sentence case. It titles the definition in the index and on the group pages.
- `aliases`: the other names of the term, or `[]`.
- `short`: the short definition, one sentence that ends with a period. Put every file name and folder name in backticks, as in `` `README.md` `` or `` `entries/` ``. The script cannot check the backticks, so check them by hand.
- `issues`: optional. The IDs of the open issues that affect the definition, as in `[I-03]`, sorted by number. The `reg-issues` skill says when to add and remove one.

## Give each name and alias to one definition

`name` and `aliases` are term fields, so a name or an alias belongs to one live definition.

- An alias is never the name of another live definition, and never repeats the name of its own definition.
- Before you add a definition, search the names and the aliases in the index of the folder and of `global/definitions/`. If a definition already covers the term, add an alias to it instead.
- To rename a term, change `name`, and add the old name to `aliases`.
- To retire a definition that another one replaces, add its name and its aliases to the `aliases` of the replacing definition.

## Set the definition tag

`TAGS.json`, in this folder, lists the definition tags and their meanings. A definition tag is not a rule tag: the first says whether a definition can change, the second whether a rule and the code agree.

If the definition tag says that the definition can change, say in the text what can change and why. For example: "If the protocol design changes, how a generation is numbered can change too."

## Register a definition, and let it win

A registered definition lives in the `entries/` folder of a definition folder. A loose definition explains a term only where the term is used, for example in a sentence of a rule. Rule R-06 of `rules/global/rules/` sets the rules between them:

- To register a definition, use this skill and the `reg` skill.
- A registered definition wins over every loose definition of the same term. If a loose definition disagrees with a registered one, fix the loose one.
- A definition folder never redefines a term from `global/definitions/`. Use the global definition instead. The script cannot see other folders, so check this by hand.

## Cite a definition

A rule can name a term in plain words, cite its ID, or link to the definition. A link is optional. To link, point at the entry file, as in `[AD-02](<path>/definitions/entries/AD-02.md)`, or at its section of `groups/all.md`, as in `[AD-02](<path>/definitions/groups/all.md#ad-02)`. The index rows have no anchors.
