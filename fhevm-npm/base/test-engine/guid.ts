import { randomUUID } from 'node:crypto';

/** The environment variable that every node of the engine carries. */
export const GUID_VARIABLE = 'FHEVM_GUID';

/** The fixed start of every GUID of the engine. A process whose GUID starts with it is a node of this engine. */
export const GUID_PREFIX = 'fhevm-test-engine';

const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** A whole GUID of the engine, and nothing else. A value that was cut off never matches. */
const GUID_PATTERN = new RegExp(`^${GUID_PREFIX}-${UUID_SOURCE}$`);

/** A new GUID, unique to one node. */
export function newGuid(): string {
  return `${GUID_PREFIX}-${randomUUID()}`;
}

export function isEngineGuid(value: string): boolean {
  return GUID_PATTERN.test(value);
}

/**
 * The GUID of the engine among the entries of an environment, each written `NAME=value`. Undefined when
 * the environment holds none, or holds a value that is not a whole GUID of the engine.
 */
export function engineGuidAmong(entries: readonly string[]): string | undefined {
  const start = `${GUID_VARIABLE}=`;
  const entry = entries.find((candidate) => candidate.startsWith(start));
  const value = entry?.slice(start.length);

  return value !== undefined && isEngineGuid(value) ? value : undefined;
}

/**
 * The environment of the engine without the GUID variable. Only a node carries a GUID: a command that
 * inherited one from the engine's own environment would look like a node of the engine.
 */
export function environmentWithoutGuid(): NodeJS.ProcessEnv {
  const { [GUID_VARIABLE]: _dropped, ...environment } = process.env;

  return environment;
}
