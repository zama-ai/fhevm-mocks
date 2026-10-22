import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { vendoredZamaConfigAbsPath } from '@fhevm/sdk-common-dev';

/** This generation's dev package: the directory holding the package.json with `fhevm.vendoredFrom`. */
const GENERATION_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

void test('resolves ZamaConfig.sol inside the copy package.json#fhevm.vendoredFrom declares', () => {
  const packageJson = JSON.parse(readFileSync(join(GENERATION_DIR, 'package.json'), 'utf8')) as {
    fhevm?: { vendoredFrom?: { to?: string; from?: string } };
  };
  const declared = packageJson.fhevm?.vendoredFrom ?? {};
  const to = declared.to ?? '';
  assert.notEqual(to, '', 'the dev package must declare fhevm.vendoredFrom, written by `fhevm-npm sync vendored`');
  assert.equal(declared.from, 'library-solidity/config', 'the dev package pins upstream config, nothing else');

  const resolved = vendoredZamaConfigAbsPath(GENERATION_DIR);
  assert.equal(resolved, join(GENERATION_DIR, to, 'ZamaConfig.sol'));
  assert.equal(resolved, join(GENERATION_DIR, 'internal', 'zama-config', 'ZamaConfig.sol'));
  assert.equal(existsSync(resolved), true, 'the copy is not on disk — run `fhevm-npm sync vendored`');
});

void test('refuses a package that declares no pinned copy, rather than guessing a layout', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'zama-config-path-'));
  try {
    writeFileSync(join(scratch, 'package.json'), '{"name":"no-vendored-block"}\n');
    assert.throws(() => vendoredZamaConfigAbsPath(scratch), /declares no fhevm\.vendoredFrom\.to/);

    writeFileSync(
      join(scratch, 'package.json'),
      JSON.stringify({ name: 'moved', fhevm: { vendoredFrom: { to: 'internal/zama-config' } } }),
    );
    assert.throws(() => vendoredZamaConfigAbsPath(scratch), /does not exist.*sync vendored/);

    mkdirSync(join(scratch, 'internal', 'zama-config'), { recursive: true });
    writeFileSync(join(scratch, 'internal', 'zama-config', 'ZamaConfig.sol'), '// stub\n');
    assert.equal(vendoredZamaConfigAbsPath(scratch), join(scratch, 'internal', 'zama-config', 'ZamaConfig.sol'));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
