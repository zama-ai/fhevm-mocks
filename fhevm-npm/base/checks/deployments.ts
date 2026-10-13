// Deployment records: `deployments/<chain>/<stack>/`, one folder per deployed stack (its deploymentId, for life),
// holding one numbered folder per on-chain event — the deploy, each generation upgrade, each hotfix — copied from
// the operator's folder once the event is final. A record is evidence of transactions that cannot be undone, so
// it is frozen: editing it can only make it disagree with the chain. A later event gets a NEW folder.
//
//   deployments/<chain>/<stack>/
//   ├── 00-deploy-v13.0-2026-10-05/        <seq>-<kind>-v<generation>.<patch>-<UTC day of the defining tx's block>
//   ├── 01-hotfix-v13.1-2026-10-20/
//   ├── 02-upgrade-v14.1-2026-11-02/
//   └── aborted/2026-10-30-upgrade-v14.1-1/ an attempt that sent transactions but never became an event
//
// Two checks, because only one of them needs git history:
//   consistency  every record is complete and agrees with itself, with fhevm-chains.config.json, and with the
//                record before it: the history of a stack is one line, each event linked to the previous one by
//                the sha256 of its manifest, kinds and versions in order, dates taken from the chain.
//   frozen       against a base ref: no record that exists at the base may change in any way. The one exception
//                is the one-time relocation of a legacy flat record (`<stack>/deploy.config.json`, the layout
//                before events had folders) into `<stack>/00-deploy-…/`, accepted only as a pure move.
//
// Generation-free on purpose: it parses integers out of names and fields, and never knows what a generation is.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { CHAINS_CONFIG_FILE } from '../fhevm-chains.ts';
import type { Violation } from '../diagnostics.ts';

export const DEPLOYMENTS_DIR = 'deployments';
export const ABORTED_DIR = 'aborted';
export const README_FILE = 'README.md';
export const RECORD_TOOL_COMMIT_FILE = 'tool-commit.txt';
/** Written by the flow's last stage from the chain: the transactions that date the record. */
export const RECORD_EVENT_FILE = 'event.json';
/** What every flow leaves in its out dir and a record must keep. */
export const RECORD_SEAL_FILES = ['manifest.json', 'addresses.sol', 'journal.jsonl'] as const;
/** What the upgrade and hotfix flows also leave, and the deploy flow does not write. */
export const RECORD_UPGRADE_FILES = ['progress.jsonl', 'verify-report.json'] as const;
/** What the tools write into their out dir as scratch. Present in a record = a tool ran inside it. */
export const RECORD_SCRATCH = [
  'build',
  'build-check',
  'broadcast',
  'cache',
  '.foundry',
  'pass2.json',
  'rehearsal',
] as const;

export const EVENT_KINDS = ['deploy', 'upgrade', 'hotfix'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** `<seq>-<kind>-v<generation>.<patch>-<YYYY-MM-DD>` */
export const EVENT_NAME = /^(\d{2})-(deploy|upgrade|hotfix)-v(\d+)\.(\d+)-(\d{4}-\d{2}-\d{2})$/;
/** `<YYYY-MM-DD>-<kind>-v<generation>.<patch>-<n>`, under `aborted/` */
export const ATTEMPT_NAME = /^(\d{4}-\d{2}-\d{2})-(deploy|upgrade|hotfix)-v(\d+)\.(\d+)-(\d+)$/;

/** The config each kind of event is run with. The legacy flat record uses the deploy one. */
export const configFileOf = (kind: EventKind): string => `${kind}.config.json`;
const LEGACY_CONFIG_FILE = configFileOf('deploy');

const RULE = 'deployments';
const COMMIT = /^[0-9a-f]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const GENERATION = /^0\.(\d+)$/;
const PACKAGE_VERSION = /^0\.(\d+)\.(\d+)$/;

export type DeploymentsInspection = {
  readonly checkedRecordKeys: readonly string[];
  readonly violations: readonly Violation[];
  readonly notes?: readonly string[];
};

const isDirectory = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();
const toPosix = (path: string): string => path.split(sep).join('/');
const keyOf = (workspaceRoot: string, dir: string): string => `./${toPosix(relative(workspaceRoot, dir))}`;

/**
 * Host chain name -> chain id, across every network group of fhevm-chains.config.json (`networks.<group>.
 * hosts.<name>.id`). Only the names and ids are read: the file's own check validates the rest, and a host
 * chain recurs across groups with the same id (Sepolia is served by the testnet and the devnet gateway).
 */
export function knownHostChains(workspaceRoot: string): ReadonlyMap<string, number> {
  const path = join(workspaceRoot, CHAINS_CONFIG_FILE);
  const chains = new Map<string, number>();
  if (!existsSync(path)) return chains;
  const config = JSON.parse(readFileSync(path, 'utf8')) as {
    readonly networks?: Readonly<
      Record<string, { readonly hosts?: Readonly<Record<string, { readonly id?: number }>> }>
    >;
  };
  for (const group of Object.values(config.networks ?? {})) {
    for (const [name, host] of Object.entries(group.hosts ?? {})) {
      if (typeof host.id === 'number') chains.set(name, host.id);
    }
  }
  return chains;
}

function readJsonObject(path: string): Record<string, unknown> | string {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'is not a JSON object';
    return value as Record<string, unknown>;
  } catch (error) {
    return `is not valid JSON (${(error as Error).message})`;
  }
}

