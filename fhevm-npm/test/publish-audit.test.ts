import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { type AuditNpmRunner, auditFindings, auditTarball, installedPeers } from '../base/publish-audit.ts';
import { auditViolations } from '../base/publish-check.ts';
import { parseCliOptions } from '../cli-options.ts';
import { loadedPackage } from './helpers.ts';

const shipped = {
  name: '@fhevm/hardhat-plugin-v3',
  version: '0.13.1',
  dependencies: { '@fhevm/host-contracts-cleartext': '^0.13.1' },
  peerDependencies: { hardhat: '^3.0.0', viem: '^2.55.19' },
};

const report = {
  vulnerabilities: {
    undici: {
      severity: 'high',
      range: '<=6.28.0',
      via: [{ title: 'Undici smuggling' }, 'tmp'],
      nodes: ['node_modules/undici'],
    },
    tmp: {
      severity: 'critical',
      range: '<=0.2.5',
      via: [{ title: 'tmp path traversal' }],
      nodes: ['node_modules/tmp'],
    },
    cookie: { severity: 'low', range: '<0.7.0', via: [{ title: 'cookie bounds' }], nodes: ['node_modules/cookie'] },
  },
};

test('findings below the level are dropped; the rest come most severe first', () => {
  assert.deepEqual(
    auditFindings(report, 'high').map((finding) => [finding.name, finding.severity, finding.advisories]),
    [
      ['tmp', 'critical', ['tmp path traversal']],
      ['undici', 'high', ['Undici smuggling', 'via tmp']],
    ],
  );
  assert.equal(auditFindings(report, 'low').length, 3);
  assert.deepEqual(auditFindings({}, 'info'), []);
});

test('a peer reaching the probe is detected, by npm flag or by a top-level copy', () => {
  assert.deepEqual(
    installedPeers(
      {
        '': {},
        'node_modules/@fhevm/host-contracts-cleartext': { version: '0.13.1' },
        'node_modules/viem': { version: '2.57.0' },
        'node_modules/ox': { version: '0.14.0', peer: true },
      },
      shipped,
    ),
    ['node_modules/ox', 'node_modules/viem'],
  );
  // A name the tarball also lists as a dependency is something it brings, not a peer.
  assert.deepEqual(
    installedPeers(
      { 'node_modules/hardhat': { version: '3.20.0' } },
      { ...shipped, dependencies: { hardhat: '^3.0.0' } },
    ),
    [],
  );
});

/** A fake npm: `install` writes the given lock entries, `audit` prints the given report. */
function fakeNpm(entries: Record<string, unknown>, auditOutput: string, calls: string[][] = []): AuditNpmRunner {
  return (directory, args) => {
    calls.push([...args]);
    if (args[0] === 'install') {
      writeFileSync(join(directory, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: entries }));
      return { status: 0, stdout: '', stderr: '' };
    }
    return { status: 1, stdout: auditOutput, stderr: '' };
  };
}

test('the tarball is installed alone without peers, then audited', () => {
  const calls: string[][] = [];
  const result = auditTarball(
    '/tmp/plugin.tgz',
    shipped,
    'high',
    fakeNpm({ '': {}, 'node_modules/undici': { version: '6.0.0' } }, JSON.stringify(report), calls),
  );
  assert.equal(result.kind, 'audited');
  if (result.kind !== 'audited') throw new Error('unreachable');
  assert.deepEqual(
    result.findings.map((finding) => finding.name),
    ['tmp', 'undici'],
  );
  assert.equal(result.installed, 1);
  const install = calls[0] ?? [];
  assert.deepEqual(install.slice(0, 2), ['install', '/tmp/plugin.tgz']);
  for (const flag of ['--legacy-peer-deps', '--package-lock-only', '--ignore-scripts'])
    assert.ok(install.includes(flag));
  assert.deepEqual(calls[1], ['audit', '--json']);
});

test('a probe that installed a peer is refused before npm audit runs', () => {
  const calls: string[][] = [];
  const result = auditTarball(
    '/tmp/plugin.tgz',
    shipped,
    'high',
    fakeNpm({ '': {}, 'node_modules/hardhat': { version: '3.20.0', peer: true } }, '{}', calls),
  );
  assert.deepEqual(result, { kind: 'peers-installed', peers: ['node_modules/hardhat'] });
  assert.equal(calls.length, 1);
});

test('an install or audit that npm cannot complete is reported, never read as clean', () => {
  const failingInstall: AuditNpmRunner = () => ({ status: 1, stdout: '', stderr: 'npm error notarget\nno match' });
  assert.deepEqual(auditTarball('/tmp/x.tgz', shipped, 'high', failingInstall), {
    kind: 'failed',
    step: 'install',
    detail: 'npm error notarget | no match',
  });
  assert.equal(auditTarball('/tmp/x.tgz', shipped, 'high', fakeNpm({ '': {} }, 'not json')).kind, 'failed');
  const auditError = JSON.stringify({ error: { code: 'ENOAUDIT', summary: 'registry unreachable' } });
  assert.deepEqual(auditTarball('/tmp/x.tgz', shipped, 'high', fakeNpm({ '': {} }, auditError)), {
    kind: 'failed',
    step: 'audit',
    detail: 'registry unreachable',
  });
});

test('each finding, a peer leak or a failure becomes a violation of the payload', () => {
  const pkg = loadedPackage(
    './hardhat/v3/plugin/pkg',
    { kind: 'published', name: shipped.name, member: true },
    shipped,
  );
  const [finding] = auditViolations(
    pkg,
    { kind: 'audited', findings: auditFindings(report, 'critical'), installed: 3 },
    'critical',
  );
  assert.equal(finding?.packageKey, './hardhat/v3/plugin/pkg/package.json');
  assert.match(
    finding?.message ?? '',
    /tmp <=0\.2\.5 is critical: tmp path traversal \[installed at node_modules\/tmp\]/,
  );
  assert.deepEqual(auditViolations(pkg, { kind: 'audited', findings: [], installed: 3 }, 'high'), []);
  assert.match(
    auditViolations(pkg, { kind: 'peers-installed', peers: ['node_modules/hardhat'] }, 'high')[0]?.message ?? '',
    /installed peer dependencies \(node_modules\/hardhat\)/,
  );
  assert.match(
    auditViolations(pkg, { kind: 'failed', step: 'install', detail: 'boom' }, 'high')[0]?.message ?? '',
    /'npm install' failed in the probe project: boom/,
  );
});

test("'publish check --audit' defaults to high and validates --audit-level", () => {
  const plain = parseCliOptions(['publish', 'check', './hardhat/v3/plugin/pkg']);
  if (plain.command !== 'publish-check') throw new Error('unreachable');
  assert.equal(plain.auditLevel, undefined);
  const audited = parseCliOptions(['publish', 'check', './hardhat/v3/plugin/pkg', '--check-npmjs', '--audit']);
  if (audited.command !== 'publish-check') throw new Error('unreachable');
  assert.equal(audited.auditLevel, 'high');
  const strict = parseCliOptions(['publish', 'check', 'x', '--audit', '--audit-level', 'moderate']);
  if (strict.command !== 'publish-check') throw new Error('unreachable');
  assert.equal(strict.auditLevel, 'moderate');
  assert.throws(
    () => parseCliOptions(['publish', 'check', 'x', '--audit', '--audit-level', 'severe']),
    /--audit-level/,
  );
});
