// The ports on which tests start their local nodes, read from the workspace's test-ports.config.json.
//
// A test asks for its port by name and never spells a number: a number in a test file is a second
// place to keep in step with every other suite, and two suites that pick the same one cannot run at the
// same time. The file's own `_readme` says who may not read it and how those are held to it.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findWorkspaceRootAbsPath } from './paths.ts';

const TEST_PORTS_CONFIG_FILE = 'test-ports.config.json';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The port a test starts its node on. Reads the file on each call: the callers are tests, and the file
 * is small.
 *
 * @param group The package that owns the port, by its workspace path.
 * @param name The port's name inside the group.
 * @throws if test-ports.config.json has no such port, or gives it something that is not an integer: a
 * test must never fall back to a default port, and a wrong value must not reach anvil as an argument.
 * @example
 * testPort('host-contracts-cleartext/<vN>', 'create2-deploy');
 */
export function testPort(group: string, name: string): number {
  const workspaceRoot = findWorkspaceRootAbsPath(dirname(fileURLToPath(import.meta.url)));
  const parsed: unknown = JSON.parse(readFileSync(join(workspaceRoot, TEST_PORTS_CONFIG_FILE), 'utf8'));
  const groups = isRecord(parsed) ? parsed.groups : undefined;
  const owner = isRecord(groups) ? groups[group] : undefined;
  const port = isRecord(owner) && isRecord(owner.ports) ? owner.ports[name] : undefined;
  if (port === undefined) {
    throw new Error(`${TEST_PORTS_CONFIG_FILE} has no port '${name}' in group '${group}'`);
  }
  if (typeof port !== 'number' || !Number.isInteger(port)) {
    throw new Error(
      `${TEST_PORTS_CONFIG_FILE} gives port '${name}' of group '${group}' a value that is not an integer`,
    );
  }
  return port;
}
