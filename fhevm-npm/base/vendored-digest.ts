import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

/**
 * A digest of a vendored directory's CONTENT, so a check can prove the tree is unchanged without git,
 * a network round trip, or the upstream repository being present.
 *
 * Hashing an archive instead would not work: gzip stores a timestamp, tar stores mtimes and uid/gid,
 * entry order is the filesystem's, and macOS tar has no `--sort`. The same bytes on two machines produce
 * two different tarballs. Content hashing has none of that.
 */
export const DIGEST_PATTERN = /^sha256-[A-Za-z0-9+/]+={0,2}$/;

export function vendoredDigest(directory: string): string {
  const files = listRelativeFiles(directory);
  if (files.length === 0) throw new Error(`${directory} contains no files to digest`);

  const hash = createHash('sha256');
  for (const file of files) {
    // A path cannot contain NUL, and the content is folded to a fixed-width 32-byte hash rather than
    // appended raw. Both together make the stream unambiguous: with raw content, a file holding
    // "X\0b.sol\0Y" digests the same as the two files it names, so deleting one and splicing it into
    // its neighbour would go unnoticed.
    hash.update(file, 'utf8');
    hash.update('\0');
    hash.update(fileDigest(join(directory, ...file.split(posix.sep))));
  }
  return `sha256-${hash.digest('base64')}`;
}

// Bytes, never a decoded string: `readFileSync(…, 'utf8')` turns every invalid sequence into U+FFFD, so
// two files differing only in undecodable bytes would hash the same.
function fileDigest(path: string): Buffer {
  return createHash('sha256')
    .update(withoutCarriageReturns(readFileSync(path)))
    .digest();
}

/** CRLF folded to LF so a Windows checkout digests as a Unix one; a lone CR is content and stays. */
function withoutCarriageReturns(bytes: Buffer): Buffer {
  const CR = 0x0d;
  const LF = 0x0a;
  const out = Buffer.allocUnsafe(bytes.length);
  let length = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === CR && bytes[index + 1] === LF) continue;
    out[length] = bytes[index]!;
    length += 1;
  }
  return out.subarray(0, length);
}

/**
 * Every regular file under the directory, POSIX-relative and sorted. Deliberately unfiltered: the digest
 * answers "is this tree what we vendored", so a stray remappings.txt or Foo.sol.bak has to count.
 */
export function listRelativeFiles(directory: string): readonly string[] {
  const walk = (current: string, prefix: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const relative = prefix === '' ? entry.name : `${prefix}${posix.sep}${entry.name}`;
      if (entry.isDirectory()) return walk(join(current, entry.name), relative);
      if (entry.isFile()) return [relative];
      // A symlink reads as neither, and silently dropping one would let a file be swapped for a link
      // without changing the digest.
      throw new Error(`${join(current, entry.name)} is neither a regular file nor a directory`);
    });
  // Sorted once, globally: a per-level sort would order './b' before './a/z'.
  return walk(directory, '')
    .map((file) => file.split(sep).join(posix.sep))
    .sort((left, right) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8')));
}
