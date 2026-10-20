// The cleartext stack's portable core, duplicated into the Forge payload.
//
// `pkg/src/cleartext/shared` is the source of truth: the handle layout, the FheType facts, the operator
// and event declarations, and the arithmetic built on them. The Forge payload needs every one of those,
// and `pkg/forge/src` must be SELF-CONTAINED — it is copied wholesale into forge-fhevm-std, where
// `src/cleartext` does not exist and an import climbing out of the payload cannot resolve.
//
// So the files are duplicated here rather than reached for. FheType comes along for the same reason,
// from the vendored contracts, and its importers are repointed at the copy: two FheType declarations
// would be two distinct enum types that do not convert, so there must be exactly one in the payload.

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const SHARED_SRC = join(ROOT, 'pkg', 'src', 'cleartext', 'shared');
const FHE_TYPE_SRC = join(ROOT, 'pkg', 'src', 'contracts', 'shared', 'FheType.sol');
const DEST = join(ROOT, 'pkg', 'forge', 'src', 'shared');

/** Any climb out of the tree to the vendored FheType, at whatever depth the importer sits. */
const FHE_TYPE_IMPORT = /(?:\.\.\/)+(?:src\/)?contracts\/shared\/FheType\.sol/g;

export interface ForgeSharedResult {
  readonly files: readonly string[];
  readonly repointed: readonly string[];
}

/** Every .sol under dir, as paths relative to it — `shared/` has subdirectories. */
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

/** Wipes and rewrites pkg/forge/src/shared. The only thing here that touches disk. */
export function writeForgeShared(): ForgeSharedResult {
  rmSync(DEST, { recursive: true, force: true });
  mkdirSync(DEST, { recursive: true });

  cpSync(SHARED_SRC, DEST, { recursive: true });
  cpSync(FHE_TYPE_SRC, join(DEST, 'FheType.sol'));

  const repointed: string[] = [];
  const files = _solFiles(DEST);

  for (const name of files) {
    const path = join(DEST, name);
    const before = readFileSync(path, 'utf8');
    const after = before.replace(FHE_TYPE_IMPORT, './FheType.sol');
    if (after === before) continue;
    writeFileSync(path, after, 'utf8');
    repointed.push(name);
  }

  return { files, repointed };
}
