// Rejects a lockfile that still carries an extraneous node.
//
// npm writes `"extraneous": true` on a package it knows about but cannot reach from the declared
// dependency graph — nothing in any package.json asks for it. It is how a retargeted dependency leaves
// its predecessor behind: the edges move, the old node is demoted rather than deleted, and the lockfile
// keeps naming a package that is no longer part of the tree.
//
// That is worth failing over, even though npm will not install it. A lockfile is the record of what a
// clean machine gets; a node nobody depends on makes it a record of something that never happens. The
// stale entry then reads like a real dependency to anyone auditing the file — the retired generation
// still appearing to be in the tree long after the switch — and it silently survives every incremental
// install, because npm only prunes it when the tree is rebuilt.
//
// Both lockfile shapes are read: `packages` (lockfileVersion 2 and 3) and the legacy nested
// `dependencies` (version 1), so the check does not quietly pass on an older file.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Violation } from '../diagnostics.ts';
import type { LoadedPackage } from '../npm.ts';
import { lockfilePath } from './package-names.ts';

export const RULE = '6.1.2';

/** Reads a lockfile, or returns undefined when there is none to read. */
export type LockfileReader = (file: string) => string | undefined;

function readIfPresent(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

type LockNode = { readonly extraneous?: unknown; readonly dependencies?: Record<string, LockNode> };

/**
 * Every node marked extraneous, by the path a reader would recognise. `packages` keys are already
 * paths; version 1 nests by name, so the ancestry is joined back into one.
 */
export function extraneousNodes(lock: unknown): readonly string[] {
  if (typeof lock !== 'object' || lock === null) return [];
  const found: string[] = [];

  const packages = (lock as { packages?: Record<string, LockNode> }).packages;
  if (typeof packages === 'object' && packages !== null) {
    for (const [key, node] of Object.entries(packages)) {
      // The root node is keyed by the empty string; it can never be extraneous, but name it sensibly.
      if (node?.extraneous === true) found.push(key === '' ? '<root>' : key);
    }
  }

  const walk = (nodes: Record<string, LockNode> | undefined, trail: readonly string[]): void => {
    for (const [name, node] of Object.entries(nodes ?? {})) {
      const path = [...trail, name];
      if (node?.extraneous === true) found.push(path.join(' > '));
      walk(node?.dependencies, path);
    }
  };
  walk((lock as { dependencies?: Record<string, LockNode> }).dependencies, []);

  return [...new Set(found)].sort();
}

export function validateLockfileExtraneous(
  packages: readonly LoadedPackage[],
  readLockfile: LockfileReader = readIfPresent,
): readonly Violation[] {
  const violations: Violation[] = [];

  // Every lockfile that exists, not only the ones a package is required to have: rule 6.1.1 owns
  // whether it belongs there at all, and a stale node is worth naming wherever it sits.
  for (const pkg of packages) {
    const content = readLockfile(join(pkg.directory, 'package-lock.json'));
    if (content === undefined) continue;

    const key = lockfilePath(pkg.key);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      violations.push({
        rule: RULE,
        packageKey: key,
        message: `is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    for (const node of extraneousNodes(parsed)) {
      violations.push({
        rule: RULE,
        packageKey: key,
        message:
          `'${node}' is marked "extraneous": true — nothing in the declared graph depends on it, so the ` +
          `lockfile records a package a clean install never gets; it is what a retargeted dependency ` +
          `leaves behind. Rebuild the tree to drop it: 'rm -rf node_modules package-lock.json && npm install'`,
      });
    }
  }

  return violations;
}
