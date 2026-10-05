// `version check`: is every derived version equal to the central one? The central file is validated first
// (versions.ts); only a valid graph is compared against the tree. Derived state is the payload's own
// package.json version, in every installation root whose lockfile records the member, the `version`
// npm wrote for it, and every committed generated file that embeds it (GENERATED_VERSION_FILES).
// Nothing here reads a version back into the authority.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { NpmManifest } from '../manifest.ts';
import { lockfilePath, packageJsonPath } from './checks/package-names.ts';
import type { Violation } from './diagnostics.ts';
import { type LoadedPackage, loadPackages } from './npm.ts';
import { installationRootOf } from './checks/workspaces.ts';
import { type VersionsFile, loadVersions, validateVersionGraph } from './versions.ts';

export type VersionInspection = {
  readonly checkedPackageKeys: readonly string[];
  /**
   * The checked payloads with no violation. Violations are keyed by the derived file (package.json,
   * a lockfile, a generated file), never by the payload, so the generic report cannot tell on its own.
   */
  readonly passedPackageKeys: readonly string[];
  readonly violations: readonly Violation[];
};

/** One installation root's lockfile, reduced to the entries that carry a version. */
export type InstallationLock = {
  readonly rootKey: string;
  readonly rootDirectory: string;
  readonly entries: Readonly<Record<string, { readonly version?: string }>>;
};

export function inspectVersions(workspaceRoot: string, manifest: NpmManifest): VersionInspection {
  const versions = loadVersions(workspaceRoot);
  const graph = validateVersionGraph(manifest, versions);
  const checkedPackageKeys = Object.keys(versions.packages);
  // An invalid graph makes every derived comparison meaningless; report it alone.
  if (graph.length > 0) return { checkedPackageKeys, passedPackageKeys: [], violations: graph };
  const packages = loadPackages(workspaceRoot, manifest);
  const locks = readInstallationLocks(workspaceRoot, packages);
  const generated = readGeneratedVersions(packages);
  // Validated one payload at a time, so each violation stays attributable to the payload it came from.
  const perPackage = packages.map((pkg) => ({
    key: pkg.key,
    violations: [
      ...validatePackageVersions([pkg], versions),
      ...validateLockfileMemberVersions([pkg], versions, locks),
      ...validateGeneratedVersions([pkg], versions, generated),
    ],
  }));
  const failed = new Set(perPackage.filter((entry) => entry.violations.length > 0).map((entry) => entry.key));
  return {
    checkedPackageKeys,
    passedPackageKeys: checkedPackageKeys.filter((key) => !failed.has(key)),
    violations: perPackage.flatMap((entry) => entry.violations),
  };
}

/** Each payload's package.json carries exactly its central version. */
export function validatePackageVersions(
  packages: readonly LoadedPackage[],
  versions: VersionsFile,
): readonly Violation[] {
  return centralPayloads(packages, versions).flatMap(({ pkg, central }) => {
    const derived = pkg.packageJson.version;
    if (derived === central) return [];
    return [
      {
        rule: 'version-package',
        packageKey: packageJsonPath(pkg.key),
        message: `package.json has ${derived ?? 'no version'}; central version is ${central} — run \`version apply\``,
      },
    ];
  });
}

/** Every lockfile entry that resolves to a payload directory records that payload's central version. */
export function validateLockfileMemberVersions(
  packages: readonly LoadedPackage[],
  versions: VersionsFile,
  locks: readonly InstallationLock[],
): readonly Violation[] {
  return centralPayloads(packages, versions).flatMap(({ pkg, central }) =>
    locks.flatMap((lock) =>
      memberEntries(lock, pkg.directory)
        .filter(([, entry]) => entry.version !== central)
        .map(([path, entry]) => ({
          rule: 'version-lockfile',
          packageKey: lockfilePath(lock.rootKey),
          message:
            `records ${entry.version ?? 'no version'} for '${path}'; ` +
            `central version is ${central} — run \`version apply\``,
        })),
    ),
  );
}

/**
 * A committed file generated from a payload's version. Committed, so it ships whatever it last said: a bump
 * that does not regenerate it publishes the previous version. Generators read package.json, not
 * versions.json, but package.json is already held to the central version above.
 */
