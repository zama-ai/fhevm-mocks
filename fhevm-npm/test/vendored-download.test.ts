import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { type Downloader, archiveUrl, downloadPinnedTree, withPinnedTree } from '../base/vendored-download.ts';

const source = {
  repository: 'https://github.com/zama-ai/fhevm',
  commit: 'ac18e49ea85dd3c26788fc66f9ac0ea7cfe48519',
  from: 'host-contracts/contracts',
};

/**
 * A downloader serving a tarball shaped like GitHub's: one `<repo>-<commit>` root wrapping the tree.
 * Nothing in these tests reaches the network.
 */
function servingArchive(files: Readonly<Record<string, string>>, rootName = `fhevm-${source.commit}`): Downloader {
  const staging = mkdtempSync(join(tmpdir(), 'fhevm-npm-archive-'));
  for (const [path, content] of Object.entries(files)) {
    const file = join(staging, rootName, path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
  }
  const archive = join(staging, 'prepared.tar.gz');
  execFileSync('tar', ['-czf', archive, '-C', staging, rootName]);
  return (_url, destination) => {
    copyFileSync(archive, destination);
  };
}

test('the archive URL is codeload at the exact commit', () => {
  assert.equal(
    archiveUrl(source),
    'https://codeload.github.com/zama-ai/fhevm/tar.gz/ac18e49ea85dd3c26788fc66f9ac0ea7cfe48519',
  );
  assert.equal(archiveUrl({ ...source, repository: 'https://github.com/zama-ai/fhevm.git' }), archiveUrl(source));
  assert.equal(archiveUrl({ ...source, repository: 'https://github.com/zama-ai/fhevm/' }), archiveUrl(source));
});

test('a non-github source is refused, because only that host can be downloaded without git', () => {
  assert.throws(
    () => archiveUrl({ ...source, repository: 'https://gitlab.com/zama-ai/fhevm' }),
    /only github\.com sources/,
  );
});

test('the requested subtree is extracted, and only it', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'fhevm-npm-dl-'));
  try {
    const tree = downloadPinnedTree(
      source,
      scratch,
      servingArchive({
        'host-contracts/contracts/ACL.sol': 'acl',
        'host-contracts/contracts/shared/Constants.sol': 'constants',
        'host-contracts/README.md': 'not part of the subtree',
      }),
    );
    assert.deepEqual(readdirSync(tree).sort(), ['ACL.sol', 'shared']);
    assert.equal(readFileSync(join(tree, 'ACL.sol'), 'utf8'), 'acl');
    assert.equal(readFileSync(join(tree, 'shared', 'Constants.sol'), 'utf8'), 'constants');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('a subtree the archive does not contain is reported against the pin that named it', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'fhevm-npm-dl-'));
  try {
    assert.throws(
      () => downloadPinnedTree(source, scratch, servingArchive({ 'somewhere/else/A.sol': 'x' })),
      /host-contracts\/contracts does not exist in https:\/\/github\.com\/zama-ai\/fhevm at ac18e49/,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('withPinnedTree downloads a commit once and serves every later call from the cache', () => {
  const cacheRoot = mkdtempSync(join(tmpdir(), 'fhevm-npm-cache-'));
  try {
    let downloads = 0;
    const counting: Downloader = (url, destination) => {
      downloads += 1;
      servingArchive({
        'host-contracts/contracts/A.sol': 'x',
        'library-solidity/config/ZamaConfig.sol': 'config',
      })(url, destination);
    };

    const first = withPinnedTree(source, (tree) => tree, counting, cacheRoot);
    assert.equal(downloads, 1);
    assert.equal(existsSync(first), true, 'the cached tree must outlive the call');
    assert.equal(readFileSync(join(first, 'A.sol'), 'utf8'), 'x');

    // Same commit, another subtree: the entry the config vendoring adds costs nothing extra.
    const config = withPinnedTree({ ...source, from: 'library-solidity/config' }, (tree) => tree, counting, cacheRoot);
    assert.equal(downloads, 1, 'a second subtree of a cached commit was downloaded again');
    assert.equal(readFileSync(join(config, 'ZamaConfig.sol'), 'utf8'), 'config');

    // A different commit is a different slot.
    withPinnedTree({ ...source, commit: 'b'.repeat(40) }, () => undefined, counting, cacheRoot);
    assert.equal(downloads, 2);

    // Only the extracted tree is kept: the 40 MB archive is not.
    const slots = readdirSync(cacheRoot).sort();
    assert.deepEqual(slots, [`zama-ai-fhevm-${source.commit}`, `zama-ai-fhevm-${'b'.repeat(40)}`]);
    assert.deepEqual(readdirSync(join(cacheRoot, slots[0]!)).sort(), ['extracted', 'file-count']);
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

/** Deletes every file under the directory and keeps the directories, as macOS does in its temp directory. */
function deleteFilesAndKeepDirectories(directory: string): void {
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isDirectory()) rmSync(join(entry.parentPath, entry.name));
  }
}

test('withPinnedTree downloads a commit again when its slot lost files and kept its directories', () => {
  const cacheRoot = mkdtempSync(join(tmpdir(), 'fhevm-npm-cache-'));
  try {
    let downloads = 0;
    const counting: Downloader = (url, destination) => {
      downloads += 1;
      servingArchive({
        'host-contracts/contracts/A.sol': 'x',
        'host-contracts/contracts/shared/B.sol': 'y',
        'library-solidity/config/ZamaConfig.sol': 'config',
      })(url, destination);
    };
    const slot = join(cacheRoot, `zama-ai-fhevm-${source.commit}`);

    const first = withPinnedTree(source, (tree) => tree, counting, cacheRoot);
    assert.equal(downloads, 1);

    // Every file of the slot is gone, its count included.
    deleteFilesAndKeepDirectories(slot);
    assert.equal(existsSync(join(first, 'shared')), true, 'the directories of the slot are kept');

    const emptied = withPinnedTree(source, (tree) => tree, counting, cacheRoot);
    assert.equal(downloads, 2, 'an emptied slot was served from the cache');
    assert.equal(readFileSync(join(emptied, 'A.sol'), 'utf8'), 'x');

    // One file is gone, in a subtree that this call does not read.
    rmSync(join(slot, 'extracted', `fhevm-${source.commit}`, 'library-solidity', 'config', 'ZamaConfig.sol'));

    const partial = withPinnedTree(source, (tree) => tree, counting, cacheRoot);
    assert.equal(downloads, 3, 'a slot that lost one file was served from the cache');
    assert.equal(readFileSync(join(partial, 'shared', 'B.sol'), 'utf8'), 'y');

    // A slot that an older version wrote has no count: it is downloaded once more, then kept.
    rmSync(join(slot, 'file-count'));
    withPinnedTree(source, () => undefined, counting, cacheRoot);
    assert.equal(downloads, 4, 'a slot with no count was served from the cache');

    withPinnedTree(source, () => undefined, counting, cacheRoot);
    assert.equal(downloads, 4, 'a complete slot was downloaded again');
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test('a failed download leaves no cache slot behind, so the next run retries', () => {
  const cacheRoot = mkdtempSync(join(tmpdir(), 'fhevm-npm-cache-'));
  try {
    assert.throws(
      () =>
        withPinnedTree(
          source,
          () => undefined,
          () => {
            throw new Error('network down');
          },
          cacheRoot,
        ),
      /network down/,
    );
    assert.deepEqual(readdirSync(cacheRoot), [], 'a partial slot survived the failure');

    // A body that throws does not poison the cache either: the commit stays available.
    assert.throws(() =>
      withPinnedTree(
        source,
        () => {
          throw new Error('body failed');
        },
        servingArchive({ 'host-contracts/contracts/A.sol': 'x' }),
        cacheRoot,
      ),
    );
    assert.deepEqual(readdirSync(cacheRoot), [`zama-ai-fhevm-${source.commit}`]);
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test('a cached commit that lacks the requested subtree is reported against the pin that named it', () => {
  const cacheRoot = mkdtempSync(join(tmpdir(), 'fhevm-npm-cache-'));
  try {
    withPinnedTree(source, () => undefined, servingArchive({ 'host-contracts/contracts/A.sol': 'x' }), cacheRoot);
    assert.throws(
      () =>
        withPinnedTree(
          { ...source, from: 'library-solidity/config' },
          () => undefined,
          () => {
            throw new Error('must not download: the commit is cached');
          },
          cacheRoot,
        ),
      /library-solidity\/config does not exist in https:\/\/github\.com\/zama-ai\/fhevm at ac18e49/,
    );
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});
