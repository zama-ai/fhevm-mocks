import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { DIGEST_PATTERN, listRelativeFiles, vendoredDigest } from '../base/vendored-digest.ts';

/** A directory holding the given `relative path -> content` pairs. */
function tree(files: Readonly<Record<string, string | Buffer>>): string {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-digest-'));
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

function withTrees(files: readonly Readonly<Record<string, string | Buffer>>[], body: (roots: string[]) => void): void {
  const roots = files.map(tree);
  try {
    body(roots);
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
}

test('the digest is stable, and shaped as the manifest requires', () => {
  withTrees([{ 'a.sol': 'X', 'shared/b.sol': 'Y' }], ([root]) => {
    const digest = vendoredDigest(root!);
    assert.match(digest, DIGEST_PATTERN);
    assert.equal(digest, vendoredDigest(root!));
  });
});

test('mtime, and therefore a fresh checkout, does not change the digest', () => {
  withTrees([{ 'a.sol': 'X' }, { 'a.sol': 'X' }], ([left, right]) => {
    utimesSync(join(right!, 'a.sol'), new Date('2031-01-01'), new Date('2031-01-01'));
    assert.equal(vendoredDigest(left!), vendoredDigest(right!));
  });
});

test('content, a rename, an addition and a deletion each change the digest', () => {
  withTrees(
    [
      { 'a.sol': 'X', 'b.sol': 'Y' },
      { 'a.sol': 'X', 'b.sol': 'Z' },
      { 'a.sol': 'X', 'c.sol': 'Y' },
      { 'a.sol': 'X', 'b.sol': 'Y', 'c.sol': 'Z' },
      { 'a.sol': 'X' },
    ],
    ([base, modified, renamed, added, deleted]) => {
      const of = vendoredDigest(base!);
      for (const [label, other] of [
        ['modified', modified],
        ['renamed', renamed],
        ['added', added],
        ['deleted', deleted],
      ] as const) {
        assert.notEqual(of, vendoredDigest(other!), `${label} tree digests the same as the base`);
      }
    },
  );
});

// The bug this framing exists to prevent: with raw content appended after the path, a file holding
// "X\0b.sol\0Y" produces the same byte stream as the two files it names.
test('a file whose content spells out another entry does not collide with it', () => {
  withTrees([{ 'a.sol': 'X', 'b.sol': 'Y' }, { 'a.sol': 'X\0b.sol\0Y' }], ([separate, spliced]) => {
    assert.notEqual(vendoredDigest(separate!), vendoredDigest(spliced!));
  });
});

test('two files differing only in an undecodable byte digest differently', () => {
  withTrees(
    [{ 'a.sol': Buffer.from([0x61, 0xff, 0x62]) }, { 'a.sol': Buffer.from([0x61, 0xfe, 0x62]) }],
    ([left, right]) => {
      assert.notEqual(vendoredDigest(left!), vendoredDigest(right!));
    },
  );
});

test('CRLF digests as LF, but a lone CR is content', () => {
  withTrees([{ 'a.sol': 'one\r\ntwo\r\n' }, { 'a.sol': 'one\ntwo\n' }, { 'a.sol': 'one\rtwo\r' }], ([crlf, lf, cr]) => {
    assert.equal(vendoredDigest(crlf!), vendoredDigest(lf!), 'CRLF should digest as LF');
    assert.notEqual(vendoredDigest(cr!), vendoredDigest(lf!), 'a lone CR is content, not a line ending');
  });
});

test('every file counts, whatever its extension', () => {
  withTrees([{ 'a.sol': 'X' }, { 'a.sol': 'X', 'remappings.txt': 'oops' }], ([clean, polluted]) => {
    assert.notEqual(vendoredDigest(clean!), vendoredDigest(polluted!));
  });
});

test('a symlink is refused rather than silently skipped', () => {
  withTrees([{ 'a.sol': 'X' }], ([root]) => {
    symlinkSync(join(root!, 'a.sol'), join(root!, 'link.sol'));
    assert.throws(() => vendoredDigest(root!), /neither a regular file nor a directory/);
  });
});

// A wiped destination would otherwise hash to the digest of nothing, which is constant and would match
// itself forever.
test('an empty directory is an error, not a digest', () => {
  const root = mkdtempSync(join(tmpdir(), 'fhevm-npm-digest-'));
  try {
    assert.throws(() => vendoredDigest(root), /contains no files/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('files are listed POSIX-relative and globally sorted, not per directory', () => {
  withTrees([{ 'b.sol': 'x', 'a/z.sol': 'x', 'a/b/c.sol': 'x' }], ([root]) => {
    assert.deepEqual(listRelativeFiles(root!), ['a/b/c.sol', 'a/z.sol', 'b.sol']);
  });
});