const asObject = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const sha256Of = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

/** The UTC day of a unix timestamp in seconds, as `YYYY-MM-DD`. */
export const utcDay = (seconds: number): string => new Date(seconds * 1000).toISOString().slice(0, 10);

/** Every transaction the journal records with a hash and a block: hash (lower case) -> block. */
function journalBlocks(path: string): ReadonlyMap<string, number> {
  const blocks = new Map<string, number>();
  if (!existsSync(path)) return blocks;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    try {
      const row = asObject(JSON.parse(line));
      if (typeof row?.['hash'] === 'string' && typeof row['block'] === 'number')
        blocks.set(row['hash'].toLowerCase(), row['block']);
    } catch {
      // A torn line is the tool's business (it appends as it goes); the transactions that matter are checked below.
    }
  }
  return blocks;
}

////////////////////////////////////////////////////////////////////////////////
// One record folder
////////////////////////////////////////////////////////////////////////////////

type FolderRole =
  | { readonly type: 'event'; readonly kind: EventKind; readonly seq: number }
  | { readonly type: 'attempt'; readonly kind: EventKind }
  | { readonly type: 'legacy' };

/** What the chain checks need from a folder that passed its own checks far enough to be read. */
type FolderReading = {
  readonly manifestPath: string;
  readonly manifest: Record<string, unknown>;
  readonly config: Record<string, unknown>;
  /** `event.json#defining`, when the folder has a valid one. */
  readonly defining?: { readonly block: number; readonly day: string };
};

type Report = (message: string) => void;

/**
 * The checks every record folder gets, whatever its place in the history: the files are there, agree with each
 * other and with the chain folder, and the tools left no scratch. Returns what the chain checks need, or
 * undefined when the folder is too broken to read further (the reason is already reported).
 */
