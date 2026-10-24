// `publish rehearse`: run, on this machine and before anything is published, what the release workflow runs for
// each payload it publishes — pack, `publish check`, the registry phase and the audit — and report every payload
// in one go.
//
// The release set is derived, not listed: every npm-distributed payload, in publish order, minus the previous
// generation of each family (npm-manifest.json#generations; it was released with its own line) and minus each
// `--exclude` (a payload kept in the tree but not released this time).
//
// What makes it a rehearsal rather than a loop over `publish check`: the release publishes the payloads one after
// the other, so a payload's check runs once the payloads it depends on are on npm. Here they are not yet, so a
// dependency on another payload of the set is satisfied by that payload's freshly packed tarball: the registry is
// not asked about it, and the audit installs that tarball beside the audited one. Everything else is judged as
// `publish check --check-npmjs --audit` judges it, peers excluded and guarded the same way.

import type { NpmManifest } from '../manifest.ts';
import type { Violation } from './diagnostics.ts';
import { type LoadedPackage, type PackageJson, loadPackages } from './npm.ts';
import { tarballsOutDir } from './pack-tarball.ts';
import { type AuditLevel, type AuditNpmRunner, type CompanionTarball, auditTarball } from './publish-audit.ts';
import {
  type RegistryOptions,
  auditViolations,
  checkRegistry,
  inspectPublishedTarball,
  tarballPackageJson,
} from './publish-check.ts';
import { type Packer, publishPack } from './publish-pack.ts';
import { payloadGraph, resolvePayload, topologicalOrder } from './publish-render.ts';

export type RehearsalStep = 'pack' | 'check' | 'registry' | 'audit';
export type StepStatus = 'passed' | 'failed' | 'skipped';

export type PayloadRehearsal = {
  readonly key: string;
  readonly name: string;
  readonly tarball?: string;
  readonly steps: Readonly<Record<RehearsalStep, StepStatus>>;
  readonly violations: readonly Violation[];
};

export type ReleaseSet = {
  readonly keys: readonly string[];
  readonly dropped: readonly { readonly key: string; readonly reason: string }[];
};

/** Every npm-distributed payload in publish order, minus the previous generations and the `--exclude` selections. */
export function releaseSet(
  manifest: NpmManifest,
  packages: readonly LoadedPackage[],
  excludes: readonly string[],
): ReleaseSet {
  const previous = new Map(
    Object.entries(manifest.generations ?? {}).flatMap(([family, pair]) => {
      const payload = pair.previous === undefined ? undefined : manifest.packages[pair.previous]?.publishedRelPath;
      return payload === undefined ? [] : [[payload, `previous generation of ${family}`] as const];
    }),
  );
  const excluded = new Map(excludes.map((selector) => [resolvePayload(packages, selector).key, '--exclude'] as const));
  const dropped: { key: string; reason: string }[] = [];
  const keys = topologicalOrder(payloadGraph(packages)).filter((key) => {
    const reason = excluded.get(key) ?? previous.get(key);
    if (reason !== undefined) dropped.push({ key, reason });
    return reason === undefined;
  });
  return { keys, dropped };
}

export type RehearseOptions = {
  readonly excludes: readonly string[];
  readonly auditLevel: AuditLevel;
  readonly outDir?: string;
  readonly registry: RegistryOptions;
  readonly pack?: Packer;
  readonly npm?: AuditNpmRunner;
};

