---
id: NR-73a
tag: VIOLATED
group: Inventory
title: Do not assume the repository root
short: The workspace root is not assumed to be the repository root.
old: '7.1.5'
check: missing
evidence:
  - '`fhevm-npm/base/checks/inventory.ts:128-130` shows a vendored `source` resolved from the git root, and no test runs the checks with the workspace below the git root. Fix: issue I-55.'
issues:
  - I-01
  - I-21
  - I-55
---

The workspace may sit anywhere
inside its git repository, as in a monorepo. Every path the manifest or a rule names is relative to the workspace
root. The repository root serves git alone: reading commits and objects, and translating a workspace path into the
path a git command expects. A test runs the checks with the workspace one directory below the repository root.

```text
✅ <repo>/fhevm-mocks/common-vendored/src    "./common-vendored/src" from the workspace root
❌ <repo>/common-vendored/src                 the same path from the repository root
```
