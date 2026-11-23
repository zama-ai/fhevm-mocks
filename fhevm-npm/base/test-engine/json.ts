import { existsSync, readFileSync } from 'node:fs';

import { TestEngineError } from './errors.ts';
import { errorMessage } from './utils.ts';

export type JsonObject = Readonly<Record<string, unknown>>;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a JSON file whose root is an object. Fails with the path when the file is missing or is not one. */
export function readJsonObject(path: string): JsonObject {
  if (!existsSync(path)) throw new TestEngineError(`${path} does not exist.`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new TestEngineError(`${path} is not valid JSON: ${errorMessage(error)}`);
  }

  if (!isPlainObject(parsed)) throw new TestEngineError(`${path} is not a JSON object.`);

  return parsed;
}
