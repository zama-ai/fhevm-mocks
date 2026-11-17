import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareGenerations,
  generationName,
  generationNameFromEnvSuffix,
  generationVersionLabel,
  isGenerationName,
  nextGenerations,
  parseGenerationName,
  releaseBranchOf,
} from '../base/generation-names.ts';

test('a generation name is v<minor> below 1.0 and v<major>.<minor> from 1.0 on', () => {
  assert.deepEqual(parseGenerationName('v13'), { major: 0, minor: 13 });
  assert.deepEqual(parseGenerationName('v14'), { major: 0, minor: 14 });
  assert.deepEqual(parseGenerationName('v1.0'), { major: 1, minor: 0 });
  assert.deepEqual(parseGenerationName('v1.12'), { major: 1, minor: 12 });
  for (const name of ['v0.15', 'v1', 'V1.0', 'v1.0.0', 'v01', 'v1.01', 'legacy', 'v13-rc']) {
    assert.equal(isGenerationName(name), name === 'v1', name); // `v1` reads as legacy 0.1
  }
});

test('names and versions convert both ways', () => {
  for (const name of ['v13', 'v14', 'v1.0', 'v1.1', 'v2.0']) {
    const version = parseGenerationName(name);
    assert.ok(version);
    assert.equal(generationName(version), name);
  }
  assert.equal(generationVersionLabel({ major: 0, minor: 14 }), '0.14');
  assert.equal(generationVersionLabel({ major: 1, minor: 0 }), '1.0');
});

test('generations order by version: v13 < v14 < v1.0 < v1.1 < v2.0', () => {
  const ordered = ['v2.0', 'v1.0', 'v14', 'v1.1', 'v13']
    .map((name) => ({ name, version: parseGenerationName(name)! }))
    .sort((a, b) => compareGenerations(a.version, b.version))
    .map((g) => g.name);
  assert.deepEqual(ordered, ['v13', 'v14', 'v1.0', 'v1.1', 'v2.0']);
});

test('the release branch is release/<major>.<minor>.x, and the zombie 0.15 owns none', () => {
  assert.equal(releaseBranchOf('v13'), 'release/0.13.x');
  assert.equal(releaseBranchOf('v14'), 'release/0.14.x');
  assert.equal(releaseBranchOf('v1.0'), 'release/1.0.x');
  assert.equal(releaseBranchOf('v1.1'), 'release/1.1.x');
  assert.equal(releaseBranchOf('v15'), undefined);
  assert.equal(releaseBranchOf('legacy'), undefined);
});

test('the generation after 0.14 is 1.0, never 0.15; from 1.0 on the next minor or the next major', () => {
  assert.deepEqual(nextGenerations({ major: 0, minor: 13 }), [{ major: 0, minor: 14 }]);
  assert.deepEqual(nextGenerations({ major: 0, minor: 14 }), [{ major: 1, minor: 0 }]);
  assert.deepEqual(nextGenerations({ major: 1, minor: 0 }), [
    { major: 1, minor: 1 },
    { major: 2, minor: 0 },
  ]);
});

test('an environment variable suffix spells a generation name: V13 is v13, V1_0 is v1.0', () => {
  assert.equal(generationNameFromEnvSuffix('V13'), 'v13');
  assert.equal(generationNameFromEnvSuffix('V1_0'), 'v1.0');
});
