// `sync pinned`: copy npm-manifest.json#dependencies.pinned into every package.json that declares a pinned
// package. The manifest is the authority (rule 3.3.4); this command makes the tree agree with it, so moving a
// pin is one edit of the manifest followed by one command, instead of a hand edit of every package.json.
//
// It walks exactly what `check pinned-dependencies` walks — the same packages, the same dependency fields — so
// after a sync the package.json half of that check passes by construction. Lockfiles are deliberately left
// alone: they are npm's output, and only npm may regenerate them (`make install`, then the consumer-lock
// regeneration). Until then the check keeps reporting them as stale, which is correct.
//
// Each file is edited as text, one spec string at a time, never re-serialized: formatting, key order and every
// other entry stay byte for byte. The result is then proven: parsed, it differs from the original in the
// planned specs and nowhere else.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { NpmManifest } from '../manifest.ts';
import { packageJsonKey } from './checks/package-names.ts';
import { type DependencyField, type LoadedPackage, declarationsByName } from './npm.ts';

export type PinnedEdit = {
  readonly file: string;
  readonly packageKey: string;
  readonly field: DependencyField;
  readonly name: string;
  readonly from: string;
  readonly to: string;
};

/** Every declaration of a pinned package whose spec differs from the pin, in package then field order. */
export function planPinnedSync(manifest: NpmManifest, packages: readonly LoadedPackage[]): readonly PinnedEdit[] {
  const pinned = Object.entries(manifest.dependencies?.pinned ?? {});
  const edits: PinnedEdit[] = [];
  for (const pkg of packages) {
    const declared = declarationsByName(pkg.packageJson);
    for (const [name, pin] of pinned) {
      for (const declaration of declared.get(name) ?? []) {
        if (declaration.spec === pin) continue;
        edits.push({
          file: join(pkg.directory, 'package.json'),
          packageKey: packageJsonKey(pkg),
          field: declaration.field,
          name,
          from: declaration.spec,
          to: pin,
        });
      }
    }
  }
  return edits;
}

/**
 * Pure: package.json text in, the same text with each edit's spec replaced out. Each edit must find exactly
 * one `"<name>": "<from>"` line inside its field's block; anything else is refused rather than guessed.
 */
export function renderPinnedEdits(file: string, text: string, edits: readonly PinnedEdit[]): string {
  const lines = text.split('\n');
  for (const edit of edits) {
    const opening = new RegExp(`^(\\s*)${escapeRegExp(JSON.stringify(edit.field))}:\\s*\\{\\s*$`);
    const starts = lines.flatMap((line, index) => (opening.test(line) ? [index] : []));
    if (starts.length !== 1) {
      throw new Error(`${file}: expected exactly one "${edit.field}" block, found ${String(starts.length)}`);
    }
    const start = starts[0] ?? 0;
    const indent = opening.exec(lines[start] ?? '')?.[1] ?? '';
    const end = lines.findIndex((line, index) => index > start && line.startsWith(`${indent}}`));
    const entry = new RegExp(
      `^(\\s*${escapeRegExp(JSON.stringify(edit.name))}:\\s*)${escapeRegExp(JSON.stringify(edit.from))}(,?\\s*)$`,
    );
    const hits = lines.flatMap((line, index) => (index > start && index < end && entry.test(line) ? [index] : []));
    const hit = hits[0];
    if (end === -1 || hits.length !== 1 || hit === undefined) {
      throw new Error(
        `${file}: expected exactly one "${edit.name}": "${edit.from}" in "${edit.field}", found ${String(hits.length)}`,
      );
    }
    lines[hit] = (lines[hit] ?? '').replace(entry, `$1${JSON.stringify(edit.to)}$2`);
  }
  const updated = lines.join('\n');

  // The proof: parsed, the result is the original with exactly the planned specs changed.
  const expected = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
  for (const edit of edits) {
    const block = expected[edit.field];
    if (block !== undefined) block[edit.name] = edit.to;
  }
  if (JSON.stringify(JSON.parse(updated)) !== JSON.stringify(expected)) {
    throw new Error(`${file}: rewriting the pinned specs would change more than those specs; nothing written`);
  }
  return updated;
}

/** Applies the plan file by file. Every file is rendered and proven before the first one is written. */
export function applyPinnedEdits(edits: readonly PinnedEdit[]): void {
  const byFile = new Map<string, PinnedEdit[]>();
  for (const edit of edits) byFile.set(edit.file, [...(byFile.get(edit.file) ?? []), edit]);
  const rendered = [...byFile].map(([file, fileEdits]) => {
    const text = readFileSync(file, 'utf8');
    return { file, text: renderPinnedEdits(file, text, fileEdits) };
  });
  for (const { file, text } of rendered) writeFileSync(file, text);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
