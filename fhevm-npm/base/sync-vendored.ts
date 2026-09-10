// Writes the TypeScript that is shared verbatim between workspace members, from the one source of truth
// to every destination that lists it. `check-vendored-origin` reads the same mapping; this is the writer.
//
// A destination is normally byte-identical to its source: no header is prepended, because each file names
// its own provenance on line 1, and no import is rewritten, because these files import only bare
// specifiers or siblings. The exception is a `rewrites` list, for a destination that already depends on
// the package the source only describes — see `expectedVendoredContent`, which both sides share so a
// write and a check can never disagree about what a destination should contain.
//
// Destinations take a SUBSET of the source on purpose, so a file at the source that no destination lists
// is not a failure. What IS a failure: a file a destination lists but the source lacks, a missing
// destination directory, a rewrite that did not apply, and a run that touched nothing at all — an empty
// mapping compares clean, which looks exactly like success.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { NpmManifest } from '../manifest.ts';
import {
  type CommonDestination,
  type PinnedVendoredTarget,
  expectedVendoredContent,
  localVendoredManifest,
  pinnedVendoredTargets,
} from './checks/vendored.ts';
import type { Violation } from './diagnostics.ts';
import { vendoredDigest } from './vendored-digest.ts';
import { withPinnedTree } from './vendored-download.ts';

/** Progress sink. Supplied only in verbose mode, so a quiet run stays silent until its report. */
export type ProgressLogger = (message: string) => void;

export type SyncVendoredOptions = {
  readonly workspaceRoot: string;
  readonly manifest: NpmManifest;
  readonly check: boolean;
  /** Download the pinned tree and print the digest it implies, writing nothing. */
  readonly digest?: boolean;
  readonly onProgress?: ProgressLogger;
};
export type SyncPinnedOptions = SyncVendoredOptions;

export type SyncVendoredResult = {
  readonly inspected: number;
  readonly destinations: readonly string[];
  readonly written: readonly string[];
  readonly violations: readonly Violation[];
};

const RULE = 'vendored-sync';

export function syncVendored(options: SyncVendoredOptions): SyncVendoredResult {
  const manifest = localVendoredManifest(options.manifest);
  const sourceDirectory = join(options.workspaceRoot, manifest.source);
  if (!existsSync(sourceDirectory)) {
    throw new Error(`npm-manifest.json vendored source '${manifest.source}' does not exist`);
  }

  const written: string[] = [];
  const violations: Violation[] = [];
  let inspected = 0;

  for (const destination of manifest.destinations) {
    for (const to of destination.to) {
      const startedAt = performance.now();
      options.onProgress?.(`→ ${to} (${String(destination.files.length)} file(s), from ${manifest.source})`);
      for (const file of destination.files) {
        inspected += 1;
        const relativePath = `${to}/${file}`;
        const before = written.length;
        const problem = syncOne(options, manifest.source, destination, to, file, written);
        if (problem !== undefined) {
          violations.push({ rule: RULE, packageKey: to, message: `${relativePath}: ${problem}` });
          options.onProgress?.(`   ❌ ${relativePath}`);
        } else {
          options.onProgress?.(`   ${written.length > before ? '↻' : '✅'} ${relativePath}`);
        }
      }
      options.onProgress?.(`   ${elapsed(startedAt)}`);
    }
  }

  // An empty mapping would report no differences, which reads as success. It is a manifest bug.
  if (inspected === 0) {
    throw new Error('npm-manifest.json listed no local vendored files — the run would have passed vacuously');
  }

  return {
    inspected,
    destinations: manifest.destinations.flatMap((destination) => destination.to),
    written,
    violations,
  };
}

/** Syncs one file, returning the reason it could not be produced or left in sync, or undefined. */
function syncOne(
  options: SyncVendoredOptions,
  source: string,
  destination: CommonDestination,
  to: string,
  file: string,
  written: string[],
): string | undefined {
  const sourceFile = join(options.workspaceRoot, source, file);
  const destinationDirectory = join(options.workspaceRoot, to);
  const destinationFile = join(destinationDirectory, file);

  if (!existsSync(sourceFile)) {
    return `listed here but absent from ${source}`;
  }
  if (!existsSync(destinationDirectory)) {
    return 'destination directory does not exist';
  }

  const expectation = expectedVendoredContent(readFileSync(sourceFile, 'utf8'), destination, file);
  if (expectation.error !== undefined) {
    return expectation.error;
  }

  const actual = existsSync(destinationFile) ? readFileSync(destinationFile, 'utf8') : undefined;
  if (actual === expectation.content) {
    return undefined;
  }

  if (options.check) {
    return actual === undefined ? 'missing' : describeDifference(actual, expectation.content, `${source}/${file}`);
  }

  writeFileSync(destinationFile, expectation.content);
  written.push(`${to}/${file}`);
  return undefined;
}

