// Renders sdk/cleartext-config.json — the source of truth for the cleartext stack's shared values —
// into every file generated FROM it. Three faces:
//
//   common-vendored/src/cleartext-config-<gen>.ts              one COMPLETE TypeScript face per generation:
//                                                              every constant that generation has a field
//                                                              for. `sync-vendored` copies it into that
//                                                              generation's pkg/ts as the stable name
//                                                              `cleartext-config.ts` (a published package
//                                                              cannot import the private helper); internal/
//                                                              imports it from @fhevm/sdk-vendored-dev by
//                                                              its generation name.
//   <gen>/pkg/src/cleartext/shared/LibFhevmCleartextConfig.sol   written PER GENERATION, directly — a .sol
//                                                              in common-vendored would make it a
//                                                              Solidity-owning package with no forge.
//                                                              It sits in the payload's Foundry half
//                                                              because it is the payload's own config,
//                                                              readable by a consumer and by the
//                                                              create2-deploy scripts alike.
//   <gen>/scripts/cleartext-config.sh                          per generation likewise; sourced by the
//                                                              launchers, never executed.
//
// The generations come from the JSON's own `appliesTo.generations`, so adding one extends the fan-out.
//
// Scoping. A constant without `generations` reaches every generation — the historical meaning, and still
// the common case. One with `generations: ["v14"]` reaches v14's three faces and no other generation's.
// Every face is complete for its generation, so the same shared constant appears in each generation's
// TypeScript face: generated duplication from one JSON, not a fork. Declaration order is preserved.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type GeneratedCleartextConfigStatus = {
  readonly path: string;
  readonly status: 'identical' | 'missing' | 'different';
};

export type GenerateCleartextConfigOptions = {
  readonly workspaceRoot: string;
  readonly check: boolean;
};

type RenderedOutput = { readonly path: string; readonly content: string };

type ConstantEntry = {
  readonly value?: string;
  readonly alias?: string;
  readonly ts: 'bigint' | 'number' | 'string';
  readonly tsEmit?: 'bigint';
  readonly solidity: string;
  /** One line, emitted above the constant in the Solidity face. The long-form `note` stays in the JSON. */
  readonly summary: string;
  readonly formula?: string;
  /** Generations whose faces carry this constant. Absent means every one in `appliesTo.generations`. */
  readonly generations?: readonly string[];
};

type LocalhostBlock = {
  readonly MNEMONIC: { readonly value: string };
  readonly DEPLOYER_ADDRESS_INDEX: { readonly value: string };
  readonly DEPLOYER_ADDRESS: { readonly value: string };
  readonly DEPLOYER_START_NONCE: { readonly value: string };
  readonly zamaConfigLocal: Readonly<Record<string, string>>;
};

type CleartextConfig = {
  readonly constants: ReadonlyMap<string, ConstantEntry>;
  readonly localhost: LocalhostBlock;
  readonly generations: readonly string[];
};

/** The central file, workspace-relative — also how violations that point at it are keyed. */
export const CLEARTEXT_CONFIG_FILE = 'cleartext-config.json';
const CONFIG_FILE = CLEARTEXT_CONFIG_FILE;

/** The generation family the per-generation faces are written into: `host-contracts-cleartext/<gen>/…`. */
export const CLEARTEXT_CONFIG_FAMILY = 'host-contracts-cleartext';

/** The `appliesTo.generations` list, for the check that compares it with npm-manifest.json#generations. */
export function cleartextConfigGenerations(workspaceRoot: string): readonly string[] {
  return loadCleartextConfig(join(workspaceRoot, CONFIG_FILE)).generations;
}

export function generateCleartextConfig(
  options: GenerateCleartextConfigOptions,
): readonly GeneratedCleartextConfigStatus[] {
  const outputs = renderCleartextConfigFaces(options.workspaceRoot);
  if (options.check) return outputs.map(compareOutput);

  for (const output of outputs) {
    mkdirSync(dirname(output.path), { recursive: true });
    writeFileSync(output.path, output.content);
  }
  return outputs.map((output) => ({ path: output.path, status: 'identical' as const }));
}

