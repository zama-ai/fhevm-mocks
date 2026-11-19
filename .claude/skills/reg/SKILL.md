---
name: reg
description: How to keep a registry folder (README.md index, entries/, groups/) for any kind of entry, such as definitions or rules: IDs, tags, groups, front matter, and the generate-index.mjs script that checks and generates the index. Use with the skill of the kind, such as reg-definitions, whenever you add, change, rename, group, or retire an entry, start a registry folder, convert an existing file into one, or add a new kind.
disable-model-invocation: true
---

# Keep a registry

A registry folder holds one kind of entry, such as definitions or rules. Every kind uses the same layout:

```
<registry folder>/
  README.md     the index: front matter and intro by hand, the index generated between two markers
  entries/      one file per entry, named after its ID, as in entries/D-02.md
  groups/       generated: one page per group, and all.md with every live entry
```

The entry files are the source. The front matter of each file holds the data of the entry. The script `generate-index.mjs`, in the folder of this skill, checks the rules of this skill and generates the index and the pages of `groups/`.

Each kind has a skill of its own, in a sibling folder named `reg-<kind>`, such as `.claude/skills/reg-definitions/` for the kind `definitions`. That folder holds:

- `KIND.json`: the letter of the IDs, the fields of an entry, and the columns of the index
- `TAGS.json`: the tags of the kind and their meanings
- `SKILL.md`: the rules that only that kind has

Read the skill of the kind together with this one: `.claude/skills/reg-<kind>/SKILL.md`, as in `.claude/skills/reg-definitions/SKILL.md`. Apply the `unslop` and `technical-writing` skills to every entry you write.

## Edit the source, then run the script

Never edit the index in `README.md` or any page in `groups/` by hand. The script overwrites them. Edit the front matter or the text of an entry file, then run this command from the root of the repository:

```sh
node .claude/skills/reg/generate-index.mjs <registry folder>
```

If a rule breaks, the script writes nothing. Each error names the file and says what to fix.

The script exits with code 0 when every file is up to date or written, with code 1 when a rule breaks or, with `--check`, a file is out of date, and with code 2 for a wrong command line or broken settings of the kind.

To check without writing, add `--check`. `make check-rules` runs it on every registry folder, as part of `make check-pre` and `make check`, and CI runs it on every pull request with `--base`. Run it yourself before you commit.

Before you merge, also add `--base <branch>`, with the branch that the change targets:

```sh
node .claude/skills/reg/generate-index.mjs --check --base main <registry folder>
```

The script then reads `README.md` on that branch. Every ID indexed there must still have a file, and every ID retired there must stay retired. Without `--base`, an entry deleted together with its index row passes, because the files alone cannot show it.

This script generates the index and the group pages, so rules R-02 and R-03 of `rules/global/rules/` apply to the index and to `groups/`. If the repository has `make generate`, add one run per registry folder to that target.

### Prove that a check exists

A kind can mark a field as a command field, as the field `checked-by` of a rule. A command field does not explain how to run the check. It is a reference whose only job is to prove that the check exists and belongs to the entry.

- Write just enough to reach the check, as in `checked-by: node scripts/rule-checks.mjs check no-hardcoded-address`.
- Start the value with the check itself: the path of a file of the repository, written with a slash, as in `./scripts/rule-checks.mjs`. Or start with one of the interpreters `node`, `sh`, `bash`, or `python3`, followed by that path. A program such as `echo` cannot start the value, so it cannot fake the proof.
- Write paths relative to the root of the repository, the folder that holds `.claude/`. A path cannot hold a space, and must match the file in letter case. A link may point to a file inside the repository, never outside it.
- Write plain words. A command field holds no quote and no shell character such as `;`, `|`, `$`, or `#`. The script may still wrap the whole value in quotes, because it quotes every value that does not start with a letter, a digit, or `(`. Those quotes belong to the front matter, not to the command.

The proof is a question to the check. The option is `--` followed by the noun of the kind and `-id`, as in `--rule-id` for a rule:

