---
name: review-handoff
description: Hand a code review to another agent through files. Step 1 writes a self-contained review prompt in markdown under tmp/reviews/, which names the reviewer and tells it where to save its report. Step 2 takes the path of that report and incorporates the review. Use when the user asks for a review handoff, a review prompt for another agent, an external or independent review, or gives the path of a report under tmp/reviews/.
disable-model-invocation: true
---

# Review handoff

The review is done by another agent, in another session. The two sessions share nothing but files:

1. This session writes a prompt file.
2. The user gives the prompt file to the other agent.
3. The other agent saves its report in a file.
4. The user gives the path of the report to this session, which incorporates it.

Pick the step from what the user gave you:

- A thing to review: run step 1.
- The path of a report: run step 2.

## Step 1 - write the prompt

### 1. Fix the scope

Turn the request into a scope the reviewer can find without you. Record:

- the absolute path of the repository,
- the branch and the HEAD commit (`git rev-parse HEAD`),
- for a diff: the base commit, and the exact command that shows the diff,
- for uncommitted work: say so, and list the files (`git status --short`),
- for files or folders: the paths.

If the request does not say what to review, and the conversation does not make it obvious, ask the user. Do not guess a scope.

### 2. Name the reviewer

Use the name the user gave. Otherwise use `reviewer-1`, or the next free number if the review folder already has a prompt for that name. The name is lowercase, with hyphens, because it is part of the file names.

If the user asks for several reviewers, write one prompt file for each name. The prompts differ only by the name and the report path.

### 3. Create the files

All paths are under `tmp/reviews/` at the root of the repository. Git ignores `tmp/`.

```
tmp/reviews/<YYYYMMDD-HHMM>-<slug>/
  prompt-<reviewer-name>.md     written by this session
  report-<reviewer-name>.md     written by the reviewer
```

`<slug>` is 2 to 4 words that describe the scope, for example `forge-std-chains-check`. Take the time from `date +%Y%m%d-%H%M`.

### 4. Write the prompt

The reviewer starts with no context. The prompt is everything it knows. Write it for a reader who has never seen this repository or this conversation.

Give the reviewer the facts and the intent. Do not give it your opinion of the code, the parts you think are fine, or the bugs you suspect: a reviewer that receives a conclusion tends to confirm it. If the user wants a specific risk examined, state it as a question.

Use this template. Replace every `<...>`, and write absolute paths.

```markdown
# Code review: <short title>

## Who you are

Your name is **<reviewer-name>**. You are an independent code reviewer.
Use this name in the title of your report and in the ID of each finding.
You did not write this code, and you have no earlier context about it. This file is all you have been told.

## What to review

- Repository: <absolute path>
- Branch: <branch>, at commit <sha>
- Scope: <diff range, uncommitted work, or paths>
- How to see it: `<exact command>`

Files in scope:

- <path>
- <path>

## What the change is meant to do

<The intent, in 3 to 10 lines: the problem, the expected behaviour, the constraints. No judgement of the implementation.>

## Read first

- <CLAUDE.md, rules, or design files that the code must respect, with paths>

## What to look for

In this order:

1. Correctness: wrong results, crashes, unhandled cases, broken callers.
2. Behaviour that does not match the intent above.
3. Violations of the rules listed under "Read first".
4. Tests: missing cases, tests that cannot fail, tests that check the wrong thing.
5. Design and readability, only where it costs something concrete.

<Optional: specific questions from the user.>

## Rules for this review

- Do not modify any file, except your report. Do not commit, stash, or reset.
- You may run read-only commands, the tests, and the builds.
- Read the code around each change, and the callers. Do not review the diff alone.
- Check each finding before you report it. Mark it `verified` if you ran or traced something that proves it, and `suspected` otherwise.
- Do not report style that a formatter or a linter owns.
- If something in this file is unclear or wrong, say so in the report and continue.

## Your report

Save your report in this file, and nowhere else:

`<absolute path of report-<reviewer-name>.md>`

Use this structure:

    # Review report - <reviewer-name>

    - Scope: <what you reviewed, with the commit>
    - Verdict: <ready | ready after fixes | not ready>

    ## Findings

    ### <reviewer-name>-01 - <one-line title>

    - Severity: <blocker | major | minor | nit>
    - Status: <verified | suspected>
    - Where: <path>:<line>
    - Problem: <what is wrong>
    - Failure scenario: <concrete input or state, and the wrong result>
    - Evidence: <command and output, or the trace you followed>
    - Suggested fix: <short>

    ## Checked and found correct

    <What you examined that has no finding. One line each.>

    ## Not covered

    <What you did not review, and why.>

Order the findings from the most severe to the least. If you find nothing, write "No findings", and still fill in the last two sections.

When the report is saved, end your last message with its absolute path on a line of its own.
```

### 5. Tell the user

Give the user three things, and nothing else of length:

- the absolute path of the prompt file,
- the absolute path where the report will be,
- the line to paste to the other agent: `Read <absolute path of the prompt> and follow it.`

Then stop. Do not review the code yourself, and do not spawn a subagent to do it.

## Step 2 - incorporate the report

The user gives the path of a report.

1. Read the whole report. Read the prompt next to it, to recover the scope and the commit.
2. Check that the code has not moved since the review: compare the commit in the report with the current one. If it moved, say so, and judge each finding against the current code.
3. Verify every finding yourself, against the code. The report is the opinion of another agent, not a fact. A finding is one of:
   - **confirmed**: you reproduced or traced the problem,
   - **rejected**: the problem does not exist, with the reason,
   - **needs a decision**: the finding is real but the fix is a design choice of the user.
4. Show the user a table: finding ID, severity, verdict, one line of reason. Keep the IDs of the reviewer.
5. Fix the confirmed findings, the most severe first. The rules of the repository apply to each fix; for a serious issue, `reproduce-before-fix` applies. Do not fix a finding that needs a decision before the user decides.
6. Report what is fixed, what is rejected, and what waits for the user.

Do not edit the report of the reviewer. If the user gives several reports, merge the findings that describe the same problem and keep all their IDs.
