// Run: npm run generate:forge-payload
//
// Must run BEFORE `forge build`: the duplicated payload is a compile input, not an output. It also
// owns pkg/src/_host outright and wipes it, so it must run before any other generator that
// writes there. See the module for why the payload is copied instead of depended on.

import { relative } from 'node:path';
import { writeForgePayload } from '../generateForgePayload.ts';

const result = writeForgePayload();

console.log(`  generation  ${relative(process.cwd(), result.generationDir)}`);
console.log(`  files       ${result.files}`);
