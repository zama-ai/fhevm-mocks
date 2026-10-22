// A live contract is recognized by its version LINE, not its exact string: the same contract and `v<major>.<minor>`,
// any patch. A hotfix may bump a patch, and a stack deployed from an earlier patch reports an older one.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { FHEVM_VERSION, majorMinorOf, sameVersionLine, versionLine } from '../create2-deploy/ts/common.ts';
import { PACKAGE_ROOT_ABS_PATH } from '../internal/constants.ts';

void test('same contract, same major.minor, any patch', () => {
  assert.equal(sameVersionLine('KMSVerifier v0.3.0', 'KMSVerifier v0.3.0'), true);
  assert.equal(sameVersionLine('KMSVerifier v0.3.1', 'KMSVerifier v0.3.0'), true, 'a hotfix patch');
  assert.equal(sameVersionLine('KMSVerifier v0.3.0', 'KMSVerifier v0.3.7'), true, 'an earlier patch of the line');
  assert.equal(sameVersionLine(' KMSVerifier v0.3.2\n', 'KMSVerifier v0.3.0'), true, 'surrounding whitespace');
});

void test('another minor, major or contract is another line; garbage is no line', () => {
  assert.equal(sameVersionLine('KMSVerifier v0.4.0', 'KMSVerifier v0.3.0'), false, 'the next line');
  assert.equal(sameVersionLine('KMSVerifier v1.3.0', 'KMSVerifier v0.3.0'), false);
  assert.equal(sameVersionLine('ProtocolConfig v0.3.0', 'KMSVerifier v0.3.0'), false, 'another contract');
  assert.equal(sameVersionLine(null, 'KMSVerifier v0.3.0'), false, 'no answer');
  assert.equal(sameVersionLine('KMSVerifier 0.3.0', 'KMSVerifier v0.3.0'), false);
  assert.equal(sameVersionLine('KMSVerifier v0.3', 'KMSVerifier v0.3.0'), false);
  assert.equal(sameVersionLine('KMSVerifier v0.3.0', 'not a version'), false);
});

void test('a version line, for messages', () => {
  assert.equal(versionLine('KMSVerifier v0.3.0'), 'KMSVerifier v0.3.x');
  assert.equal(versionLine('not a version'), 'not a version');
});

void test("the salt's version is the package's MAJOR.MINOR, and names the contracts' generation", () => {
  assert.equal(majorMinorOf('0.14.2'), '0.14');
  assert.equal(majorMinorOf('1.0.0'), '1.0');
  // A prerelease names the same generation, so it salts the same addresses.
  assert.equal(majorMinorOf('0.15.0-0'), '0.15');
  assert.equal(majorMinorOf('0.15.0-rc.1'), '0.15');
  const acl = readFileSync(join(PACKAGE_ROOT_ABS_PATH, 'pkg/src/cleartext/CleartextACL.sol'), 'utf8');
  const generation = /uint256 public constant CLEARTEXT_PROTOCOL_VERSION = (\d+);/.exec(acl)?.[1];
  assert.ok(generation !== undefined, 'CleartextACL declares CLEARTEXT_PROTOCOL_VERSION');
  assert.equal(FHEVM_VERSION, `0.${generation}`);
});