- `<value> --rule-id <ID of the entry>` must exit with code 0.
- `<value> --rule-id <ID that no entry has>` must exit with another code. The script asks with several such IDs, picked at random for each run and shaped like real ones: a free number, a free letter suffix on a taken number, as in `NR-07q`, and a number above every entry. IDs leave no gap, so a free number is always above the last entry. A command that accepts anything shaped like an ID fails.
- `<value> --rule-id <ID of an entry that another check enforces>` must exit with another code for at least one such entry. The script asks up to ten of them, in random order, and stops at the first no. A command that accepts every ID that exists fails. One no is enough, because a check may also enforce part of an entry that another check owns.
- No answer prints anything. A command that prints while it answers runs more than the answer.

The proof is only as strong as the check script makes it, so a check script must:

- answer only from its own list of the entries it enforces, and run nothing else: no check, no file read, no network
- read the rest of the line as it would without the option, and fail on an unknown option or an extra argument, so that a typo in the value fails the proof; a missing required argument or option can be excused, because the question does not need it
- answer yes for an entry that it enforces only with an option, as `--base`, only when the value gives that option
- exit with a code other than 0 when it does not know the check that the value names

The script cannot see whether a check script keeps this contract. Check it by hand when you review a check script.

To verify every reference, add `--verify-commands`:

```sh
node .claude/skills/reg/generate-index.mjs --check --verify-commands <registry folder>
```

With this flag, the script asks these questions for each command field of a live entry. It runs each one without a shell, from the root of the repository, in a process group of its own. Each question has 30 seconds and 1 MB of output. Then the script stops the whole group, so no process the check started keeps running. The script skips retired entries.

Only this flag runs anything. A normal run and `--check` never do. Never run `--verify-commands` on a branch you have not reviewed. Anyone who can edit an entry file can put any program in a command field, and this flag runs it.

### What the script checks

- the front matter of `README.md`: it starts on the first line, names the kind and the prefix, and holds each field once
- the `KIND.json` and `TAGS.json` of the kind, and a letter that no other kind uses
- the two markers, each once, alone on its line, outside a code block
- the form of each ID, its prefix, the gaps between IDs, and the file name of each entry
- an ID that the index lists but that has no file any more
- an ID that the index lists as retired but that is no longer retired
- with `--base`, the same two rules against the index on the base branch
- an `entries/` folder that holds only `.md` files, apart from hidden files
- the fields of each entry, their values, and their quotes, including a ` #` that YAML would read as a comment
- the tag, and a tag repeated in the text outside code
- each field of type `sentence`, as one sentence that ends with a period
- each field of type `choice`, as one of its values
- each field with a condition: allowed only when its `allowedWhen` holds, and present whenever its `requiredWhen` holds
- each command field: no quote and no shell character
- with `--verify-commands`, each command field: it starts with a file of the repository, or an interpreter and that file, `<value> --rule-id <ID>` exits with code 0 for the ID of the entry, with another code for IDs that no entry has and for at least one of ten entries that other checks enforce, and prints nothing, which proves the check exists
- each value: not empty, and no space at its start or its end
- each condition: no value it does not allow, no value twice, and no condition that always holds, never holds, or holds only for retired entries
- the values of the term fields that two live entries share, ignoring case
- the form of a retired entry, and the entry it merges into, if that entry is in the same registry
- the group of each entry, which `README.md` must declare
- each group line: a valid name, a one-sentence description, no duplicate, and no reserved name
- a `groups/` folder that holds only the pages the script wrote
- in the text of an entry: an underlined heading, an HTML link or image, a code block that never closes, a heading whose anchor matches an ID, and a link label that another entry on the same group page uses
- two headings of `README.md` that would get the same anchor

The script cannot see other folders, and it cannot judge wording. Check these rules by hand:

- No two registry folders of the same kind share a prefix.
- Only the global registry of a kind has the empty prefix.
- An entry merged into an entry of another registry points at an entry that exists and is live.
- Every group name is in sentence case.
- Every rule that the skill of the kind marks as a check by hand.

### What the script changes

- It rewrites the front matter of each entry file in the format of the next section, and the part of `README.md` between the two markers.
- It writes the pages of `groups/`, and deletes or renames only the pages it wrote. The script owns `groups/`.
- It never changes the text of an entry, the front matter of `README.md`, or the text outside the markers. The only exception: it converts CRLF line endings to LF and removes a byte order mark.

## Write the front matter of an entry

Every entry file starts with its front matter, followed by the text. This example comes from the kind `definitions`, whose fields are `name`, `aliases`, and `short`:

