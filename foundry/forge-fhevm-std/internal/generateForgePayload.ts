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
// NOTHING is rewritten: the copy is byte-identical to its origin. The payload ships self-contained
// because the host's own `generate:forge-shared` duplicates `src/cleartext/shared` — the handle
// layout, the FheType facts, the operator and event declarations, the arithmetic — into
// `pkg/forge/src/shared` first, FheType included. So no file here climbs out of its own tree, and this
// generator is a plain directory copy. When that stops being true the build says so immediately, since
// the climbing import simply will not resolve.

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

////////////////////////////////////////////////////////////////////////////////

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_ROOT = join(ROOT, '..', '..');
const MANIFEST_PATH = join(WORKSPACE_ROOT, 'npm-manifest.json');

const DEST_DIR = join(ROOT, 'pkg', 'src', '_host');

/**
 * Payload files that stay behind in the host package.
 *
 * Empty, and worth keeping so: a payload file may only reach out of its own tree to `src/cleartext/
 * shared` or to FheType, both of which are copied in below. Anything reaching further — into the
 * vendored `src/contracts`, or into `src/cleartext` outside `shared` — arrives with imports that
 * cannot resolve, because forge-fhevm-std has no such directories. Listing it here is the escape
 * hatch; making it depend only on `shared` is the fix.
 */
const HOST_ONLY = new Set<string>();

/** Relative to the host generation's package root. */
const PAYLOAD_REL = join('pkg', 'forge', 'src');

////////////////////////////////////////////////////////////////////////////////

/**
 * The current host-contracts-cleartext generation, as npm-manifest.json declares it. Throws rather
 * than defaulting: a missing entry means the manifest moved, and silently copying the wrong
 * generation is worse than failing.
 */
export function currentGenerationDir(): string {
  const manifest: unknown = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const current = (manifest as { generations?: Record<string, { current?: unknown }> }).generations?.[
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

////////////////////////////////////////////////////////////////////////////////

export interface PayloadResult {
  readonly generationDir: string;
  readonly files: number;
}

/** Wipes and rewrites pkg/src/_host. The only thing here that touches disk. */
export function writeForgePayload(): PayloadResult {
  const generationDir = currentGenerationDir();
  const payloadDir = join(generationDir, PAYLOAD_REL);

  for (const path of [payloadDir]) {
    try {
      statSync(path);
    } catch {
      throw new Error(`${path}: missing; the current generation has no Forge payload to duplicate`);
    }
  }

  rmSync(DEST_DIR, { recursive: true, force: true });
  mkdirSync(DEST_DIR, { recursive: true });
  cpSync(payloadDir, DEST_DIR, { recursive: true });

  for (const name of HOST_ONLY) {
    rmSync(join(DEST_DIR, name), { force: true });
  }

  return { generationDir, files: _solFiles(DEST_DIR).length };
}
