import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The pinned upstream tree, fetched over plain HTTPS.
 *
 * Deliberately not git: the enclosing repository is not the upstream one anywhere except this workspace,
 * so `git cat-file` only ever worked here by coincidence. Nothing is written to any `.git`, and no
 * repository has to be present at all.
 */
export type PinnedSource = {
  readonly repository: string;
  readonly commit: string;
  readonly from: string;
};

export type Downloader = (url: string, destination: string) => void;

/**
 * Downloads the commit as an archive and returns the directory holding `source.from`. The caller owns
 * the returned path's parent and must remove it; `withPinnedTree` keeps one per commit instead.
 */
export function downloadPinnedTree(source: PinnedSource, into: string, download: Downloader = curl): string {
  const archive = join(into, 'source.tar.gz');
  download(archiveUrl(source), archive);

  const extracted = join(into, 'extracted');
  mkdirSync(extracted, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', extracted], { stdio: ['ignore', 'ignore', 'pipe'] });
  // The archive has done its job; only the tree is worth keeping when `into` is the cache.
  rmSync(archive, { force: true });

  return subtreeOf(extracted, source);
}

/** Where extracted commits are kept between runs. One directory per repository and commit. */
export function pinnedTreeCacheRoot(): string {
  return join(tmpdir(), 'fhevm-npm-vendored-cache');
}

/**
 * Runs the body with the pinned tree extracted. The extraction is keyed by repository and commit and
 * kept under `cacheRoot`, so a second entry at the same commit — or a second run — costs no download.
 *
 * A commit is immutable, which is what makes the cache safe to keep: the only reason to re-fetch is a
 * missing or half-written slot, and a half-written slot never exists — extraction happens in a scratch
 * directory that is renamed into place only once it is complete.
 */
export function withPinnedTree<T>(
  source: PinnedSource,
  body: (tree: string) => T,
  download: Downloader = curl,
  cacheRoot: string | undefined = undefined,
): T {
  return body(cachedPinnedTree(source, cacheRoot ?? pinnedTreeCacheRoot(), download));
}

/** The directory holding `source.from` at `source.commit`, downloading once per commit into `cacheRoot`. */
export function cachedPinnedTree(source: PinnedSource, cacheRoot: string, download: Downloader = curl): string {
  const slot = join(cacheRoot, cacheKey(source));
  const extracted = join(slot, 'extracted');
  if (existsSync(extracted)) {
    return subtreeOf(extracted, source);
  }

  mkdirSync(cacheRoot, { recursive: true });
  const staging = mkdtempSync(join(cacheRoot, `${cacheKey(source)}.partial-`));
  try {
    downloadPinnedTree(source, staging, download);
    try {
      renameSync(staging, slot);
    } catch (error) {
      // Another run filled the slot first. Its copy is the same commit, so use it and drop ours.
      if (!existsSync(extracted)) throw error;
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  return subtreeOf(extracted, source);
}

export function archiveUrl(source: PinnedSource): string {
  const { owner, name } = githubRepository(source);
  return `https://codeload.github.com/${owner}/${name}/tar.gz/${source.commit}`;
}

/** `<owner>-<repo>-<commit>`: unique per pinned commit, and readable when the cache is listed. */
function cacheKey(source: PinnedSource): string {
  const { owner, name } = githubRepository(source);
  return `${owner}-${name}-${source.commit}`;
}

function githubRepository(source: PinnedSource): { readonly owner: string; readonly name: string } {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(source.repository);
  if (match === null) {
    throw new Error(`only github.com sources can be downloaded without git; got ${source.repository}`);
  }
  return { owner: match[1]!, name: match[2]! };
}

/** `source.from` inside an extracted archive, or an error naming the pin that asked for it. */
function subtreeOf(extracted: string, source: PinnedSource): string {
  // GitHub wraps the tree in one `<repo>-<commit>` directory whose name is not worth predicting.
  const roots = readdirSync(extracted, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const root = roots[0];
  if (roots.length !== 1 || root === undefined) {
    throw new Error(`archive of ${source.repository} at ${source.commit} has ${String(roots.length)} root directories`);
  }

  const tree = join(extracted, root.name, source.from);
  if (!existsSync(tree)) {
    throw new Error(`${source.from} does not exist in ${source.repository} at ${source.commit}`);
  }
  return tree;
}

function curl(url: string, destination: string): void {
  // `--fail` so an HTML error page is never mistaken for an archive, `--location` for codeload's redirect.
  execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--output', destination, url], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}
