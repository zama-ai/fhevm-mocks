// The config remapping prefix has one source of truth, the import in FHEVMHostAddresses.sol. The other
// places that must carry it cannot import it, so they are checked against it here.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { FHEVM_VERSION } from '../create2-deploy/ts/common.ts';
import { fhevmConfigRemappingPrefix } from '../internal/configRemapping.ts';
import { PACKAGE_ROOT_ABS_PATH } from '../internal/constants.ts';

void test('the prefix is read from the import the contracts compile through, once', () => {
  assert.match(fhevmConfigRemappingPrefix(), /^fhevm-config-\d+\.\d+\.0\/$/);
  assert.equal(fhevmConfigRemappingPrefix(), fhevmConfigRemappingPrefix());
});

void test('remappings.txt maps the same prefix', () => {
  const remappings = readFileSync(join(PACKAGE_ROOT_ABS_PATH, 'remappings.txt'), 'utf8').split('\n');
  assert.ok(
    remappings.some((line) => line.startsWith(`${fhevmConfigRemappingPrefix()}=`)),
    `remappings.txt has no ${fhevmConfigRemappingPrefix()}= line`,
  );
});

void test("the prefix names the package's MAJOR.MINOR, the salt's version", () => {
  assert.equal(fhevmConfigRemappingPrefix(), `fhevm-config-${FHEVM_VERSION}.0/`);
});