function inspectFolder(
  dir: string,
  role: FolderRole,
  stack: string,
  chainId: number | undefined,
  fail: Report,
): FolderReading | undefined {
  if (existsSync(join(dir, '.git'))) {
    fail('holds a .git folder: a nested repository is committed as a bare pointer, without its files');
  }

  // The tool commit: the first line, a full sha. Comment lines below it are allowed.
  const toolCommitPath = join(dir, RECORD_TOOL_COMMIT_FILE);
  let toolCommit: string | undefined;
  if (!existsSync(toolCommitPath)) {
    fail(`missing ${RECORD_TOOL_COMMIT_FILE} (the commit of the tool that computed the seal)`);
  } else {
    const first = readFileSync(toolCommitPath, 'utf8').split('\n')[0]?.trim() ?? '';
    if (COMMIT.test(first)) toolCommit = first;
    else fail(`${RECORD_TOOL_COMMIT_FILE}: the first line must be a full 40-hex commit, found '${first}'`);
  }

  const configFile = role.type === 'legacy' ? LEGACY_CONFIG_FILE : configFileOf(role.kind);
  const config = existsSync(join(dir, configFile)) ? readJsonObject(join(dir, configFile)) : 'is missing';
  if (typeof config === 'string') {
    fail(`${configFile} ${config}`);
    return undefined;
  }
  if (config['deploymentId'] !== stack) {
    fail(`${configFile}: deploymentId is '${String(config['deploymentId'])}', the stack is '${stack}'`);
  }

  // The out dir, as the tools resolve it: relative to the config file. It must stay inside the record.
  const outDir = config['outDir'];
  if (typeof outDir !== 'string' || outDir === '' || isAbsolute(outDir)) {
    fail(`${configFile}: outDir must be a relative path inside the record, found ${JSON.stringify(outDir)}`);
    return undefined;
  }
  const out = resolve(dir, outDir);
  const outRelative = relative(dir, out);
  if (outRelative === '' || outRelative.startsWith('..') || isAbsolute(outRelative)) {
    fail(`${configFile}: outDir '${outDir}' leaves the record folder`);
    return undefined;
  }
  if (!isDirectory(out)) {
    fail(`${configFile}: outDir '${outDir}' does not exist`);
    return undefined;
  }
  const shown = toPosix(outRelative);
  const required: string[] = [...RECORD_SEAL_FILES];
  if (role.type === 'event' && role.kind !== 'deploy') required.push(...RECORD_UPGRADE_FILES);
  for (const file of required) {
    if (!existsSync(join(out, file))) fail(`missing ${shown}/${file}`);
  }
  if (role.type === 'attempt' && existsSync(join(out, 'verify-report.json'))) {
    fail(`${shown}/verify-report.json in an aborted attempt: an attempt that verified is an event, not an attempt`);
  }
  for (const scratch of RECORD_SCRATCH) {
    if (existsSync(join(out, scratch))) {
      fail(
        `${shown}/${scratch} is forge scratch: a tool was run inside the record. ` +
          'Delete it, and run the tool from a copy of the folder instead',
      );
    }
  }

  const manifestPath = join(out, 'manifest.json');
  if (!existsSync(manifestPath)) return undefined;
  const manifest = readJsonObject(manifestPath);
  if (typeof manifest === 'string') {
    fail(`manifest.json ${manifest}`);
    return undefined;
  }
  if (manifest['deploymentId'] !== stack) {
    fail(`manifest.json: deploymentId is '${String(manifest['deploymentId'])}', the stack is '${stack}'`);
  }
  if (manifest['simulation'] !== undefined) {
    fail(
      "manifest.json is a fork simulation's seal (`simulation`): its transactions happened on a fork, not on the " +
        'chain. A simulation is never a record; archive the real run',
    );
  }
  if (typeof manifest['toolCommit'] === 'string' && toolCommit !== undefined && manifest['toolCommit'] !== toolCommit) {
    fail(`${RECORD_TOOL_COMMIT_FILE} names ${toolCommit}, the seal was made by ${manifest['toolCommit']}`);
  }
  const admin = config['admin'];
  if (
    typeof admin === 'string' &&
    (typeof manifest['admin'] !== 'string' || manifest['admin'].toLowerCase() !== admin.toLowerCase())
  ) {
    fail(`${configFile}: admin ${admin} differs from the sealed admin ${String(manifest['admin'])}`);
  }
  if (chainId !== undefined && manifest['chainId'] !== chainId) {
    fail(`manifest.json: chainId is ${String(manifest['chainId'])}, but the chain folder is chain ${chainId}`);
  }

  // event.json: the legacy flat record predates it, and so does a deploy relocated from one (§ legacy tolerance).
  const eventPath = join(out, RECORD_EVENT_FILE);
  if (!existsSync(eventPath)) {
    if (role.type === 'legacy' || (role.type === 'event' && role.kind === 'deploy')) {
      return { manifestPath, manifest, config };
    }
    fail(`missing ${shown}/${RECORD_EVENT_FILE} (the transactions that date the record, written by the tool)`);
    return { manifestPath, manifest, config };
  }
  const defining = inspectEventFile(eventPath, join(out, 'journal.jsonl'), role, `${shown}/${RECORD_EVENT_FILE}`, fail);
  return { manifestPath, manifest, config, ...(defining === undefined ? {} : { defining }) };
}

