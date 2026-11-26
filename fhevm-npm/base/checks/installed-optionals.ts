// Rejects an install that silently dropped an optional package this machine needs.
//
// npm treats every optional dependency as "nice to have": when its download aborts, or its install script
// fails, npm leaves it out, prints nothing of its own, and still exits 0. That is how platform bindings
// ship — rolldown, esbuild and EDR each list one optional package per os/cpu/libc, and npm keeps the one
// that fits — so a dropped binding passes the install and breaks the first tool that loads it, much
// later and far from the cause. A CI run lost `@rolldown/binding-linux-x64-gnu` to an aborted registry
// download: `npm ci` passed, and every vitest suite failed at startup with "Cannot find native binding".
//
// The lockfile already says what a complete install holds. Each node marked `optional` (or
// `devOptional`, since CI installs dev dependencies too) whose `os`, `cpu` and `libc` fit this machine
// must be on disk. A node that does not fit is skipped, as npm skips it. A node nested under a parent
// that is not installed is skipped too: its parent is reported, or did not apply here.
//
// An installation root with no `node_modules` has not been installed, so there is nothing to check; it
// is skipped rather than failed, which keeps the check usable on a tree that is only partly installed.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Violation } from '../diagnostics.ts';
import type { LoadedPackage } from '../npm.ts';
import { lockfilePath } from './package-names.ts';

export const RULE = 'NR-93';

/** The machine an install is checked against: `process.platform`, `process.arch`, and on Linux its libc. */
export type Platform = { readonly os: string; readonly cpu: string; readonly libc?: 'glibc' | 'musl' };

export type InstallReader = {
  /** The text of a file, or undefined when there is none. */
  readonly read: (file: string) => string | undefined;
  /** Whether a path exists. */
  readonly exists: (path: string) => boolean;
};

const DISK: InstallReader = {
  read: (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined),
  exists: existsSync,
};

export function currentPlatform(): Platform {
  if (process.platform !== 'linux') return { os: process.platform, cpu: process.arch };
  // The same test npm uses: a glibc runtime reports its version, musl reports none.
  const header = (process.report.getReport() as { header?: { glibcVersionRuntime?: string } }).header;
  return { os: process.platform, cpu: process.arch, libc: header?.glibcVersionRuntime ? 'glibc' : 'musl' };
}

/**
 * npm's rule for an `os`, `cpu` or `libc` list: no list fits everything; a `!value` entry excludes that
 * value; when the list has positive entries, the value must be one of them.
 */
export function fits(list: unknown, value: string | undefined): boolean {
  if (!Array.isArray(list) || list.length === 0) return true;
  if (value === undefined) return true;
  const entries = list.filter((entry): entry is string => typeof entry === 'string');
  if (entries.includes(`!${value}`)) return false;
  const positive = entries.filter((entry) => !entry.startsWith('!'));
  return positive.length === 0 || positive.includes(value);
}

type LockNode = {
  readonly optional?: unknown;
  readonly devOptional?: unknown;
  readonly link?: unknown;
  readonly inBundle?: unknown;
  readonly os?: unknown;
  readonly cpu?: unknown;
  readonly libc?: unknown;
};

/**
 * The `packages` keys of every optional node that this platform should have on disk but does not.
 * `isInstalled` answers for a key, relative to the installation root.
 */
export function missingOptionals(
  packages: Readonly<Record<string, LockNode>>,
  platform: Platform,
  isInstalled: (key: string) => boolean,
): readonly string[] {
  const missing: string[] = [];
  for (const [key, node] of Object.entries(packages)) {
    if (!key.includes('node_modules/')) continue; // the root, and workspace members, which are links
    if (node.link === true || node.inBundle === true) continue;
    if (node.optional !== true && node.devOptional !== true) continue;
    if (!fits(node.os, platform.os) || !fits(node.cpu, platform.cpu)) continue;
    if (platform.libc !== undefined && !fits(node.libc, platform.libc)) continue;
    const nested = key.lastIndexOf('/node_modules/');
    if (nested > 0 && !isInstalled(key.slice(0, nested))) continue;
    if (!isInstalled(join(key, 'package.json'))) missing.push(key);
  }
  return missing.sort();
}

function describe(platform: Platform): string {
  return [platform.os, platform.cpu, platform.libc].filter((part) => part !== undefined).join('/');
}

export function validateInstalledOptionals(
  packages: readonly LoadedPackage[],
  platform: Platform = currentPlatform(),
  reader: InstallReader = DISK,
): readonly Violation[] {
  const violations: Violation[] = [];

  for (const pkg of packages) {
    const content = reader.read(join(pkg.directory, 'package-lock.json'));
    if (content === undefined) continue;
    if (!reader.exists(join(pkg.directory, 'node_modules'))) continue; // not installed: nothing to check

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

    const lockPackages = (parsed as { packages?: unknown } | null)?.packages;
    if (typeof lockPackages !== 'object' || lockPackages === null) {
      // lockfileVersion 1 has no `packages`, and no os/cpu per node: the check would pass vacuously.
      violations.push({
        rule: RULE,
        packageKey: key,
        message: 'has no "packages" section (lockfileVersion 1?), so its optional packages cannot be checked',
      });
      continue;
    }

    for (const node of missingOptionals(lockPackages as Record<string, LockNode>, platform, (path) =>
      reader.exists(join(pkg.directory, path)),
    )) {
      violations.push({
        rule: RULE,
        packageKey: key,
        message:
          `'${node}' is optional and fits ${describe(platform)}, but it is not installed. npm leaves out an ` +
          `optional package whose download or install script failed, and still exits 0, so the install ` +
          `looked fine. Install again from the lockfile: 'npm ci' in ${pkg.key}`,
      });
    }
  }

  return violations;
}