```markdown
---
id: AD-02
tag: EVOLVING
group: Releases
name: Widget batch
aliases:
  - batch
  - release batch
short: The widgets that one release ships.
---

# Widget batch

<The full text of the entry.>
```

- The front matter holds `id`, `tag`, an optional `group`, then the fields that `KIND.json` lists, in that order. The script rewrites them in this order, one per line, as `<field>: <value>`, except for lists.
- Write the tag as the `TAGS.json` of the kind spells it, without brackets. YAML reads a value in brackets as a list.
- Write a field of type `list` as a line `<field>:`, then one line `  - <item>` for each item. Write `<field>: []` for an empty list. The script leaves out an empty list if `KIND.json` marks the field optional.
- Do not write a list in brackets, as in `[first, second]`. A Markdown link checker reads the brackets as a link reference and warns. The script still reads a list in brackets, and rewrites it as one line per item.
- Write a field of type `sentence` as one sentence that ends with a period.
- Set `group` to a group that `README.md` declares, or leave it out. See "Group entries when the index grows".
- Write each value as plain text. If YAML would read a value as something other than text, the script adds quotes. For example, it quotes `true`, `1.0`, a date, a value that contains a colon, and a value that starts with a character other than a letter, a digit, or `(`.
- The script quotes a value as Prettier does with the workspace setting `singleQuote`: in single quotes, as `'1.2.1'`, unless the value holds a backslash, or more single quotes than double quotes, then in double quotes. Prettier formats these files when your editor saves them, so the script writes what Prettier would write, and neither undoes the other. In single quotes, write a quote inside the value as `''`.
- You choose the text after the front matter. Give it a title of your choice, or no title, because the front matter already holds the title field. Never repeat the tag in the text.
- Write headings with `#`, never by underlining a line with `===` or `---`. Write links and images in Markdown, never as HTML. Close every code block. Give each link label a name that no other entry of the registry folder uses, because `groups/all.md` holds every entry. The script copies the text to the group pages, and it cannot move the other forms safely.

## Lay out README.md around the generated index

```markdown
---
kind: definitions
prefix: A
groups:
  Releases: How a widget reaches users.
---

# Definitions

The rule books of this package use these terms with the meanings below.

<!-- BEGIN GENERATED INDEX. Edit the entry files, then run generate-index.mjs. -->
<!-- END GENERATED INDEX -->
```

- `kind` names the kind, as in `definitions`. The script reads `KIND.json` and `TAGS.json` from `.claude/skills/reg-<kind>/`, as in `.claude/skills/reg-definitions/`.
- `prefix` is the prefix of every ID in the folder: capital letters, or `""` for the empty prefix.
- `groups` is optional. "Group entries when the index grows" explains it.
- Below the front matter, write a title and one sentence that says who uses the entries.

The script fills the space between the markers with the sentence that gives the prefix, the table of tags, the note of the kind if it has one, a link to `groups/all.md`, and the index. Each table of the index lists its entries sorted by ID, with one column per field of `KIND.json`.

- Without groups, the index is one table with no heading.
- With groups, the index starts with a `## Groups` table. It links each group to its section and to its page in `groups/`.
- A `## No group` table follows, if any entry has no group.
- Each group then gets a `##` section with its own table, in the order of the front matter.

## Read a group on one page

The script writes one page per declared group, named after the anchor of the group heading, as in `groups/versions.md`, and `groups/all.md` with every live entry, sorted by ID.

Each page shows the heading, the summary, the other fields, and the full text of each live entry. The pages leave out retired entries, because their text only names what replaced them. The index still lists them.

- To link to one entry on a page, link to `groups/all.md#d-02`. That link survives a rename and a move to another group. A link to a group page, such as `groups/versions.md#d-02`, breaks when the entry changes group.
- The script adjusts the headings and the relative links of the text for the page. It leaves code as it is.
- A page repeats the text of the entry files, so a search also finds an entry in `groups/`. Edit only the file in `entries/`.

## Each registry folder has its own prefix

Every ID in a registry folder has the form `<P><L>-<NN>`. `<P>` is the prefix that `README.md` declares: capital letters, or nothing. `<L>` is the letter of the kind, from `KIND.json`. The generated index says which `<P><L>-` its IDs start with. For example, the definitions with the prefix `A` have the IDs `AD-01`, `AD-02`, and so on.

