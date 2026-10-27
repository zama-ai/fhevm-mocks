// What the create2 coordinators stamp into a record so that `fhevm-npm check deployments` can place it in its
// stack's history: the `previous` link (path as the record will be archived, sha256 of the exact bytes) and the
// event record (the transactions that date it). No chain, no forge: the two functions are pure apart from files.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  eventRecord,
  previousLink,
  PROXY_ROLES,
  recordedImplementations,
  type JournalEntry,
} from '../create2-deploy/ts/common.ts';
import { PACKAGE_ROOT_ABS_PATH } from '../internal/constants.ts';

const STACK = 'cleartext-v13-sepolia-2026-10-05-1';

function scratch(t: test.TestContext): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'create2-record-')));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function writeManifest(path: string, manifest: Record<string, unknown>): string {
  mkdirSync(resolve(path, '..'), { recursive: true });
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(path, text);
  return text;
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

void test('previous: a manifest in an event folder is linked as the new record will be archived', (t) => {
  const root = scratch(t);
  const previous = join(
    root,
    'repo/deployments/ethereum_sepolia',
    STACK,
    '00-deploy-v13.0-2026-10-05/record/manifest.json',
  );
  const text = writeManifest(previous, { deploymentId: STACK, chainId: 11155111, version: '0.13' });
  // The operator works far from the repository; the record will land next to the previous event.
  const operator = join(root, 'ops/01-upgrade-v14.0-2026-11-02');

  const link = previousLink(previous, join(operator, 'record'), operator);
  assert.deepEqual(link, {
    path: '../../00-deploy-v13.0-2026-10-05/record/manifest.json',
    sha256: sha256(text),
    deploymentId: STACK,
    chainId: 11155111,
    version: '0.13',
    // The legacy deploy has no packageVersion: the folder name stands for it.
    packageVersion: '0.13.0',
  });

  // A manifest that carries its own packageVersion wins over the folder name.
  writeManifest(previous, { deploymentId: STACK, chainId: 11155111, version: '0.13', packageVersion: '0.13.4' });
  assert.equal(previousLink(previous, join(operator, 'record'), operator).packageVersion, '0.13.4');

  // A deeper out dir needs one more step up.
  assert.equal(
    previousLink(previous, join(operator, 'out/record'), operator).path,
    '../../../00-deploy-v13.0-2026-10-05/record/manifest.json',
  );
});

void test('previous: anywhere else, the plain relative path from the out dir', (t) => {
  const root = scratch(t);
  const previous = join(root, 'v13/create2-deploy/.out/manifest.json');
  writeManifest(previous, { deploymentId: 'e2e', chainId: 31337, version: '0.13' });
  const outDir = join(root, 'operator/out');
  const link = previousLink(previous, outDir, join(root, 'operator'));
  assert.equal(link.path, '../../v13/create2-deploy/.out/manifest.json');
  assert.equal(link.packageVersion, undefined);
  // No config folder known: the same fallback.
  assert.equal(previousLink(previous, outDir, null).path, '../../v13/create2-deploy/.out/manifest.json');
});

const tx = (hash: number, block: number | null, status: JournalEntry['status'] = 'ok'): JournalEntry => ({
  kind: 'tx',
  stage: 'x',
  hash: `0x${hash.toString(16).padStart(64, '0')}`,
  block,
  status,
});
const timestamps = (block: number): number => 1_790_000_000 + block;

void test('event record: first and last mined transactions, and the defining one per kind', () => {
  const journal = [tx(1, 10), tx(2, 12), tx(3, 11), tx(4, null, 'unmined'), tx(5, 13, 'REVERTED'), tx(6, 12)];
  const at = (hash: number, block: number) => ({
    hash: `0x${hash.toString(16).padStart(64, '0')}`,
    block,
    blockTimestamp: timestamps(block),
  });

  // A deploy is dated by its last transaction; ties in a block keep the journal's order.
  assert.deepEqual(eventRecord('deploy', journal, null, timestamps), {
    kind: 'deploy',
    defining: at(6, 12),
    first: at(1, 10),
    last: at(6, 12),
  });
  // An upgrade by its ACLOwner.upgrade, whatever its place.
  const upgrade = eventRecord(
    'upgrade',
    journal,
    tx(3, 11).hash?.toUpperCase().replace('0X', '0x') ?? null,
    timestamps,
  );
  assert.notEqual(typeof upgrade, 'string');
  if (typeof upgrade !== 'string') assert.deepEqual(upgrade.defining, at(3, 11));
  // An attempt by its first transaction.
  const aborted = eventRecord('aborted', journal, null, timestamps);
  if (typeof aborted !== 'string') assert.deepEqual(aborted.defining, at(1, 10));
});

/** The refusal reason, or a marker that would fail every match when a record was built instead. */
const reason = (result: ReturnType<typeof eventRecord>): string => (typeof result === 'string' ? result : '(built)');

void test('event record: refused rather than guessed', () => {
  assert.equal(
    eventRecord('deploy', [tx(4, null, 'unmined')], null, timestamps),
    'the journal holds no mined transaction (1 unmined (no block))',
  );
  assert.match(
    reason(eventRecord('upgrade', [tx(1, 10)], tx(9, 99).hash, timestamps)),
    /defining transaction 0x0+9 is not in the journal/,
  );
  assert.match(
    reason(eventRecord('deploy', [tx(1, 10)], null, () => null)),
    /did not return the timestamp of block 10/,
  );
});

void test('recorded implementations: a deploy seals every proxy, an upgrade keeps what it left alone', () => {
  const a = (n: number): string => `0x${n.toString(16).padStart(40, '0')}`;
  const deploy = { address: Object.fromEntries(PROXY_ROLES.map((role, i) => [`IMPL_${role}`, a(i + 1)])) };
  assert.deepEqual(recordedImplementations(deploy), Object.fromEntries(PROXY_ROLES.map((role, i) => [role, a(i + 1)])));
  // An upgrade re-points ACL only; the others are what it found live.
  const upgrade = {
    address: { IMPL_ACL_ADDRESS: a(100).toUpperCase().replace('0X', '0x'), ACL_ADDRESS: a(200) },
    preUpgrade: { implementation: { ACL_ADDRESS: a(1), CLEARTEXT_DB_ADDRESS: a(9), JUNK: 'x' } },
  };
  assert.deepEqual(recordedImplementations(upgrade), { ACL_ADDRESS: a(100), CLEARTEXT_DB_ADDRESS: a(9) });
  assert.deepEqual(recordedImplementations({}), {});
});

void test('the archived Sepolia deploy record names the implementation of every proxy', () => {
  const path = join(
    PACKAGE_ROOT_ABS_PATH,
    '../../deployments/ethereum_sepolia/cleartext-v13-sepolia-2026-10-05-1/00-deploy-v13.0-2026-10-05/record/manifest.json',
  );
  const recorded = recordedImplementations(JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>);
  // A v13 stack predates both v15 additions: every proxy of this generation but those two.
  const v13Roles = PROXY_ROLES.filter(
    (role) => role !== 'PADDED_INPUTTER_ADDRESS' && role !== 'PROTOCOL_CONFIG_REPLICA_ADDRESS',
  );
  assert.deepEqual(Object.keys(recorded).sort(), [...v13Roles].sort());
});
