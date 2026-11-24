// Run: npm run generate:std-fhevm-chains [-- --check]
//
// Must run BEFORE `forge build`: the chain table it writes is a compile input. With --check it writes nothing
// and exits 1 when pkg/src/StdFhevmChains.sol is not what the template, fhevm-chains.config.json and
// internal/fhevm-chain-aliases.json give.

import { generateStdFhevmChains } from '../generateStdFhevmChains.ts';

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== '--check');
if (unknown.length > 0) {
  console.error(`generateStdFhevmChains: unknown argument(s): ${unknown.join(' ')}`);
  process.exit(2);
}
const check = args.includes('--check');

const status = generateStdFhevmChains({ check });
if (status === 'different') {
  console.error(
    '❌ pkg/src/StdFhevmChains.sol is not what internal/StdFhevmChains.sol.template, fhevm-chains.config.json and ' +
      'internal/fhevm-chain-aliases.json give. ' +
      'Run `npm run generate:std-fhevm-chains`, and edit the template, never the generated file.',
  );
  process.exitCode = 1;
} else {
  console.log(`✅ pkg/src/StdFhevmChains.sol ${status === 'written' ? 'written' : 'is up to date'}`);
}
