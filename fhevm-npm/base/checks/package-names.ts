import type { Violation, ViolationTag } from '../diagnostics.ts';
import type { LoadedPackage } from '../npm.ts';

const PRIVATE_PACKAGE_KINDS = new Set(['dev', 'shared-helper', 'internal-consumer']);
const PRIVATE_PACKAGE_VERSION = '0.0.0';

export function validatePackageNames(packages: readonly LoadedPackage[]): readonly Violation[] {
  const violations: Violation[] = [];

  for (const pkg of packages) {
    const expectedName = pkg.inventory.name;
    const actualName = pkg.packageJson.name;

    if (expectedName === undefined && actualName !== undefined) {
      violations.push(
        failure(pkg, `package.json name "${actualName}" is forbidden for kind ${pkg.inventory.kind}`, 'package-name'),
      );
    } else if (expectedName !== undefined && actualName !== expectedName) {
      violations.push(
        failure(
          pkg,
          `package.json name ${quote(actualName)} does not match manifest name "${expectedName}"`,
          'package-name',
        ),
      );
    }

    if (PRIVATE_PACKAGE_KINDS.has(pkg.inventory.kind)) {
      if (pkg.packageJson.private !== true) {
        violations.push(failure(pkg, 'private development packages must set private: true'));
      }
      if (actualName === undefined || !actualName.endsWith('-dev')) {
        violations.push(failure(pkg, `private development package name ${quote(actualName)} must end in -dev`));
      }
      if (pkg.packageJson.version !== PRIVATE_PACKAGE_VERSION) {
        violations.push(
          failure(
            pkg,
            `private development package version ${quote(pkg.packageJson.version)} must be "${PRIVATE_PACKAGE_VERSION}"`,
            'NR-01',
          ),
        );
      }
    }

    if (pkg.inventory.kind === 'published') {
      if (pkg.packageJson.private === true) {
        violations.push(failure(pkg, 'a published package cannot set private: true', 'NR-09'));
      }
      if (actualName?.endsWith('-dev')) {
        violations.push(failure(pkg, `published package name "${actualName}" cannot end in -dev`));
      }
    }
  }

  return violations;
}

function failure(pkg: LoadedPackage, message: string, rule: ViolationTag = 'NR-40'): Violation {
  return { rule, packageKey: packageJsonKey(pkg), message };
}

/**
 * A file inside a package, keyed the way a violation should name it: the file a reader would open to
 * fix it, not the directory it lives in — an editor turns a path with a filename into a link, and a
 * bare package key into nothing.
 */
export function fileInPackage(key: string, file: string): string {
  return key === '.' ? `./${file}` : `${key}/${file}`;
}

export function packageJsonPath(key: string): string {
  return fileInPackage(key, 'package.json');
}

export function lockfilePath(key: string): string {
  return fileInPackage(key, 'package-lock.json');
}

export function packageJsonKey(pkg: LoadedPackage): string {
  return packageJsonPath(pkg.key);
}

function quote(value: string | undefined): string {
  return value === undefined ? '<missing>' : `"${value}"`;
}
