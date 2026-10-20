// Verifies that `forge-fhevm-std`'s published package has not drifted between generations.
//
// THE PACKAGE IS ONE PACKAGE. It is authored once and shipped from every generation's branch, so what
// a test written against it does on the 0.13 line it must do on the 0.14 line. Its public surface is
// therefore not allowed to differ between those branches at all — a cheat that exists on one and not
// the other, or takes different arguments, is two SDKs wearing one name.
//
// Nothing enforced that until this check. The drift it is built to catch has already happened twice:
// a fork suite rewritten on one branch and not the other, and a cheat whose signature was about to
// change on one side only.
//
// SYMMETRIC, unlike `generation-parity`. There the rule is one-directional, because V(N-1) is a copy
// that may lose files to a rotation. Here neither side owns the package: a file on one branch and not
// the other is drift whichever way round it is, and both directions are reported.
//
// THE REF IS NOT DERIVABLE, which is why it comes from the environment. `npm-manifest.json#generations`
// names directories, not the branch that carries another generation's copy of this package, and a
// branch cannot know what the next generation called its own. So:
//
//   FHEVM_FORGE_STD_PARITY_REF=devex/alexb/forge-fhevm-v14 ./fhevm-npm-cli check forge-fhevm-std-parity
//
// Unset, the check SKIPS and says so: nothing was compared, and a silent pass would be worse than no
// check. Set but unresolvable, it FAILS — a ref someone typed is a ref they expect to exist. That is
// the same pair of rules `generation-parity`'s own override follows.

import { execFileSync } from 'node:child_process';

import type { Violation } from '../diagnostics.ts';

export const RULE = '3.4.7';

/** Runs git and returns stdout; throws when git exits non-zero, which is how a missing ref reports. */
export type GitRunner = (args: readonly string[], cwd: string) => string;

/** The package's published tree. Everything under it is in scope unless `EXEMPT` says otherwise. */
export const PACKAGE_PATHSPEC = 'foundry/forge-fhevm-std/pkg';

/** `FHEVM_FORGE_STD_PARITY_REF=<ref>` names the branch to compare against. */
export const REF_VAR = 'FHEVM_FORGE_STD_PARITY_REF';

/**
 * The files that MUST differ, each for a reason that is a rule rather than a convenience.
 *
 * Kept here, spelled out, and deliberately short. An exemption is a hole in the only thing holding the
 * two SDKs together, so each one states why it cannot be closed — and anything not on this list is
 * drift, including a file that looks harmless.
 */
export const EXEMPT: ReadonlyArray<{ readonly path: string; readonly because: string }> = [
  {
    path: `${PACKAGE_PATHSPEC}/package.json`,
    because: 'carries the package VERSION, which is the generation it ships from',
  },
  {
    path: `${PACKAGE_PATHSPEC}/src/StdFhevmVersion.sol`,
    because: 'generated from that version, so it moves with it',
  },
];

/**
 * The vendored payload, generated per generation from the cleartext package beside it. It is the one
 * part of `pkg` that is SUPPOSED to differ: it is this generation's contracts.
 */
export const EXEMPT_PREFIX = `${PACKAGE_PATHSPEC}/src/_host/`;

export type ForgeStdParityInspection = {
  readonly checkedKeys: readonly string[];
  readonly successes: readonly string[];
  /** Said out loud, so an unset ref is never mistaken for a comparison that passed. */
  readonly skipped: readonly string[];
  readonly violations: readonly Violation[];
};

function runGit(args: readonly string[], cwd: string): string {
  return execFileSync('git', [...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** The local branch if it exists, else the remote-tracking copy, else undefined. */
function resolveRef(git: GitRunner, repoRoot: string, ref: string): string | undefined {
  for (const candidate of [ref, `origin/${ref}`]) {
    try {
      git(['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], repoRoot);
      return candidate;
    } catch {
      // Not this one; try the remote-tracking copy, then give up.
    }
  }
  return undefined;
}

const lines = (output: string): readonly string[] => output.split('\n').filter((line) => line !== '');

function isExempt(path: string): string | undefined {
  if (path.startsWith(EXEMPT_PREFIX)) return 'the vendored payload, generated from this generation';
  return EXEMPT.find((entry) => entry.path === path)?.because;
}

export function inspectForgeStdParity(
  workspaceRoot: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
  git: GitRunner = runGit,
): ForgeStdParityInspection {
  const repoRoot = git(['rev-parse', '--show-toplevel'], workspaceRoot).trim();

  const requested = env[REF_VAR]?.trim();
  if (requested === undefined || requested === '') {
    return {
      checkedKeys: [],
      successes: [],
      skipped: [
        `${PACKAGE_PATHSPEC}: skipped — ${REF_VAR} names no ref, so nothing was compared and this run ` +
          `proves nothing about the two generations agreeing; set it to the branch carrying the other ` +
          `generation's copy of this package`,
      ],
      violations: [],
    };
  }

  const ref = resolveRef(git, repoRoot, requested);
  if (ref === undefined) {
    return {
      checkedKeys: [],
      successes: [],
      skipped: [],
      violations: [
        {
          rule: RULE,
          packageKey: './npm-manifest.json',
          message:
            `${REF_VAR} names '${requested}', which resolves neither locally nor as 'origin/${requested}'; ` +
            `a ref given by hand is one the run expects to exist — 'git fetch origin ${requested}', or ` +
            `correct the name`,
        },
      ],
    };
  }

  const violations: Violation[] = [];
  let exempted = 0;

  for (const line of lines(
    git(['diff', '--name-status', '--no-renames', ref, 'HEAD', '--', PACKAGE_PATHSPEC], repoRoot),
  )) {
    const tab = line.indexOf('\t');
    const status = line.slice(0, tab);
    const path = line.slice(tab + 1);

    const because = isExempt(path);
    if (because !== undefined) {
      exempted++;
      continue;
    }

    const how = status.startsWith('A')
      ? `is here but not on ${ref}`
      : status.startsWith('D')
        ? `is on ${ref} but not here`
        : `differs from ${ref}`;

    violations.push({
      rule: RULE,
      packageKey: `./${path}`,
      message:
        `${how}; forge-fhevm-std is ONE package shipped from every generation, so its published tree ` +
        `must read the same on both — make the change on both branches, or add it to EXEMPT with the ` +
        `reason it cannot be closed`,
    });
  }

  const tracked = lines(git(['ls-tree', '-r', '--name-only', 'HEAD', '--', PACKAGE_PATHSPEC], repoRoot));
  return {
    checkedKeys: [`./${PACKAGE_PATHSPEC}`],
    successes: [
      `./${PACKAGE_PATHSPEC}: ${String(tracked.length)} tracked file(s) compared with ${ref}, ` +
        `${String(exempted)} exempt`,
    ],
    skipped: [],
    violations,
  };
}
