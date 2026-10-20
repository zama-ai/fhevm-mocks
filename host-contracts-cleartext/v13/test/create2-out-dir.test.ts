// The create2 coordinators' out dir is canonical: symlinks resolved, whether or not the folder exists yet.
//
// Forge compares the real path of every file a script writes with `fs_permissions` as written, so an out dir
// granted under a symlinked name (macOS's `/tmp`, really `/private/tmp`) was refused under its real one:
// "vm.writeFile: the path … is not allowed". No forge here: the property is the path the tool hands to it.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { canonicalPath, resolveOutDir } from '../create2-deploy/ts/common.ts';

void test('an out dir reached through a symlink resolves to its real path', (t) => {
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'create2-out-dir-')));
  t.after(() => {
    rmSync(scratch, { recursive: true, force: true });
  });
  const real = join(scratch, 'real');
  const link = join(scratch, 'link');
  mkdirSync(real);
  symlinkSync(real, link);

  // Existing, missing below an existing symlink, and missing two levels down.
  assert.equal(canonicalPath(link), real);
  assert.equal(canonicalPath(join(link, 'out')), join(real, 'out'));
  assert.equal(canonicalPath(join(link, 'a', 'b')), join(real, 'a', 'b'));
  // No symlink on the way: unchanged.
  assert.equal(canonicalPath(join(real, 'out')), join(real, 'out'));

  // What every stage uses, and so what lands in the generated forge config.
  assert.equal(resolveOutDir(join(link, 'out')), join(real, 'out'));
});
