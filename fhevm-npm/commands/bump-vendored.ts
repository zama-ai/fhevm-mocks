import { bumpVendored } from '../base/bump-vendored.ts';
import type { CommandReport } from '../base/diagnostics.ts';

/**
 * `bump vendored <package> --tag <tag> [--repository <url>] [--commit <sha>] [--check]`: every pin under
 * that package moves to the tag, and everything derived from the pin follows — digests, copies, and each
 * owning package.json's `fhevm.vendoredFrom`. What it does NOT decide is what the new upstream means for
 * the code that wraps it; the report says whether the copies change, which is when that question arises.
 */
export async function bumpVendoredCommand(options: {
  readonly workspaceRoot: string;
  readonly manifestFile: string;
  readonly selector: string;
  readonly repository?: string;
  readonly tag: string;
  readonly commit?: string;
  readonly check: boolean;
  readonly verbose: boolean;
}): Promise<CommandReport> {
  const onProgress = options.verbose
    ? (message: string): void => {
        console.log(message);
      }
    : undefined;

  const result = await bumpVendored({ ...options, onProgress });

  const written = result.sync?.written ?? [];
  const perEntry = result.entries.map((entry) => {
    const touched = written.filter((path) => path.replace(/^removed /, '').startsWith(`${entry.relPath}/`)).length;
    const change = !entry.copiesChange
      ? 'copies unchanged'
      : options.check
        ? 'copies WOULD change'
        : `${String(touched)} file(s) rewritten`;
    return `${entry.packageKey} ${entry.relPath}: ${entry.from.tag} (${entry.from.commit.slice(0, 12)}) → ${entry.to.tag} (${entry.to.commit.slice(0, 12)}), ${change}`;
  });

  return {
    command: options.check ? 'bump-vendored --check' : 'bump-vendored',
    checkedPackageKeys: result.entries.map((entry) => entry.packageKey),
    checkedItemLabel: 'pinned tree(s)',
    // Printed at every verbosity: a bump that changed nothing and one that rewrote twenty files must
    // read differently, and the difference is what tells the operator whether the wrappers need a look.
    notes: [
      ...perEntry,
      result.manifestWritten ? 'npm-manifest.json written' : options.check ? 'nothing written (--check)' : '',
    ].filter((note) => note.length > 0),
    verboseSuccesses: written.map((path) => (path.startsWith('removed ') ? path : `wrote ${path}`)),
    violations: result.violations,
  };
}
