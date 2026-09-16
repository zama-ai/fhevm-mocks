// Run: npm run generate:version
//
// Must run BEFORE `forge build`: the constant it writes is a compile input, not an output.

import { writeVersion } from '../generateVersion.ts';

console.log(`  FhevmStdVersion.VERSION = ${writeVersion()}`);
