// The ports of this package's tests, by name. The numbers live in the workspace's test-ports.config.json,
// under the group named after this package's workspace path.

import { testPort as workspaceTestPort } from '@fhevm/sdk-common-dev';
import { relative, sep } from 'node:path';
import { PACKAGE_ROOT_ABS_PATH, WORKSPACE_ROOT_ABS_PATH } from './constants.ts';

/** This package's group in test-ports.config.json: its workspace path, with forward slashes. */
const TEST_PORTS_GROUP = relative(WORKSPACE_ROOT_ABS_PATH, PACKAGE_ROOT_ABS_PATH).split(sep).join('/');

/** The port a test of this package starts its node on. Throws if the name is not in the file. */
export function testPort(name: string): number {
  return workspaceTestPort(TEST_PORTS_GROUP, name);
}
