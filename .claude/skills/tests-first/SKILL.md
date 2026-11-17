---
name: tests-first
description: Write tests from a spec with independent agents that never see the implementation. They know only the spec and the public API, list every edge case, agree on one catalog, then write black-box tests. Use for /tests-first, or when asked to write spec-based tests, to find edge cases, or to test code without reading it.
---

# Tests first

A test written after reading the code checks what the code does. A test written from the spec checks what the code must do. This skill keeps the test authors away from the code, so every gap between the code and the spec shows up as a failing test or as a question about the spec.

Use this skill for a whole spec at once, to build a catalog of cases and the tests for it.

```text
spec.md + api.md                                  for people, in the repository
        │  derive, compare again after every edit
        v
spec-agents.md + api-agents.md + conventions.md   the only files the agents see
        │
        ├── agent A: rules, decision tables ──┐
        │                                     ├── one critique round ──> you settle against the rule text
        └── agent B: inputs, types, attacks ──┘                                   │
                                                                                  v
                                                   one catalog + spec gaps ──> the user answers the gaps
                                                                                  │
                                                                                  v
                       a fresh blind agent writes the tests ──> you place them ──> run, then triage
```

## Stay blind yourself until the tests run

The agents are blind only if you are. Until the tests are placed and have run once, follow these rules:

- Do not read the code under test. Take the API from its exported signatures, never from its function bodies. When the API does not exist yet, take the layout the user agreed on.
- Take behavior and error text only from the spec or from the user.
- If you have read the code earlier in this session, say so to the user. Then have a fresh agent, which has not read the code, derive the agents' files from the documents for people.

## Write the documents for people

Each input exists twice: once for people and once for the agents. The documents for people carry context, prose, and examples for a reader. The agents' files carry only literal rules and values, so an agent cannot fill a gap from context. Do not merge the two copies.

Write the documents for people first, where the project keeps its docs. Write both with the `technical-writing` and `unslop` skills. When they already exist, check them against this section before anything derives from them: the rule conventions, the open questions, every part that `api.md` must hold, and the design review.

`spec.md` says what the code must do, from the user's request, the design doc, or the issue. If no spec exists, ask the user for one. Its rules follow these conventions:

- Number every rule. A rule never changes its number. A later rule splits as `4a` and `4b`.
- When rules apply in order, either give each rule its full condition, including the negation of every earlier rule, or state "the rules apply in order, and the first that matches wins" as a rule of its own.
- An invariant, such as "nothing else takes part in the decision", and a prohibition, such as "a stage that only reads never calls it", are rules too.
- List the open questions at the end. Each one becomes a spec gap before the agents start.

`api.md` documents the public API as reference documentation that a person can read without the code. Draw it with the `show-me` skill where a picture helps. It holds:

- an overview: what the API is for, where it lives, and what it exports;
- every exported name with its signature, what it means, and what it returns. A union lists what each case stands for;
- examples: a call and its result for each case, error cases included. Each example names the rules of `spec.md` it shows;
- the CLI options with their `--help` text, the file formats, and the console view, only where the tests reach the API through the CLI or a file.

Behavior and error text have one home: `spec.md`. `api.md` refers to the rules and does not restate them.

Leave out every function body and every comment about how the code works inside.

Before anything derives from `api.md`, review its design with the `thermo-nuclear-code-quality-review` skill. When that review would change the API, show the change to the user. Apply it, in `api.md` and in `spec.md`, only once the user agrees.

## Write the files for the agents

Write three files into one folder in the scratchpad, `tests-first/<topic>/`. Note its absolute path: you pass it to every agent.

- `spec-agents.md`: every rule of `spec.md` with the same number, one rule per item. Each rule states its full condition and its exact result, or it is an invariant or a prohibition stated as such. Nothing in it relies on a reader's judgment.
- `api-agents.md`: every name, signature, type, case, field, value, option, exit code, and format of `api.md`, each stated once and literally. Number the examples `E1`, `E2`, and so on, as input and output pairs. It holds no file path and no sentence written to guide a person.
- `conventions.md`: the test runner, the command that runs one test file, the lint, type-check, and format-check commands that a test file must pass, with the rules that new code usually breaks, and how a test reaches the API: the import specifier of each public module, how a test starts the CLI, and the name and signature of each shared fixture a test may call. Describe them in words. Do not paste their bodies or a test of the code under test.

## Keep each pair in step

A document for people and its file for the agents must say the same thing. After you write a pair, and again after every edit to either file, give both files to a fresh agent and ask it to list every difference in a name, a signature, a value, a rule, or an error text. Fix each difference in the document for people first, then in the agents' file, and ask again until it finds none.

## Start the blind agents

Start every blind agent fresh, never as a fork: a fork inherits this conversation, including any code you have read. Pass the absolute path of the inputs folder and nothing from your own context. Name no other path of the repository. Every prompt states these rules:

