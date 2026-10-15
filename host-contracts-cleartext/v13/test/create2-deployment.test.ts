// `--deployment <stack folder>`: the stack's latest event is the live stack, and records are never written into.
// findLatestEvent is pure apart from reading files; the refusals are checked through deploy-cli itself, at a stage
// that needs no chain.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { findLatestEvent, RECORDS_DIR } from '../create2-deploy/ts/common.ts';
import { PACKAGE_ROOT_ABS_PATH } from '../internal/constants.ts';

const STACK = 'cleartext-v13-sepolia-2026-10-05-1';
const ADMIN = '0xD9F9298BbcD72843586e7E08DAe577E3a0aC8866';

type Files = Record<string, string>;

function stackFolder(t: test.TestContext, files: Files): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'create2-deployment-')));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const stack = join(root, STACK);
  mkdirSync(stack, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(resolve(stack, path, '..'), { recursive: true });
    writeFileSync(join(stack, path), content);
  }
  return stack;
}

const event = (name: string, kind: string, config: Record<string, unknown> = {}): Files => ({
  [`${name}/${kind}.config.json`]: JSON.stringify({ deploymentId: STACK, outDir: 'record', ...config }),
  [`${name}/record/manifest.json`]: JSON.stringify({ deploymentId: STACK, chainId: 11155111, admin: ADMIN }),
});

void test('the latest event is the highest sequence; its config and seal are what --deployment takes', (t) => {
  const stack = stackFolder(t, {
    ...event('00-deploy-v13.0-2026-10-05', 'deploy', { rpcUrl: 'https://deploy.example', account: 'deployer' }),
    ...event('01-hotfix-v13.1-2026-10-20', 'hotfix', { rpcUrl: 'https://hotfix.example', adminAccount: 'admin' }),
    'README.md': '# story\n',
    'aborted/2026-10-30-upgrade-v14.1-1/ABORTED.md': 'why\n',
  });
  const latest = findLatestEvent(stack);
  if (typeof latest === 'string') assert.fail(latest);
  assert.equal(latest.stack, STACK);
  assert.equal(latest.event, '01-hotfix-v13.1-2026-10-20');
  assert.equal(latest.manifestPath, join(stack, '01-hotfix-v13.1-2026-10-20/record/manifest.json'));
  assert.deepEqual(latest.config, { rpcUrl: 'https://hotfix.example', adminAccount: 'admin' });
  assert.equal(latest.admin, ADMIN);
});

void test('a folder the next event could not extend soundly is refused, with the reason', (t) => {
  const reason = (files: Files): string => {
    const found = findLatestEvent(stackFolder(t, files));
    return typeof found === 'string' ? found : '(found)';
  };
  assert.match(reason({ 'deploy.config.json': '{}', 'record/manifest.json': '{}' }), /legacy flat record/);
  assert.match(reason(event('01-upgrade-v14.0-2026-11-02', 'upgrade')), /no 00-deploy-/);
  assert.match(reason({ '00-deploy-v13.0-2026-10-05/record/manifest.json': '{}' }), /no readable deploy\.config\.json/);
  assert.match(
    reason({
      '00-deploy-v13.0-2026-10-05/deploy.config.json': JSON.stringify({ deploymentId: STACK, outDir: 'record' }),
    }),
    /has no sealed manifest/,
  );
  assert.equal(findLatestEvent(join(tmpdir(), 'no-such-stack-folder')), 'not a folder');
});

