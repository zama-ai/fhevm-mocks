import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
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
 * the returned path's parent and must remove it; `withPinnedTree` does that for you.
 */
export function downloadPinnedTree(source: PinnedSource, into: string, download: Downloader = curl): string {
  const archive = join(into, 'source.tar.gz');
  download(archiveUrl(source), archive);

  const extracted = join(into, 'extracted');
  mkdirSync(extracted, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', extracted], { stdio: ['ignore', 'ignore', 'pipe'] });

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

/** Runs the body with the pinned tree extracted, and removes the temporary copy afterwards. */
export function withPinnedTree<T>(source: PinnedSource, body: (tree: string) => T, download: Downloader = curl): T {
  const scratch = mkdtempSync(join(tmpdir(), 'fhevm-npm-vendored-'));
  try {
    return body(downloadPinnedTree(source, scratch, download));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function archiveUrl(source: PinnedSource): string {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(source.repository);
  if (match === null) {
    throw new Error(`only github.com sources can be downloaded without git; got ${source.repository}`);
  }
  return `https://codeload.github.com/${match[1]!}/${match[2]!}/tar.gz/${source.commit}`;
}

function curl(url: string, destination: string): void {
  // `--fail` so an HTML error page is never mistaken for an archive, `--location` for codeload's redirect.
  execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--output', destination, url], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}
