import type { NpmManifest } from '../manifest.ts';
import { pinAvailability } from '../base/pin-availability.ts';

/** The exit code that means "unavailable": distinct from 1, so a caller never mistakes a crash for a skip. */
export const PIN_UNAVAILABLE_EXIT_CODE = 10;

/**
 * `pin-available <name>`: exit 0 when the pinned dependency is usable here, PIN_UNAVAILABLE_EXIT_CODE with the
 * reason when npm-manifest.json#dependencies.unavailable declares it and its pin is not a tarball.
 */
export function pinAvailableCommand(manifest: NpmManifest, name: string): void {
  if (manifest.dependencies?.pinned?.[name] === undefined) {
    throw new Error(`'${name}' is not in npm-manifest.json#dependencies.pinned`);
  }
  const availability = pinAvailability(manifest, name);
  if (availability.available) {
    console.log(`✅ ${name}: available`);
    return;
  }
  console.log(`⏭️  ${name}: unavailable — ${availability.reason}`);
  process.exitCode = PIN_UNAVAILABLE_EXIT_CODE;
}
