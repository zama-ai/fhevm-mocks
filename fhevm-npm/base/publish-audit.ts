// `publish check --audit`: does what this tarball brings into a user's project carry a known vulnerability, at the
// moment it is published? The tarball is installed alone into a throwaway project, the way a user's `npm install`
// would resolve it today, and `npm audit` judges the result.
//
// Only what the package BRINGS is judged. Its peerDependencies (hardhat, viem, @fhevm/sdk...) are installed by the
// user, at the user's version, so `--legacy-peer-deps` keeps npm from installing them at all. That is not taken on
// trust: npm marks every node it installs to satisfy a peer with `peer: true`, and a probe lockfile holding such a
// node, or a top-level copy of a declared peer, fails the check instead of reporting a misleading result.
//
// The phase runs after --check-npmjs has proven every rendered dependency is on the registry, which is exactly
// what installing the tarball alone needs. No age cutoff: a user installing right after the publish gets today's
// newest versions, so those are the ones audited.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { PackageJson } from './npm.ts';

export const auditLevels = ['info', 'low', 'moderate', 'high', 'critical'] as const;
export type AuditLevel = (typeof auditLevels)[number];

/** Runs npm in a directory and hands back what it printed; injected so tests need no registry. */
export type AuditNpmRunner = (
  directory: string,
  args: readonly string[],
) => { readonly status: number | null; readonly stdout: string; readonly stderr: string };

export const runAuditNpm: AuditNpmRunner = (directory, args) => {
  const result = spawnSync('npm', [...args], { cwd: directory, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};

/** One advisory finding at or above the level, with the lockfile paths that install the vulnerable package. */
export type AuditFinding = {
  readonly name: string;
  readonly severity: AuditLevel;
  readonly range: string;
  readonly advisories: readonly string[];
  readonly nodes: readonly string[];
};

export type AuditResult =
  | { readonly kind: 'audited'; readonly findings: readonly AuditFinding[]; readonly installed: number }
  | { readonly kind: 'peers-installed'; readonly peers: readonly string[] }
  | { readonly kind: 'failed'; readonly step: 'install' | 'audit'; readonly detail: string };

type LockEntries = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export function auditTarball(
  tarball: string,
  shipped: PackageJson,
  level: AuditLevel,
  npm: AuditNpmRunner = runAuditNpm,
): AuditResult {
  const directory = mkdtempSync(join(tmpdir(), 'fhevm-npm-audit-'));
  try {
    writeFileSync(
      join(directory, 'package.json'),
      `${JSON.stringify({ name: 'fhevm-npm-audit-probe', version: '0.0.0', private: true }, null, 2)}\n`,
    );
    const install = npm(directory, [
      'install',
      tarball,
      '--package-lock-only',
      '--legacy-peer-deps',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ]);
    if (install.status !== 0) return { kind: 'failed', step: 'install', detail: lastLines(install.stderr) };

    const entries = readLockEntries(join(directory, 'package-lock.json'));
    const peers = installedPeers(entries, shipped);
    if (peers.length > 0) return { kind: 'peers-installed', peers };

    // `npm audit` exits non-zero whenever it finds anything; the JSON on stdout is the answer either way.
    const audit = npm(directory, ['audit', '--json']);
    let report: unknown;
    try {
      report = JSON.parse(audit.stdout);
    } catch {
      return { kind: 'failed', step: 'audit', detail: lastLines(audit.stderr || audit.stdout) };
    }
    if (isAuditError(report))
      return { kind: 'failed', step: 'audit', detail: report.error.summary ?? 'npm audit failed' };
    return {
      kind: 'audited',
      findings: auditFindings(report, level),
      installed: Object.keys(entries).filter((path) => path !== '').length,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Peers that reached the probe anyway: a node npm installed to satisfy a peer (`peer: true`), or a top-level copy of
 * a name the tarball declares only as a peer.
 */
export function installedPeers(entries: LockEntries, shipped: PackageJson): readonly string[] {
  const bundledNames = new Set([
    ...Object.keys(shipped.dependencies ?? {}),
    ...Object.keys(shipped.optionalDependencies ?? {}),
  ]);
  const declaredPeers = Object.keys(shipped.peerDependencies ?? {}).filter((name) => !bundledNames.has(name));
  const flagged = Object.entries(entries).flatMap(([path, entry]) => (entry.peer === true ? [path] : []));
  const topLevel = declaredPeers.map((name) => `node_modules/${name}`).filter((path) => entries[path] !== undefined);
  return [...new Set([...flagged, ...topLevel])].sort();
}

/** `npm audit --json` (lockfile v2+ report format) reduced to the findings at or above `level`. */
export function auditFindings(report: unknown, level: AuditLevel): readonly AuditFinding[] {
  const vulnerabilities = record(record(report).vulnerabilities);
  const threshold = auditLevels.indexOf(level);
  return Object.entries(vulnerabilities)
    .flatMap(([name, value]): AuditFinding[] => {
      const entry = record(value);
      const severity = entry.severity;
      if (typeof severity !== 'string' || !isAuditLevel(severity) || auditLevels.indexOf(severity) < threshold)
        return [];
      const via = Array.isArray(entry.via) ? entry.via : [];
      const advisories = via.map((item: unknown) =>
        typeof item === 'string' ? `via ${item}` : String(record(item).title ?? record(item).url ?? 'advisory'),
      );
      const nodes = Array.isArray(entry.nodes) ? entry.nodes.filter((node) => typeof node === 'string') : [];
      return [{ name, severity, range: String(entry.range ?? '*'), advisories, nodes }];
    })
    .sort(
      (left, right) =>
        auditLevels.indexOf(right.severity) - auditLevels.indexOf(left.severity) || left.name.localeCompare(right.name),
    );
}

export function isAuditLevel(value: string): value is AuditLevel {
  return (auditLevels as readonly string[]).includes(value);
}

function readLockEntries(file: string): LockEntries {
  const packages: unknown = (JSON.parse(readFileSync(file, 'utf8')) as { packages?: unknown }).packages;
  return typeof packages === 'object' && packages !== null ? (packages as LockEntries) : {};
}

function isAuditError(report: unknown): report is { readonly error: { readonly summary?: string } } {
  return typeof record(report).error === 'object' && record(report).error !== null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function lastLines(text: string): string {
  return text.trim().split('\n').slice(-5).join(' | ') || 'no output';
}
