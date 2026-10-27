// Pin availability: npm-manifest.json#dependencies.unavailable declares a pinned dependency that has no usable
// release yet, and why. The tests that need it cannot say anything meaningful against what the registry has, so they
// are SKIPPED, with that reason printed, rather than run against a release that is known not to be the real one.
//
// The one way to run them is a tarball pin (tarball-pins.ts): a release candidate built elsewhere, in development.
// A tarball pin is refused in CI and by `publish check`, so a CI run always skips them, and a developer with a
// tarball pin always runs them. Nothing has to be flipped back when the release ships, except removing the entry.
//
// Asked by the Makefile (`fhevm-npm pin-available <name>`) for whole test targets, by `test-consumer` for each
// consumer fixture, and by any test reading npm-manifest.json for a single suite.

import type { NpmManifest } from '../manifest.ts';
import { type PackageJson, dependencyDeclarations } from './npm.ts';
import { isTarballPin } from './tarball-pins.ts';

export type PinAvailability = { readonly available: true } | { readonly available: false; readonly reason: string };

/** Available unless declared unavailable, and then only through a tarball pin. */
export function pinAvailability(manifest: NpmManifest, name: string): PinAvailability {
  const reason = manifest.dependencies?.unavailable?.[name];
  if (reason === undefined) return { available: true };
  const pin = manifest.dependencies?.pinned?.[name];
  if (pin !== undefined && isTarballPin(pin)) return { available: true };
  return { available: false, reason };
}

/** The unavailable dependencies a package.json declares, in any field, with their reasons. */
export function unavailableDependencies(
  manifest: NpmManifest,
  packageJson: PackageJson,
): readonly { readonly name: string; readonly reason: string }[] {
  const names = new Set(dependencyDeclarations(packageJson).map((declaration) => declaration.name));
  return [...names].flatMap((name) => {
    const availability = pinAvailability(manifest, name);
    return availability.available ? [] : [{ name, reason: availability.reason }];
  });
}
