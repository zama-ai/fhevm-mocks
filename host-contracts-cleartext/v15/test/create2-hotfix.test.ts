// The hotfix's own rules, without a chain: what makes a change a plain re-point, which package may hotfix which
// record, and that hotfix-cli starts only from a sound stack folder.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PROXY_ROLES } from '../create2-deploy/ts/common.ts';
import {
  GENERATION,
  hotfixVersionRefusal,
  initializedVersionIn,
  planReinitializer,
  REINITIALIZER_SOURCES,
  reinitializerVersionIn,
} from '../create2-deploy/ts/hotfix.ts';
import { PACKAGE_ROOT_ABS_PATH } from '../internal/constants.ts';

void test('every proxy role names the source that declares its reinitializer, and it declares one', () => {
  assert.deepEqual(Object.keys(REINITIALIZER_SOURCES).sort(), [...PROXY_ROLES].sort());
  for (const [role, source] of Object.entries(REINITIALIZER_SOURCES)) {
    const version = reinitializerVersionIn(readFileSync(join(PACKAGE_ROOT_ABS_PATH, source), 'utf8'));
    assert.ok(version !== null && version > 0, `${role}: ${source} declares no REINITIALIZER_VERSION`);
  }
});

void test('a reinitializer version, read from a source and from a storage word', () => {
  assert.equal(reinitializerVersionIn('    uint64 private constant REINITIALIZER_VERSION = 6;'), 6);
  assert.equal(reinitializerVersionIn('contract X {}'), null);
  // OpenZeppelin packs `_initializing` (bool) above `_initialized` (uint64): only the low 8 bytes count.
  assert.equal(initializedVersionIn(`0x${'0'.repeat(46)}01${'0'.repeat(14)}06`), 6);
  assert.equal(initializedVersionIn(`0x${'0'.repeat(63)}7`), 7);
  assert.equal(initializedVersionIn('not a word'), null);
});

/** The refusal a plan carries, or a marker no refusal pattern matches. */
const refusal = (plan: ReturnType<typeof planReinitializer>): string =>
  typeof plan === 'string' ? plan : '(not refused)';

void test('an op is a plain re-point, or one no-argument reinitializer when it moved by exactly one', () => {
  const source = (version: number, extra = ''): string =>
    `contract C {\n    uint64 private constant REINITIALIZER_VERSION = ${String(version)};\n${extra}}\n`;
  assert.equal(planReinitializer(source(2), 2), null, 'unchanged: a plain re-point');
  assert.deepEqual(
    planReinitializer(
      source(3, '    function reinitializeV2() public virtual reinitializer(REINITIALIZER_VERSION) {}\n'),
      2,
    ),
    { call: 'reinitializeV2()', from: 2, to: 3 },
  );
  assert.match(refusal(planReinitializer(source(3), 2)), /declares no no-argument reinitializeV2\(\)/);
  assert.match(
    refusal(planReinitializer(source(3, '    function reinitializeV2(uint256 x) public {}\n'), 2)),
    /declares no no-argument reinitializeV2\(\)/,
  );
  assert.match(refusal(planReinitializer(source(4), 2)), /only a move by one is a hotfix/);
  assert.match(refusal(planReinitializer(source(1), 2)), /only a move by one is a hotfix/);
  assert.match(refusal(planReinitializer('contract C {}', 2)), /declares no REINITIALIZER_VERSION/);
  assert.match(refusal(planReinitializer(source(2), null)), /could not be read/);
});

void test('a hotfix stays in its generation and moves the patch up', () => {
  const g = String(GENERATION);
  assert.equal(hotfixVersionRefusal(`0.${g}.0`, `0.${g}.1`), null);
  assert.equal(hotfixVersionRefusal(`0.${g}.3`, `0.${g}.10`), null, 'numeric, not lexical');
  assert.match(String(hotfixVersionRefusal(`0.${g}.1`, `0.${g}.1`)), /is not newer than/);
  assert.match(String(hotfixVersionRefusal(`0.${g}.2`, `0.${g}.1`)), /is not newer than/);
  // The salt accepts a prerelease (`majorMinorOf`); a hotfix does not: it would record a patch that is not one.
  assert.match(String(hotfixVersionRefusal(`0.${g}.0`, `0.${g}.1-0`)), /is not 0\.<generation>\.<patch>/);
  assert.match(
    String(hotfixVersionRefusal(`0.${String(GENERATION - 1)}.6`, `0.${g}.1`)),
    /that is an upgrade, not a hotfix/,
  );
  assert.match(String(hotfixVersionRefusal(undefined, `0.${g}.1`)), /names no package version/);
  assert.match(String(hotfixVersionRefusal('1.2', `0.${g}.1`)), /is not 0\.<generation>\.<patch>/);
});

void test('hotfix-cli starts only from a sound stack folder', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'create2-hotfix-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const stack = join(root, 'some-stack');
  mkdirSync(stack);
  writeFileSync(join(stack, 'deploy.config.json'), '{}');
  const run = spawnSync(
    join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', 'hotfix-cli'),
    ['--deployment', stack, '--stage', 'log'],
    {
      encoding: 'utf8',
    },
  );
  assert.notEqual(run.status, 0);
  assert.match(`${run.stdout}${run.stderr}`, /legacy flat record/);
});
