import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDuration, linePrefixer } from '../base/test-engine/output.ts';
import { formatElapsed } from '../base/test-engine/progress.ts';

function prefixed(chunks: readonly Buffer[]): readonly string[] {
  const lines: string[] = [];
  const prefixer = linePrefixer({ prefix: '> ', write: (line) => lines.push(line) });

  for (const chunk of chunks) prefixer.push(chunk);

  prefixer.flush();

  return lines;
}

test('a line split over chunks comes out whole, with one prefix', () => {
  assert.deepEqual(prefixed([Buffer.from('one\ntw'), Buffer.from('o\nthree\n')]), ['> one', '> two', '> three']);
});

test('output that ends without a newline comes out on flush', () => {
  assert.deepEqual(prefixed([Buffer.from('one\nlast')]), ['> one', '> last']);
  assert.deepEqual(prefixed([Buffer.from('one\n')]), ['> one']);
});

test('a character split over chunks comes out whole', () => {
  const bytes = Buffer.from('é\n');

  assert.deepEqual(prefixed([bytes.subarray(0, 1), bytes.subarray(1)]), ['> é']);
});

test('formatDuration shows seconds with one decimal', () => {
  assert.equal(formatDuration(2049), '2.0s');
  assert.equal(formatDuration(50), '0.1s');
});

test('formatElapsed shows seconds, then minutes, then hours, and never a fraction', () => {
  assert.equal(formatElapsed(0), '0s');
  assert.equal(formatElapsed(45_900), '45s');
  assert.equal(formatElapsed(125_000), '2m05s');
  assert.equal(formatElapsed(3_725_000), '1h02m05s');
});