- The global registry of a kind has the empty prefix, so its IDs are `D-01`, `D-02`, and so on.
- Every other registry folder of the kind has a prefix of one or more capital letters.
- Before you choose a prefix, search the repository for the prefixes in use:

  ```sh
  grep -rn 'IDs in this file start with' --include=README.md .
  ```

## Each entry has an ID that never changes

- A new entry takes the highest ID number in its folder plus one. `<NN>` is two digits and starts at `01`. After `99`, IDs continue with three digits, and the existing IDs do not change.
- If `KIND.json` allows suffixes, an entry can also take a letter suffix after an existing ID, as in `FR-07a`, `FR-07b`. The letters start at `a` and leave no gap.
- Never change an ID, and never give it to another entry.
- Name the entry file after its ID only, as in `entries/AD-02.md`. The title of an entry can change. Its ID and its file name cannot.

## Each term belongs to one entry

`KIND.json` marks some fields as term fields, such as the name and the aliases of a definition.

- Two live entries never share a value of a term field. The script compares the values ignoring case.
- One entry never repeats a value across its term fields.
- A retired entry has empty term lists, and its values are free. The entry that replaces it can take them.

## Group entries when the index grows

A group is optional. It splits the index into one table per group, so that a reader finds an entry by its topic. Every entry file stays in `entries/`, whatever its group, so a link to an entry never breaks when the entry changes group.

`README.md` declares its groups in its front matter, one per line, as `  <Group>: <description>`, under `groups:`. The order of the lines is the order of the index. An entry can use only a declared group, spelled exactly as declared. A declared group can be empty.

- Name a group by its topic, in sentence case, as in `Versions` or `Releases`. Start the name with a letter or a digit, and leave out quotes, colons, `#`, brackets, and other characters that YAML reads specially.
- The index uses the headings "Groups" and "No group", and `groups/all.md` holds every entry, so no group can take these names or the name "All". A group also cannot share its anchor with another heading of `README.md`.
- Write the description as one sentence that ends with a period and says which entries belong to the group. If YAML would not read the description as plain text, for example because it contains a colon or `#`, put it in quotes.
- An entry belongs to one group or to none. A retired entry keeps its group.
- To add a group, declare it in `README.md`, set `group` on each entry that belongs to it, then run the script.
- To move an entry to another group, change its `group`, then run the script. Its ID and its file stay the same.
- To rename a group, change its line in `README.md` and `group` in every entry of the group, then run the script. The script deletes the page of the old name, so links to the old group heading and to the old page break. Search the repository for both.
- To remove a group, remove `group` from its entries or move them to another group, delete its line in `README.md`, then run the script. The script deletes the page of the group, so search the repository for links to it.

## Each entry carries one tag

The `TAGS.json` of the kind lists the tags and their meanings. Every generated index shows them as a table.

- To change the tag of one entry, edit `tag` in its front matter.
- To add, remove, or reword a tag, edit `TAGS.json`, then run the script on every registry folder of the kind. Keep RETIRED in `TAGS.json`, because the script depends on it.

## Start a registry folder

1. Choose a prefix that no other registry folder of the kind uses. The grep in "Each registry folder has its own prefix" lists the prefixes in use.
2. Create `README.md` with the layout of "Lay out README.md around the generated index".
3. Create `entries/` with the first entry, `entries/<P><L>-01.md`. Git does not keep an empty folder, so create the first entry in the same commit.
4. Run the script.

## Add an entry

1. Search the index of the folder, and the global registry of the kind, for an entry that already covers the subject. Follow the skill of the kind on what to do if one exists.
2. Take the highest ID number in the folder plus one.
3. Create `entries/<ID>.md` with the front matter and the text. If `README.md` declares a group for its topic, set `group` to it.
4. Run the script.

## Change an entry

1. Edit the front matter or the text of the entry file.
2. Run the script.
3. Search the repository for the ID and the values of the term fields. Give the rule tag `[STALE]` to each rule that the change makes wrong, with an evidence line, as the `reg-rules` skill describes.
4. If the meaning changes so much that the text citing the ID becomes wrong, retire the entry and add a new one instead.

## Retire an entry

