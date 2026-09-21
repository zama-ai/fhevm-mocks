// Runs the born-on-a-fork suite (test/forkurl) under `forge test --fork-url`, pinned to a block so the RPC
// cache serves every run after the first.
//
// The URL comes from SEPOLIA_RPC_URL, else from `[rpc_endpoints] sepolia` in foundry.toml — the same two
// places `getFhevmChain("testnet", "sepolia")` reads, and never the shared built-in default.
//
//   SEPOLIA_RPC_URL=https://… npm run test:fork-url
//   SEPOLIA_FORK_BLOCK=11743572 npm run test:fork-url      # another pinned block
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
const block = process.env.SEPOLIA_FORK_BLOCK ?? '11743572';
const forge = spawnSync(
  'forge',
  ['test', '--threads', '2', '--fork-url', url, '--fork-block-number', block, '--match-path', 'test/forkurl/*'],
  { stdio: 'inherit' },
);
process.exit(forge.status ?? 1);