export function renderCleartextConfigFaces(workspaceRoot: string): readonly RenderedOutput[] {
  const config = loadCleartextConfig(join(workspaceRoot, CONFIG_FILE));
  const generation = (gen: string, ...segments: readonly string[]): string =>
    join(workspaceRoot, CLEARTEXT_CONFIG_FAMILY, gen, ...segments);

  return config.generations.flatMap((gen) => {
    const visible = visibleConstants(config.constants, gen);
    return [
      { path: join(workspaceRoot, ...tsFacePath(gen)), content: renderTsFace(gen, visible) },
      {
        path: generation(gen, 'pkg', 'src', 'cleartext', 'shared', 'LibFhevmCleartextConfig.sol'),
        content: renderSolFace(visible),
      },
      { path: generation(gen, 'scripts', 'cleartext-config.sh'), content: renderShFace(visible, config.localhost) },
    ];
  });
}

/** `common-vendored/src/cleartext-config-<gen>.ts`, exported so a consumer can name the file it is synced from. */
export function tsFacePath(gen: string): readonly string[] {
  return ['common-vendored', 'src', `cleartext-config-${gen}.ts`];
}

/** A generation's faces: everything unscoped, plus what is scoped to it, in declaration order. */
function visibleConstants(
  constants: ReadonlyMap<string, ConstantEntry>,
  gen: string,
): ReadonlyMap<string, ConstantEntry> {
  return new Map([...constants].filter(([, e]) => e.generations === undefined || e.generations.includes(gen)));
}

function compareOutput(output: RenderedOutput): GeneratedCleartextConfigStatus {
  if (!existsSync(output.path)) return { path: output.path, status: 'missing' };
  const status = readFileSync(output.path, 'utf8') === output.content ? 'identical' : 'different';
  return { path: output.path, status };
}

function loadCleartextConfig(configFile: string): CleartextConfig {
  if (!existsSync(configFile)) throw new Error(`${configFile} not found — it is the cleartext source of truth.`);
  const parsed = JSON.parse(readFileSync(configFile, 'utf8')) as {
    appliesTo?: { generations?: readonly string[] };
    constants?: Record<string, ConstantEntry>;
    localhost?: LocalhostBlock;
  };
  // Object key order is declaration order; the faces preserve it, so aliases follow what they alias.
  const generations = parsed.appliesTo?.generations ?? [];
  if (generations.length === 0) throw new Error(`${configFile} declares no "appliesTo.generations".`);
  for (const gen of generations) {
    if (!/^v\d+$/.test(gen)) throw new Error(`appliesTo.generations: '${gen}' is not a generation key like 'v13'`);
  }

  const constants = new Map(Object.entries(parsed.constants ?? {}));
  if (constants.size === 0) throw new Error(`${configFile} declares no "constants" — refusing to emit an empty face.`);
  for (const [name, entry] of constants) validateEntry(name, entry, constants, generations);

  return { constants, localhost: validateLocalhost(configFile, parsed.localhost), generations };
}

function validateEntry(
  name: string,
  entry: ConstantEntry,
  declared: ReadonlyMap<string, ConstantEntry>,
  generations: readonly string[],
): void {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error(`${name}: not a CONSTANT_CASE identifier`);
  if ((entry.value === undefined) === (entry.alias === undefined)) {
    throw new Error(`${name}: exactly one of "value" or "alias" must be present`);
  }
  if (entry.generations !== undefined) {
    if (entry.generations.length === 0)
      throw new Error(`${name}: "generations" is empty — omit it to mean every generation`);
    if (new Set(entry.generations).size !== entry.generations.length) {
      throw new Error(`${name}: "generations" repeats a generation`);
    }
    for (const gen of entry.generations) {
      if (!generations.includes(gen)) {
        throw new Error(
          `${name}: scoped to '${gen}', which appliesTo.generations does not list (${generations.join(', ')})`,
        );
      }
    }
  }
  if (entry.alias !== undefined) {
    const target = declared.get(entry.alias);
    if (target === undefined) throw new Error(`${name}: aliases ${entry.alias}, which is not declared`);
    // Every face emits the alias as a bare reference to the target's NAME, so the target has to be in every
    // face the alias lands in: an alias may be scoped more narrowly than its target, never more widely.
    if (!coversScope(target, entry)) {
      throw new Error(
        `${name}: aliases ${entry.alias}, which is not declared everywhere ${name} is (${describeScope(entry)} vs ` +
          `${describeScope(target)}); a target's "generations" must include every generation of its alias`,
      );
    }
  }
  if (!['bigint', 'number', 'string'].includes(entry.ts)) throw new Error(`${name}: unknown "ts" type ${entry.ts}`);
  if (entry.tsEmit !== undefined && (entry.tsEmit !== 'bigint' || entry.ts === 'string')) {
    throw new Error(`${name}: "tsEmit" may only widen a numeric "ts" to bigint`);
  }
  if (entry.value !== undefined && entry.ts !== 'string' && !/^\d+$/.test(entry.value)) {
    throw new Error(`${name}: numeric value must be decimal digits, got ${entry.value}`);
  }
  if (!/^(string|address|bytes32|u?int\d*|bool)$/.test(entry.solidity)) {
    throw new Error(`${name}: unknown "solidity" type ${entry.solidity}`);
  }
}

