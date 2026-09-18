// Generates pkg/src/_host/ by duplicating the current generation's Forge payload.
//
// The payload is host-contracts-cleartext's pkg/forge/src: the cleartext deploy, encrypt, decrypt and
// signer helpers this library builds on. It is COPIED rather than depended on because a Forge
// dependency of a Forge dependency is exactly what this package refuses to have (see
// DESIGN-dependencies.md); a copy keeps forge-fhevm-std a leaf that resolves the same way on every
// install channel.
//
// The generation is read from npm-manifest.json#generations, never hardcoded: that file is the one
// place naming the current generation, and the Makefile reads it the same way. A v13 -> v14 bump then
// reaches this package by re-running the generator, not by editing it.
//
// pkg/src/_host is owned ENTIRELY by this generator and wiped on every run, so the tree can be
// diffed against its origin byte for byte. Nothing else may be written there. The directory is named
// for its origin rather than _internal, because the payload already carries an _internal/ of its own
// and nesting one inside the other read as _internal/_internal.
//
// One import is rewritten, and only one. The payload's interfaces reach out of the payload for
// FheType with "../../../../src/contracts/shared/FheType.sol", which resolves to the host package's
// pkg/src/contracts/shared. That path does not exist here, so FheType is copied to _host/shared and
// the three imports are repointed at it. Everything else is byte-identical to the origin.

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

////////////////////////////////////////////////////////////////////////////////

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_ROOT = join(ROOT, '..', '..');
const MANIFEST_PATH = join(WORKSPACE_ROOT, 'npm-manifest.json');

const DEST_DIR = join(ROOT, 'pkg', 'src', '_host');

/** Relative to the host generation's package root. */
const PAYLOAD_REL = join('pkg', 'forge', 'src');
const FHE_TYPE_REL = join('pkg', 'src', 'contracts', 'shared', 'FheType.sol');

/**
 * The payload's only out-of-tree import, and where it lands.
 *
 * FheType is not part of the payload directory — it belongs to the host CONTRACTS, which the forge
 * sources reach by climbing out of their own tree. It is copied in beside them, under `shared/`, so
 * the shipped payload is self-contained and there is exactly one FheType: two copies would be two
 * distinct enum types that do not convert.
 *
 * The climb is matched rather than hardcoded because the payload has files at more than one depth
 * (`shared/` and `_internal/interfaces/`), so the number of `../` differs per file.
 */
const FHE_TYPE_IMPORT_FROM = /(?:\.\.\/)+src\/contracts\/shared\/FheType\.sol/g;
const FHE_TYPE_DEST_REL = join('shared', 'FheType.sol');

////////////////////////////////////////////////////////////////////////////////

/**
 * The current host-contracts-cleartext generation, as npm-manifest.json declares it. Throws rather
 * than defaulting: a missing entry means the manifest moved, and silently copying the wrong
 * generation is worse than failing.
 */
export function currentGenerationDir(): string {
  const manifest: unknown = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const current = (manifest as { generations?: Record<string, { current?: unknown }> })?.generations?.[
    'host-contracts-cleartext'
  ]?.current;
  if (typeof current !== 'string' || current.length === 0) {
    throw new Error(`${MANIFEST_PATH}: no generations["host-contracts-cleartext"].current`);
  }
  return join(WORKSPACE_ROOT, current);
}

////////////////////////////////////////////////////////////////////////////////

/** Every .sol file under dir, as paths relative to it. */
function _solFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.sol')) out.push(relative(dir, full));
    }
  };
  walk(dir);
  return out.sort();
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Repoints the payload's out-of-tree FheType import at the copy under `shared/`, one file at a time so
 * each gets a path relative to ITSELF. Returns the files it touched.
 */
function _rewriteFheTypeImports(): string[] {
  const touched: string[] = [];
  const fheTypeDest = join(DEST_DIR, FHE_TYPE_DEST_REL);

  for (const rel of _solFiles(DEST_DIR)) {
    const path = join(DEST_DIR, rel);
    const before = readFileSync(path, 'utf8');

    let to = relative(dirname(path), fheTypeDest).split(sep).join('/');
    if (!to.startsWith('.')) to = `./${to}`;

    const after = before.replace(FHE_TYPE_IMPORT_FROM, to);
    if (after === before) continue;
    writeFileSync(path, after, 'utf8');
    touched.push(rel);
  }
  return touched;
}

////////////////////////////////////////////////////////////////////////////////

export interface PayloadResult {
  readonly generationDir: string;
  readonly files: number;
  readonly rewritten: readonly string[];
}

/** Wipes and rewrites pkg/src/_host. The only thing here that touches disk. */
export function writeForgePayload(): PayloadResult {
  const generationDir = currentGenerationDir();
  const payloadDir = join(generationDir, PAYLOAD_REL);
  const fheTypePath = join(generationDir, FHE_TYPE_REL);

  for (const path of [payloadDir, fheTypePath]) {
    try {
      statSync(path);
    } catch {
      throw new Error(`${path}: missing; the current generation has no Forge payload to duplicate`);
    }
  }

  rmSync(DEST_DIR, { recursive: true, force: true });
  mkdirSync(DEST_DIR, { recursive: true });
  cpSync(payloadDir, DEST_DIR, { recursive: true });

  const fheTypeDest = join(DEST_DIR, FHE_TYPE_DEST_REL);
  mkdirSync(dirname(fheTypeDest), { recursive: true });
  cpSync(fheTypePath, fheTypeDest);

  const rewritten = _rewriteFheTypeImports();
  return { generationDir, files: _solFiles(DEST_DIR).length, rewritten };
}
