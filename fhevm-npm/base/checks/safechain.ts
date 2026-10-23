// `check safechain`: would safe-chain let `npm ci` install every committed lockfile right now? It refuses a version
// younger than its minimum package age (48 hours by default) and any version Aikido lists as malware. The answer
// depends on the clock and on Aikido's list, so this check is run by hand before pushing, never from `make check`.

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Violation } from '../diagnostics.ts';
import { type Packument, ageInHours } from '../registry-age.ts';

const NPMJS_TARBALL = 'https://registry.npmjs.org/';
export const AIKIDO_MALWARE_LIST = 'https://malware-list.aikido.dev/malware_predictions.json';

/** One registry package a lockfile installs, under its real name (an alias resolves to the aliased package). */
export type LockedPackage = { readonly name: string; readonly version: string; readonly lockfileKey: string };

/** Every lockfile `npm ci` replays: the installation roots, then any package that carries its own. */
export function committedLockfiles(workspaceRoot: string, directories: readonly string[]): readonly string[] {
  const files = directories.map((directory) => join(directory, 'package-lock.json')).filter((file) => existsSync(file));
  return [...new Set(files)].sort((left, right) =>
    relative(workspaceRoot, left).localeCompare(relative(workspaceRoot, right)),
  );
}

/**
 * The registry packages a lockfile installs. Links, `file:` and git entries are not downloaded from the registry,
 * so safe-chain never sees them; everything resolved from registry.npmjs.org is.
 */
export function lockedPackages(
  lockfileKey: string,
  entries: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): readonly LockedPackage[] {
  return Object.entries(entries).flatMap(([path, entry]): LockedPackage[] => {
    const at = path.lastIndexOf('node_modules/');
    const { version, resolved, name } = entry;
    if (at === -1 || entry.link === true || typeof version !== 'string') return [];
    if (typeof resolved !== 'string' || !resolved.startsWith(NPMJS_TARBALL)) return [];
    return [{ name: typeof name === 'string' ? name : path.slice(at + 'node_modules/'.length), version, lockfileKey }];
  });
}

/** `name@version` for every listed malicious version; Aikido's feed is a JSON array of `{ package_name, version }`. */
export function parseMalwareList(body: unknown): ReadonlySet<string> {
  if (!Array.isArray(body)) throw new Error('Aikido malware list: expected a JSON array');
  return new Set(
    body.flatMap((item: unknown) => {
      const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
      return typeof record.package_name === 'string' && typeof record.version === 'string'
        ? [`${record.package_name}@${record.version}`]
        : [];
    }),
  );
}

export function validateSafechain(
  locked: readonly LockedPackage[],
  packuments: ReadonlyMap<string, Packument | undefined>,
  malware: ReadonlySet<string> | undefined,
  minAgeHours: number,
  now: Date = new Date(),
): readonly Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const pkg of locked) {
    const id = `${pkg.lockfileKey} ${pkg.name}@${pkg.version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (malware?.has(`${pkg.name}@${pkg.version}`) === true) {
      violations.push({
        rule: 'safe-chain',
        packageKey: pkg.lockfileKey,
        message: `${pkg.name}@${pkg.version} is on Aikido's malware list: safe-chain blocks it. Move off this version now`,
      });
    }
    const publishedAt = packuments.get(pkg.name)?.time[pkg.version];
    if (publishedAt === undefined) {
      violations.push({
        rule: 'safe-chain',
        packageKey: pkg.lockfileKey,
        message: `${pkg.name}@${pkg.version}: registry.npmjs.org records no publish time, so its age cannot be checked`,
      });
      continue;
    }
    const age = ageInHours(publishedAt, now);
    if (age >= minAgeHours) continue;
    const allowedAt = new Date(Date.parse(publishedAt) + minAgeHours * 3_600_000).toISOString();
    violations.push({
      rule: 'safe-chain',
      packageKey: pkg.lockfileKey,
      message: `${pkg.name}@${pkg.version} was published ${age.toFixed(1)}h ago (${publishedAt}), under the ${String(minAgeHours)}h minimum age: safe-chain blocks it until ${allowedAt}`,
    });
  }
  return violations;
}
