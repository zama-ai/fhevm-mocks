// How the create2 coordinators make forge size the gas of what they send: from the NODE's estimate
// (`--skip-simulation`), never from forge's own simulation, which runs with the compile target's EVM rules
// (cancun) and goes stale at the chain's next gas repricing. On Sepolia's 2026-10-06 fork it set 7.8M for a
// create that needed 38.2M. The argument list is pure; the refusals are checked through the CLIs themselves,
// at a stage that needs no chain.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { forgeSendArgs, parseGasEstimateMultiplier } from '../create2-deploy/ts/common.ts';
import { PACKAGE_ROOT_ABS_PATH } from '../internal/constants.ts';

void test('a send takes its gas from the node: --skip-simulation, one transaction at a time', () => {
  assert.deepEqual(forgeSendArgs(null), ['--slow', '--skip-simulation', '--broadcast']);
  assert.deepEqual(forgeSendArgs(300), [
    '--slow',
    '--skip-simulation',
    '--gas-estimate-multiplier',
    '300',
    '--broadcast',
  ]);
});

void test('the multiplier is a whole percentage of at least 100, from the command line or the config file', () => {
  assert.equal(parseGasEstimateMultiplier('250', '--gas-estimate-multiplier'), 250);
  assert.equal(parseGasEstimateMultiplier(130, 'config'), 130);
  assert.equal(parseGasEstimateMultiplier(100, 'config'), 100);
});

const run = (cli: string, args: readonly string[]): { status: number | null; output: string } => {
  const r = spawnSync(join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', cli), [...args], { encoding: 'utf8' });
  return { status: r.status, output: `${r.stdout}${r.stderr}` };
};
const REFUSED = /must be a whole percentage of at least 100/;

void test('a multiplier below 100%, or not a whole number, is refused before anything else', () => {
  for (const cli of ['deploy-cli', 'upgrade/upgrade-cli', 'hotfix-cli']) {
    for (const value of ['50', '99', '1.5', 'abc', '-200']) {
      const r = run(cli, ['--gas-estimate-multiplier', value, '--stage', 'log']);
      assert.notEqual(r.status, 0, `${cli} ${value}`);
      assert.match(r.output, REFUSED, `${cli} ${value}`);
    }
    // Accepted: whatever stops the run next, it is not the multiplier.
    const ok = run(cli, ['--gas-estimate-multiplier', '300', '--stage', 'log']);
    assert.doesNotMatch(ok.output, REFUSED, cli);
  }
});

void test('in a config file the key is gasEstimateMultiplier, held to the same rule', (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'create2-gas-')));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const config = (value: unknown): string => {
    const path = join(dir, `upgrade-${String(Math.random()).slice(2)}.config.json`);
    writeFileSync(path, JSON.stringify({ gasEstimateMultiplier: value }));
    return path;
  };
  for (const value of [50, 1.5, '200', null]) {
    const r = run('upgrade/upgrade-cli', ['--config', config(value), '--stage', 'log']);
    assert.notEqual(r.status, 0, JSON.stringify(value));
    assert.match(r.output, /"gasEstimateMultiplier" in .* must be a whole percentage/, JSON.stringify(value));
  }
  const ok = run('upgrade/upgrade-cli', ['--config', config(400), '--stage', 'log']);
  assert.doesNotMatch(ok.output, REFUSED);
  assert.doesNotMatch(ok.output, /unknown key 'gasEstimateMultiplier'/);
});
