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
  readonly violations: readonly Violation[];
};

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
): GenerationParityInspection {
  const repoRoot = git(['rev-parse', '--show-toplevel'], workspaceRoot).trim();

  const checkedKeys: string[] = [];
  const successes: string[] = [];
  const skipped: string[] = [];
  const violations: Violation[] = [];

  for (const family of generationFamilies(manifest)) {
    // A family with a single generation has nothing older to hold still.
    if (family.previous === undefined) continue;

    const key = family.previous;
    const name = key.slice(key.lastIndexOf('/') + 1);

    const branch = releaseBranchOf(name);
    if (branch === undefined) {
      violations.push({
        rule: RULE,
        packageKey: key,
        message:
          `generation directory '${name}' is not named 'v<number>', so the release branch that owns it ` +
          `cannot be derived; rename it or drop it from npm-manifest.json#generations`,
      });
      continue;
    }

    const ref = resolveRef(git, repoRoot, branch);
    if (ref === undefined) {
      skipped.push(
        `${key}: skipped — neither '${branch}' nor 'origin/${branch}' resolves, so nothing about this ` +
          `generation was verified; 'git fetch origin ${branch}' if the branch exists`,
      );
      continue;
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

  return { checkedKeys, successes, skipped, violations };
}
