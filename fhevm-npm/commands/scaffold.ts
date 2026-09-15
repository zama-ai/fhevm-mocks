import { scaffold } from '../base/scaffold.ts';
import type { NpmManifest } from '../manifest.ts';

export type ScaffoldCommandOptions = {
  readonly workspaceRoot: string;
  readonly manifest: NpmManifest;
  readonly selector: string;
  readonly out: string;
  readonly registry?: string;
  readonly force: boolean;
};

export function scaffoldCommand(options: ScaffoldCommandOptions): void {
  const result = scaffold(options);

  console.log(`✅ ${result.packageKey} → ${result.out} (${String(result.fileCount)} tracked file(s))`);
  for (const { name, from, to } of result.replacements) {
    console.log(`   ${name}: "${from}" → "${to}"`);
  }
  if (result.npmrc !== undefined) {
    console.log(`   .npmrc → ${result.npmrc.split('\n')[0] ?? ''}`);
  }
  console.log(`
Install it the way a user would:
  cd ${result.out}
  npm install
`);
}