/** Names the first line that disagrees, so a failure points at a line rather than a file. */
function describeDifference(actual: string, expected: string, sourceLabel: string): string {
  const here = actual.split('\n');
  const want = expected.split('\n');
  const at = here.findIndex((line, index) => line !== want[index]);
  const index = at === -1 ? Math.min(here.length, want.length) : at;
  return (
    `differs from ${sourceLabel} at line ${String(index + 1)}: ` +
    `found ${JSON.stringify(here[index] ?? '(missing)')}, expected ${JSON.stringify(want[index] ?? '(missing)')}`
  );
}

////////////////////////////////////////////////////////////////////////////////
// Pinned destinations: Solidity taken from an external tree at a declared commit.
////////////////////////////////////////////////////////////////////////////////

/**
 * Writes every pinned vendored tree, and the `fhevm.vendoredFrom` block that records where it came from.
 *
 * Enumerates UPSTREAM rather than the destination, so bumping a tag adds files the new version
 * introduced and deletes ones it dropped. Reading the destination instead would only ever refresh what
 * is already there, which is the failure mode a manual bump already has.
 *
 * Writing into `pkg/src/contracts` is the sanctioned path: those files are read-only to a human editor
 * precisely because this is what produces them.
 */
export function syncPinnedVendored(options: SyncPinnedOptions): SyncVendoredResult {
  const targets = pinnedVendoredTargets(options.workspaceRoot, options.manifest);
  const written: string[] = [];
  const violations: Violation[] = [];
  let inspected = 0;

  for (const target of targets) {
    // The digest mode answers what upstream implies, so it does not care what is on disk.
    if (options.digest === true) {
      inspected += reportUpstreamDigest(target, violations);
      continue;
    }
    if (!existsSync(target.directory)) {
      violations.push({ rule: RULE, packageKey: `./${targetLabel(target)}`, message: `destination missing` });
      continue;
    }
    const startedAt = performance.now();
    options.onProgress?.(`→ ${targetLabel(target)} (${target.source.from} at ${target.source.tag})`);
    // Checking compares the recorded digest against the copies on disk: no download, no git, no
    // upstream repository. Writing is the only path that reaches the network.
    inspected += options.check
      ? checkPinnedDigest(options, target, violations)
      : syncPinnedTarget(options, target, written, violations);
    options.onProgress?.(`   ${elapsed(startedAt)}`);
  }

  return { inspected, destinations: targets.map((target) => target.relPath), written, violations };
}

/** Where a digest goes, in the shortest form that says exactly what to type and where. */
export function digestInstruction(target: PinnedVendoredTarget, digest: string): string {
  return (
    `record it in npm-manifest.json, in the "source" of "${target.packageKey}" > vendored[${String(target.entryIndex)}]:\n` +
    `      "digest": "${digest}"`
  );
}

/**
 * Downloads the pinned tree, formats it, and prints the digest it implies — computed from upstream, not
 * from the copies on disk, so it says what the manifest SHOULD record rather than what it currently does.
 */
