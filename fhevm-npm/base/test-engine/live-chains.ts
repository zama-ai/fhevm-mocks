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

////////////////////////////////////////////////////////////////////////////////
// Fork blocks
////////////////////////////////////////////////////////////////////////////////

/**
 * The variable that holds the block a test forks a live chain at: its RPC URL variable, with
 * `_FORK_BLOCK` in place of `_RPC_URL`, as in `MAINNET_FORK_BLOCK`.
 */
function forkBlockVariableOf(rpcVariable: string): string {
  return rpcVariable.replace(/_RPC_URL$/, '_FORK_BLOCK');
}

/** Every fork block variable the engine knows, one for each live chain. */
const FORK_BLOCK_VARIABLES: readonly string[] = [...RPC_VARIABLE_OF_CHAIN_ID.values()].map(forkBlockVariableOf);

/** The block a fork pins, or undefined when it forks the latest block, or one still to find (`null`). */
function pinnedBlock(chain: Chain): number | undefined {
  return chain.runtime === 'forge-fork' && typeof chain.block === 'number' ? chain.block : undefined;
}

/**
 * One line for each chain that the test forks at more than one block. A test gets one block variable
 * per chain, so all its forks of one chain must pin the same block, or none.
 */
export function conflictingForkBlockLines(entry: InventoryEntry): readonly string[] {
  const blocksOfChainId = new Map<number, Set<number | undefined>>();

  for (const chain of entry.test.chains) {
    if (chain.runtime !== 'forge-fork') continue;
    const blocks = blocksOfChainId.get(chain.chainid) ?? new Set();
    blocks.add(pinnedBlock(chain));
    blocksOfChainId.set(chain.chainid, blocks);
  }

  return [...blocksOfChainId]
    .filter(([, blocks]) => blocks.size > 1)
    .map(([chainId, blocks]) => {
      const names = [...blocks].map((block) => (block === undefined ? 'latest' : String(block)));

      return `${entry.id}: forks chain ${chainId} at blocks ${names.join(' and ')}.`;
    });
}

/** Fails when a test forks one chain at more than one block: see `conflictingForkBlockLines`. */
export function checkForkBlocks(inventory: Inventory): void {
  const lines = [...inventory.tests].flatMap(([id, test]) => conflictingForkBlockLines({ id, test }));

  if (lines.length === 0) return;

  throw new TestEngineError(
    [`${inventory.file} has ${lines.length} test(s) that fork one chain at more than one block:`, ...lines].join(
      '\n  ',
    ),
  );
}

export type ForkBlocksOfTestInput = {
  readonly entry: InventoryEntry;
  readonly environment: NodeJS.ProcessEnv;
};

/**
 * The environment with the fork block of each live chain that the test pins, and no other. A test that
 * pins `"block": 26493782` on its mainnet fork gets `MAINNET_FORK_BLOCK=26493782`; a test that pins none
 * gets no such variable, even when the engine's own environment holds one, so a block left in a shell
 * never moves a test that forks the latest block.
 */
export function withForkBlocksOfTest(input: ForkBlocksOfTestInput): NodeJS.ProcessEnv {
  const environment = { ...input.environment };

  for (const variable of FORK_BLOCK_VARIABLES) delete environment[variable];

  for (const chain of input.entry.test.chains) {
    const block = pinnedBlock(chain);
    const rpcVariable = RPC_VARIABLE_OF_CHAIN_ID.get(chain.chainid);

    if (block !== undefined && rpcVariable !== undefined) environment[forkBlockVariableOf(rpcVariable)] = String(block);
  }

  return environment;
}

/** The state of the live chains that a test reaches: all at pinned blocks, or at least one at the latest. */
export const BLOCK_MODES = ['pinned', 'latest'] as const;
export type BlockMode = (typeof BLOCK_MODES)[number];

/**
 * `pinned` when the test reaches live chains and every one of them is a fork at a pinned block: nothing
 * that happens on the chains can change its result. `latest` when it reaches at least one live chain at
 * its latest state: a fork with no pinned block (a block still to find included), or a remote chain,
 * which is always at its latest. Undefined for a test that reaches no live chain.
 */
export function blockModeOf(test: Test): BlockMode | undefined {
  const live = test.chains.filter(isLiveChain);

  if (live.length === 0) return undefined;

  return live.every((chain) => pinnedBlock(chain) !== undefined) ? 'pinned' : 'latest';
}
