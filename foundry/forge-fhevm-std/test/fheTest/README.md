### Addresses

#### Sepolia Testnet

FHETest: 0x6Bc47f6A33c0E04235f79e1Fc9A3cCD6e7Bbb5fc
Initialized for: 0x37AC010c1c566696326813b840319B58Bb5840E4
Deployed at block: 11772022
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

`./deploy-sepolia.sh --dry-run` first; then `PRIVATE_KEY=0x… ./deploy-sepolia.sh`. Afterwards the
addresses above, `FHE_TEST` in each fork suite, and `CONTRACT_NAME` in `FHETest.sol` all need
updating — the last one so the new deployment is distinguishable from the old one on chain.