function reportUpstreamDigest(target: PinnedVendoredTarget, violations: Violation[]): number {
  let digest: string;
  try {
    digest = withPinnedTree(target.source, (tree) => {
      const scratch = mkdtempSync(join(tmpdir(), 'fhevm-npm-digest-'));
      try {
        for (const file of solidityFilesUnder(tree)) {
          const destination = join(scratch, file);
          mkdirSync(dirname(destination), { recursive: true });
          writeFileSync(destination, formatSolidity(readFileSync(join(tree, file), 'utf8')));
        }
        return vendoredDigest(scratch);
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    });
  } catch (error) {
    violations.push({
      rule: RULE,
      packageKey: `./${targetLabel(target)}`,
      message: `${error instanceof Error ? error.message : String(error)}`,
    });
    return 0;
  }

  const state =
    target.source.digest === digest
      ? ' (already recorded)'
      : target.source.digest === undefined
        ? ''
        : ` (npm-manifest.json currently records ${target.source.digest})`;
  console.log(`${target.packageKey} ${target.relPath} at ${target.source.tag}${state}`);
  console.log(`      "digest": "${digest}"`);
  return 1;
}

function checkPinnedDigest(options: SyncPinnedOptions, target: PinnedVendoredTarget, violations: Violation[]): number {
  let actual: string;
  try {
    actual = vendoredDigest(target.directory);
  } catch (error) {
    violations.push({
      rule: RULE,
      packageKey: `./${targetLabel(target)}`,
      message: `${error instanceof Error ? error.message : String(error)}`,
    });
    return 0;
  }

  if (target.source.digest === undefined) {
    violations.push({
      rule: RULE,
      packageKey: `./${targetLabel(target)}`,
      message: `no digest recorded, so the copies are unverified — ${digestInstruction(target, actual)}`,
    });
    return 1;
  }
  if (target.source.digest !== actual) {
    violations.push({
      rule: RULE,
      packageKey: `./${targetLabel(target)}`,
      message:
        `${target.relPath}: content is ${actual}, but npm-manifest.json records ${target.source.digest}. ` +
        `The copies were edited, or the pin moved — run 'fhevm-npm sync vendored' to rewrite them from ${target.source.tag}.`,
    });
    return 1;
  }

  options.onProgress?.(`   ✅ ${targetLabel(target)} ${actual}`);
  return 1;
}

function syncPinnedTarget(
  options: SyncPinnedOptions,
  target: PinnedVendoredTarget,
  written: string[],
  violations: Violation[],
): number {
  let files: readonly string[];
  try {
    files = withPinnedTree(target.source, (tree) => {
      const upstream = solidityFilesUnder(tree);
      if (upstream.length === 0) throw new Error(`${target.source.from} holds no Solidity files`);
      for (const file of upstream) {
        const destinationFile = join(target.directory, file);
        // Formatted on the way in, so the committed copy is what forge would produce and the digest is
        // stable against upstream whitespace.
        const expected = formatSolidity(readFileSync(join(tree, file), 'utf8'));
        if (existsSync(destinationFile) && readFileSync(destinationFile, 'utf8') === expected) {
          options.onProgress?.(`   ✅ ${targetLabel(target)}/${file}`);
          continue;
        }
        mkdirSync(dirname(destinationFile), { recursive: true });
        writeFileSync(destinationFile, expected);
        written.push(`${target.relPath}/${file}`);
        options.onProgress?.(`   ↻ ${targetLabel(target)}/${file}`);
      }
      return upstream;
    });
  } catch (error) {
    violations.push({
      rule: RULE,
      packageKey: `./${targetLabel(target)}`,
      message: `unable to read ${target.source.repository} at ${target.source.commit}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
    return 0;
  }

  removeStale(options, target, files, written, violations);
  writeVendoredFrom(options, target, violations);
  reportDigest(options, target, violations);
  return files.length;
}

/**
 * The digest of what was just written, and where to put it. Never written for you: npm-manifest.json is
 * hand-edited and reviewed, so a value that gates every build should arrive through a diff you read.
 */
function reportDigest(options: SyncPinnedOptions, target: PinnedVendoredTarget, violations: Violation[]): void {
  const digest = vendoredDigest(target.directory);
  if (target.source.digest === digest) {
    options.onProgress?.(`   ✅ ${targetLabel(target)} ${digest}`);
    return;
  }
  violations.push({
    rule: RULE,
    packageKey: `./${targetLabel(target)}`,
    message:
      `${target.relPath}: ${target.source.digest === undefined ? 'no digest recorded' : `recorded digest is ${target.source.digest}`}, ` +
      `content is ${digest} — ${digestInstruction(target, digest)}`,
  });
}

function formatSolidity(source: string): string {
  return execFileSync('forge', ['fmt', '--raw', '-'], { encoding: 'utf8', input: source });
}

/** Files the destination still holds that the pinned tree no longer has. A bump must prune them. */
function removeStale(
  options: SyncPinnedOptions,
  target: PinnedVendoredTarget,
  upstream: readonly string[],
  written: string[],
  violations: Violation[],
): void {
  const keep = new Set(upstream);
  for (const file of solidityFilesUnder(target.directory)) {
    if (keep.has(file)) continue;
    if (options.check) {
      violations.push({
        rule: RULE,
        packageKey: `./${targetLabel(target)}`,
        message: `${target.relPath}/${file}: absent from ${target.source.from} at ${target.source.tag}`,
      });
      continue;
    }
    rmSync(join(target.directory, file));
    written.push(`removed ${target.relPath}/${file}`);
    options.onProgress?.(`   ✗ removed ${targetLabel(target)}/${file}`);
  }
}

/** The provenance block in the published package.json, regenerated from the manifest entry. */
function writeVendoredFrom(options: SyncPinnedOptions, target: PinnedVendoredTarget, violations: Violation[]): void {
  const file = join(target.packageDirectory, 'package.json');
  const packageJson = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown> & {
    fhevm?: Record<string, unknown>;
  };
  const expected = {
    repository: target.source.repository,
    tag: target.source.tag,
    commit: target.source.commit,
    from: target.source.from,
    to: target.relPath.replace(/^\.\//, ''),
  };

  const current = packageJson.fhevm?.['vendoredFrom'];
  if (JSON.stringify(current) === JSON.stringify(expected)) return;

  if (options.check) {
    violations.push({
      rule: RULE,
      packageKey: `./${targetLabel(target)}`,
      message: 'package.json#fhevm.vendoredFrom does not match npm-manifest.json',
    });
    return;
  }
  packageJson.fhevm = { ...packageJson.fhevm, vendoredFrom: expected };
  writeFileSync(file, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function solidityFilesUnder(directory: string, prefix = ''): readonly string[] {
  return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return solidityFilesUnder(directory, relativePath);
    return entry.name.endsWith('.sol') ? [relativePath] : [];
  });
}

/** A destination's wall clock, for the progress line that closes it. */
function elapsed(startedAt: number): string {
  return `${(performance.now() - startedAt).toFixed(0)}ms`;
}

/** A pinned destination's workspace-relative path, matching how the local half labels its own. */
function targetLabel(target: PinnedVendoredTarget): string {
  return `${target.packageKey}/${target.relPath}`.replaceAll('/./', '/').replace(/^\.\//, '');
}
