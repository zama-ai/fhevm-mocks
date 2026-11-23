import { dirname, resolve } from 'node:path';

import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';

import { TestEngineError } from './errors.ts';
import { type JsonObject, readJsonObject } from './json.ts';
import { checkRpcVariablesOfCommands } from './live-chains.ts';
import type { PortSpec } from './port-spec.ts';
import { errorMessage } from './utils.ts';

/** The key of an inventory that names its schema. It is not a test. */
const SCHEMA_KEY = '$schema';

/** The start of a URL, as opposed to a file path. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

////////////////////////////////////////////////////////////////////////////////
// Types
////////////////////////////////////////////////////////////////////////////////
// These types mirror the inventory schema, which lives with the specification, outside this repository.
// The schema is the only validator: the engine checks no field itself, and trusts these types only for
// an inventory that the schema accepted.

export const CHAIN_RUNTIMES = ['forge', 'forge-fork', 'hardhat', 'anvil', 'hardhat-node', 'remote'] as const;
export type ChainRuntime = (typeof CHAIN_RUNTIMES)[number];

type ChainBase = {
  readonly chainid: number;
  readonly fhevm: 'local' | 'testnet' | 'devnet' | 'mainnet' | 'none';
};

/** A chain that runs in a separate node process. */
export type NodeChain = ChainBase & {
  readonly runtime: 'anvil' | 'hardhat-node';
  readonly startedBy: 'runner' | 'test';
  readonly fresh: boolean | 'possibly';
  /** The ports that the inventory states for the chain. Required by the schema when the test starts the node. */
  readonly port?: PortSpec | undefined;
};

/** The live chain itself. */
export type RemoteChain = ChainBase & {
  readonly runtime: 'remote';
  readonly wallet: boolean;
};

/** A chain inside forge, copied from a live chain. */
export type ForkChain = ChainBase & {
  readonly runtime: 'forge-fork';
  /** `null` comes from the inventory format: the test needs a fixed block whose number is still to find. */
  readonly block?: number | null | undefined;
};

/** A chain inside the test process. */
export type InProcessChain = ChainBase & {
  readonly runtime: 'forge' | 'hardhat';
};

export type Chain = NodeChain | RemoteChain | ForkChain | InProcessChain;

export type Test = {
  readonly command: string;
  readonly package: string;
  readonly duration?: 'fast' | 'slow' | 'very-slow' | undefined;
  readonly ci: boolean;
  readonly skipped?: true | undefined;
  readonly chains: readonly Chain[];
};

/** One test with its ID: what the engine passes around. */
export type InventoryEntry = {
  readonly id: string;
  readonly test: Test;
};

export type Inventory = {
  readonly file: string;
  readonly schemaFile: string;
  /** The tests by ID, in the order of the inventory file. */
  readonly tests: ReadonlyMap<string, Test>;
};

////////////////////////////////////////////////////////////////////////////////
// Loading
////////////////////////////////////////////////////////////////////////////////

export type LoadInventoryInput = {
  readonly inventoryFile: string;
  /** The schema to validate against. Undefined: the file that the inventory's `$schema` names. */
  readonly schemaFile: string | undefined;
};

/**
 * Loads an inventory, and validates it against its schema and against the live chains that its commands
 * name. Fails with one error that lists every violation.
 */
export function loadInventory(input: LoadInventoryInput): Inventory {
  const document = readJsonObject(input.inventoryFile);
  const schemaFile = input.schemaFile ?? referencedSchemaFile({ document, inventoryFile: input.inventoryFile });

  validateAgainstSchema({ document, inventoryFile: input.inventoryFile, schemaFile });

  // The schema accepted the document, so each value other than `$schema` is a test.
  const tests = new Map<string, Test>();

  for (const [id, value] of Object.entries(document)) {
    if (id !== SCHEMA_KEY) tests.set(id, value as Test);
  }

  const inventory = { file: input.inventoryFile, schemaFile, tests };

  checkRpcVariablesOfCommands(inventory);

  return inventory;
}

type SchemaReferenceInput = {
  readonly document: JsonObject;
  readonly inventoryFile: string;
};

function referencedSchemaFile(input: SchemaReferenceInput): string {
  const reference = input.document[SCHEMA_KEY];

  if (typeof reference !== 'string' || reference.length === 0) {
    throw new TestEngineError(
      `${input.inventoryFile} names no schema. Add a '${SCHEMA_KEY}' key to it, or pass --schema.`,
    );
  }

  if (URL_SCHEME.test(reference)) {
    throw new TestEngineError(
      `${input.inventoryFile} names its schema by a URL, and the engine reads a schema from a file only. Pass --schema.`,
    );
  }

  return resolve(dirname(input.inventoryFile), reference);
}

type ValidationInput = {
  readonly document: JsonObject;
  readonly inventoryFile: string;
  readonly schemaFile: string;
};

function validateAgainstSchema(input: ValidationInput): void {
  const validate = compileSchema(input.schemaFile);

  if (validate(input.document)) return;

  const violations = (validate.errors ?? []).filter(isOwnViolation).map((error) => `  ${formatViolation(error)}`);

  throw new TestEngineError(
    [`${input.inventoryFile} does not match ${input.schemaFile}:`, ...new Set(violations)].join('\n'),
  );
}

// compileSchema and formatViolation resemble private code of commands/check-json-schemas.ts. The copy is
// deliberate: that command is outside the engine, and the engine changes no other code of fhevm-npm.
function compileSchema(schemaFile: string): ValidateFunction<unknown> {
  const schema = readJsonObject(schemaFile);

  // `required` inside `if` and `not` refers to properties that the enclosing object declares. That is
  // valid JSON Schema, but Ajv's strictRequired and strictTypes checks reject it.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, strictTypes: false });

  try {
    return ajv.compile(schema);
  } catch (error) {
    throw new TestEngineError(`${schemaFile} is not a valid JSON Schema: ${errorMessage(error)}`);
  }
}

/**
 * False for an error that only repeats another one: Ajv reports a failed `if` branch next to the error
 * of the branch, and a rejected key next to the `propertyNames` error that names the key.
 */
function isOwnViolation(error: ErrorObject): boolean {
  if (error.keyword === 'if') return false;

  return error.propertyName === undefined || error.keyword === 'propertyNames';
}

function formatViolation(error: ErrorObject): string {
  const path = error.instancePath === '' ? '/' : error.instancePath;

  if (error.keyword === 'required') {
    return `${path}: missing required property '${String(error.params['missingProperty'])}'`;
  }

  if (error.keyword === 'additionalProperties') {
    return `${path}: unknown property '${String(error.params['additionalProperty'])}'`;
  }

  // The keys of an inventory are its test IDs.
  if (error.keyword === 'propertyNames') {
    return `${path}: invalid test ID '${String(error.params['propertyName'])}'`;
  }

  return `${path}: ${error.message ?? `failed '${error.keyword}' validation`}`;
}
