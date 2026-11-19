import type { Violation } from '../diagnostics.ts';
import { packageJsonPath } from './package-names.ts';
import type { LoadedPackage } from '../npm.ts';
import { rangeMajor } from '../semver.ts';

const GLOB_CHARACTER = /[*?[\]{}]/;

// N installation roots: '.' plus every non-'.' workspace-root entry (a CLUSTER — its own npm workspace).
// Each root's package.json#workspaces is compared against the manifest members that declare it via
// memberOf ('.' being the default). A published name has at most one member across ALL roots: two
// generations share a name only when the older one is not a member.
export function validateWorkspaces(packages: readonly LoadedPackage[]): readonly Violation[] {
  const roots = packages.filter((pkg) => pkg.inventory.kind === 'workspace-root');
  if (!roots.some((root) => root.key === '.')) throw new Error('The loaded inventory has no workspace root package');

  const violations: Violation[] = [];
  for (const root of roots) validateOneRoot(root, packages, roots, violations);
  validatePublishedMemberNames(packages, violations);

  return [...violations, ...workspaceGlobsOutsideRoots(packages), ...dependencyMajorsSharingARoot(packages)];
}

function validateOneRoot(
  root: LoadedPackage,
  packages: readonly LoadedPackage[],
  roots: readonly LoadedPackage[],
  violations: Violation[],
): void {
  const workspacesFile = `${root.key === '.' ? 'sdk' : root.key}/package.json#workspaces`;
  const actual = root.packageJson.workspaces ?? [];
  const expected = new Map(
    packages
      .filter((pkg) => installationRootOf(pkg) === root.key)
      .map((pkg) => [relativeToRoot(pkg.key, root.key), pkg] as const),
  );
  const actualSet = new Set(actual);

  for (const entry of actual) {
    if (GLOB_CHARACTER.test(entry)) {
      violations.push({
        rule: '2.1.1',
        packageKey: packageJsonPath(root.key),
        message: `workspace entry '${entry}' must be an explicit relative path, not a glob`,
      });
      continue;
    }
    if (expected.has(entry)) continue;
    const key = joinRoot(root.key, entry);
    const inventoried = packages.find((pkg) => pkg.key === key);
    violations.push({
      rule: inventoried?.inventory.kind === 'standalone' ? '2.1.4' : '2.1.1',
      packageKey: packageJsonPath(inventoried?.key ?? root.key),
      message:
        inventoried?.inventory.kind === 'standalone'
          ? `standalone package '${inventoried.key}' must not appear in ${workspacesFile}`
          : `workspace entry '${entry}' has no matching manifest member of '${root.key}'`,
    });
  }

  for (const [entry, pkg] of expected) {
    if (!actualSet.has(entry)) {
      violations.push({
        rule: '2.1.1',
        packageKey: packageJsonPath(pkg.key),
        message: `manifest member is missing from ${workspacesFile} as '${entry}'`,
      });
    }
  }

  // A '.'-rooted member physically inside a cluster would be installed by TWO roots at once.
  if (root.key !== '.') {
    for (const pkg of packages) {
      if (installationRootOf(pkg) !== '.' || !pkg.key.startsWith(`${root.key}/`)) continue;
      violations.push({
        rule: '2.1.6',
        packageKey: packageJsonPath(pkg.key),
        message: `a member inside installation root '${root.key}' must declare memberOf: "${root.key}"`,
      });
    }
  }
}

function validatePublishedMemberNames(packages: readonly LoadedPackage[], violations: Violation[]): void {
  const publishedMembersByName = new Map<string, LoadedPackage[]>();
  for (const pkg of packages) {
    const name = pkg.packageJson.name;
    if (pkg.inventory.kind !== 'published' || installationRootOf(pkg) === undefined || name === undefined) continue;

    const sameName = publishedMembersByName.get(name) ?? [];
    sameName.push(pkg);
    publishedMembersByName.set(name, sameName);
  }

  for (const [name, sameName] of publishedMembersByName) {
    if (sameName.length < 2) continue;

    const packageKeys = sameName
      .map((pkg) => pkg.key)
      .sort()
      .join(', ');
    for (const pkg of sameName) {
      violations.push({
        rule: '2.1.3',
        packageKey: packageJsonPath(pkg.key),
        message: `published name '${name}' has more than one workspace member, across every installation root: ${packageKeys}`,
      });
    }
  }
}

/** 2.1.1 for packages that are not installation roots: a `workspaces` glob would make one, silently. */
function workspaceGlobsOutsideRoots(packages: readonly LoadedPackage[]): readonly Violation[] {
  return packages
    .filter((pkg) => pkg.inventory.kind !== 'workspace-root')
    .flatMap((pkg) =>
      (pkg.packageJson.workspaces ?? [])
        .filter((entry) => GLOB_CHARACTER.test(entry))
        .map((entry) => ({
          rule: '2.1.1',
          packageKey: packageJsonPath(pkg.key),
          message: `workspace entry '${entry}' must be an explicit relative path, not a glob`,
        })),
    );
}

const PRIVATE_MEMBER_KINDS = new Set(['dev', 'shared-helper', 'internal-consumer']);

/**
 * 4.2.2: the private members of one installation root share one `node_modules`, so they declare one major of
 * each dependency. A dependency whose major differs per dependency group (hardhat 2 and 3) puts those groups
 * in separate roots. Published payloads are left out: their peer ranges state what users may have.
 */
function dependencyMajorsSharingARoot(packages: readonly LoadedPackage[]): readonly Violation[] {
  const majorsByRootAndName = new Map<string, Map<number, LoadedPackage[]>>();
  for (const pkg of packages) {
    const rootKey = installationRootOf(pkg);
    if (rootKey === undefined || !PRIVATE_MEMBER_KINDS.has(pkg.inventory.kind)) continue;

    const specs = { ...pkg.packageJson.dependencies, ...pkg.packageJson.devDependencies };
    for (const [name, spec] of Object.entries(specs)) {
      const major = rangeMajor(spec);
      if (major === undefined) continue;

      const key = `${rootKey}\0${name}`;
      const byMajor = majorsByRootAndName.get(key) ?? new Map<number, LoadedPackage[]>();
      byMajor.set(major, [...(byMajor.get(major) ?? []), pkg]);
      majorsByRootAndName.set(key, byMajor);
    }
  }

  const violations: Violation[] = [];
  for (const [key, byMajor] of majorsByRootAndName) {
    if (byMajor.size < 2) continue;

    const [rootKey, name] = key.split('\0');
    const majors = [...byMajor.keys()].sort((left, right) => left - right).join(' and ');
    for (const pkg of [...byMajor.values()].flat().sort((left, right) => left.key.localeCompare(right.key))) {
      violations.push({
        rule: '4.2.2',
        packageKey: packageJsonPath(pkg.key),
        message: `installation root '${rootKey}' holds majors ${majors} of '${name}'; a dependency whose major differs per group needs separate roots`,
      });
    }
  }
  return violations;
}

/** The installation root a member belongs to, or undefined for non-members. */
export function installationRootOf(pkg: LoadedPackage): string | undefined {
  if (!pkg.inventory.member) return undefined;
  return pkg.inventory.memberOf ?? '.';
}

function relativeToRoot(key: string, rootKey: string): string {
  if (rootKey === '.') return key.startsWith('./') ? key.slice(2) : key;
  return key.slice(rootKey.length + 1);
}

function joinRoot(rootKey: string, entry: string): string {
  return rootKey === '.' ? `./${entry}` : `${rootKey}/${entry}`;
}
