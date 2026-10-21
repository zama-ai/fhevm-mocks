// What every e2e that runs a create2 coordinator checks about the record it produced: the seal names the package
// version the tool ran at, and `event.json` dates the record by transactions that are in the journal, at the
// blocks it claims. The same properties `fhevm-npm check deployments` enforces once the record is archived.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Tx = { readonly hash: string; readonly block: number; readonly blockTimestamp: number };
export type EventRecordFile = { readonly kind: string; readonly defining: Tx; readonly first: Tx; readonly last: Tx };

/** The sealed manifest of an out dir, as JSON. */
export function sealedManifest(outDir: string): Record<string, unknown> {
  const path = join(outDir, 'manifest.json');
  assert.ok(existsSync(path), `no manifest sealed at ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

/** Asserts the seal and `event.json` of `outDir`, made by the package at `packageRoot`; returns the event record. */
export function assertStampedRecord(outDir: string, packageRoot: string, kind: string): EventRecordFile {
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'pkg', 'package.json'), 'utf8')) as { version: string };
  assert.equal(sealedManifest(outDir).packageVersion, pkg.version, 'the seal names the package version');

  const path = join(outDir, 'event.json');
  assert.ok(existsSync(path), `no ${path}: the record is not dated`);
  const event = JSON.parse(readFileSync(path, 'utf8')) as EventRecordFile;
  assert.equal(event.kind, kind);

  const journal = new Map<string, number>();
  for (const line of readFileSync(join(outDir, 'journal.jsonl'), 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    const row = JSON.parse(line) as { hash?: unknown; block?: unknown };
    if (typeof row.hash === 'string' && typeof row.block === 'number') journal.set(row.hash.toLowerCase(), row.block);
  }
  for (const name of ['defining', 'first', 'last'] as const) {
    const tx = event[name];
    assert.equal(journal.get(tx.hash.toLowerCase()), tx.block, `event.json's ${name} is in the journal at its block`);
    assert.ok(Number.isSafeInteger(tx.blockTimestamp) && tx.blockTimestamp > 0, `${name} has a block timestamp`);
  }
  assert.ok(event.first.block <= event.defining.block && event.defining.block <= event.last.block, 'blocks in order');
  if (kind === 'deploy')
    assert.equal(event.defining.hash, event.last.hash, 'a deploy is dated by its last transaction');
  return event;
}