const DEPLOY_CLI = join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', 'deploy-cli');
const cli = (args: readonly string[]): { status: number | null; output: string } => {
  const run = spawnSync(DEPLOY_CLI, [...args], { encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
};

void test('a deploy takes no --deployment: it creates a stack', () => {
  const run = cli(['--deployment', tmpdir(), '--stage', 'log']);
  assert.notEqual(run.status, 0);
  assert.match(run.output, /a deploy creates a new one/);
});

void test("a flow takes only its own live stack's address flags: a deploy takes none", () => {
  const run = cli(['--acl', `0x${'0'.repeat(39)}1`, '--stage', 'log']);
  assert.notEqual(run.status, 0);
  assert.match(run.output, /unknown argument '--acl'/);
});

void test('no tool writes inside deployments/, where records are archived', () => {
  assert.equal(RECORDS_DIR, resolve(PACKAGE_ROOT_ABS_PATH, '..', '..', 'deployments'));
  const run = cli([
    '--rpc-url',
    'http://127.0.0.1:1',
    '--deployment-id',
    'x',
    '--out-dir',
    join(RECORDS_DIR, 'x'),
    '--stage',
    'log',
  ]);
  assert.notEqual(run.status, 0);
  assert.match(run.output, /is inside .*deployments, where deployment records are archived/);
});

void test('--fork is refused for a deploy, with --rpc-url, and on a node that is not an anvil', () => {
  const hotfix = (args: readonly string[]): { status: number | null; output: string } => {
    const r = spawnSync(join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', 'hotfix-cli'), [...args], { encoding: 'utf8' });
    return { status: r.status, output: `${r.stdout}${r.stderr}` };
  };
  const deploy = cli(['--fork', 'http://127.0.0.1:1', '--stage', 'log']);
  assert.notEqual(deploy.status, 0);
  assert.match(deploy.output, /--fork simulates a re-point of a deployed stack/);

  const both = hotfix(['--fork', 'http://127.0.0.1:1', '--rpc-url', 'http://127.0.0.1:1', '--stage', 'log']);
  assert.notEqual(both.status, 0);
  assert.match(both.output, /drop --rpc-url/);

  // Nothing answers on port 1, so it is not an anvil: refused before anything else is resolved.
  const notAnvil = hotfix(['--fork', 'http://127.0.0.1:1', '--stage', 'log']);
  assert.notEqual(notAnvil.status, 0);
  assert.match(notAnvil.output, /did not answer anvil_nodeInfo: it is not an anvil fork/);
});

void test('a re-point that sends to a chain that is not an anvil names the real stack: --real <deploymentId>', (t) => {
  // The upgrade lane exists only while the generation carries one: the rotation deletes `upgrade/` (ROTATION.md).
  const flows = ['hotfix-cli', join('upgrade', 'upgrade-cli')].filter((flow) =>
    existsSync(join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', flow)),
  );
  assert.ok(flows.includes('hotfix-cli'), 'hotfix-cli is part of every generation');
  const root = mkdtempSync(join(tmpdir(), 'create2-real-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const out = join(root, 'out');
  for (const flow of flows) {
    const run = (args: readonly string[]): { status: number | null; output: string } => {
      // Nothing answers on port 1, so it is not an anvil.
      const base = ['--rpc-url', 'http://127.0.0.1:1', '--deployment-id', 'x', '--account', 'k', '--out-dir', out];
      const r = spawnSync(join(PACKAGE_ROOT_ABS_PATH, 'create2-deploy', flow), [...base, ...args], {
        encoding: 'utf8',
      });
      return { status: r.status, output: `${r.stdout}${r.stderr}` };
    };
    const REFUSED = /it changes the REAL stack 'x'/;
    for (const stage of ['all', 'creates']) {
      const bare = run(['--stage', stage]);
      assert.notEqual(bare.status, 0, `${flow} ${stage}`);
      assert.match(bare.output, REFUSED, `${flow} ${stage}`);
      assert.match(bare.output, /--real x/, `${flow} ${stage}`);
    }
    const wrong = run(['--stage', 'creates', '--real', 'y']);
    assert.match(wrong.output, /--real y does not name this stack/, flow);
    // Past the guard, the run stops at the next missing option: --admin.
    for (const args of [
      ['--stage', 'creates', '--real', 'x'],
      ['--stage', 'creates', '--dry-run'],
      ['--stage', 'verify'],
    ]) {
      const passed = run(args);
      assert.doesNotMatch(passed.output, REFUSED, `${flow} ${args.join(' ')}`);
      assert.match(passed.output, /--admin is required/, `${flow} ${args.join(' ')}`);
    }
  }
});
