// Run: npm run generate:forge-shared
//
// Must run BEFORE any compile of the Forge payload: `pkg/forge/src/shared` is a duplicate, and a stale
// one compiles perfectly well against the previous generation's types.

import { writeForgeShared } from '../generateForgeShared.ts';

const { files, repointed } = writeForgeShared();

for (const name of files) {
  console.log(`  ${name.padEnd(34)} ${repointed.includes(name) ? 'repointed' : ''}`);
}
console.log(`\n  ${files.length} files -> pkg/forge/src/shared`);
