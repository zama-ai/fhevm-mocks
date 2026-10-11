import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { NpmManifest } from '../../manifest.ts';
import type { Violation } from '../diagnostics.ts';
import { type LoadedPackage, dependencyFields, declarationsByName } from '../npm.ts';
import { compareVersions, parseVersion } from '../semver.ts';
import { packageJsonKey } from './package-names.ts';

const MANIFEST_KEY = './npm-manifest.json';

/** The manifests a lockfile mirrors from the tree. Everything under node_modules is resolved output. */
type LockfileEntries = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export type LockfileReader = (file: string) => LockfileEntries | undefined;

export function validatePinnedDependencies(
  manifest: NpmManifest,
  packages: readonly LoadedPackage[],
  readLockfile: LockfileReader = defaultLockfileReader,
): readonly Violation[] {
  const pinned = Object.entries(manifest.dependencies?.pinned ?? {});
  if (pinned.length === 0) return [];

  const violations: Violation[] = [];
  const declaredSomewhere = new Set<string>();
  const resolved: ResolvedCopy[] = [];

  for (const pkg of packages) {
    const declared = declarationsByName(pkg.packageJson);
    for (const [name, pin] of pinned) {
      for (const declaration of declared.get(name) ?? []) {
        declaredSomewhere.add(name);
        if (declaration.spec === pin) continue;
        violations.push({
          rule: '3.3.4',
          packageKey: packageJsonKey(pkg),
          message: `'${name}' in '${declaration.field}' is "${declaration.spec}"; npm-manifest.json#dependencies.pinned requires "${pin}"`,
        });
      }
    }
    violations.push(...validateLockfile(pkg, pinned, readLockfile));
    resolved.push(...resolvedCopies(pkg, pinned, readLockfile));
  }

  violations.push(...validateResolvedVersions(resolved));

  for (const [name, pin] of pinned) {
    if (declaredSomewhere.has(name)) continue;
    violations.push({
      rule: '3.3.4',
      packageKey: MANIFEST_KEY,
      message: `pin '${name}': "${pin}" is unused; no inventoried package declares it, so remove it from npm-manifest.json#dependencies.pinned`,
    });
  }

  return violations;
}

// A lockfile copies each workspace manifest's dependency specs into its own `packages` map. Aligning a
// package.json without regenerating the lock leaves that copy behind, and `npm ci` refuses the mismatch —
// so an unregenerated lock is a violation of the pin, not a separate bookkeeping problem.
function validateLockfile(
  pkg: LoadedPackage,
  pinned: readonly (readonly [string, string])[],
  readLockfile: LockfileReader,
): readonly Violation[] {
  const entries = readLockfile(join(pkg.directory, 'package-lock.json'));
  if (entries === undefined) return [];

  const lockfileKey = pkg.key === '.' ? './package-lock.json' : `${pkg.key}/package-lock.json`;
  const violations: Violation[] = [];

  for (const [entryPath, entry] of Object.entries(entries)) {
    if (entryPath.split('/').includes('node_modules')) continue;
    for (const field of dependencyFields) {
      const specs = entry[field];
      if (typeof specs !== 'object' || specs === null) continue;
      for (const [name, pin] of pinned) {
        const spec = (specs as Record<string, unknown>)[name];
        if (typeof spec !== 'string' || spec === pin) continue;
        violations.push({
          rule: '3.3.4',
          packageKey: lockfileKey,
          message: `stale lockfile: '${name}' in '${field}' of '${entryPath === '' ? '.' : entryPath}' is "${spec}"; npm-manifest.json#dependencies.pinned requires "${pin}". Regenerate with 'npm install --package-lock-only'`,
        });
      }
    }
  }

  return violations;
}

// The same pin, written in every package.json, still lets each lockfile resolve its own version: a range is
// resolved when the lock is written, so a root locked after a release takes the new version and the others keep
// the old one. That is the drift the pin exists to prevent, so every copy a lockfile resolves — top-level or
// nested under another dependency, in an installation root or a consumer fixture — must be one version.
type ResolvedCopy = {
  readonly name: string;
  readonly version: string;
  readonly lockfileKey: string;
  readonly entryPath: string;
  readonly pkg: LoadedPackage;
};

