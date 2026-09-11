// Locating the sdk workspace, the fhevm repo around it, and the files that live at either root.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This module's own directory — the anchor for anything found relative to the workspace. */
const THIS_DIR = dirname(fileURLToPath(import.meta.url));

/** The one file of upstream's `library-solidity/config` this workspace reads. */
const ZAMA_CONFIG_FILE_NAME = 'ZamaConfig.sol';

/** Path of ZamaConfig.sol relative to the fhevm repo root. */
const ZAMA_CONFIG_REPO_PATH = join('library-solidity', 'config', ZAMA_CONFIG_FILE_NAME);

/**
 * Nearest ancestor of `startDir` whose package.json declares `workspaces`.
 *
 * @param startDir Absolute path to start from — the calling package's own root.
 * @throws if no ancestor declares `workspaces`.
 * @example
 * findWorkspaceRootAbsPath('/repo/sdk/host-contracts-cleartext/v13'); // '/repo/sdk'
 */
export function findWorkspaceRootAbsPath(startDir: string): string {
  let current = startDir;
  for (;;) {
    const manifest = join(current, 'package.json');
    if (existsSync(manifest)) {
      const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null && 'workspaces' in parsed) {
        return current;
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`no package.json declaring "workspaces" above ${startDir}`);
    }
    current = parent;
  }
}

/** The fhevm repo root according to git, or undefined outside a checkout. */
function _gitRepoRoot(): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: THIS_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Absolute path of `library-solidity/config/ZamaConfig.sol`, tried as the sdk workspace's sibling then
 * from the git repo root — so moving a package within the repo cannot silently lose the file.
 *
 * @throws if neither candidate exists, which means it moved rather than that it may be skipped.
 * @example
 * zamaConfigAbsPath(); // '/repo/library-solidity/config/ZamaConfig.sol'
 */
export function zamaConfigAbsPath(): string {
  const layoutRelative = join(dirname(findWorkspaceRootAbsPath(THIS_DIR)), ZAMA_CONFIG_REPO_PATH);
  const repoRoot = _gitRepoRoot();
  const candidates =
    repoRoot === undefined ? [layoutRelative] : [...new Set([layoutRelative, join(repoRoot, ZAMA_CONFIG_REPO_PATH)])];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) {
    throw new Error(
      `ZamaConfig.sol not found. Tried:\n${candidates.map((candidate) => `     ${candidate}`).join('\n')}\n` +
        `   It is the source of truth for the localhost address set, so this check cannot be skipped: fix ` +
        `the path in @fhevm/sdk-common-dev (src/paths.ts) if the file moved.`,
    );
  }

  return found;
}

/**
 * The generation's own vendored `ZamaConfig.sol`: `<packageDir>/<fhevm.vendoredFrom.to>/ZamaConfig.sol`,
 * where `fhevm.vendoredFrom` is the block `fhevm-npm sync vendored` writes into the dev package.json from
 * its npm-manifest.json entry. Read from the manifest rather than spelled out here, so the check reads
 * the copy at the commit the generation pins, and a moved copy cannot leave this pointing at the old spot.
 *
 * @param packageDir Absolute path of the generation's dev package — the directory holding its package.json.
 * @throws if the dev package declares no pinned vendored source, or the copy is not where it says.
 * @example
 * vendoredZamaConfigAbsPath('/repo/host-contracts-cleartext/v14');
 * // '/repo/host-contracts-cleartext/v14/internal/zama-config/ZamaConfig.sol'
 */
export function vendoredZamaConfigAbsPath(packageDir: string): string {
  const manifest = join(packageDir, 'package.json');
  const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'));
  const to = _vendoredTo(parsed);
  if (to === undefined) {
    throw new Error(
      `${manifest} declares no fhevm.vendoredFrom.to. The generation must vendor library-solidity/config at ` +
        `its own pinned commit (an npm-manifest.json "vendored" entry on the dev package, written by ` +
        `'fhevm-npm sync vendored'); ZamaConfig.sol is read from that copy and nowhere else.`,
    );
  }

  const found = join(packageDir, to, ZAMA_CONFIG_FILE_NAME);
  if (!existsSync(found)) {
    throw new Error(
      `${found} does not exist. package.json#fhevm.vendoredFrom says the pinned copy lives in '${to}', so ` +
        `either the copy was never written — run 'fhevm-npm sync vendored' — or the manifest entry moved ` +
        `without it.`,
    );
  }
  return found;
}

/** `fhevm.vendoredFrom.to` of a parsed package.json, or undefined when the block is absent or malformed. */
function _vendoredTo(packageJson: unknown): string | undefined {
  if (typeof packageJson !== 'object' || packageJson === null) return undefined;
  const fhevm: unknown = (packageJson as { fhevm?: unknown }).fhevm;
  if (typeof fhevm !== 'object' || fhevm === null) return undefined;
  const vendoredFrom: unknown = (fhevm as { vendoredFrom?: unknown }).vendoredFrom;
  if (typeof vendoredFrom !== 'object' || vendoredFrom === null) return undefined;
  const to: unknown = (vendoredFrom as { to?: unknown }).to;
  return typeof to === 'string' && to.length > 0 ? to : undefined;
}

/**
 * How to name a path in output: relative to the fhevm repo root when it sits inside one, absolute
 * otherwise.
 *
 * @example
 * sourceLabel('/repo/library-solidity/config/ZamaConfig.sol'); // 'library-solidity/config/ZamaConfig.sol'
 */
export function sourceLabel(sourcePath: string): string {
  const repoRoot = _gitRepoRoot();
  if (repoRoot === undefined) {
    return sourcePath;
  }

  const fromRoot = relative(repoRoot, sourcePath);
  return fromRoot.startsWith('..') ? sourcePath : fromRoot;
}
