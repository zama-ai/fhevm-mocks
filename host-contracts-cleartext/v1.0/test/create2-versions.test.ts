// A live contract is recognized by its version LINE, not its exact string: the same contract and `v<major>.<minor>`,
// any patch. A hotfix may bump a patch, and a stack deployed from an earlier patch reports an older one.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  FHEVM_VERSION,
  generationOfMarker,
  majorMinorOf,
  releaseLabel,
  sameVersionLine,
  versionLine,
} from '../create2-deploy/ts/common.ts';
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
  assert.equal(majorMinorOf('1.0.0-0'), '1.0');
  assert.equal(majorMinorOf('1.0.0-rc.1'), '1.0');
  const acl = readFileSync(join(PACKAGE_ROOT_ABS_PATH, 'pkg/src/cleartext/CleartextACL.sol'), 'utf8');
  const marker = /uint256 public constant CLEARTEXT_PROTOCOL_VERSION = ([\d_]+);/.exec(acl)?.[1];
  assert.ok(marker !== undefined, 'CleartextACL declares CLEARTEXT_PROTOCOL_VERSION');
  assert.equal(generationOfMarker(BigInt(marker.replaceAll('_', ''))), FHEVM_VERSION);
});

void test('a marker decodes to its generation: legacy below 1.0, major.minor.patch from 1.0 on', () => {
  assert.equal(generationOfMarker(13n), '0.13');
  assert.equal(generationOfMarker(14n), '0.14');
  assert.equal(generationOfMarker(1_000_000n), '1.0');
  assert.equal(generationOfMarker(1_000_001n), '1.0', 'the patch is not part of the generation');
  assert.equal(generationOfMarker(1_001_000n), '1.1');
  assert.equal(generationOfMarker(2_000_000n), '2.0');
});

void test('an event folder spells the release without the major below 1.0, with it from 1.0 on', () => {
  assert.equal(releaseLabel('0.14.1'), 'v14.1');
  assert.equal(releaseLabel('1.0.0'), 'v1.0.0');
  assert.equal(releaseLabel('0.14'), 'v14');
  assert.equal(releaseLabel('1.0'), 'v1.0');
});
