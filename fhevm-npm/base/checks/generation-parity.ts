// Verifies that V(N-1) has not drifted from the release branch that owns it.
//
// A generation is authored on its own release branch, and it keeps living in the workspace after the
// next one arrives — as V(N-1), the stack V(N)'s upgrade suite upgrades FROM. That copy is not a fork:
// it must stay the same bytes the branch it came from holds, or the upgrade is rehearsed against a
// stack no one ships.
//
// The rule is DELIBERATELY one-directional. Files may exist on the release branch and not here — a
// rotation deletes the older generation's own upgrade lane (see its ROTATION.md), and those deletions
// are the point, not drift. What may never happen is the other direction: a file here that differs
// from the branch, or that the branch does not have at all. Both mean the retired generation was
// edited in place instead of on the branch that owns it.
//
// Nothing here names a version. The generation directories come from `npm-manifest.json#generations`,
// and the branch is derived from the generation's own number, so a rotation needs no edit.
//
// A generation whose release branch does not resolve is SKIPPED rather than failed, and the skip is
// reported. Not every generation has one: the practice began partway through, so v12 has no
// `release/0.12.x` and never will. Failing there would make this file impossible to keep identical
// across branches — the one thing fhevm-npm must be — for a branch that is not coming back.
//
// THE ESCAPE HATCH: `FHEVM_PARITY_REF_<GENERATION>` names a different ref to compare against.
//
//   FHEVM_PARITY_REF_V13=devex/alexb/v13/forge-fhevm-std-v2 ./fhevm-npm-cli check generation-parity
//
// It exists for one situation, and it is a common one: V(N-1) is brought across while the work it
// comes from is still on a topic branch, unmerged into the release branch that owns it. Until that
// merge lands the derived ref is genuinely the wrong baseline, and the check has nothing useful to
// say — the alternative is to disable it, which is worse, because then nothing is compared at all.
//
// Two rules keep it from becoming a way to silence the check. It is REPORTED on every run that uses
// it, as a note rather than a verbose success, because a green run that did not compare against the
// release branch has not proved what this check exists to prove. And an override that does not
// resolve FAILS rather than skips: the skip above is for a branch that was never created, whereas a
// ref someone typed is a ref they expect to exist.

import { execFileSync } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';

import type { NpmManifest } from '../../manifest.ts';
import type { Violation } from '../diagnostics.ts';
import { generationFamilies } from './generations.ts';

export const RULE = '3.4.6';

/** Runs git and returns stdout; throws when git exits non-zero, which is how a missing ref reports. */
export type GitRunner = (args: readonly string[], cwd: string) => string;

export type GenerationParityInspection = {
  /** Generations actually compared. A skipped one is not among them: nothing about it was verified. */
  readonly checkedKeys: readonly string[];
  readonly successes: readonly string[];
  /** Generations whose release branch does not resolve, said out loud so a skip is never silent. */
  readonly skipped: readonly string[];
  /** Generations compared against an overridden ref, said out loud for the same reason. */
  readonly overridden: readonly string[];
  readonly violations: readonly Violation[];
};

/** `FHEVM_PARITY_REF_V13=<ref>` overrides the ref generation `v13` is compared against. */
export const OVERRIDE_PREFIX = 'FHEVM_PARITY_REF_';

/**
 * The overrides an environment declares, keyed by generation name (`v13`), lowercased to match the
 * directory names `npm-manifest.json#generations` holds. An empty value is treated as unset, so
 * `FHEVM_PARITY_REF_V13= ...` in a shell prefix does not silently mean "compare with nothing".
 */
export function parityRefOverrides(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(OVERRIDE_PREFIX) || value === undefined || value.trim() === '') continue;
    overrides[key.slice(OVERRIDE_PREFIX.length).toLowerCase()] = value.trim();
  }
  return overrides;
}