export async function rehearseRelease(
  workspaceRoot: string,
  manifest: NpmManifest,
  options: RehearseOptions,
): Promise<{ readonly set: ReleaseSet; readonly payloads: readonly PayloadRehearsal[] }> {
  const packages = loadPackages(workspaceRoot, manifest);
  const set = releaseSet(manifest, packages, options.excludes);
  const outDir = tarballsOutDir(workspaceRoot, manifest, options.outDir);

  // Every tarball first: a payload's audit needs the tarballs of the set payloads it depends on.
  type Packed =
    | { readonly pkg: LoadedPackage; readonly tarball: string; readonly shipped: PackageJson }
    | { readonly pkg: LoadedPackage; readonly error: string };
  const packed = set.keys.map((key): Packed => {
    const pkg = packages.find((candidate) => candidate.key === key) as LoadedPackage;
    try {
      const tarball = publishPack(workspaceRoot, manifest, key, { outDir, pack: options.pack });
      return { pkg, tarball, shipped: tarballPackageJson(tarball) };
    } catch (error) {
      return { pkg, error: error instanceof Error ? error.message : String(error) };
    }
  });
  const local = new Map(
    packed.flatMap((entry) =>
      'tarball' in entry && entry.shipped.name !== undefined
        ? [[entry.shipped.name, { tarball: entry.tarball, shipped: entry.shipped }] as const]
        : [],
    ),
  );

  const payloads: PayloadRehearsal[] = [];
  for (const entry of packed) {
    const { pkg } = entry;
    const name = pkg.packageJson.name ?? pkg.key;
    if (!('tarball' in entry)) {
      payloads.push({
        key: pkg.key,
        name,
        steps: { pack: 'failed', check: 'skipped', registry: 'skipped', audit: 'skipped' },
        violations: [{ rule: 'rehearse', packageKey: pkg.key, message: `publish pack failed: ${entry.error}` }],
      });
      continue;
    }
    const base = { key: pkg.key, name, tarball: entry.tarball };

    const statics = (await inspectPublishedTarball(workspaceRoot, manifest, pkg.key, { outDir })).violations;
    if (statics.length > 0) {
      payloads.push({
        ...base,
        steps: { pack: 'passed', check: 'failed', registry: 'skipped', audit: 'skipped' },
        violations: statics,
      });
      continue;
    }

    const registry = await checkRegistry(pkg, entry.shipped, packages, options.registry, new Set(local.keys()));
    if (registry.length > 0) {
      payloads.push({
        ...base,
        steps: { pack: 'passed', check: 'passed', registry: 'failed', audit: 'skipped' },
        violations: registry,
      });
      continue;
    }

    const companions = companionTarballs(entry.shipped, local);
    const audit = auditViolations(
      pkg,
      auditTarball(entry.tarball, entry.shipped, options.auditLevel, options.npm, companions),
      options.auditLevel,
    );
    payloads.push({
      ...base,
      steps: { pack: 'passed', check: 'passed', registry: 'passed', audit: audit.length > 0 ? 'failed' : 'passed' },
      violations: audit,
    });
  }
  return { set, payloads };
}

/** The set payloads `shipped` depends on, directly or through one another, as tarballs to install beside it. */
export function companionTarballs(
  shipped: PackageJson,
  local: ReadonlyMap<string, CompanionTarball>,
): readonly CompanionTarball[] {
  const found = new Map<string, CompanionTarball>();
  const visit = (manifest: PackageJson): void => {
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      const companion = local.get(dependency);
      if (companion === undefined || found.has(dependency) || dependency === shipped.name) continue;
      found.set(dependency, companion);
      visit(companion.shipped);
    }
  };
  visit(shipped);
  return [...found.values()];
}

/** One line per payload: the result of each step, in the order they ran. */
export function formatRehearsal(payloads: readonly PayloadRehearsal[]): string {
  const icon: Readonly<Record<StepStatus, string>> = { passed: '✅', failed: '❌', skipped: '⏭️' };
  const steps: readonly RehearsalStep[] = ['pack', 'check', 'registry', 'audit'];
  const width = Math.max(...payloads.map((payload) => payload.key.length));
  return payloads
    .map(
      (payload) =>
        `${payload.key.padEnd(width)}  ${steps.map((step) => `${icon[payload.steps[step]]} ${step}`).join('  ')}`,
    )
    .join('\n');
}
