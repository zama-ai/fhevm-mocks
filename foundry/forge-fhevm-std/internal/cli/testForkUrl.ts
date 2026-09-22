// Runs the born-on-a-fork suite (test/forkurl) under `forge test --fork-url`, at the chain head unless a
// block is named — see the note on SEPOLIA_FORK_BLOCK below.
//
// The URL comes from SEPOLIA_RPC_URL, else from `[rpc_endpoints] sepolia` in foundry.toml — the same two
// places `getFhevmChain("testnet", "sepolia")` reads, and never the shared built-in default.
//
//   SEPOLIA_RPC_URL=https://… npm run test:fork-url
//   SEPOLIA_FORK_BLOCK=12345678 npm run test:fork-url      # pin a block, to reuse the RPC cache
import { execFileSync, spawnSync } from 'node:child_process';

function configuredSepoliaUrl(): string {
  const fromEnv = process.env.SEPOLIA_RPC_URL;
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const config: unknown = JSON.parse(execFileSync('forge', ['config', '--json'], { encoding: 'utf8' }));
  const sepolia = (config as { rpc_endpoints?: { sepolia?: unknown } }).rpc_endpoints?.sepolia;
  return typeof sepolia === 'string' ? sepolia : '';
}

const url = configuredSepoliaUrl();
if (url === '') {
  console.error('configure sepolia first: `[rpc_endpoints] sepolia = ...` in foundry.toml, or SEPOLIA_RPC_URL');
  process.exit(1);
}
// No DEFAULT block on purpose. A pinned constant serves the cache for a day or two and then fails for
// everyone: an ordinary node keeps state for only its most recent blocks and answers `state at block #N is
// pruned` past that. Unpinned, forge takes the head, which is always servable. Pin deliberately —
// SEPOLIA_FORK_BLOCK — when a run wants the cache, and pick a block the endpoint still has.
const block = process.env.SEPOLIA_FORK_BLOCK;
const pinned = block === undefined || block === '' ? [] : ['--fork-block-number', block];
const forge = spawnSync('forge', ['test', '--threads', '2', '--fork-url', url, ...pinned, '--match-path', 'test/forkurl/*'], {
  stdio: 'inherit',
});
process.exit(forge.status ?? 1);
