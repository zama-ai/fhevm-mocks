// npmjs.com packages url:
// =======================

// https://www.npmjs.com/package/@fhevm/solidity?activeTab=versions (0.9.1)
// https://www.npmjs.com/package/@fhevm/host-contracts?activeTab=versions (0.9.0)
// https://www.npmjs.com/package/@zama-fhe/relayer-sdk?activeTab=versions (0.3.0-4)

const constants = {
  PRIVATE_KEY_KMS_SIGNER: "388b7680e4e1afa06efbfd45cdd1fe39f3c6af381df6555a19661f283b97de91", //address=0x0971C80fF03B428fD2094dd5354600ab103201C5
  PRIVATE_KEY_COPROCESSOR_SIGNER: "7ec8ada6642fc4ccfb7729bc29c17cf8d21b61abd5642d1db992c0b8672ab901", //address=0xc9990FEfE0c27D31D0C2aa36196b085c0c4d456c
  HARDHAT_RELAYER_SIGNER_INDEX: 6, // wallet index in hre.ethers.getSigners() used to compute mock relayer signatures.
  DECRYPTION_ADDRESS: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
  INPUT_VERIFICATION_ADDRESS: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
  KMS_THRESHOLD: 1,
  INPUT_VERIFIER_THRESHOLD: 1,
  FHEVM_HANDLE_VERSION: 0,
  HARDHAT_PLUGIN_NAME: "@fhevm/hardhat-plugin",
  FHEVM_MOCK_UTILS_PACKAGE_NAME: "@fhevm/mock-utils",
  SOLIDITY_COVERAGE_PACKAGE_NAME: "solidity-coverage",
  TRACE_DECRYPTION_REQUEST_EVENTS: false,
  DEVELOPMENT_NETWORK_CHAINID: 31337,
  // https://www.npmjs.com/package/@fhevm/solidity?activeTab=versions
  // @fhevm/solidity@0.9.1
  FHEVM_SOLIDITY_PACKAGE: {
    version: "0.9.1",
    name: "@fhevm/solidity",
    configFile: "config/ZamaConfig.sol",
    configContractName: "EthereumConfig",
    // `SepoliaConfig` must match the exact configuration defined in `config/ZamaConfig.sol`
    // It is essentially used to detect any mismatch with `config/ZamaConfig.sol`
    SepoliaConfig: {
      ACLAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
      CoprocessorAddress: "0x92C920834Ec8941d2C77D188936E1f7A6f49c127",
      KMSVerifierAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
    },
    LocalConfig: {
      ACLAddress: "0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D",
      CoprocessorAddress: "0xe3a9105a3a932253A70F126eb1E3b589C643dD24",
      KMSVerifierAddress: "0x901F8942346f7AB3a01F6D7613119Bca447Bb030",
    },
  },
  // https://www.npmjs.com/package/@fhevm/host-contracts?activeTab=versions
  // @fhevm/host-contracts@0.9.0
  FHEVM_HOST_CONTRACTS_PACKAGE: {
    version: "0.9.0",
    name: "@fhevm/host-contracts",
  },
  // https://www.npmjs.com/package/@zama-fhe/relayer-sdk?activeTab=versions
  // @zama-fhe/relayer-sdk@0.3.0-5
  ZAMA_FHE_RELAYER_SDK_PACKAGE: {
    version: "0.3.0-5",
    name: "@zama-fhe/relayer-sdk",
    // `sepolia` must match the exact configuration defined in `relayer-sdk`
    // It is essentially used to detect any mismatch with `relayer-sdk`'s constant `SepoliaConfig`
    // https://github.com/zama-ai/relayer-sdk/blob/main/src/index.ts#L79
    sepolia: {
      relayerUrl: "https://relayer.testnet.zama.org",
      gatewayChainId: 10901,
      chainId: 11155111,
      ACLAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
      CoprocessorAddress: "0x92C920834Ec8941d2C77D188936E1f7A6f49c127",
      KMSVerifierAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
      InputVerifierAddress: "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0",
      HCULimitAddress: "0x594BB474275918AF9609814E68C61B1587c5F838",
    },
  },
};
Object.freeze(constants);
Object.freeze(constants.ZAMA_FHE_RELAYER_SDK_PACKAGE);
Object.freeze(constants.ZAMA_FHE_RELAYER_SDK_PACKAGE.sepolia);
Object.freeze(constants.FHEVM_HOST_CONTRACTS_PACKAGE);
Object.freeze(constants.FHEVM_SOLIDITY_PACKAGE);
Object.freeze(constants.FHEVM_SOLIDITY_PACKAGE.SepoliaConfig);

export default constants;
