# forge-fhevm-std

FHEVM standard library for [Forge](https://getfoundry.sh). A companion to `forge-std`: helpers to encrypt inputs and
decrypt handles from Foundry tests and scripts.

| directory | contents                                                     |
| --------- | ------------------------------------------------------------ |
| `src/`    | Solidity sources: the cheat-code helpers and their interfaces |

## Install

The library has one dependency, `encrypted-types`, which holds the `euint*` / `externalE*` type declarations. It must
resolve to the **same** file that `@fhevm/solidity` resolves, otherwise the encrypted types of the two libraries are
distinct Solidity types and will not interoperate. Installing `@fhevm/solidity` with npm already puts that file in
`node_modules/encrypted-types/`, where Forge finds it without configuration.

### forge install

```sh
forge install zama-ai/forge-fhevm-std
```

No remapping to add: Forge maps `forge-fhevm-std/` to `lib/forge-fhevm-std/src/` on its own.

### npm

```sh
npm install @fhevm/forge-fhevm-std
```

```toml
# foundry.toml
remappings = ["forge-fhevm-std/=node_modules/@fhevm/forge-fhevm-std/src/"]
```

### soldeer

```sh
forge soldeer install forge-fhevm-std~0.13.0
```

```toml
# foundry.toml
remappings = ["forge-fhevm-std/=dependencies/forge-fhevm-std-0.13.0/src/"]
```

## Use

```solidity
import {Test} from "forge-std/Test.sol";
import {euint64} from "encrypted-types/EncryptedTypes.sol";
import {FhevmStd} from "forge-fhevm-std/FhevmStd.sol";
```
