import { TestEngineError } from './errors.ts';
import type { Chain, InventoryEntry, Test } from './inventory.ts';

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
function isLiveChain(chain: Chain): boolean {
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
