import type { NpmManifest } from '../manifest.ts';
import type { CommandReport } from '../base/diagnostics.ts';
import type { AuditLevel } from '../base/publish-audit.ts';
import { inspectPublishedTarball } from '../base/publish-check.ts';
import { devOnlyTarballPinViolations } from '../base/tarball-pins.ts';

export type PublishCheckOptions = {
  readonly payload: string;
  readonly outDir?: string;
  readonly checkNpmjs: boolean;
  readonly retries: number;
  readonly retryDelaySeconds: number;
  /** Audit what the tarball brings, peers excluded; implies the registry phase, which it needs. */
  readonly auditLevel?: AuditLevel;
};

/** `publish check <payload>`: the packed tarball carries only registry specs and the central version; with --check-npmjs, the registry agrees; with --audit, what it brings is free of known advisories. */
export async function publishCheck(
  workspaceRoot: string,
  manifest: NpmManifest,
  options: PublishCheckOptions,
): Promise<CommandReport> {
  const registry =
    options.checkNpmjs || options.auditLevel !== undefined
      ? {
          fetchRegistry: (url: string) => fetch(url, { signal: AbortSignal.timeout(15_000) }),
          retries: options.retries,
          retryDelayMs: options.retryDelaySeconds * 1000,
          sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
        }
      : undefined;
  const inspection = await inspectPublishedTarball(workspaceRoot, manifest, options.payload, {
    outDir: options.outDir,
    registry,
    ...(options.auditLevel === undefined ? {} : { audit: { level: options.auditLevel } }),
  });
  return {
    command: 'publish check',
    checkedPackageKeys: [inspection.tarball],
    checkedItemLabel: 'tarball(s)',
    // A tarball pin is for development only: nothing is published while any is set.
    violations: [...devOnlyTarballPinViolations(manifest, 'publish'), ...inspection.violations],
  };
}
