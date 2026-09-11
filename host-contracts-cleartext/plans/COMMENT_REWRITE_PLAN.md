# Plan: make the comments in v12 and v13 readable

A plan, not a policy — nothing here has been applied yet. It lives at the family level because it applies
to both generations, and both must be changed in the same pass to stay identical.

## Goal

Comments today explain at length. The target is comments a newcomer can skim:

- **Prose comments** — one or two plain lines saying what the thing is.
- **JSDoc on functions** — a one-or-two-line description, a terse `@param` / `@returns` list, and a tiny
  example when the shape of the input or output is not obvious.
- No history, no essays, no re-derivation of a decision inside the code.

## Scale

|     | files | lines  | comment lines |
| --- | ----- | ------ | ------------- |
| v12 | 231   | 33,316 | 6,920         |
| v13 | 266   | 45,449 | 9,114         |

One comment line per five lines of code, ~16,000 in total across ~500 files. This is a program of work,
not a single change: a whole-tree pass would produce a diff nobody can review, and a mistake in it would
be invisible.

## The decision to make first

Many of these comments do not describe what the code does. They record **why**, usually the failure that
produced the rule. Three that proved load-bearing while this plan was being written:

- `eslint.cleartext.mjs` — "`create2-deploy` was absent from this list until it was noticed that ~2400
  lines were linted by nothing at all". That sentence is why a new directory must be added to `nodeFiles`.
- `create2-deploy/tsconfig.json` — "`include` is a GLOB on purpose. A named file list only checked files
  something imported". That sentence stops someone tidying it back.
- `v12/README.md` — `internal/listUpgradeOps.ts` is **deliberately** kept at rotation. Without it, the
  file reads like a leftover somebody forgot.

Compressing everything uniformly deletes that knowledge from the tree. So the proposed rule is to decide
per comment rather than shrink everything:

1. **Restates the code** → one line, or delete it. Example: four lines explaining "read from the installed
   `@fhevm/sdk`, not a sibling source tree" become "Use the installed copy — that is what a consumer gets."
2. **Gives a reason or names a failure mode** → keep it, tightened to one sentence. The lesson survives;
   the essay does not.
3. **Is a history** (how the upgrade e2e stopped needing a pack-and-extract step, why a tarball is the
   wrong tool here) → move to `README.md` / `BUILD.md` and leave a pointer. Prose belongs in prose files.
4. **Documents the published API** (`pkg/ts/**`) → this is where the JSDoc format pays off most, because
   consumers read it in their editor. Short description, params, and a two-line example.

**Open question for the author:** is rule 2 wanted, or should the "why" go too? "Delete the reasons, I will
take that trade" is a legitimate answer — it just has to be a decision, not a side effect.

## Order of work

One area at a time, one commit each, v12 and v13 together:

1. `internal/` — build and generator tooling; the densest comments.
2. `pkg/ts/**` — the published API. The JSDoc format matters most here.
3. `test/**` — many headers explain what a test defends against; rule 2 applies often.
4. `create2-deploy/**` — the largest single file in the package (`upgrade/testnet.ts`, ~1900 lines).
5. `*.sol` — NatSpec, which has its own conventions (`@notice` is user-facing).

## Calibrating first

Before the areas, one small file in both generations as a sample — `test/signers.test.ts` is a good
candidate: it has both shapes, a seven-line prose header and a three-line JSDoc. Review that diff, adjust
the dial, then run the areas.

## Verification after each area

Comments are not always inert — `.prettierignore` entries, eslint directives, `@ts-expect-error` and NatSpec
tags all live in them.

```sh
cd sdk/host-contracts-cleartext/<gen>
npm run lint && npm run prettier:check    # eslint + all tsc projects
forge build && forge test                 # for the .sol area
npm run test                              # the area's own suites
```

For `pkg/ts/**` also check the published surface still documents itself: `npm run check:publint` and a look
at the generated `.d.ts`, since JSDoc is what a consumer's editor shows.