function resolvedCopies(
  pkg: LoadedPackage,
  pinned: readonly (readonly [string, string])[],
  readLockfile: LockfileReader,
): readonly ResolvedCopy[] {
  const entries = readLockfile(join(pkg.directory, 'package-lock.json'));
  if (entries === undefined) return [];

  const pinnedNames = new Set(pinned.map(([name]) => name));
  const lockfileKey = pkg.key === '.' ? './package-lock.json' : `${pkg.key}/package-lock.json`;
  const copies: ResolvedCopy[] = [];

  for (const [entryPath, entry] of Object.entries(entries)) {
    // `node_modules/<name>` or `.../node_modules/<name>`: the name the tree installs it under. For an npm alias
    // that is the alias, which is also its pin key; the entry's own `name` is the aliased package.
    const at = entryPath.lastIndexOf('node_modules/');
    if (at === -1) continue;
    const name = entryPath.slice(at + 'node_modules/'.length);
    const version = entry.version;
    if (!pinnedNames.has(name) || typeof version !== 'string') continue;
    copies.push({ name, version, lockfileKey, entryPath, pkg });
  }

  return copies;
}

function validateResolvedVersions(copies: readonly ResolvedCopy[]): readonly Violation[] {
  const byName = new Map<string, ResolvedCopy[]>();
  for (const copy of copies) byName.set(copy.name, [...(byName.get(copy.name) ?? []), copy]);

  const violations: Violation[] = [];
  for (const [name, all] of byName) {
    const versions = [...new Set(all.map((copy) => copy.version))].sort(byVersion);
    if (versions.length < 2) continue;
    // No version is the authority: the newest one is named as the target because a lagging root can reach it
    // within the same range, whereas going back would mean re-locking the others.
    const newest = versions[versions.length - 1];
    const where = versions
      .map((version) => {
        const files = [...new Set(all.filter((copy) => copy.version === version).map((copy) => copy.lockfileKey))];
        return `${version} in ${files.join(', ')}`;
      })
      .join('; ');
    for (const copy of all) {
      if (copy.version === newest) continue;
      violations.push({
        rule: '3.3.4',
        packageKey: copy.lockfileKey,
        message: `'${name}' resolves to ${copy.version} at '${copy.entryPath}', but the lockfiles disagree (${where}); every lockfile must resolve one version. ${alignHint(copy)}`,
      });
    }
  }
  return violations;
}

function byVersion(left: string, right: string): number {
  const l = parseVersion(left);
  const r = parseVersion(right);
  if (l === undefined || r === undefined) return left.localeCompare(right);
  return compareVersions(l, r);
}

// npm keeps a locked version while it still satisfies the range, so a lagging copy must be dropped from the lock
// for npm to resolve it again — `npm update` would be the natural tool, but in a workspace whose members declare
// the package as a peer it fails with ERESOLVE. A consumer fixture's lock is then regenerated by fhevm-npm.
function alignHint(copy: ResolvedCopy): string {
  const drop = `delete its '${copy.entryPath}' entry from ${copy.lockfileKey}`;
  if (copy.pkg.inventory.kind === 'workspace-root') {
    const where = copy.pkg.key === '.' ? 'the repository root' : copy.pkg.key;
    return `Align it: ${drop}, then run 'npm install --package-lock-only' in ${where}.`;
  }
  return `Align it: ${drop}, then run './fhevm-npm-cli test-consumer-regenerate-package-lock ${copy.pkg.key}'.`;
}

function defaultLockfileReader(file: string): LockfileEntries | undefined {
  if (!existsSync(file)) return undefined;
  const packages: unknown = JSON.parse(readFileSync(file, 'utf8')).packages;
  return typeof packages === 'object' && packages !== null ? (packages as LockfileEntries) : undefined;
}
