---
name: reg-rules
description: How to write, tag, check, or retire a rule in a rule book: the fields of a rule, its rule tag and evidence, its check and the reference that proves the check exists, sub-rules, and how rules stay out of public text. Use together with the `reg` skill, which holds the layout, the script, and the steps, whenever you add, change, review, tag, or retire a rule, convert a rule book, or for /reg-rules.
disable-model-invocation: true
---

# Write a rule

A rule book is a registry folder of the kind `rules`, usually named `rules/`. The `reg` skill, in `.claude/skills/reg/SKILL.md`, gives the layout of the folder, the script, the checks, groups, IDs, and the steps to add, change, and retire an entry. This skill gives what only rules have. Read both.

This folder holds the settings of the kind:

- `KIND.json`: the letter `R`, letter suffixes, and the fields of a rule
- `TAGS.json`: the rule tags and their meanings

Apply the `unslop` and `technical-writing` skills to every rule you write. A change to a rule is critical, because every package that follows the book changes at once. `rules/global/README.md` says how to review one.

## Give each rule book its prefix

Each rule book has its own prefix, which its `README.md` declares:

- the global rules: `""`, so their IDs are `R-01`, `R-02`, and so on
- the forge-fhevm-std rules: `F`, as in `FR-01`
- the Hardhat rules: `H`, as in `HR-01`

To add a rule next to an existing one without renumbering, or to split a rule, give it a letter suffix: `FR-07a`, `FR-07b`. The script checks that the letters follow `FR-07` with no gap.

## Fill the fields

This example comes from a made-up rule book with the prefix `X`:

```markdown
---
id: XR-02a
tag: STALE
group: Tests
title: Name the RPC alias
short: The alias of the RPC is sepolia.
old: "4.3"
check: script
checked-by: node scripts/rule-checks.mjs check rpc-alias
evidence:
  - "`foundry.toml:12` names sepolia-v2. Fix: name the alias sepolia-v2."
---

<The full rule: what it asks, why, and how to follow it.>
```

- `title`: the name of the rule, short, as in `Never edit a generated file`. Two live rules of one book never share a title.
- `short`: the rule itself, one sentence that ends with a period.
- `old`: optional. The number the rule had before it had an ID, as in `"4.3"`, so that an old citation still finds it. Quote it, because YAML reads `4.3` as a number.
- `check`: how a check enforces the rule:
  - `script`: a script checks it.
  - `missing`: a script could check it, and none does yet.
  - `impossible`: no script can check it, as for a recovery procedure.
  - `ignored`: the rule is not checked, on purpose, for now.
- `checked-by`: only with `check: script`. A reference that proves the check exists, as the `reg` skill describes in "Prove that a check exists". `<checked-by> --rule-id <ID of the rule>` must exit with code 0.
- `evidence`: one line for each problem, required with every rule tag except `HOLD` and not allowed with `HOLD`.
- `issues`: optional. The IDs of the open issues that affect the rule, as in `[I-04, I-93]`, sorted by number. The `reg-issues` skill says when to add and remove one.

The index shows the title, the short rule, the old number, the check, and the issues. The group pages show the rest.

## Set the rule tag and its evidence

`TAGS.json`, in this folder, lists the rule tags and their meanings. A rule tag is not a definition tag. A rule tag says whether a rule and the code agree.

Write each evidence line in the form that its rule tag needs:

- `STALE`, `VIOLATED`: `` `<file>:<line>` shows <what changed>. Fix: <the fix>. ``
- `CONFLICT`: `Conflicts with FR-05.` Tag both rules, and each one names the other.
- `GAP`: start with the kind of gap:
  - `Gap, no check:` nothing checks the rule.
  - `Gap, loose check:` a check exists but lets some breaking change pass. Name that change.
  - `Gap, wrong check:` a check exists but would fail a change that follows the rule. Name that change.

Keep the rule tag and the check in agreement. The script cannot see this, so check it by hand:

- `check: missing` goes with `GAP`, or with a worse tag such as `STALE`.
- `check: impossible` never goes with `GAP`. Guidance that no check can enforce is not a gap. It goes with `HOLD`, or with `STALE` or `VIOLATED` when the text or the code is wrong.
- `check: script` can go with `GAP`, for a loose or a wrong check.

A rule carries one rule tag. If parts of a rule have different status, split it into sub-rules with letter suffixes, each with its own tag.

The script does not read evidence lines. Check these by hand:

- An evidence line has the form that its rule tag needs.
- Both rules of a `CONFLICT` carry the tag, and each one names the other.
- A rule that the owner keeps in two rule books on purpose names the other copy in its text, as R-04 and NR-27 name each other. The two copies are tagged separately, and neither is a `CONFLICT`.

To list the open work of a rule folder, search the front matter for the rule tags:

```sh
grep -l -E '^tag: (STALE|VIOLATED|CONFLICT|GAP)$' <rule folder>/entries/*.md
```

## Retire a rule

Follow "Retire an entry" in the `reg` skill. A rule merged into another one, even in another book, has `short: Merged into R-02.`, as for a rule of a package that moved to the global rules. Keep its `old` number, so that old citations still find it.

## Give IDs to a book that used numbers

When a rule book with numbered rules becomes a rule folder:

- Give its rules their first IDs in their current order. A sub-rule takes the ID of its parent with a letter suffix: if rule 3 becomes `FR-03`, rule 3.1 becomes `FR-03a`.
- Keep the old number of each rule in its field `old`. A citation of an old number then resolves through the index, where the column "Old number" stands next to each ID.
- Rewrite a citation of an old number only at its source. Never rewrite one in a frozen copy or in a generated copy.
- A prefix belongs to a rule book, not to a file. A rule keeps its ID when it moves to another file, or to another package.

## Keep rules out of public text

Rule R-01 of `rules/global/rules/` applies to every rule. Public text never cites a rule. Internal text can cite a rule by its ID: internal source files, tests, build scripts, CI, the rule books, commit messages, and PRs, as in `see FR-16`. A link is optional. To link, point at the entry file, as in `rules/entries/FR-16.md`, or at its section of `groups/all.md`, as in `rules/groups/all.md#fr-16`.
