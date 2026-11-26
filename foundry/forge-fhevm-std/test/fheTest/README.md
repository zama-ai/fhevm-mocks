### Addresses

#### Sepolia Testnet

FHETest: 0x6Bc47f6A33c0E04235f79e1Fc9A3cCD6e7Bbb5fc
Initialized for: 0x37AC010c1c566696326813b840319B58Bb5840E4
Deployed at block: 11772022

#### Bsc Testnet

FHETest: 0x7553CB9124f974Ee475E5cE45482F90d5B6076BC
Initialized for: 0x37AC010c1c566696326813b840319B58Bb5840E4
Deployed at block: 144852504

### Running the fork suites against it

A freshly deployed fixture does not exist at the blocks `ForkBlocks` hands out, which counts back
from the head — the suites then fail with `Contract 0x… does not exist on active fork`, and stay
that way for a few hours of chain time. `FHEVM_FORK_FIXTURE_FLOOR` floors the fork blocks at the
fixture instead of waiting:

```sh
export FHEVM_FORK_FIXTURE_FLOOR=$(./test/fheTest/fixture-floor.sh)
make ci
```

`fixture-floor.sh` asks the chain for the deploy block rather than trusting the number above, and
prints `0` — the value that means "no floor" — once the fixture is old enough not to need one. So
the line is safe to leave in a profile, and safe across a redeploy.

### Redeploying

`./deploy.sh --dry-run` first; then `./deploy.sh --account <name>` (a foundry keystore in
`~/.foundry/keystores`; the password is asked for once), or `PRIVATE_KEY=0x… ./deploy.sh`. Afterwards the
addresses above, `FHE_TEST` in each fork suite, and `CONTRACT_NAME` in `FHETest.sol` all need
updating — the last one so the new deployment is distinguishable from the old one on chain.

### BSC Testnet

The installed `@fhevm/solidity` has no chain 97, so BSC Testnet compiles FHETest against
`zama-config/release-0.14.x/ZamaConfig.sol`: fhevm `release/0.14.x`'s copy, vendored from zama-ai/fhevm#4714.
`FHETest` inherits `ZamaMultiChainConfig`, which routes chain 97 once that file is in place:

```sh
./deploy.sh --network bsc-testnet --zama-config release-0.14.x --account <name> --dry-run
./deploy.sh --network bsc-testnet --zama-config release-0.14.x --account <name>
```

`--zama-config release-0.14.x` selects foundry.toml's `zama-config-release-0-14-x` profile.
The RPC is `BSC_TESTNET_RPC_URL` (`SEPOLIA_RPC_URL` for Sepolia), from the environment or else from the
repository's `.env`; without either, a publicnode default.
