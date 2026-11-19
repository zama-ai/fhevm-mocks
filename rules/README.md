# Rules and definitions

This folder holds the rule books and the definitions of the repository. Each book is a registry folder: a `README.md` index, one file per entry in `entries/`, and generated pages in `groups/`.

| Path | What it is |
| --- | --- |
| [global/definitions/](global/definitions/README.md) | The definitions that every book uses, `D-<NN>` |
| [global/rules/](global/rules/README.md) | The rules that apply to every package, `R-<NN>` |
| [forge-fhevm-std/rules/](forge-fhevm-std/rules/README.md) | The rules of the forge-fhevm-std package, `FR-<NN>` |
| [forge-fhevm-std/FORK_AND_LOCAL.md](forge-fhevm-std/FORK_AND_LOCAL.md) | How one API of forge-fhevm-std works on a local stack and on a fork |
| [forge-fhevm-std/PUBLIC_API.md](forge-fhevm-std/PUBLIC_API.md) | Which files of forge-fhevm-std are public, and which are internal |
| [fhevm-npm/rules/](fhevm-npm/rules/README.md) | The rules of the npm workspace, `NR-<NN>` |
| [fhevm-npm/definitions/](fhevm-npm/definitions/README.md) | The terms of the npm workspace, `ND-<NN>` |
| [fhevm-npm/WORKSPACE.md](fhevm-npm/WORKSPACE.md) | What the npm rules are for, and how generations live side by side |
| [\_\_issues\_\_/](__issues__/README.md) | The open work on the rules and the definitions, `I-<NN>`. An entry lists the issues that affect it in its `issues` field |

## Change a rule or a definition

A change to a rule or a definition is critical. [global/README.md](global/README.md) says how to review one.

The skills `reg`, `reg-rules`, `reg-definitions`, and `reg-issues`, in `.claude/skills/` of the repository that holds this folder, give the format of every entry and the steps to add, change, and retire one. Edit the entry files, then run the script from the root of that repository:

```sh
node .claude/skills/reg/generate-index.mjs --check rules/global/definitions
node .claude/skills/reg/generate-index.mjs --check rules/global/rules
node .claude/skills/reg/generate-index.mjs --check rules/forge-fhevm-std/rules
node .claude/skills/reg/generate-index.mjs --check rules/fhevm-npm/rules
node .claude/skills/reg/generate-index.mjs --check rules/fhevm-npm/definitions
node .claude/skills/reg/generate-index.mjs --check rules/__issues__
```
