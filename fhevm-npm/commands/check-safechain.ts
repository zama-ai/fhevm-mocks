import { join, relative } from 'node:path';

import {
  AIKIDO_MALWARE_LIST,
  type LockedPackage,
  committedLockfiles,
  lockedPackages,
  parseMalwareList,
  validateSafechain,
} from '../base/checks/safechain.ts';
import { defaultLockfileReader } from '../base/checks/pinned-dependencies.ts';
import type { CommandReport } from '../base/diagnostics.ts';
import { packageDirectory } from '../base/paths.ts';
import { type PackumentFetch, fetchPackument, fetchPackuments } from '../base/registry-age.ts';
import type { NpmManifest } from '../manifest.ts';

/** Reads Aikido's malware list; injected by tests. A failure leaves the age check standing alone. */
export type MalwareListFetch = () => Promise<ReadonlySet<string>>;

const fetchMalwareList: MalwareListFetch = async () => {
  const response = await fetch(AIKIDO_MALWARE_LIST, { signal: AbortSignal.timeout(60_000) });
  if (response.status !== 200) throw new Error(`HTTP ${String(response.status)}`);
  return parseMalwareList((await response.json()) as unknown);
};

export async function checkSafechain(
  options: { readonly workspaceRoot: string; readonly manifest: NpmManifest; readonly minAgeHours: number },
  fetchOne: PackumentFetch = fetchPackument,
  fetchMalware: MalwareListFetch = fetchMalwareList,
): Promise<CommandReport> {
  const directories = [
    ...Object.keys(options.manifest.packages).map((key) => packageDirectory(options.workspaceRoot, key)),
    join(options.workspaceRoot, 'fhevm-npm'),
  ];
  const lockfiles = committedLockfiles(options.workspaceRoot, directories);
  const lockfileKey = (file: string): string => `./${relative(options.workspaceRoot, file)}`;
  const locked: LockedPackage[] = lockfiles.flatMap((file) =>
    lockedPackages(lockfileKey(file), defaultLockfileReader(file) ?? {}),
  );

  const notes: string[] = [];
  const [packuments, malware] = await Promise.all([
    fetchPackuments(
      locked.map((pkg) => pkg.name),
      fetchOne,
    ),
    fetchMalware().catch((error: unknown) => {
      notes.push(
        `Aikido malware list unreadable (${error instanceof Error ? error.message : String(error)}): only the minimum age was checked`,
      );
      return undefined;
    }),
  ]);

  return {
    command: 'check safechain',
    checkedPackageKeys: lockfiles.map(lockfileKey),
    checkedItemLabel: `lockfile(s), ${String(new Set(locked.map((pkg) => `${pkg.name}@${pkg.version}`)).size)} registry package version(s)`,
    notes,
    violations: validateSafechain(locked, packuments, malware, options.minAgeHours),
  };
}