Never delete an entry file. Retire the entry instead. A retired entry stays retired. To use it again, add a new entry.

1. Note the values of the term fields of the entry. You search for them in step 7.
2. Set `tag: RETIRED`.
3. If the kind has term fields, and another entry replaces the retired one, move the values of the term lists to the term lists of that entry, as the skill of the kind describes.
4. Empty every term list of the retired entry, as in `[]`. Its title stays, so that the index still names it. Its other fields stay as they were. A retired entry needs no field that a `requiredWhen` would ask for, and `--verify-commands` skips it.
5. Set the summary field, the one that `KIND.json` marks `"summary": true`, to `Merged into <ID>.` or `No longer used.`, with the real ID in place of `<ID>`.
6. Delete the text. In its place, write the same sentence as a quote, such as `> Merged into AD-01.` A title can stay. Nothing else can.
7. Run the script, then search the repository for the retired ID and the values you noted. Give the rule tag `[STALE]` to each rule that cites them, as in "Change an entry".

## Convert an existing file into a registry folder

1. Create the registry folder, its `README.md` with the front matter, the title, the intro, and the two markers, and its `entries/` folder.
2. Move the text of each entry into `entries/<ID>.md`. Keep its ID. If the IDs have no prefix and the folder is not the global registry of the kind, add the prefix, so that `D-03` becomes `AD-03`. This is the only time an ID changes. Rewrite every citation of the old ID in the repository.
3. Fix every relative link in the moved text, because each file now sits at another depth.
4. Write the front matter of each file from the old text. Then delete the old heading, the old field lines, and any tag from the text.
5. Fix every value of a term field that two entries share. If two entries share one, ask the owner which entry keeps it.
6. Run the script.

## Add a kind

1. Create `.claude/skills/reg-<kind>/`, where `<kind>` is the name that `kind` will have in `README.md`. Give its `SKILL.md` the name `reg-<kind>`.
2. Write `TAGS.json`: an object that maps each tag, in capital letters, to its meaning on one line. It must hold RETIRED.
3. Write `KIND.json`:

   ```json
   {
   	"letter": "D",
   	"noun": "definition",
   	"plural": "definitions",
   	"suffixes": false,
   	"tagLabel": "Definition tag",
   	"fields": [
   		{ "key": "name", "label": "Name", "type": "text", "title": true, "term": true },
   		{ "key": "aliases", "label": "Aliases", "type": "list", "term": true },
   		{ "key": "short", "label": "Short definition", "type": "sentence", "summary": true }
   	],
   	"note": { "tag": "EVOLVING", "text": "The sentence the index shows while that tag exists." }
   }
   ```

   - `letter`: one capital letter, unique among the kinds.
   - `suffixes`: whether IDs can take a letter suffix, as in `FR-07a`.
   - `tagLabel`: the header of the tag column in the table of tags.
   - `fields`: each field has a `key`, a `label` for its column, and a `type`:
     - `text`: one line, any number of sentences.
     - `sentence`: one sentence that ends with a period.
     - `list`: a list, with one `  - item` line for each item.
     - `choice`: one of the texts in its `values`, as in `"values": ["script", "missing", "impossible", "ignored"]`.
   - Exactly one required `text` field has `"title": true`, and exactly one required `sentence` field has `"summary": true`. `"term": true` makes the values unique across live entries. `"optional": true` makes a field optional.
   - `"command": true` marks a `text` field as a command field: a reference that proves a check exists, which `--verify-commands` verifies.
   - `"index": false` keeps a field out of the index table, for a long field. The group pages still show it. The title and the summary always stay in the index.
   - `"lines": true` shows a `list` field as one bullet per item on the group pages.
   - `"allowedWhen"` allows a field only in some cases, and `"requiredWhen"` requires it in some cases. A field with either condition must be optional. Each condition maps the tag, or a `choice` field, to the values that make it hold, as in `"allowedWhen": { "check": ["script"] }`, or with `"not"` to the values that make it fail, as in `"requiredWhen": { "tag": { "not": ["HOLD"] } }`. With several keys, every key must hold.
   - A `choice` field cannot be a term, because many entries share a choice.
   - `note`: optional. Its `tag` must be a tag of `TAGS.json`.

4. Write `SKILL.md` with the rules that only that kind has, and point it to this skill.