function runGit(args: readonly string[], cwd: string): string {
  return execFileSync('git', [...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * `v13` -> `release/0.13.x`. The generation number IS the release minor, which is what lets this check
 * follow a rotation without an edit: when v15 lands, v14 becomes V(N-1) and answers `release/0.14.x`.
 */
export function releaseBranchOf(generationName: string): string | undefined {
  const match = /^v(\d+)$/.exec(generationName);
  return match === null ? undefined : `release/0.${match[1]}.x`;
}

/** The local branch if it exists, else the remote-tracking copy, else undefined. */
function resolveRef(git: GitRunner, repoRoot: string, branch: string): string | undefined {
  for (const ref of [branch, `origin/${branch}`]) {
    try {
      git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], repoRoot);
      return ref;
    } catch {
      // Not this one; try the remote-tracking copy, then give up.
    }
  }
  return undefined;
}

const lines = (output: string): readonly string[] => output.split('\n').filter((line) => line !== '');

export function inspectGenerationParity(
  workspaceRoot: string,
  manifest: NpmManifest,
  git: GitRunner = runGit,
  refOverrides: Readonly<Record<string, string>> = {},
): GenerationParityInspection {
  const repoRoot = git(['rev-parse', '--show-toplevel'], workspaceRoot).trim();

  const checkedKeys: string[] = [];
  const successes: string[] = [];
  const skipped: string[] = [];
  const overridden: string[] = [];
  const violations: Violation[] = [];

  for (const family of generationFamilies(manifest)) {
    // A family with a single generation has nothing older to hold still.
    if (family.previous === undefined) continue;

    const key = family.previous;
    const name = key.slice(key.lastIndexOf('/') + 1);

    const override = refOverrides[name];
    const releaseBranch = releaseBranchOf(name);
    // An explicit override answers the "which ref" question outright, so the naming rule below — which
    // exists only to DERIVE that ref — has nothing left to enforce.
    const branch = override ?? releaseBranch;
    if (branch === undefined) {
      violations.push({
        rule: RULE,
        packageKey: './npm-manifest.json',
        message:
          `generation directory '${name}' is not named 'v<number>', so the release branch that owns it ` +
          `cannot be derived; rename it or drop it from npm-manifest.json#generations`,
      });
      continue;
    }

    const ref = resolveRef(git, repoRoot, branch);
    if (ref === undefined) {
      // A ref someone typed is a ref they expect to exist; only the DERIVED one may quietly not.
      if (override !== undefined) {
        violations.push({
          rule: RULE,
          packageKey: './npm-manifest.json',
          message:
            `${OVERRIDE_PREFIX}${name.toUpperCase()} names '${override}', but neither it nor ` +
            `'origin/${override}' resolves; fetch it, or unset the variable to compare with ` +
            `'${releaseBranch ?? 'the release branch'}'`,
        });
        continue;
      }
      skipped.push(
        `${key}: skipped — neither '${branch}' nor 'origin/${branch}' resolves, so nothing about this ` +
          `generation was verified; 'git fetch origin ${branch}' if the branch exists`,
      );
      continue;
    }
    if (override !== undefined) {
      overridden.push(
        `${key}: compared with '${ref}' because ${OVERRIDE_PREFIX}${name.toUpperCase()} is set — this run ` +
          `does NOT prove parity with '${releaseBranch ?? 'the release branch'}', which is what this check ` +
          `is for; unset it once that branch carries the work`,
      );
    }
    checkedKeys.push(key);

    const pathspec = relative(repoRoot, resolve(workspaceRoot, key)).split(sep).join('/');
    const tracked = lines(git(['ls-tree', '-r', '--name-only', 'HEAD', '--', pathspec], repoRoot));
    // The generation's own package.json is the one file a rotation is REQUIRED to edit in place, so
    // byte-identity cannot apply to it: § 3.4.5 says V(N-1) must not declare `test:upgrade`, and
    // § 3.4.1 says it must not depend on the generation it upgraded from. Both lines are still present
    // on the release branch, where that generation was V(N). Exempting it leaves nothing unguarded —
    // those two checks own its content, and every nested package.json below it stays in scope.
    const exempt = `${pathspec}/package.json`;

    // One diff rather than a blob read per file. `--no-renames` so a move reports as a deletion plus an
    // addition: the deletion is the exempt direction, the addition is a path the branch never had.
    for (const line of lines(git(['diff', '--name-status', '--no-renames', ref, 'HEAD', '--', pathspec], repoRoot))) {
      const tab = line.indexOf('\t');
      const status = line.slice(0, tab);
      const path = line.slice(tab + 1);

      // Present on the release branch, absent here: the exempt direction. A rotation deletes V(N-1)'s
      // own upgrade lane, and that is what this looks like.
      if (status.startsWith('D')) continue;
      if (path === exempt) continue;

      violations.push({
        rule: RULE,
        packageKey: `./${path}`,
        message: status.startsWith('A')
          ? `present in ${name} here but absent from ${ref}; V(N-1) may only LOSE files relative to the ` +
            `branch that owns it, never gain them — add it on ${branch} instead`
          : `differs from ${ref}; V(N-1) is a copy of the branch that owns it, not a fork — ` +
            `make the change on ${branch} and bring the whole generation across`,
      });
    }

    successes.push(`${key}: ${String(tracked.length)} tracked file(s) compared with ${ref}`);
  }

  return { checkedKeys, successes, skipped, overridden, violations };
}
