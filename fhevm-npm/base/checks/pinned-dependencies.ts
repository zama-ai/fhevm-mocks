import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { NpmManifest } from '../../manifest.ts';
import type { Violation } from '../diagnostics.ts';
import { type DependencyField, type LoadedPackage, dependencyFields, declarationsByName } from '../npm.ts';
import { compareVersions, parseVersion } from '../semver.ts';
import {
  type TarballVersionReader,
  expectedPinnedSpec,
  isTarballPin,
  isTarballSpec,
  readTarballVersion,
  tarballPinPath,
} from '../tarball-pins.ts';
import { packageJsonKey } from './package-names.ts';

const MANIFEST_KEY = './npm-manifest.json';

/** The manifests a lockfile mirrors from the tree. Everything under node_modules is resolved output. */
type LockfileEntries = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export type LockfileReader = (file: string) => LockfileEntries | undefined;

export function validatePinnedDependencies(
  manifest: NpmManifest,
  packages: readonly LoadedPackage[],
  readLockfile: LockfileReader = defaultLockfileReader,
  readVersion: TarballVersionReader = readTarballVersion,
): readonly Violation[] {
  const allPins = Object.entries(manifest.dependencies?.pinned ?? {});
  if (allPins.length === 0) return [];
  // Only a tarball pin is relative to anything, so only then is the root looked up.
  const workspaceRoot = allPins.some(([, pin]) => isTarballPin(pin)) ? workspaceRootOf(packages) : '';
  const violations: Violation[] = [];

  // A tarball pin whose tarball is missing cannot say what its declarations must be: reported once, then skipped.
  const pinned = allPins.filter(([name, pin]) => {
    if (!isTarballPin(pin)) return true;
    const tarball = tarballPinPath(workspaceRoot, pin);
    if (existsSync(tarball)) return true;
    violations.push({
      rule: '3.3.4',
      packageKey: MANIFEST_KEY,
      message: `pin '${name}': "${pin}" names ${tarball}, which does not exist; fix the path in npm-manifest.json#dependencies.pinned`,
    });
    return false;
  });
  const context: PinContext = { workspaceRoot, readVersion };

  const declaredSomewhere = new Set<string>();
  const resolved: ResolvedCopy[] = [];
  const pinnedNames = new Set(allPins.map(([name]) => name));

  for (const pkg of packages) {
    const declared = declarationsByName(pkg.packageJson);
    for (const [name, pin] of pinned) {
      for (const declaration of declared.get(name) ?? []) {
        declaredSomewhere.add(name);
        const expected = expectedSpec(context, pin, pkg.directory, declaration.field);
        if (declaration.spec === expected) continue;
        violations.push({
          rule: '3.3.4',
          packageKey: packageJsonKey(pkg),
          message: `'${name}' in '${declaration.field}' is "${declaration.spec}"; npm-manifest.json#dependencies.pinned requires "${expected}"${expected === pin ? '' : ` (from the pin "${pin}")`}`,
        });
      }
    }
    // A tarball comes only from a tarball pin: one the manifest names, in one place, and the checks above follow.
    for (const [name, declarations] of declared) {
      if (pinnedNames.has(name)) continue;
      for (const declaration of declarations) {
        if (!isTarballSpec(declaration.spec)) continue;
        violations.push({
          rule: '3.3.4',
          packageKey: packageJsonKey(pkg),
          message: `'${name}' in '${declaration.field}' is the tarball "${declaration.spec}", but no npm-manifest.json#dependencies.pinned entry names it; pin it there as "file:<path>.tgz"`,
        });
      }
    }
    violations.push(...validateLockfile(pkg, pinned, readLockfile, context));
    resolved.push(...resolvedCopies(pkg, pinned, readLockfile));
  }

  violations.push(...validateResolvedVersions(resolved, pinned, context));

  for (const [name, pin] of pinned) {
    if (declaredSomewhere.has(name)) continue;
    if (isTarballPin(pin) && !existsSync(tarballPinPath(workspaceRoot, pin))) continue;
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
type PinContext = { readonly workspaceRoot: string; readonly readVersion: TarballVersionReader };

/** The workspace root package's directory: what a relative tarball pin is relative to. */
export function workspaceRootOf(packages: readonly LoadedPackage[]): string {
  const root = packages.find((pkg) => pkg.key === '.');
  if (root === undefined) throw new Error('The loaded inventory has no workspace root package');
  return root.directory;
}

function expectedSpec(context: PinContext, pin: string, directory: string, field: DependencyField): string {
  return expectedPinnedSpec({ ...context, pin, directory, field });
}

function validateLockfile(
  pkg: LoadedPackage,
  pinned: readonly (readonly [string, string])[],
  readLockfile: LockfileReader,
  context: PinContext,
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
        // The entry copies the manifest of the package at `entryPath`, relative to this lock: a tarball spec in it is
        // relative to that package, so that is where the expected one is computed from.
        const expected = expectedSpec(context, pin, resolve(pkg.directory, entryPath), field);
        if (typeof spec !== 'string' || spec === expected) continue;
        violations.push({
          rule: '3.3.4',
          packageKey: lockfileKey,
          message: `stale lockfile: '${name}' in '${field}' of '${entryPath === '' ? '.' : entryPath}' is "${spec}"; npm-manifest.json#dependencies.pinned requires "${expected}". Regenerate with 'npm install --package-lock-only'`,
        });
      }
    }
  }

  return violations;
}