/** Whether `target` is visible in every generation `entry` is: unscoped covers all, scoped covers a subset. */
function coversScope(target: ConstantEntry, entry: ConstantEntry): boolean {
  if (target.generations === undefined) return true;
  if (entry.generations === undefined) return false;
  return entry.generations.every((gen) => target.generations?.includes(gen));
}

function describeScope(entry: ConstantEntry): string {
  return entry.generations === undefined ? 'every generation' : `generations [${entry.generations.join(', ')}]`;
}

const ZAMA_LOCAL_FIELDS = ['ACLAddress', 'CoprocessorAddress', 'KMSVerifierAddress'] as const;

function validateLocalhost(configFile: string, localhost: LocalhostBlock | undefined): LocalhostBlock {
  if (localhost === undefined) throw new Error(`${configFile} declares no "localhost" block.`);
  for (const key of ['MNEMONIC', 'DEPLOYER_ADDRESS_INDEX', 'DEPLOYER_ADDRESS', 'DEPLOYER_START_NONCE'] as const) {
    if (typeof localhost[key]?.value !== 'string') throw new Error(`localhost.${key}: missing "value"`);
  }
  for (const field of ZAMA_LOCAL_FIELDS) {
    if (typeof localhost.zamaConfigLocal[field] !== 'string') {
      throw new Error(`localhost.zamaConfigLocal.${field}: missing`);
    }
  }
  return localhost;
}

////////////////////////////////////////////////////////////////////////////////
// TypeScript face
////////////////////////////////////////////////////////////////////////////////

function renderTsFace(gen: string, constants: ReadonlyMap<string, ConstantEntry>): string {
  const entries = [...constants].map(([name, entry]) => renderTsEntry(name, entry));
  return `${tsFaceHeader(gen)}\n${entries.join('\n\n')}\n`;
}

function renderTsEntry(name: string, entry: ConstantEntry): string {
  const comment = entry.formula === undefined ? '' : `// ${entry.formula}\n`;
  return `${comment}export const ${name} = ${tsLiteral(entry)};`;
}

function tsLiteral(entry: ConstantEntry): string {
  if (entry.alias !== undefined) return entry.alias;
  const value = entry.value ?? '';
  if (entry.ts === 'string') return quote(value);
  return (entry.tsEmit ?? entry.ts) === 'bigint' ? `${value}n` : value;
}

// Prettier's rule: single quotes unless the value contains one (the HD paths do). No value holds both.
function quote(value: string): string {
  if (value.includes("'") && value.includes('"')) throw new Error(`cannot quote a value holding both quote kinds`);
  return value.includes("'") ? `"${value}"` : `'${value}'`;
}

function tsFaceHeader(_gen: string): string {
  return `// AUTO-GENERATED by \`fhevm-npm generate cleartext-config\` from sdk/cleartext-config.json — DO NOT EDIT.`;
}

////////////////////////////////////////////////////////////////////////////////
// Solidity face
////////////////////////////////////////////////////////////////////////////////

function renderSolFace(constants: ReadonlyMap<string, ConstantEntry>): string {
  const entries = [...constants].map(([name, entry]) => renderSolEntry(name, entry));
  return `${SOL_FACE_HEADER}library LibFhevmCleartextConfig {\n${entries.join('\n\n')}\n}\n`;
}