/** `event.json`: its kind, its three transactions, all in the journal at the blocks it claims. */
function inspectEventFile(
  path: string,
  journalPath: string,
  role: FolderRole,
  shown: string,
  fail: Report,
): { readonly block: number; readonly day: string } | undefined {
  const event = readJsonObject(path);
  if (typeof event === 'string') {
    fail(`${shown} ${event}`);
    return undefined;
  }
  const expectedKind = role.type === 'attempt' ? 'aborted' : role.type === 'event' ? role.kind : 'deploy';
  if (event['kind'] !== expectedKind) fail(`${shown}: kind is '${String(event['kind'])}', expected '${expectedKind}'`);

  const journal = journalBlocks(journalPath);
  const txs: Record<string, { hash: string; block: number; blockTimestamp: number }> = {};
  for (const name of ['defining', 'first', 'last'] as const) {
    const tx = asObject(event[name]);
    const hash = tx?.['hash'];
    const block = tx?.['block'];
    const blockTimestamp = tx?.['blockTimestamp'];
    if (
      typeof hash !== 'string' ||
      !TX_HASH.test(hash) ||
      !Number.isSafeInteger(block) ||
      !Number.isSafeInteger(blockTimestamp)
    ) {
      fail(`${shown}: '${name}' must be { hash: 0x + 64 hex, block: integer, blockTimestamp: integer seconds }`);
      return undefined;
    }
    txs[name] = { hash, block: block as number, blockTimestamp: blockTimestamp as number };
    const recorded = journal.get(hash.toLowerCase());
    if (recorded === undefined) fail(`${shown}: the '${name}' transaction ${hash} is not in journal.jsonl`);
    else if (recorded !== block)
      fail(`${shown}: '${name}' says block ${String(block)}, journal.jsonl says ${recorded}`);
  }
  const { defining, first, last } = txs as Record<
    'defining' | 'first' | 'last',
    { hash: string; block: number; blockTimestamp: number }
  >;
  if (!(first.block <= defining.block && defining.block <= last.block)) {
    fail(
      `${shown}: blocks must satisfy first (${first.block}) <= defining (${defining.block}) <= last (${last.block})`,
    );
  }
  if (role.type === 'attempt' && defining.hash.toLowerCase() !== first.hash.toLowerCase()) {
    fail(`${shown}: an attempt is dated by its first transaction, so 'defining' must be 'first'`);
  }
  if (role.type === 'event' && role.kind === 'deploy' && defining.hash.toLowerCase() !== last.hash.toLowerCase()) {
    fail(`${shown}: a deploy is dated by its last transaction, so 'defining' must be 'last'`);
  }
  return { block: defining.block, day: utcDay(defining.blockTimestamp) };
}

////////////////////////////////////////////////////////////////////////////////
// One stack: its events in order, its attempts
////////////////////////////////////////////////////////////////////////////////

type ParsedEvent = {
  readonly name: string;
  readonly seq: number;
  readonly kind: EventKind;
  readonly generation: number;
  readonly patch: number;
  readonly day: string;
};

function parseEvent(name: string): ParsedEvent | undefined {
  const m = EVENT_NAME.exec(name);
  if (m === null) return undefined;
  return {
    name,
    seq: Number(m[1]),
    kind: m[2] as EventKind,
    generation: Number(m[3]),
    patch: Number(m[4]),
    day: m[5] ?? '',
  };
}

/** The manifest's own versions agree with the folder name. A legacy deploy may lack `packageVersion`. */
function checkVersions(manifest: Record<string, unknown>, event: ParsedEvent, fail: Report): void {
  const generation = GENERATION.exec(String(manifest['version']));
  if (generation === null || Number(generation[1]) !== event.generation) {
    fail(
      `manifest.json: version is '${String(manifest['version'])}', the folder name says generation v${event.generation}`,
    );
  }
  const packageVersion = manifest['packageVersion'];
  if (packageVersion === undefined) {
    if (event.kind !== 'deploy') fail('manifest.json: packageVersion is missing');
    return;
  }
  const parsed = PACKAGE_VERSION.exec(String(packageVersion));
  if (parsed === null || Number(parsed[1]) !== event.generation || Number(parsed[2]) !== event.patch) {
    fail(
      `manifest.json: packageVersion is '${String(packageVersion)}', the folder name says ` +
        `v${event.generation}.${event.patch}`,
    );
  }
}

/** What a manifest's `previous` must say about the record it starts from. */
function checkPrevious(
  reading: FolderReading,
  target: { readonly reading: FolderReading; readonly event?: ParsedEvent },
  stack: string,
  fail: Report,
): void {
  const previous = asObject(reading.manifest['previous']);
  if (previous === undefined) {
    fail('manifest.json: previous is missing (the path and sha256 of the record this one starts from)');
    return;
  }
  const path = previous['path'];
  if (typeof path !== 'string' || isAbsolute(path)) {
    fail(`manifest.json: previous.path must be a relative path, found ${JSON.stringify(path)}`);
    return;
  }
  if (resolve(dirname(reading.manifestPath), path) !== target.reading.manifestPath) {
    fail(`manifest.json: previous.path '${path}' does not resolve to the manifest of the record before it`);
    return;
  }
  const configured = reading.config['previousManifest'];
  if (configured !== undefined && configured !== path) {
    fail(`the config's previousManifest '${String(configured)}' differs from the sealed previous.path '${path}'`);
  }
  const sha = previous['sha256'];
  if (typeof sha !== 'string' || !SHA256.test(sha)) {
    fail(`manifest.json: previous.sha256 must be 64 lower-case hex, found ${JSON.stringify(sha)}`);
  } else if (sha !== sha256Of(target.reading.manifestPath)) {
    fail(`manifest.json: previous.sha256 does not match the bytes of ${path}: the record it starts from changed`);
  }
  const before = target.reading.manifest;
  if (previous['deploymentId'] !== stack) {
    fail(`manifest.json: previous.deploymentId is '${String(previous['deploymentId'])}', the stack is '${stack}'`);
  }
  for (const field of ['chainId', 'version'] as const) {
    if (previous[field] !== before[field]) {
      fail(
        `manifest.json: previous.${field} is ${JSON.stringify(previous[field])}, that record says ${JSON.stringify(before[field])}`,
      );
    }
  }
  // A legacy deploy's manifest has no packageVersion: its folder name stands for it.
  const beforePackage =
    before['packageVersion'] ??
    (target.event === undefined ? undefined : `0.${target.event.generation}.${target.event.patch}`);
  if (previous['packageVersion'] !== beforePackage) {
    fail(
      `manifest.json: previous.packageVersion is ${JSON.stringify(previous['packageVersion'])}, ` +
        `that record is ${JSON.stringify(beforePackage)}`,
    );
  }
}

