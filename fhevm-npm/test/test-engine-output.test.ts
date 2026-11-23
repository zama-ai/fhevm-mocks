import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDuration, linePrefixer } from '../base/test-engine/output.ts';

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
