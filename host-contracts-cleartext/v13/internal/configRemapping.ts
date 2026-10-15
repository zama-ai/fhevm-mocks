// The config remapping prefix, read from the Solidity that compiles through it rather than typed again here.
import { readFileSync } from 'node:fs';

import { FHEVM_HOST_ADDRESSES_SOL_ABS_PATH } from './constants.ts';

let cachedPrefix: string | undefined;

/**
 * The Solidity import prefix the contracts read their address set through — the left side of a Foundry
 * remapping, as in `fhevm-config-<major>.<minor>.0/=internal/placeholders/`. Not a directory: what it maps *to*
 * varies by who is compiling, which is the whole point.
 *
 * Version-pinned, so two protocol generations can coexist in one project without their address sets
 * colliding — which also means it moves when the protocol minor does (README step 5).
 *
 * Read once, from the import in `pkg/src/addresses/FHEVMHostAddresses.sol`: what forge compiles is the
 * truth, and `remappings.txt` must carry the same string (`test/config-remapping.test.ts`). Neither can
 * import a constant, so TypeScript reads the first instead of keeping a third copy.
 */
export function fhevmConfigRemappingPrefix(): string {
  if (cachedPrefix === undefined) {
    const source = readFileSync(FHEVM_HOST_ADDRESSES_SOL_ABS_PATH, 'utf8');
    const prefix = /from "(fhevm-config-\d+\.\d+\.\d+\/)addresses\.sol";/.exec(source)?.[1];
    if (prefix === undefined) {
      throw new Error(`${FHEVM_HOST_ADDRESSES_SOL_ABS_PATH} imports no "fhevm-config-<version>/addresses.sol"`);
    }
    cachedPrefix = prefix;
  }
  return cachedPrefix;
}