function inspectStack(
  workspaceRoot: string,
  chain: string,
  stack: string,
  chainId: number | undefined,
  violations: Violation[],
  notes: string[],
  checked: string[],
): void {
  const stackDir = join(workspaceRoot, DEPLOYMENTS_DIR, chain, stack);
  const stackKey = keyOf(workspaceRoot, stackDir);
  const failAt =
    (key: string): Report =>
    (message) => {
      violations.push({ rule: RULE, packageKey: key, message });
    };
  const failStack = failAt(stackKey);
  const entries = readdirSync(stackDir).sort();

  // The layout before events had folders: the stack folder IS the deploy record.
  if (entries.includes(LEGACY_CONFIG_FILE)) {
    checked.push(stackKey);
    const events = entries.filter((entry) => EVENT_NAME.test(entry) || entry === ABORTED_DIR);
    if (events.length > 0) {
      failStack(`mixes a legacy flat record with event folders (${events.join(', ')}): relocate the flat record first`);
    }
    inspectFolder(stackDir, { type: 'legacy' }, stack, chainId, failStack);
    notes.push(
      `${stackKey} is a legacy flat record: relocate it, as a pure move, into ${stackKey}/00-deploy-v<N>.<p>-<YYYY-MM-DD>/ ` +
        "(the date is the UTC day of the deploy's last transaction's block)",
    );
    return;
  }

  const events: ParsedEvent[] = [];
  for (const entry of entries) {
    const path = join(stackDir, entry);
    if (entry === README_FILE && !isDirectory(path)) continue;
    if (entry === ABORTED_DIR && isDirectory(path)) continue;
    const event = isDirectory(path) ? parseEvent(entry) : undefined;
    if (event === undefined) {
      failStack(
        `'${entry}' is not an event folder (<seq>-<deploy|upgrade|hotfix>-v<N>.<p>-<YYYY-MM-DD>), '${ABORTED_DIR}/' or ${README_FILE}`,
      );
      continue;
    }
    events.push(event);
  }
  events.sort((a, b) => a.seq - b.seq);

  // The sequence: 00 is the one deploy, then contiguous, no duplicates.
  if (events.length === 0) failStack('holds no event folder: a stack starts with 00-deploy-…');
  events.forEach((event, index) => {
    if (event.seq !== index) {
      failStack(
        `event '${event.name}' has sequence ${event.seq}, expected ${index}: the sequence is contiguous from 00`,
      );
    }
    if ((index === 0) !== (event.kind === 'deploy')) {
      failStack(
        index === 0
          ? `the first event is '${event.name}', not a deploy`
          : `'${event.name}': a stack has exactly one deploy`,
      );
    }
  });

  // Each event on its own, then against the one before it.
  const readings: (FolderReading | undefined)[] = [];
  events.forEach((event, index) => {
    const dir = join(stackDir, event.name);
    const key = keyOf(workspaceRoot, dir);
    checked.push(key);
    const fail = failAt(key);
    const reading = inspectFolder(dir, { type: 'event', kind: event.kind, seq: event.seq }, stack, chainId, fail);
    readings.push(reading);
    if (reading === undefined) return;

    checkVersions(reading.manifest, event, fail);
    if (reading.defining !== undefined && reading.defining.day !== event.day) {
      fail(`the folder is dated ${event.day}, its defining transaction's block is from ${reading.defining.day} (UTC)`);
    }

    const before = events[index - 1];
    if (before === undefined) {
      if (reading.manifest['previous'] !== undefined)
        fail('manifest.json: a deploy starts nothing, so it has no previous');
      return;
    }
    if (event.kind === 'upgrade' && event.generation !== before.generation + 1) {
      fail(`an upgrade moves exactly one generation up: v${before.generation} -> v${event.generation}`);
    }
    if (event.kind === 'hotfix' && (event.generation !== before.generation || event.patch <= before.patch)) {
      fail(
        `a hotfix stays in its generation with a higher patch: v${before.generation}.${before.patch} -> ` +
          `v${event.generation}.${event.patch}`,
      );
    }
    if (event.day < before.day) fail(`dated ${event.day}, before the event it follows (${before.day})`);
    const beforeReading = readings[index - 1];
    if (beforeReading === undefined) {
      fail(`cannot check the link to '${before.name}': that record is unreadable`);
      return;
    }
    checkPrevious(reading, { reading: beforeReading, event: before }, stack, fail);
    if (
      reading.defining !== undefined &&
      beforeReading.defining !== undefined &&
      reading.defining.block <= beforeReading.defining.block
    ) {
      fail(
        `its defining transaction (block ${reading.defining.block}) is not after '${before.name}''s (block ${beforeReading.defining.block})`,
      );
    }
  });

  // Attempts: outside the sequence, never a previous, but linked to the event they started from.
  const abortedDir = join(stackDir, ABORTED_DIR);
  if (!isDirectory(abortedDir)) return;
  for (const entry of readdirSync(abortedDir).sort()) {
    const dir = join(abortedDir, entry);
    if (entry === README_FILE && !isDirectory(dir)) continue;
    const m = isDirectory(dir) ? ATTEMPT_NAME.exec(entry) : null;
    if (m === null) {
      failStack(
        `'${ABORTED_DIR}/${entry}' is not an attempt folder (<YYYY-MM-DD>-<kind>-v<N>.<p>-<n>) or ${README_FILE}`,
      );
      continue;
    }
    const key = keyOf(workspaceRoot, dir);
    checked.push(key);
    const fail = failAt(key);
    const kind = m[2] as EventKind;
    const reading = inspectFolder(dir, { type: 'attempt', kind }, stack, chainId, fail);
    if (reading === undefined) continue;
    if (reading.defining !== undefined && reading.defining.day !== m[1]) {
      fail(`the folder is dated ${m[1] ?? ''}, its first transaction's block is from ${reading.defining.day} (UTC)`);
    }
    if (kind === 'deploy') {
      if (reading.manifest['previous'] !== undefined)
        fail('manifest.json: a deploy attempt starts nothing, so it has no previous');
      continue;
    }
    const path = asObject(reading.manifest['previous'])?.['path'];
    const target =
      typeof path === 'string'
        ? events.findIndex((_, i) => readings[i]?.manifestPath === resolve(dirname(reading.manifestPath), path))
        : -1;
    const targetReading = target < 0 ? undefined : readings[target];
    if (targetReading === undefined) {
      fail(`manifest.json: previous.path ${JSON.stringify(path)} does not resolve to an event of this stack`);
      continue;
    }
    checkPrevious(
      reading,
      { reading: targetReading, ...(events[target] === undefined ? {} : { event: events[target] }) },
      stack,
      fail,
    );
  }
}

