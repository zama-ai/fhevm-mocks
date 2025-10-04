// npmjs.com packages url:
// =======================

// https://www.npmjs.com/package/@fhevm/solidity?activeTab=versions
// https://www.npmjs.com/package/@fhevm/host-contracts?activeTab=versions
// https://www.npmjs.com/package/@zama-fhe/oracle-solidity?activeTab=versions
// https://www.npmjs.com/package/@zama-fhe/relayer-sdk?activeTab=versions

const constants = {
  PRIVATE_KEY_KMS_SIGNER: "388b7680e4e1afa06efbfd45cdd1fe39f3c6af381df6555a19661f283b97de91", //address=0x0971C80fF03B428fD2094dd5354600ab103201C5
  PRIVATE_KEY_COPROCESSOR_SIGNER: "7ec8ada6642fc4ccfb7729bc29c17cf8d21b61abd5642d1db992c0b8672ab901", //address=0xc9990FEfE0c27D31D0C2aa36196b085c0c4d456c
  HARDHAT_RELAYER_SIGNER_INDEX: 6, // wallet index in hre.ethers.getSigners() used to compute mock relayer signatures.
  DECRYPTION_ADDRESS: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
  INPUT_VERIFICATION_ADDRESS: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
  KMS_THRESHOLD: 1,
  FHEVM_HANDLE_VERSION: 0,
  HARDHAT_PLUGIN_NAME: "@fhevm/hardhat-plugin",
  FHEVM_MOCK_UTILS_PACKAGE_NAME: "@fhevm/mock-utils",
  SOLIDITY_COVERAGE_PACKAGE_NAME: "solidity-coverage",
  TRACE_DECRYPTION_REQUEST_EVENTS: false,
  DEVELOPMENT_NETWORK_CHAINID: 31337,
  // https://www.npmjs.com/package/@zama-fhe/oracle-solidity?activeTab=versions
  // @zama-fhe/oracle-solidity@0.3.0-2
  ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE: {
    version: "0.3.0-2",
    name: "@zama-fhe/oracle-solidity",
    addressFile: "address/ZamaOracleAddress.sol",
    SepoliaZamaOracleAddress: "0xa02Cda4Ca3a71D7C46997716F4283aa851C28812",
  },
  // https://www.npmjs.com/package/@fhevm/solidity?activeTab=versions
  // @fhevm/solidity@0.9.0-1
  FHEVM_SOLIDITY_PACKAGE: {
    version: "0.9.0-1",
    name: "@fhevm/solidity",
    configFile: "config/ZamaConfig.sol",
    configContractName: "SepoliaConfig",
    // `SepoliaConfig` must match the exact configuration defined in `config/ZamaConfig.sol`
    // It is essentially used to detect any mismatch with `config/ZamaConfig.sol`
    SepoliaConfig: {
      ACLAddress: "0x687820221192C5B662b25367F70076A37bc79b6c",
      CoprocessorAddress: "0x848B0066793BcC60346Da1F49049357399B8D595",
      DecryptionOracleAddress: "0xa02Cda4Ca3a71D7C46997716F4283aa851C28812",
      KMSVerifierAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
    },
  },
  // https://www.npmjs.com/package/@fhevm/host-contracts?activeTab=versions
  // @fhevm/host-contracts@0.9.0-1
  FHEVM_HOST_CONTRACTS_PACKAGE: {
    version: "0.9.0-1",
    name: "@fhevm/host-contracts",
  },
  // https://www.npmjs.com/package/@zama-fhe/relayer-sdk?activeTab=versions
  // @zama-fhe/relayer-sdk@0.3.0-3
  ZAMA_FHE_RELAYER_SDK_PACKAGE: {
    version: "0.3.0-3",
    name: "@zama-fhe/relayer-sdk",
    // `sepolia` must match the exact configuration defined in `relayer-sdk`
    // It is essentially used to detect any mismatch with `relayer-sdk`'s constant `SepoliaConfig`
    // https://github.com/zama-ai/relayer-sdk/blob/main/src/index.ts#L79
    sepolia: {
      relayerUrl: "https://relayer.testnet.zama.cloud/",
      gatewayChainId: 55815,
      chainId: 11155111,
      ACLAddress: "0x687820221192C5B662b25367F70076A37bc79b6c",
      CoprocessorAddress: "0x848B0066793BcC60346Da1F49049357399B8D595",
      DecryptionOracleAddress: "0xa02Cda4Ca3a71D7C46997716F4283aa851C28812",
      KMSVerifierAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
      InputVerifierAddress: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
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
Object.freeze(constants.ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE);

export default constants;
