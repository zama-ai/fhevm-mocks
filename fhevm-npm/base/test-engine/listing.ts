import type { Chain } from './inventory.ts';
import type { ResolvedTest } from './selection.ts';

/** One line per test: its selection state, its ID, and its chains. */
export function selectionLines(resolved: readonly ResolvedTest[]): readonly string[] {
  const stateWidth = Math.max(0, ...resolved.map((entry) => entry.state.length));
  const idWidth = Math.max(0, ...resolved.map((entry) => entry.id.length));

  return resolved.map((entry) => {
    const chains = entry.test.chains.map(describeChain).join(', ');

    return `${entry.state.padEnd(stateWidth)}  ${entry.id.padEnd(idWidth)}  ${chains === '' ? 'no chain' : chains}`;
  });
}

function describeChain(chain: Chain): string {
  return [`${chain.chainid}/${chain.fhevm}/${chain.runtime}`, ...chainDetails(chain)].join(' ');
}

function chainDetails(chain: Chain): readonly string[] {
  switch (chain.runtime) {
    case 'anvil':
    case 'hardhat-node':
      return [`startedBy=${chain.startedBy}`, `fresh=${String(chain.fresh)}`];
    case 'remote':
      return [`wallet=${String(chain.wallet)}`];
    case 'forge-fork':
      return chain.block === undefined ? [] : [`block=${String(chain.block)}`];
    case 'forge':
    case 'hardhat':
      return [];
  }
}
