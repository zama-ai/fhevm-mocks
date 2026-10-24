import {
  generationFamilies,
  validateGenerationCleartextConfig,
  validateGenerationDependencies,
  validateGenerationMemberFlags,
  validateGenerationUpgradeSuite,
  validateGenerationVendoredDestinations,
} from '../base/checks/generations.ts';
import { localVendoredManifest } from '../base/checks/vendored.ts';
import type { CheckCommand } from '../base/command.ts';
import { CLEARTEXT_CONFIG_FAMILY, cleartextConfigGenerations } from '../base/generate-cleartext-config.ts';
import { loadPackages } from '../base/npm.ts';

/**
 * Rules 3.4.x, the generation pair declared in npm-manifest.json#generations: V(N)'s published payload is
 * the workspace member and V(N-1)'s is not; every dependency on a package of the family targets V(N) and
 * only V(N) itself may also depend on V(N-1); every vendored destination under the family sits in a live
 * generation; cleartext-config.json fans out to exactly the live generations; and the upgrade suite that needs a live
 * V(N-1) is declared by V(N) alone.
 * Read-only, like every check.
 */
export const checkGenerations: CheckCommand = (context) => {
  const packages = loadPackages(context.workspaceRoot, context.manifest);
  const families = generationFamilies(context.manifest);
  const violations = [
    ...validateGenerationMemberFlags(context.manifest),
    ...validateGenerationUpgradeSuite(context.manifest, packages),
    ...validateGenerationDependencies(context.manifest, packages),
    ...validateGenerationVendoredDestinations(context.manifest, localVendoredManifest(context.manifest).destinations),
    ...validateGenerationCleartextConfig(
      context.manifest,
      CLEARTEXT_CONFIG_FAMILY,
      cleartextConfigGenerations(context.workspaceRoot),
    ),
  ];
  return {
    command: 'check generations',
    checkedPackageKeys: packages.map((pkg) => pkg.key),
    checkedItemLabel: 'package(s)',
    verboseSuccesses:
      violations.length === 0
        ? families.map(
            (family) =>
              `${family.family}: V(N) is ${family.current}` +
              (family.previous === undefined ? ', no V(N-1)' : `, V(N-1) is ${family.previous}`),
          )
        : undefined,
    violations,
  };
};
