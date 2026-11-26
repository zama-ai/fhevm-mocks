import { TestEngineError } from './errors.ts';
import type { Chain, Inventory, InventoryEntry, Test } from './inventory.ts';

/**
 * The environment variable that holds the RPC URL of each live chain, by chain id. A test reads the URL
 * of its chain from this variable. The engine reads the variable for one thing only: to know whether a
 * test that needs the chain can run.
 */
const RPC_VARIABLE_OF_CHAIN_ID: ReadonlyMap<number, string> = new Map([
  [11155111, 'SEPOLIA_RPC_URL'],
  [1, 'MAINNET_RPC_URL'],
  [42161, 'ARBITRUM_RPC_URL'],
]);

/** The environment of a process, as Node.js gives it. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** A chain that a test reaches through the RPC of a live chain: the chain itself, or a fork of it. */
export function isLiveChain(chain: Chain): boolean {
  return chain.runtime === 'remote' || chain.runtime === 'forge-fork';
}

/** True when the test needs the RPC of at least one live chain. */
export function needsLiveChain(test: Test): boolean {
  return test.chains.some(isLiveChain);
}

/**
 * The variables that hold the RPC URLs of the live chains of a test, each once, in the order of its
 * chains. Fails for a live chain whose variable the engine does not know: the engine cannot tell whether
 * such a test can run.
 */
export function rpcVariablesOfTest(entry: InventoryEntry): readonly string[] {
  const variables = entry.test.chains.filter(isLiveChain).map((chain) => {
    const variable = RPC_VARIABLE_OF_CHAIN_ID.get(chain.chainid);

    if (variable === undefined) {
      throw new TestEngineError(
        `${entry.id} needs the live chain ${chain.chainid}, and the engine knows no RPC URL variable for that chain.`,
      );
    }

    return variable;
  });

  return [...new Set(variables)];
}

export type MissingRpcVariablesInput = {
  readonly entry: InventoryEntry;
  readonly environment: Environment;
};

/** The RPC URL variables that a test needs and that the environment does not set. Empty is not set. */
export function missingRpcVariables(input: MissingRpcVariablesInput): readonly string[] {
  return rpcVariablesOfTest(input.entry).filter((variable) => (input.environment[variable] ?? '').trim() === '');
}

export type RpcVariablesOfTestInput = {
  readonly entry: InventoryEntry;
  readonly environment: NodeJS.ProcessEnv;
};

/**
 * The environment without the RPC URL variables of the live chains that the test does not declare. A
 * test reaches only the chains that the inventory says it uses: a test that reads the URL of another
 * chain when it finds it, as a suite that holds fork tests does, finds none. So what a test does never
 * depends on a URL that the machine happens to hold, and only the tests that declare a live chain can
 * call its provider.
 */
export function withoutUndeclaredRpcVariables(input: RpcVariablesOfTestInput): NodeJS.ProcessEnv {
  const declared = new Set(rpcVariablesOfTest(input.entry));
  const undeclared = [...RPC_VARIABLE_OF_CHAIN_ID.values()].filter((variable) => !declared.has(variable));
  const environment = { ...input.environment };

  for (const variable of undeclared) delete environment[variable];

  return environment;
}

////////////////////////////////////////////////////////////////////////////////

/** True when the text names the variable as a whole word, and not as a part of a longer name. */
function namesVariable(input: { readonly text: string; readonly variable: string }): boolean {
  return new RegExp(`(?<![A-Za-z0-9_])${input.variable}(?![A-Za-z0-9_])`).test(input.text);
}

/** One line for each RPC URL variable that the command of the test names without a declared chain. */
export function undeclaredRpcVariableLines(entry: InventoryEntry): readonly string[] {
  const declared = new Set(entry.test.chains.filter(isLiveChain).map((chain) => chain.chainid));
  const lines: string[] = [];

  for (const [chainId, variable] of RPC_VARIABLE_OF_CHAIN_ID) {
    if (declared.has(chainId)) continue;
    if (!namesVariable({ text: entry.test.command, variable })) continue;

    lines.push(
      `${entry.id}: the command names ${variable}, and the test declares no chain ${chainId} with the runtime "remote" or "forge-fork".`,
    );
  }

  return lines;
}

/**
 * Fails when the command of a test names the RPC URL variable of a live chain that the test does not
 * declare. The engine gives a test only the URLs of its declared chains, and holds back a test only for
 * them: such a command would start, and find its variable empty.
 */
export function checkRpcVariablesOfCommands(inventory: Inventory): void {
  const lines = [...inventory.tests].flatMap(([id, test]) => undeclaredRpcVariableLines({ id, test }));

  if (lines.length === 0) return;

  throw new TestEngineError(
    [
      `${inventory.file} has ${lines.length} command(s) that need a live chain the test does not declare:`,
      ...lines,
    ].join('\n  '),
  );
}