/** Consistency of every record on disk. Needs no git. */
export function inspectDeploymentRecords(workspaceRoot: string): DeploymentsInspection {
  const violations: Violation[] = [];
  const notes: string[] = [];
  const checked: string[] = [];
  const root = join(workspaceRoot, DEPLOYMENTS_DIR);
  if (!isDirectory(root)) return { checkedRecordKeys: [], violations };
  const chains = knownHostChains(workspaceRoot);

  for (const chain of readdirSync(root).sort()) {
    const chainDir = join(root, chain);
    if (!isDirectory(chainDir)) continue;
    const chainId = chains.get(chain);
    if (chainId === undefined) {
      violations.push({
        rule: RULE,
        packageKey: keyOf(workspaceRoot, chainDir),
        message:
          `the chain folder '${chain}' is not a host chain of ${CHAINS_CONFIG_FILE}` +
          (chains.size > 0 ? ` (known: ${[...chains.keys()].sort().join(', ')})` : ''),
      });
    }
    for (const stack of readdirSync(chainDir).sort()) {
      if (isDirectory(join(chainDir, stack))) {
        inspectStack(workspaceRoot, chain, stack, chainId, violations, notes, checked);
      } else if (stack !== README_FILE) {
        violations.push({
          rule: RULE,
          packageKey: keyOf(workspaceRoot, chainDir),
          message: `'${stack}' is neither a stack folder nor ${README_FILE}`,
        });
      }
    }
  }

  return { checkedRecordKeys: checked, violations, ...(notes.length > 0 ? { notes } : {}) };
}

