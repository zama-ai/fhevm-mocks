import { resolve } from 'node:path';

const DEFAULT_INVENTORY_NAME = 'ALL_TESTS.json';
const DEFAULT_REPORT_NAME = 'test-report.json';
const DEFAULT_LOGS_NAME = 'test-logs';

/** The variables that say where the report and the logs go, when no option does. */
export const REPORT_VARIABLE = 'FHEVM_TEST_REPORT';
export const LOGS_VARIABLE = 'FHEVM_TEST_LOGS';

/** Where the engine works, as typed on the command line. */
export type LocationOptions = {
  readonly root: string;
  readonly inventory?: string | undefined;
  readonly schema?: string | undefined;
  /** A file of environment variables to read before anything else. */
  readonly envFile?: string | undefined;
  readonly report?: string | undefined;
  readonly logs?: string | undefined;
};

/** Where the engine works, as absolute paths. Every path is outside the repository of the engine. */
export type Locations = {
  /** The directory each test command runs from. */
  readonly root: string;
  readonly inventoryFile: string;
  /** Undefined: the inventory names its own schema. */
  readonly schemaFile: string | undefined;
  readonly reportFile: string;
  /** The directory that holds one log per test. */
  readonly logsDirectory: string;
};

export const INVENTORY_OPTION_DEFAULT = `<root>/${DEFAULT_INVENTORY_NAME}`;
export const REPORT_OPTION_DEFAULT = `<root>/${DEFAULT_REPORT_NAME}`;
export const LOGS_OPTION_DEFAULT = `<root>/${DEFAULT_LOGS_NAME}/`;

/**
 * Resolves the locations. A path that a person gives is relative to the current directory, as in any
 * shell command; only a default is relative to the root.
 *
 * The report and the logs follow the order that forge follows for its own settings: an option wins over
 * an environment variable, which wins over the default. So an operator can send them out of the root,
 * for example out of a git repository that must stay clean, without changing any command.
 */
export function resolveLocations(options: LocationOptions): Locations {
  const root = resolve(options.root);
  const givenOrDefault = (path: { given: string | undefined; defaultName: string }): string => {
    return path.given === undefined || path.given === '' ? resolve(root, path.defaultName) : resolve(path.given);
  };

  return {
    root,
    inventoryFile: givenOrDefault({ given: options.inventory, defaultName: DEFAULT_INVENTORY_NAME }),
    schemaFile: options.schema === undefined ? undefined : resolve(options.schema),
    reportFile: givenOrDefault({
      given: options.report ?? process.env[REPORT_VARIABLE],
      defaultName: DEFAULT_REPORT_NAME,
    }),
    logsDirectory: givenOrDefault({
      given: options.logs ?? process.env[LOGS_VARIABLE],
      defaultName: DEFAULT_LOGS_NAME,
    }),
  };
}