// The pin names the version the workspace develops and releases against: `^1.2.2` says 1.2.2. A range is
// resolved when a lockfile is written, so a root locked after a newer release silently takes that release instead —
// the pin then lies about what is installed, and roots locked at different times resolve different copies. Every
// copy a lockfile resolves for a pinned name — top-level or nested, in an installation root or a consumer fixture,
// an npm alias under its alias name — must therefore be exactly the pinned version. A newer one means the pin is
// behind: move it up, so the release carries the most recent package.
export type ResolvedCopy = {
  readonly name: string;
  readonly version: string;
  /** The lock's `resolved`: for a tarball pin, the `file:` path it was installed from, relative to the lock. */
  readonly resolved?: string;
  readonly lockfileKey: string;
  readonly entryPath: string;
  readonly pkg: LoadedPackage;
};

export function resolvedCopies(
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
    const resolved = typeof entry.resolved === 'string' ? entry.resolved : undefined;
    copies.push({ name, version, ...(resolved === undefined ? {} : { resolved }), lockfileKey, entryPath, pkg });
  }

  return copies;
}

function validateResolvedVersions(
  copies: readonly ResolvedCopy[],
  pinned: readonly (readonly [string, string])[],
  context: PinContext,
): readonly Violation[] {
  const pins = new Map(pinned);
  const violations: Violation[] = [];
  for (const copy of copies) {
    const pin = pins.get(copy.name);
    if (pin === undefined) continue;
    if (isTarballPin(pin)) {
      violations.push(...validateTarballCopy(copy, pin, context));
      continue;
    }
    const pinnedVersion = versionOfPin(pin);
    if (copy.version === pinnedVersion) continue;
    violations.push({
      rule: '3.3.4',
      packageKey: copy.lockfileKey,
      message: isNewer(copy.version, pinnedVersion)
        ? `'${copy.name}' resolves to ${copy.version} at '${copy.entryPath}', newer than its pin "${pin}": the pin is behind what is installed. Move it to "${pin.replace(pinnedVersion, copy.version)}" in npm-manifest.json#dependencies.pinned, then run 'make sync-pinned'`
        : `'${copy.name}' resolves to ${copy.version} at '${copy.entryPath}', not the pinned ${pinnedVersion} ("${pin}"). ${relockHint(copy)}`,
    });
  }
  return violations;
}

/**
 * A copy of a tarball-pinned package must have been installed from that tarball: its `resolved` names the pinned
 * path (relative to the lock) and its version is the one inside it. Anything else is a lock written before the pin
 * moved, or one npm resolved from the registry instead; either way, reinstall.
 */
function validateTarballCopy(copy: ResolvedCopy, pin: string, context: PinContext): readonly Violation[] {
  const tarball = tarballPinPath(context.workspaceRoot, pin);
  const reinstall = `Reinstall it: 'make install' (a consumer fixture: './fhevm-npm-cli test-consumer-regenerate-package-lock ${copy.pkg.key}')`;
  const from =
    copy.resolved?.startsWith('file:') === true ? resolve(copy.pkg.directory, copy.resolved.slice(5)) : undefined;
  if (from !== tarball) {
    return [
      {
        rule: '3.3.4',
        packageKey: copy.lockfileKey,
        message: `'${copy.name}' at '${copy.entryPath}' is resolved from "${String(copy.resolved)}", not from the pinned tarball ${tarball} ("${pin}"). ${reinstall}.`,
      },
    ];
  }
  const version = context.readVersion(tarball);
  if (copy.version === version) return [];
  return [
    {
      rule: '3.3.4',
      packageKey: copy.lockfileKey,
      message: `'${copy.name}' at '${copy.entryPath}' is locked at ${copy.version}, but the pinned tarball ${tarball} is ${version}. ${reinstall}.`,
    },
  ];
}

/** `^1.2.2`, `~1.2.2`, `1.2.2` and `npm:@scope/pkg@^1.2.2` all pin 1.2.2. */
export function versionOfPin(pin: string): string {
  const range = pin.startsWith('npm:') ? pin.slice(pin.lastIndexOf('@') + 1) : pin;
  return range.replace(/^[~^]/, '');
}

export function isNewer(candidate: string, reference: string): boolean {
  const c = parseVersion(candidate);
  const r = parseVersion(reference);
  return c !== undefined && r !== undefined && compareVersions(c, r) > 0;
}

// npm keeps a locked version while it still satisfies the range, so a copy that must move is dropped from the lock
// for npm to resolve it again — `npm update` would be the natural tool, but in a workspace whose members declare
// the package as a peer it fails with ERESOLVE. A consumer fixture's lock is then regenerated by fhevm-npm.
function relockHint(copy: ResolvedCopy): string {
  const drop = `delete its '${copy.entryPath}' entry from ${copy.lockfileKey}`;
  if (copy.pkg.inventory.kind === 'workspace-root') {
    const where = copy.pkg.key === '.' ? 'the repository root' : copy.pkg.key;
    return `Re-lock it: ${drop}, then run 'npm install --package-lock-only' in ${where}.`;
  }
  return `Re-lock it: ${drop}, then run './fhevm-npm-cli test-consumer-regenerate-package-lock ${copy.pkg.key}'.`;
}

export function defaultLockfileReader(file: string): LockfileEntries | undefined {
  if (!existsSync(file)) return undefined;
  const packages: unknown = JSON.parse(readFileSync(file, 'utf8')).packages;
  return typeof packages === 'object' && packages !== null ? (packages as LockfileEntries) : undefined;
}