////////////////////////////////////////////////////////////////////////////////
// Frozen records, against a base
////////////////////////////////////////////////////////////////////////////////

export type DeploymentsChange = {
  /** git's status letter, with its score for a rename (`R100`). */
  readonly status: string;
  /** The path in the worktree (for a rename, where it went). */
  readonly path: string;
  /** For a rename: where it came from. */
  readonly from?: string;
};

/** Git, from the workspace root; injectable so tests can drive it without a network. */
export type DeploymentsGit = {
  /** The commit both sides share, or a thrown error when `base` cannot be resolved. */
  readonly mergeBase: (base: string) => string;
  /** Every file under deployments/ at `revision`, workspace-relative. */
  readonly filesAt: (revision: string) => readonly string[];
  /** Every file under deployments/ that differs between `revision` and the worktree; exact renames detected. */
  readonly changesSince: (revision: string) => readonly DeploymentsChange[];
};

export function realDeploymentsGit(workspaceRoot: string): DeploymentsGit {
  const git = (args: readonly string[]): string =>
    execFileSync('git', [...args], { cwd: workspaceRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    mergeBase: (base) => git(['merge-base', base, 'HEAD']).trim(),
    filesAt: (revision) =>
      git(['ls-tree', '-r', '-z', '--name-only', revision, '--', DEPLOYMENTS_DIR]).split('\0').filter(Boolean),
    // Against the worktree, not HEAD: an uncommitted edit of a record is caught locally too. Untracked
    // files are not listed, and need not be: a new file is an addition, judged the same once committed.
    // Renames are detected only at 100% similarity: the relocation is accepted as a pure move and nothing else.
    changesSince: (revision) => {
      const fields = git(['diff', '--name-status', '-M100%', '-z', '--relative', revision, '--', DEPLOYMENTS_DIR])
        .split('\0')
        .filter(Boolean);
      const changes: DeploymentsChange[] = [];
      for (let i = 0; i < fields.length;) {
        const status = fields[i] ?? '';
        if (status.startsWith('R') || status.startsWith('C')) {
          changes.push({ status, from: fields[i + 1] ?? '', path: fields[i + 2] ?? '' });
          i += 3;
        } else {
          changes.push({ status, path: fields[i + 1] ?? '' });
          i += 2;
        }
      }
      return changes;
    },
  };
}

/**
 * The record a path belongs to, given the stacks that are legacy flat records: `deployments/<chain>/<stack>` for
 * those, `deployments/<chain>/<stack>/<event>` or `…/aborted/<attempt>` otherwise; undefined for anything above a
 * record (a README at the top, chain or stack level).
 */
export function recordFolderOf(path: string, legacyStacks: ReadonlySet<string> = new Set()): string | undefined {
  const parts = path.split('/');
  if (parts[0] !== DEPLOYMENTS_DIR || parts.length < 4) return undefined;
  const stack = parts.slice(0, 3).join('/');
  if (legacyStacks.has(stack)) return stack;
  if (parts[3] === ABORTED_DIR) return parts.length >= 6 ? parts.slice(0, 5).join('/') : undefined;
  return parts.length >= 5 ? parts.slice(0, 4).join('/') : undefined;
}

const STATUS_WORDS: Readonly<Record<string, string>> = {
  A: 'added to',
  M: 'modified in',
  D: 'deleted from',
  T: 'changed type in',
  R: 'renamed in',
  C: 'copied in',
};

const FROZEN_HINT = 'A record never changes after it lands; record a later on-chain event in a new folder';

/**
 * The one exception to frozen records: a legacy flat record relocated into `<stack>/00-deploy-…/`. Accepted only
 * when EVERY file of the flat record is renamed, byte for byte (R100), to the same relative path under one
 * `00-deploy-*` folder, and nothing is added to that folder. New event folders beside it are not this record.
 */
function inspectRelocation(
  stack: string,
  baseFiles: readonly string[],
  changes: readonly DeploymentsChange[],
  fail: Report,
): void {
  const moved = changes.filter((change) => change.from?.startsWith(`${stack}/`) === true);
  const touchingBase = changes.filter((change) => change.from === undefined && baseFiles.includes(change.path));
  if (moved.length === 0) {
    for (const change of touchingBase) {
      fail(
        `${change.path.slice(stack.length + 1)} ${STATUS_WORDS[change.status.charAt(0)] ?? 'changed in'} a frozen record. ${FROZEN_HINT}`,
      );
    }
    for (const change of changes) {
      if (change.from !== undefined || baseFiles.includes(change.path)) continue;
      const rest = change.path.slice(stack.length + 1).split('/');
      const isNewRecord = rest.length > 1 && (EVENT_NAME.test(rest[0] ?? '') || rest[0] === ABORTED_DIR);
      if (!isNewRecord && rest.join('/') !== README_FILE) {
        fail(`${rest.join('/')} added to a frozen record. ${FROZEN_HINT}`);
      }
    }
    return;
  }

  const targets = new Set<string>();
  for (const change of moved) {
    const from = (change.from ?? '').slice(stack.length + 1);
    const to = change.path.startsWith(`${stack}/`) ? change.path.slice(stack.length + 1) : change.path;
    const [target, ...rest] = to.split('/');
    const event = target === undefined ? undefined : parseEvent(target);
    if (
      change.status !== 'R100' ||
      event === undefined ||
      event.seq !== 0 ||
      event.kind !== 'deploy' ||
      rest.join('/') !== from
    ) {
      fail(
        `${from} -> ${to}: a legacy flat record may only move, byte for byte, to the same path under ` +
          `00-deploy-v<N>.<p>-<YYYY-MM-DD>/`,
      );
      continue;
    }
    targets.add(target ?? '');
  }
  if (targets.size > 1)
    fail(`the flat record is split across ${[...targets].sort().join(', ')}: move it into one folder`);
  const movedFrom = new Set(moved.map((change) => change.from));
  for (const file of baseFiles) {
    if (!movedFrom.has(file)) fail(`${file.slice(stack.length + 1)} was left behind: relocate the whole flat record`);
  }
  for (const change of touchingBase) {
    fail(
      `${change.path.slice(stack.length + 1)} ${STATUS_WORDS[change.status.charAt(0)] ?? 'changed in'} a relocated record. ${FROZEN_HINT}`,
    );
  }
  for (const change of changes) {
    if (change.from !== undefined || baseFiles.includes(change.path)) continue;
    const [first] = change.path.slice(stack.length + 1).split('/');
    if (first !== undefined && targets.has(first)) {
      fail(
        `${change.path.slice(stack.length + 1)} added to a relocated record: a relocation adds nothing. ${FROZEN_HINT}`,
      );
    }
  }
}

/** Frozen records: nothing under a record that exists at the merge base with `base` may change. */
export function inspectFrozenRecords(
  base: string,
  git: DeploymentsGit,
): DeploymentsInspection & { readonly mergeBase: string } {
  let mergeBase: string;
  try {
    mergeBase = git.mergeBase(base);
  } catch (error) {
    // A check that cannot find its base must not pass: in CI that is a shallow checkout, not a clean record.
    throw new Error(
      `check deployments: cannot find the merge base of '${base}' and HEAD (${(error as Error).message.trim()}). ` +
        'Fetch the base ref, or check out with full history (fetch-depth: 0).',
    );
  }

  const baseFiles = git.filesAt(mergeBase);
  const legacyStacks = new Set(
    baseFiles
      .filter((path) => path.split('/').length === 4 && path.endsWith(`/${LEGACY_CONFIG_FILE}`))
      .map((path) => path.split('/').slice(0, 3).join('/')),
  );
  const frozen = new Set(
    baseFiles.map((path) => recordFolderOf(path, legacyStacks)).filter((folder) => folder !== undefined),
  );
  const changes = git.changesSince(mergeBase);
  const violations: Violation[] = [];

  for (const stack of [...legacyStacks].sort()) {
    inspectRelocation(
      stack,
      baseFiles.filter((path) => path.startsWith(`${stack}/`)),
      changes.filter((change) => change.path.startsWith(`${stack}/`) || change.from?.startsWith(`${stack}/`) === true),
      (message) => {
        violations.push({ rule: RULE, packageKey: `./${stack}`, message });
      },
    );
  }

  for (const change of changes) {
    for (const path of change.from === undefined ? [change.path] : [change.from, change.path]) {
      const folder = recordFolderOf(path);
      if (folder === undefined || !frozen.has(folder) || legacyStacks.has(path.split('/').slice(0, 3).join('/')))
        continue;
      const word = STATUS_WORDS[change.status.charAt(0)] ?? `changed (${change.status}) in`;
      violations.push({
        rule: RULE,
        packageKey: `./${folder}`,
        message: `${path.slice(folder.length + 1)} ${word} a frozen record. ${FROZEN_HINT}`,
      });
      break;
    }
  }
  return { checkedRecordKeys: [...frozen].sort().map((folder) => `./${folder}`), violations, mergeBase };
}
