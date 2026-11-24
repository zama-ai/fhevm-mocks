import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

  const extracted = join(into, EXTRACTED_NAME);
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
 * A commit is immutable, which is what makes the cache safe to keep. The tool never writes half a slot:
 * extraction happens in a scratch directory that is renamed into place only once it is complete.
 *
 * A slot can still lose files after it was written. The cache is in the system temp directory, and
 * macOS deletes the files there that nothing read for three days, and keeps their directories. So each
 * slot records how many files it holds, and a slot whose files no longer match that number is
 * downloaded again.
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
  const extracted = join(slot, EXTRACTED_NAME);

  if (slotIsComplete(slot)) return subtreeOf(extracted, source);

  // A slot that lost files, or that an older version wrote without its count, is of no use.
  rmSync(slot, { recursive: true, force: true });
  mkdirSync(cacheRoot, { recursive: true });

  const staging = mkdtempSync(join(cacheRoot, `${cacheKey(source)}.partial-`));

  try {
    downloadPinnedTree(source, staging, download);
    writeFileSync(join(staging, FILE_COUNT_NAME), `${String(countFiles(join(staging, EXTRACTED_NAME)))}\n`);

    try {
      renameSync(staging, slot);
    } catch (error) {
      // Another run filled the slot first. Its copy is the same commit, so use it and drop ours.
      if (!slotIsComplete(slot)) throw error;
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  return subtreeOf(extracted, source);
}

/** The directory of a slot that holds the extracted archive. */
const EXTRACTED_NAME = 'extracted';

/** The file of a slot that records how many files the extracted archive held when it was written. */
const FILE_COUNT_NAME = 'file-count';

/** True when the slot still holds every file that its archive had. */
function slotIsComplete(slot: string): boolean {
  const extracted = join(slot, EXTRACTED_NAME);
  const countFile = join(slot, FILE_COUNT_NAME);

  if (!existsSync(extracted) || !existsSync(countFile)) return false;

  const recorded = readFileSync(countFile, 'utf8').trim();

  return /^\d+$/.test(recorded) && Number(recorded) === countFiles(extracted);
}

/** How many entries under the directory are not directories. */
function countFiles(directory: string): number {
  const entries = readdirSync(directory, { recursive: true, withFileTypes: true });

  return entries.filter((entry) => !entry.isDirectory()).length;
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
