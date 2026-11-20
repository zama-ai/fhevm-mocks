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

## Write the text of a rule

This section is for a live rule. A retired entry holds only its notice, as "Retire an entry" in the `reg` skill says. The `technical-writing` and `unslop` skills apply to the text of a rule as to every entry. This section adds only what is particular to rules.

### Size the text to what the reader must know

Use the smallest form that keeps the whole meaning: the obligation, its scope, the reason a reader cannot guess, and how it is checked. The three sizes are guidance, not templates.

- **Short**: a few sentences, with no heading. The obligation, its scope, and its reason fit in them. A named command fits too. R-02 and FR-40 are short.
- **Medium**: a paragraph or two, with a scope list or one example if the reader needs it, and still no heading. Use it when a scope, an exception, or a reason needs more than one sentence. R-01, R-04, and NR-01 are medium.
- **Elaborate**: titled sections. Use it when the text has parts that a reader looks up on their own, such as a mechanism, a failure on purpose, or a procedure. NR-91 and R-05 are elaborate. One order that works: what the rule covers, how it is checked, when the check fails on purpose, and what to do. Leave out a section that does not apply.

If two parts of a rule can stand alone, or need different tags or checks, split them into sub-rules, as "Set the rule tag and its evidence" says. Many sections are a reason to look at the structure, not a reason to split.

### Write what only a rule needs

- Keep the obligation in the text and the current defects in the evidence. The text gives the obligation, its scope, its reason, and how the check behaves, with its known limits. The evidence lists what is wrong today, in the form that the tag needs. Do not copy that list into the text.
- Give every "never" its reason. One clause is often enough.
- When a check fails on purpose, say so. Say what stays red, what fixes it, and what must never be added to make it pass, with the reason.
- Describe each thing that the rule governs in one place. For example, list every field of a generated entry together, not some in a list and the rest in a later section.
- Make the ❌ example show the mistake that this rule prevents, not a nearby one. A rule about regenerating copies after a config sync shows a sync without the regeneration, not a hand edit of a generated file, which R-02 already covers. Keep the comments of the example from repeating the text.
- Introduce each code block with its purpose. Put a warning or a prerequisite before a command, and the expected result after it.

### Review a rewrite for form

A rewrite for form keeps the meaning. Before you accept one, compare it with the original: the scope, the obligations, the exceptions, the failure conditions, and the examples. Undo any difference, or treat it as a change to the rule, which `rules/global/README.md` says how to review.

For an elaborate rule, iterate. Keep each version. Give each one to a fresh reviewer, who compares it with the previous version and with the original. Stop when the reviewer reports no clarity issue worth fixing. This review adds to the review in `rules/global/README.md`, and never replaces it: the owner of the rules still approves the change.

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