function renderSolEntry(name: string, entry: ConstantEntry): string {
  // The one-line `summary` from the JSON, then the derivation where the JSON records one. The long-form
  // `note` is deliberately NOT emitted: it belongs in the JSON, once, where it is edited.
  const summary = `    /// ${entry.summary}\n`;
  const formula = entry.formula === undefined ? '' : `    // ${entry.formula}\n`;
  return `${summary}${formula}    ${entry.solidity} internal constant ${name} = ${solLiteral(entry)};`;
}

function solLiteral(entry: ConstantEntry): string {
  if (entry.alias !== undefined) return entry.alias;
  const value = entry.value ?? '';
  // An address is a bare (checksummed) literal; everything non-numeric is a double-quoted string.
  if (entry.solidity === 'address') return value;
  if (/^u?int\d*$/.test(entry.solidity)) return value;
  if (value.includes('"')) throw new Error(`cannot emit a Solidity string holding a double quote`);
  return `"${value}"`;
}

const SOL_FACE_HEADER = `// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title  LibFhevmCleartextConfig
 * @notice AUTO-GENERATED by \`fhevm-npm generate cleartext-config\` from cleartext-config.json — DO NOT
 *         EDIT. That JSON is where these values are decided, and where the long-form note on each one
 *         lives; regenerate with \`make generate\` after editing it.
 */
`;

////////////////////////////////////////////////////////////////////////////////
// Shell face
////////////////////////////////////////////////////////////////////////////////

function renderShFace(visible: ReadonlyMap<string, ConstantEntry>, l: LocalhostBlock): string {
  const constants = [...visible].map(([name, entry]) => renderShEntry(name, entry)).join('\n');
  return `${SH_FACE_HEADER}
${constants}

# The localhost deploy recipe. MNEMONIC is the DEPLOY mnemonic — NOT FHEVM_MNEMONIC, which derives the
# KMS and coprocessor signer pools. Two different strings with two different jobs: swap them and the
# stack's addresses look right while its signatures never verify.
MNEMONIC=${shQuote(l.MNEMONIC.value)}
DEPLOYER_ADDRESS_INDEX=${shQuote(l.DEPLOYER_ADDRESS_INDEX.value)}
DEPLOYER_ADDRESS=${shQuote(l.DEPLOYER_ADDRESS.value)}
DEPLOYER_START_NONCE=${shQuote(l.DEPLOYER_START_NONCE.value)}

# The three addresses ZamaConfig._getLocalConfig() compiles into consumer bytecode, under the names the
# launchers use. Note ZAMA_LOCAL_COPROCESSOR (ZamaConfig's CoprocessorAddress) IS the FHEVMExecutor.
ZAMA_LOCAL_ACL=${shQuote(l.zamaConfigLocal['ACLAddress'] ?? '')}
ZAMA_LOCAL_COPROCESSOR=${shQuote(l.zamaConfigLocal['CoprocessorAddress'] ?? '')}
ZAMA_LOCAL_KMS_VERIFIER=${shQuote(l.zamaConfigLocal['KMSVerifierAddress'] ?? '')}
`;
}

function renderShEntry(name: string, entry: ConstantEntry): string {
  const comment = entry.formula === undefined ? '' : `# ${entry.formula}\n`;
  const literal = entry.alias !== undefined ? `"$${entry.alias}"` : shQuote(entry.value ?? '');
  return `${comment}${name}=${literal}`;
}

// Everything is double-quoted (the HD paths hold single quotes), so nothing the shell expands may appear.
function shQuote(value: string): string {
  if (/["$\\`]/.test(value)) throw new Error(`cannot emit a shell value holding ", $, \\ or a backtick`);
  return `"${value}"`;
}

const SH_FACE_HEADER = `#!/usr/bin/env bash
# AUTO-GENERATED by \`fhevm-npm generate cleartext-config\` from sdk/cleartext-config.json — DO NOT EDIT.
#
# Sourced, never executed: the shell face of the cleartext stack's source of truth. Every \`constants\`
# entry verbatim, then the localhost deploy recipe and the ZamaConfig trio under the names the launchers
# use. Values are baked in and CHECKED IN, so a script works from a checkout of one generation alone,
# with no jq and no reach above the package. Regenerate with \`make generate\` after editing the JSON.
# shellcheck disable=SC2034  # consumed by the scripts that source this file
`;
