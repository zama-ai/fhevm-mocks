// Run: node docs-tool-probe.ts <file>... , with the package folder as the working directory.
//
// Asks Prettier and ESLint, as each runs from that package, whether it would read each file, and prints one JSON line:
// `[{ "file": ..., "prettier": bool, "eslint": bool }]`, true where the tool reads the file. `check docs` spawns it,
// because both tools answer asynchronously and a check command is synchronous.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ESLint } from 'eslint';
import { getFileInfo } from 'prettier';

type ToolReads = { readonly file: string; readonly prettier: boolean; readonly eslint: boolean };

const files = process.argv.slice(2);
const cwd = process.cwd();
// The ignore files Prettier's CLI reads from its working directory.
const ignorePath = ['.gitignore', '.prettierignore']
  .map((name) => resolve(cwd, name))
  .filter((path) => existsSync(path));
const eslint = new ESLint({ cwd });

const results: ToolReads[] = [];
for (const file of files) {
  const info = await getFileInfo(resolve(cwd, file), { ignorePath });
  // A file Prettier cannot parse is never formatted, ignored or not.
  const prettier = !info.ignored && info.inferredParser !== null;
  const eslintReads = !(await eslint.isPathIgnored(resolve(cwd, file)));
  results.push({ file, prettier, eslint: eslintReads });
}
process.stdout.write(`${JSON.stringify(results)}\n`);
