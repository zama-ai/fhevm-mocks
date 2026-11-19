// NR-91: forge-fhevm-std's chain table, StdFhevmChains.sol, carries the addresses fhevm-chains.config.json gives.
//
// The config is the one source of every deployed address (it is rendered from the protocol registry, and
// `check fhevm-chains-origin` holds it to the registry). Solidity cannot read JSON, so the table is a
// hand-written copy, and a copy drifts silently: nothing failed when a network group was redeployed and only one
// side moved. This compares the two, entry by entry, in both directions.
//
// Compared, per (network group, chain ID): the five host contracts and `kmsGeneration` (`address(0)` when the
// host has none), the gateway's `decryption` and `inputVerification`, and the group's relayer URL. Not compared:
// the `local` group, which no config describes, and `rpcUrl`, which the config does not hold.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Violation } from '../diagnostics.ts';
import { CHAINS_CONFIG_FILE, chainsConfigPath } from '../fhevm-chains.ts';

export const RULE = 'NR-91';

/** The Solidity table, relative to the workspace root. */
export const FORGE_STD_CHAINS_FILE = 'foundry/forge-fhevm-std/pkg/src/StdFhevmChains.sol';

/** The host contracts the table names, with the same keys as `networks.<group>.hosts.<alias>.contracts`. */
const HOST_FIELDS = ['acl', 'fhevmExecutor', 'inputVerifier', 'kmsVerifier', 'protocolConfig', 'kmsGeneration'];

/** The gateway contracts the table names, with the same keys as `networks.<group>.gateway.contracts`. */
const GATEWAY_FIELDS = ['decryption', 'inputVerification'];

const ZERO = 'address(0)';

type ConfigContracts = Readonly<Record<string, { readonly address?: string } | undefined>>;
type ConfigNetwork = {
  readonly relayerUrl?: string;
  readonly gateway?: { readonly contracts?: ConfigContracts };
  readonly hosts?: Readonly<Record<string, { readonly id?: number; readonly contracts?: ConfigContracts }>>;
};
type ChainsConfig = { readonly networks?: Readonly<Record<string, ConfigNetwork>> };

/** One `FhevmChainData({ ... })` literal of the table, with its fields as written. */
export type TableEntry = {
  readonly group: string;
  readonly chainId: number;
  readonly line: number;
  readonly fields: ReadonlyMap<string, string>;
};

export type ForgeStdChainsInspection = {
  readonly checkedKeys: readonly string[];
  readonly violations: readonly Violation[];
};

export function inspectForgeStdChains(workspaceRoot: string): ForgeStdChainsInspection {
  const tablePath = join(workspaceRoot, FORGE_STD_CHAINS_FILE);
  const configPath = chainsConfigPath(workspaceRoot);
  const violations: Violation[] = [];
  const report = (message: string): void => {
    violations.push({ rule: RULE, packageKey: `./${FORGE_STD_CHAINS_FILE}`, message });
  };

  if (!existsSync(tablePath)) {
    report('the chain table is missing');
    return { checkedKeys: [], violations };
  }
  if (!existsSync(configPath)) {
    report(`${CHAINS_CONFIG_FILE} is missing, so the table has nothing to be compared with`);
    return { checkedKeys: [], violations };
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8')) as ChainsConfig;
  const networks = config.networks ?? {};
  const entries = parseChainTable(readFileSync(tablePath, 'utf8'));
  const checkedKeys: string[] = [];
  const seen = new Map<string, number>();

  for (const entry of entries) {
    const network = networks[entry.group];
    if (network === undefined) continue; // `local`, or any group the config does not describe
    const key = `${entry.group}:${String(entry.chainId)}`;
    const where = `${entry.group} chain ${String(entry.chainId)} (line ${String(entry.line)})`;
    const first = seen.get(key);
    if (first !== undefined) {
      report(`${where}: a second entry for this chain; the first is at line ${String(first)}`);
      continue;
    }
    seen.set(key, entry.line);
    checkedKeys.push(key);

    const host = Object.entries(network.hosts ?? {}).find(([, value]) => value.id === entry.chainId);
    if (host === undefined) {
      report(`${where}: ${CHAINS_CONFIG_FILE} has no ${entry.group} host with this chain ID`);
      continue;
    }
    const [alias, hostConfig] = host;
    const expected = new Map<string, string>([
      ...HOST_FIELDS.map((field) => [field, hostConfig.contracts?.[field]?.address ?? ZERO] as const),
      ...GATEWAY_FIELDS.map((field) => [field, network.gateway?.contracts?.[field]?.address ?? ZERO] as const),
    ]);
    for (const [field, want] of expected) {
      const have = entry.fields.get(field);
      if (have === undefined) report(`${where}: no \`${field}\` field to compare with ${want}`);
      else if (have.toLowerCase() !== want.toLowerCase()) {
        report(`${where} ${alias}: \`${field}\` is ${have}, but ${CHAINS_CONFIG_FILE} has ${want}`);
      }
    }
    const relayer = entry.fields.get('relayerUrl');
    if (network.relayerUrl !== undefined && relayer !== network.relayerUrl) {
      report(
        `${where} ${alias}: \`relayerUrl\` is ${relayer ?? 'missing'}, but ${CHAINS_CONFIG_FILE} has ${network.relayerUrl}`,
      );
    }
  }

  // The other direction: a host chain the config lists and the table lacks.
  for (const [group, network] of Object.entries(networks)) {
    for (const [alias, host] of Object.entries(network.hosts ?? {})) {
      if (host.id !== undefined && !seen.has(`${group}:${String(host.id)}`)) {
        report(
          `${CHAINS_CONFIG_FILE} lists ${group} host ${alias} (chain ${String(host.id)}), and the table has no entry for it`,
        );
      }
    }
  }

  return { checkedKeys: checkedKeys.sort(), violations };
}

/**
 * Every `FhevmChainData({ ... })` literal of the table. The group is resolved through the file's own
 * `string constant FHEVM_*_GROUP = "<name>"` declarations; an address field keeps its literal text, or
 * `address(0)`; a string field keeps its value without the quotes.
 */
export function parseChainTable(source: string): readonly TableEntry[] {
  const groups = new Map(
    [...source.matchAll(/string constant (\w+)\s*=\s*"([^"]*)"/g)].map((match) => [match[1] ?? '', match[2] ?? '']),
  );
  const entries: TableEntry[] = [];
  for (const literal of source.matchAll(/FhevmChainData\(\{([\s\S]*?)\}\)/g)) {
    const body = literal[1] ?? '';
    const fields = new Map<string, string>();
    for (const field of body.matchAll(/(\w+):\s*("([^"]*)"|0x[0-9a-fA-F]{40}|address\(0\)|[\w.]+)/g)) {
      fields.set(field[1] ?? '', field[3] ?? field[2] ?? '');
    }
    const groupConstant = fields.get('fhevmGroup') ?? '';
    const chainId = Number(fields.get('chainId'));
    if (!Number.isInteger(chainId)) continue; // a template literal whose chain ID is not a number literal
    entries.push({
      group: groups.get(groupConstant) ?? groupConstant,
      chainId,
      line: source.slice(0, literal.index).split('\n').length,
      fields,
    });
  }
  return entries;
}
