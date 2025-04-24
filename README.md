# fhevm-hardhat-plugin

Hardhat plugin for integration with Zama's FHEVM.

## What is still missing

- Test solidity coverage
- Test gas reporter
- Add FHE gas reporter

## VSCode type issues FAQ

1. To solve :

```sh
Property 'ethers' does not exist on type 'HardhatRuntimeEnvironment'.ts(2339)
```

add `"files": ["./hardhat.config.ts"],` in tsconfig.json

2. To solve :

```sh
Type 'BaseContract & { deploymentTransaction(): ContractTransactionResponse; } & Omit<Contract, keyof BaseContract>' is missing the following properties from type 'TestConfidentialERC20Mintable': acceptOwnership, allowance, "approve(address,bytes32)", "approve(address,bytes32,bytes)", and 14 more.ts(2740)
```

add `"./<typechain-out-dir>"` to `"include": ["./test", "./src"]` in tsconfig.json
