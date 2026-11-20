---
name: reproduce-before-fix
description: One of the golden rules of the repository - never fix a serious issue or a new unexpected failure before a test reproduces it and fails. Use each time you detect a serious issue, each time a new unexpected failure occurs, and before you write any fix.
---

# Reproduce before you fix

When you detect a serious issue, or when a new unexpected failure occurs:

1. Do not fix the issue.
2. Write a test that reproduces the issue.
3. Run the test, and confirm that it fails because of the issue.
4. Fix the issue only then. The same test now passes.

A fix without a failing test first is not allowed.

The rule does not apply automatically to a minor issue. If an issue is not clearly serious, ask the user for approval before you fix it without a test.

Rule R-08, in `rules/global/rules/entries/R-08.md`, is the source of this skill. If the two differ, R-08 wins.