export type GeneratedVersionFile = {
  readonly packageKey: string;
  /** Relative to the payload directory. */
  readonly path: string;
  /** Captures the embedded version as group 1; `version apply` replaces exactly that span. */
  readonly pattern: RegExp;
  /** The fallback when the pattern no longer matches and `version apply` cannot rewrite the file. */
  readonly regenerate: string;
};

export const GENERATED_VERSION_FILES: readonly GeneratedVersionFile[] = [
  {
    packageKey: './foundry/forge-fhevm-std/pkg',
    path: 'src/StdFhevmVersion.sol',
    pattern: /string internal constant VERSION = "([^"]*)";/,
    regenerate: '`npm run generate:version` in foundry/forge-fhevm-std',
  },
];

/** What one generated file says. `version` is undefined when the file exists but the pattern finds nothing. */
export type GeneratedVersion = {
  readonly file: GeneratedVersionFile;
  readonly version: string | undefined;
};

/** Every generated version file must embed its payload's central version. */
export function validateGeneratedVersions(
  packages: readonly LoadedPackage[],
  versions: VersionsFile,
  generated: readonly GeneratedVersion[],
): readonly Violation[] {
  const centralByKey = new Map(centralPayloads(packages, versions).map(({ pkg, central }) => [pkg.key, central]));
  return generated.flatMap(({ file, version }) => {
    const central = centralByKey.get(file.packageKey);
    if (central === undefined || version === central) return [];
    return [
      {
        rule: 'version-generated',
        packageKey: `${file.packageKey}/${file.path}`,
        message:
          version === undefined
            ? `embeds no version matching ${String(file.pattern)}; central version is ${central} — run ${file.regenerate}`
            : `embeds ${version}; central version is ${central} — run \`version apply\``,
      },
    ];
  });
}

/**
 * Reads each generated file of a loaded payload. A missing file is skipped, not reported: `clean:generated`
 * deletes it and this check runs pre-build; a deleted tracked file already shows in `git status`.
 */
export function readGeneratedVersions(
  packages: readonly LoadedPackage[],
  files: readonly GeneratedVersionFile[] = GENERATED_VERSION_FILES,
): GeneratedVersion[] {
  return files.flatMap((file) => {
    const pkg = packages.find((candidate) => candidate.key === file.packageKey);
    if (pkg === undefined) return [];
    const path = join(pkg.directory, file.path);
    if (!existsSync(path)) return [];
    return [{ file, version: file.pattern.exec(readFileSync(path, 'utf8'))?.[1] }];
  });
}

/** The lockfile of every installation root the members belong to, missing files skipped. */
export function readInstallationLocks(workspaceRoot: string, packages: readonly LoadedPackage[]): InstallationLock[] {
  const rootKeys = [...new Set(packages.map(installationRootOf))].filter((key): key is string => key !== undefined);
  return rootKeys.flatMap((rootKey) => {
    const rootDirectory = resolve(workspaceRoot, rootKey);
    const file = join(rootDirectory, 'package-lock.json');
    if (!existsSync(file)) return [];
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { packages?: InstallationLock['entries'] };
    return [{ rootKey, rootDirectory, entries: parsed.packages ?? {} }];
  });
}

/** The payloads the central file knows, paired with their version; the graph check already reported the rest. */
export function centralPayloads(
  packages: readonly LoadedPackage[],
  versions: VersionsFile,
): readonly { readonly pkg: LoadedPackage; readonly central: string }[] {
  return packages.flatMap((pkg) => {
    const central = versions.packages[pkg.key];
    return central === undefined ? [] : [{ pkg, central }];
  });
}

/**
 * Lock entries are keyed by path relative to the root ('plugin/pkg', '../../host-contracts-cleartext/v13/pkg');
 * link entries under node_modules carry no version and are skipped by the version filter.
 */
export function memberEntries(
  lock: InstallationLock,
  payloadDirectory: string,
): [string, { readonly version?: string }][] {
  return Object.entries(lock.entries).filter(
    ([path, entry]) =>
      path !== '' && entry.version !== undefined && resolve(lock.rootDirectory, path) === resolve(payloadDirectory),
  );
}
