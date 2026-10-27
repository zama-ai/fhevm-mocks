// `sync pinned`: copy npm-manifest.json#dependencies.pinned into every package.json that declares a pinned
// package. The manifest is the authority (rule 3.3.4); this command makes the tree agree with it, so moving a
// pin is one edit of the manifest followed by one command, instead of a hand edit of every package.json.
//
// A pin that is BEHIND what the lockfiles resolve is raised first: when any lockfile resolves a newer version than
// the pin names (a root locked after a release), the manifest pin moves up to it — the operator and an alias prefix
// stay — so the workspace declares, and releases with, the package it actually installs. That is a text edit of
// npm-manifest.json, made before the package.json edits, which then follow the raised pin.
//
// It walks exactly what `check pinned-dependencies` walks — the same packages, the same dependency fields — so
// after a sync the package.json half of that check passes by construction. Lockfiles are deliberately left
// alone: they are npm's output, and only npm may regenerate them (`make install`, then the consumer-lock
// regeneration). Until then the check keeps reporting them as stale, which is correct.
//
// Each file is edited as text, one spec string at a time, never re-serialized: formatting, key order and every
// other entry stay byte for byte. The result is then proven: parsed, it differs from the original in the
// planned specs and nowhere else.
//
// A tarball pin (`file:<path>.tgz`, see tarball-pins.ts) is copied as the spec each declaration must carry — a
// `file:` path relative to the declaring package, or a range on the tarball's version for a peer — and is never
// raised: it names a file, not a registry version a lockfile could have moved past.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { NpmManifest } from '../manifest.ts';
import {
  type LockfileReader,
  defaultLockfileReader,
  isNewer,
  resolvedCopies,
  versionOfPin,
  workspaceRootOf,
} from './checks/pinned-dependencies.ts';
import { packageJsonKey } from './checks/package-names.ts';
import { type DependencyField, type LoadedPackage, declarationsByName } from './npm.ts';
import { type TarballVersionReader, expectedPinnedSpec, isTarballPin, readTarballVersion } from './tarball-pins.ts';

export type PinnedEdit = {
  readonly file: string;
  readonly packageKey: string;
  readonly field: DependencyField;
  readonly name: string;
  readonly from: string;
  readonly to: string;
};

export type PinRaise = { readonly name: string; readonly from: string; readonly to: string };

/** Every pin some lockfile resolves NEWER than, raised to the newest version any lockfile resolves. */
export function planPinRaises(
  manifest: NpmManifest,
  packages: readonly LoadedPackage[],
  readLockfile: LockfileReader = defaultLockfileReader,
): readonly PinRaise[] {
  const pinned = Object.entries(manifest.dependencies?.pinned ?? {}).filter(([, pin]) => !isTarballPin(pin));
  const copies = packages.flatMap((pkg) => resolvedCopies(pkg, pinned, readLockfile));
  const raises: PinRaise[] = [];
  for (const [name, pin] of pinned) {
    const pinnedVersion = versionOfPin(pin);
    let newest = pinnedVersion;
    for (const copy of copies) if (copy.name === name && isNewer(copy.version, newest)) newest = copy.version;
    if (newest === pinnedVersion) continue;
    // The version is the tail of the spec, after any `^`/`~` and any `npm:<name>@` prefix.
    raises.push({ name, from: pin, to: `${pin.slice(0, pin.length - pinnedVersion.length)}${newest}` });
  }
  return raises;
}

/** The manifest as it reads once `raises` are applied: what the package.json plan must follow. */
export function withRaisedPins(manifest: NpmManifest, raises: readonly PinRaise[]): NpmManifest {
  if (raises.length === 0 || manifest.dependencies?.pinned === undefined) return manifest;
  const pinned = { ...manifest.dependencies.pinned };
  for (const raise of raises) pinned[raise.name] = raise.to;
  return { ...manifest, dependencies: { ...manifest.dependencies, pinned } };
}

/**
 * Pure: npm-manifest.json text in, the same text with each raised pin replaced out. Each raise must find exactly
 * one `"<name>": "<from>"` line inside the `pinned` block; the result is proven like a package.json edit.
 */
export function renderPinRaises(file: string, text: string, raises: readonly PinRaise[]): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^\s*"pinned":\s*\{\s*$/.test(line));
  const indent = /^(\s*)/.exec(lines[start] ?? '')?.[1] ?? '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith(`${indent}}`));
  if (start === -1 || end === -1) throw new Error(`${file}: expected one "pinned" block written over several lines`);
  for (const raise of raises) {
    const entry = new RegExp(
      `^(\\s*${escapeRegExp(JSON.stringify(raise.name))}:\\s*)${escapeRegExp(JSON.stringify(raise.from))}(,?\\s*)$`,
    );
    const hits = lines.flatMap((line, index) => (index > start && index < end && entry.test(line) ? [index] : []));
    const hit = hits[0];
    if (hits.length !== 1 || hit === undefined) {
      throw new Error(
        `${file}: expected exactly one "${raise.name}": "${raise.from}" in "pinned", found ${String(hits.length)}`,
      );
    }
    lines[hit] = (lines[hit] ?? '').replace(entry, `$1${JSON.stringify(raise.to)}$2`);
  }
  const updated = lines.join('\n');

  const expected = JSON.parse(text) as { dependencies?: { pinned?: Record<string, string> } };
  for (const raise of raises) {
    if (expected.dependencies?.pinned !== undefined) expected.dependencies.pinned[raise.name] = raise.to;
  }
  if (JSON.stringify(JSON.parse(updated)) !== JSON.stringify(expected)) {
    throw new Error(`${file}: raising the pins would change more than those pins; nothing written`);
  }
  return updated;
}

/** Every declaration of a pinned package whose spec differs from the pin, in package then field order. */
export function planPinnedSync(
  manifest: NpmManifest,
  packages: readonly LoadedPackage[],
  readVersion: TarballVersionReader = readTarballVersion,
): readonly PinnedEdit[] {
  const pinned = Object.entries(manifest.dependencies?.pinned ?? {});
  const workspaceRoot = pinned.some(([, pin]) => isTarballPin(pin)) ? workspaceRootOf(packages) : '';
  const edits: PinnedEdit[] = [];
  for (const pkg of packages) {
    const declared = declarationsByName(pkg.packageJson);
    for (const [name, pin] of pinned) {
      for (const declaration of declared.get(name) ?? []) {
        const to = expectedPinnedSpec({
          workspaceRoot,
          pin,
          directory: pkg.directory,
          field: declaration.field,
          readVersion,
        });
        if (declaration.spec === to) continue;
        edits.push({
          file: join(pkg.directory, 'package.json'),
          packageKey: packageJsonKey(pkg),
          field: declaration.field,
          name,
          from: declaration.spec,
          to,
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
