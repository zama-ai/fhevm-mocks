import type { CommandReport } from '../base/diagnostics.ts';
import type { AuditLevel } from '../base/publish-audit.ts';
import { formatRehearsal, rehearseRelease } from '../base/publish-rehearse.ts';
import type { NpmManifest } from '../manifest.ts';

export type PublishRehearseOptions = {
  readonly excludes: readonly string[];
  readonly auditLevel: AuditLevel;
  readonly outDir?: string;
};

/** `publish rehearse`: pack, check, ask the registry and audit every payload a release publishes, in one report. */
export async function publishRehearse(
  workspaceRoot: string,
  manifest: NpmManifest,
  options: PublishRehearseOptions,
): Promise<CommandReport> {
  const { set, payloads } = await rehearseRelease(workspaceRoot, manifest, {
    excludes: options.excludes,
    auditLevel: options.auditLevel,
    outDir: options.outDir,
    // Nothing is published during a rehearsal, so a missing version will not appear by waiting: ask once.
    registry: {
      fetchRegistry: (url: string) => fetch(url, { signal: AbortSignal.timeout(15_000) }),
      retries: 0,
      retryDelayMs: 0,
      sleep: async () => {},
    },
  });
  for (const dropped of set.dropped) console.log(`⏭️  ${dropped.key}: not rehearsed (${dropped.reason})`);
  console.log(formatRehearsal(payloads));
  return {
    command: 'publish rehearse',
    checkedPackageKeys: payloads.map((payload) => payload.key),
    checkedItemLabel: 'payload(s)',
    violations: payloads.flatMap((payload) => payload.violations),
  };
}
