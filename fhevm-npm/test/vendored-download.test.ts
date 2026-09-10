import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

test('withPinnedTree removes its scratch directory, including after a failure', () => {
  let seen = '';
  withPinnedTree(source, (tree) => (seen = tree), servingArchive({ 'host-contracts/contracts/A.sol': 'x' }));
  assert.notEqual(seen, '');
  assert.equal(existsSync(seen), false, 'the extracted tree outlived the call');

  let escaped = '';
  assert.throws(() =>
    withPinnedTree(
      source,
      (tree) => {
        escaped = tree;
        throw new Error('body failed');
      },
      servingArchive({ 'host-contracts/contracts/A.sol': 'x' }),
    ),
  );
  assert.equal(existsSync(escaped), false, 'a throwing body left the extracted tree behind');
});