- Read only the files in the inputs folder. Do not read, search, or run anything else in the repository, its tests, or its git history.
- When `spec-agents.md` does not say what happens, do not guess. Record a spec gap.
- Cite the rule number, or the example number, for every expected result.
- At the end of the report, list every file you opened.

You see an agent's report, not its tool calls, so the last rule is the only check you have. If an agent opened a file outside the folder, run it again with the rules repeated at the top of the prompt. If one row cites no rule, move that row to the spec gaps and keep the rest of the report.

## Find the edge cases

Start two agents in parallel, on two different models, such as `opus` and `sonnet`. Give each one a different starting point, because different starting points find different cases:

- Agent A works rule by rule. It builds a decision table for every set of ordered rules.
- Agent B works from the inputs, the types, and the ways a caller can misuse the API.

Each agent writes its catalog to `catalog-A.md` or `catalog-B.md` in the inputs folder, with one row per case:

| ID | Spec rule | Situation or input | Expected result | Test level |
| --- | --- | --- | --- | --- |

The test level is `unit`, `CLI`, or `not testable through the public API`. A case of the last kind is reported, never faked with a mock.

The prompt names these techniques. Every agent applies each one that fits the spec:

- Decision table: every combination of the conditions of ordered rules. Use pairwise selection when the combinations are too many.
- Rule coverage: every rule fires in at least one case, and in another case it almost fires but does not.
- Output coverage: every case of a union, every error text, and every exit code comes out of at least one case.
- Equivalence classes and boundaries for each input: empty, zero, one, the maximum, one past the maximum, an empty string against an absent value.
- States: every operation in every state the spec names.
- Invariants: every "never", "always", "only", "exactly once", and "nothing else" in the spec becomes a case or a property-based test.
- Examples: every example in `api-agents.md` is a case.

These categories apply only when the spec involves the matching thing. Otherwise the agent writes `n/a` and invents no case:

- Failures around the code, such as a network error or a full disk, when the spec names input or output.
- Concurrency, when the spec names shared state.
- Security, such as injection or a secret in the output, when the spec takes untrusted input or handles secrets.
- Precedence and defaults, when the spec names a flag, a config file, and an environment variable for one value.
- Compatibility, when the spec accepts older formats or versions.

## Agree on one catalog

Continue each agent with `SendMessage`, so it keeps the reasoning behind its own catalog. Send each one the other's catalog, and ask three questions: which cases its own catalog lacks, which of the other's cases contradict the spec, and which expected results differ. Every answer cites the rule text.

Then settle each disagreement yourself, against the rule text. A disagreement becomes a spec gap only when the rule text allows both readings. If one agent misread a clear rule, correct the row.

Merge the two catalogs into one, without duplicates. When two rows describe the same case, keep the more precise one and note both IDs. If you want one more check, give the merged catalog and the inputs folder to a fresh agent and ask only what is missing.

## Ask about the spec gaps

Before any test exists, show the user the spec gaps, together with the open questions of `spec.md`. Ask only about a gap that changes an observable result of the code under test.

Each answer becomes a rule in `spec.md` and in `spec-agents.md`, then the pair is compared again. The user may answer "unspecified": that case gets no test, and the report lists it. After the answers, give the new rules and the catalog to one agent and ask which new cases they create.

## Write the tests

Give the merged catalog and the inputs folder to a fresh blind agent. With more than about 40 cases, split the catalog between two agents. The tests follow these rules:

- Reach the code only through the names in `api-agents.md` and the fixtures in `conventions.md`. Mock nothing.
- Report each case that no test can reach through the public API, with its ID. Do not drop it, and do not fake it.
- Name each test by its situation and its expected result, in words, and cite the rule number of `spec.md`. Put the case ID in a comment.
- Write the test files into `out/` in the inputs folder. Do not run them.
- Run the lint, type-check, and format commands of `conventions.md` on the test files, and fix every error without changing what a test checks.

Then move the tests to the place that `conventions.md` names, and fix their imports. To wire them, read only the test setup, such as the runner config and the shared fixtures. Run the lint, type-check, and format check again in place: the repository's config is the one that counts.

## Run and triage

Run the tests. Your blindness ends here, and you may now read the code under test.

If the code does not exist yet, every test fails as expected. Report the failing tests as the work left to do, and stop here.

Otherwise, give each failure one of four causes:

- The code is wrong. Fix the code, or report the failure if the user asked for tests only.
- The spec is wrong. Ask the user, update the pair, compare it again, then update the case and the test.
- The test misreads its rule. Change the test only when the rule it cites says something different, never because the code does something different. When you are unsure, give the test and the rule to a fresh blind agent and ask which reading is right.
- The test or its wiring is broken, such as an import or a fixture. Fix the wiring, not the expected result.

Report the catalog, the spec gaps with the user's answers, the cases that no test can reach, the tests written, and the result of each case.
