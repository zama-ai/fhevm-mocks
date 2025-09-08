import {
  FhevmContractName,
  FhevmMockProvider,
  MinimalProvider,
  assertIsEIP712Domain,
  constants as constantsBase,
  contracts,
  setInitializableStorage,
  setOwnableStorage,
} from "@fhevm/mock-utils";
import setupDebug from "debug";
import { ethers as EthersT } from "ethers";
import * as path from "path";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../../error";
import { FhevmEnvironmentAddresses, FhevmEnvironmentConfig, FhevmSigners } from "../FhevmEnvironment";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";
import constants from "../constants";
import { assertHHFhevm } from "../error";
import { assertSignersMatchAddresses } from "../utils/ethers";
import { getGatewayDecryptionAddress, getGatewayInputVerificationAddress, getKMSThreshold } from "./addresses";

const debug = setupDebug("@fhevm/hardhat:setup");

function __logDeploy(contractName: string, contractAddress: string, artifactPath: string) {
  debug(`Deploy ${picocolors.cyanBright(contractName)} at ${contractAddress} using artifact ${artifactPath}`);
}

function __logAlreadyDeployed(contractName: string, contractAddress: string, artifactPath: string) {
  debug(
    `${picocolors.cyanBright(contractName)} is already deployed at ${contractAddress} using artifact ${artifactPath}`,
  );
}

async function __tryDeploy(
  mockProvider: FhevmMockProvider,
  contractName: FhevmContractName,
  contractAddress: string,
  artifactPath: string,
  bytecode: string,
): Promise<{ deployed: boolean; alreadyDeployed: boolean }> {
  try {
    const deployedBytecode = await mockProvider.getCodeAt(contractAddress);
    if (deployedBytecode === bytecode) {
      __logAlreadyDeployed(contractName, contractAddress, artifactPath);
      return {
        deployed: true,
        alreadyDeployed: true,
      };
    } else {
      assertHHFhevm(
        deployedBytecode === "0x",
        `${contractName} contract's bytecode at ${contractAddress} is not empty.`,
      );
      __logDeploy(contractName, contractAddress, artifactPath);
      await mockProvider.setCodeAt(contractAddress, bytecode);
      return {
        deployed: true,
        alreadyDeployed: false,
      };
    }
  } catch (e) {
    debug(`Deploy ${contractName} at address ${contractAddress} using artifact at ${artifactPath} failed.`);
    throw e;
  }
}

function __logCallFuncFailed(contractName: FhevmContractName, contractAddress: string, funcName: string) {
  debug(
    `${picocolors.bgRedBright(picocolors.bold("ERROR"))} invalid deployed ${contractName} contact at ${contractAddress}. Function ${funcName} does not exist.`,
  );
}

async function __tryCallGetFHEVMExecutorAddress(
  contract: EthersT.Contract,
  contractName: FhevmContractName,
  contractAddress: string,
): Promise<string> {
  try {
    return await contract.getFHEVMExecutorAddress();
  } catch {
    __logCallFuncFailed(contractName, contractAddress, "getFHEVMExecutorAddress()");
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.name} contracts.`);
  }
}

async function __tryCallGetACLAddress(
  contract: EthersT.Contract,
  contractName: FhevmContractName,
  contractAddress: string,
): Promise<string> {
  try {
    return await contract.getACLAddress();
  } catch {
    __logCallFuncFailed(contractName, contractAddress, "getACLAddress()");
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.name} contracts.`);
  }
}

async function __tryCallGetHCULimitAddress(
  contract: EthersT.Contract,
  contractName: FhevmContractName,
  contractAddress: string,
): Promise<string> {
  try {
    return await contract.getHCULimitAddress();
  } catch {
    __logCallFuncFailed(contractName, contractAddress, "getHCULimitAddress()");
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.name} contracts.`);
  }
}

async function __tryCallGetInputVerifierAddress(
  contract: EthersT.Contract,
  contractName: FhevmContractName,
  contractAddress: string,
): Promise<string> {
  try {
    return await contract.getInputVerifierAddress();
  } catch {
    __logCallFuncFailed(contractName, contractAddress, "getInputVerifierAddress()");
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.name} contracts.`);
  }
}

function __requireResolveFhevmCoreContracts(): { version: string; packagePath: string } {
  const pkgPath = require.resolve(path.join(constants.FHEVM_CORE_CONTRACTS_PACKAGE.name, "package.json"), {
    paths: [__dirname],
  });
  const pkgJson = require(pkgPath);
  const pkg = require(path.join(constants.FHEVM_CORE_CONTRACTS_PACKAGE.name, "package.json"));
  assertHHFhevm(pkgJson.version === pkg.version, "__requireResolveFhevmCoreContracts version mismatch");
  return { version: pkg.version, packagePath: pkgPath };
}

function __requireConsumerFhevmCoreContracts(root: string): { version: string; packagePath: string } {
  const pkgPath = require.resolve(path.join(constants.FHEVM_CORE_CONTRACTS_PACKAGE.name, "package.json"), {
    paths: [root],
  });
  const pkg = require(pkgPath);
  return { version: pkg.version, packagePath: pkgPath };
}

// Called by FhevmEnvironment
export async function setupMockUsingCoreContractsArtifacts(
  mockProvider: FhevmMockProvider,
  fhevmAddresses: FhevmEnvironmentAddresses,
  fhevmSigners: FhevmSigners,
  fhevmPaths: FhevmEnvironmentPaths,
): Promise<{
  contracts: contracts.FhevmContractsRepository;
  config?: FhevmEnvironmentConfig;
  coprocessorSigners: EthersT.Signer[];
  kmsSigners: EthersT.Signer[];
}> {
  const consumerCoreContractsPkg = __requireConsumerFhevmCoreContracts(fhevmPaths.rootDir);
  const hhPluginCoreContractsPkg = __requireResolveFhevmCoreContracts();

  // Make sure the consumer of the HH Plugin uses the expected version of core-contracts
  if (consumerCoreContractsPkg.version !== constants.FHEVM_CORE_CONTRACTS_PACKAGE.version) {
    throw new HardhatFhevmError(
      `Invalid ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.name} version. Expecting ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.version}. Got ${consumerCoreContractsPkg.version} instead (at ${consumerCoreContractsPkg.packagePath}).`,
    );
  }
  // Make sure the HH Plugin uses the expected version of core-contracts
  if (hhPluginCoreContractsPkg.version !== constants.FHEVM_CORE_CONTRACTS_PACKAGE.version) {
    throw new HardhatFhevmError(
      `Invalid ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.name} version. Expecting ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.version}. Got ${hhPluginCoreContractsPkg.version} instead (at ${hhPluginCoreContractsPkg.packagePath}).`,
    );
  }

  const FHEVMExecutorAddress = fhevmAddresses.CoprocessorConfig.CoprocessorAddress;
  const aclAddress = fhevmAddresses.CoprocessorConfig.ACLAddress;
  const kmsVerifierAddress = fhevmAddresses.CoprocessorConfig.KMSVerifierAddress;
  const inputVerifierAddress = fhevmAddresses.InputVerifierAddress;
  const hcuLimitAddress = fhevmAddresses.HCULimitAddress;
  const decryptionOracleAddress = fhevmAddresses.CoprocessorConfig.DecryptionOracleAddress;

  // Setup FHEVMExecutor
  const execArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("FHEVMExecutor");
  const execDeployment = await __tryDeploy(
    mockProvider,
    "FHEVMExecutor",
    FHEVMExecutorAddress,
    execArtifact.path,
    execArtifact.artifact.deployedBytecode,
  );

  // Retrieve precompiled FHE addresses using FHEVMExecutor.
  const fhevmExecutorReadOnly = new EthersT.Contract(
    FHEVMExecutorAddress,
    execArtifact.artifact.abi,
    mockProvider.readonlyEthersProvider,
  );

  const precompiledACLAddress = (await fhevmExecutorReadOnly.getACLAddress()) as string;
  const precompiledHCULimitAddress = (await fhevmExecutorReadOnly.getHCULimitAddress()) as string;
  const precompiledInputVerifierAddress = (await fhevmExecutorReadOnly.getInputVerifierAddress()) as string;

  __checkHardCodedAddress("FHEVMExecutor", FHEVMExecutorAddress, precompiledACLAddress, aclAddress);
  __checkHardCodedAddress("FHEVMExecutor", FHEVMExecutorAddress, precompiledHCULimitAddress, hcuLimitAddress);
  __checkHardCodedAddress("FHEVMExecutor", FHEVMExecutorAddress, precompiledInputVerifierAddress, inputVerifierAddress);

  // Setup ACL
  const aclArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("ACL");
  const aclDeployment = await __tryDeploy(
    mockProvider,
    "ACL",
    aclAddress,
    aclArtifact.path,
    aclArtifact.artifact.deployedBytecode,
  );

  // Setup KMSVerifier
  const kmsArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("KMSVerifier");
  const kmsDeployment = await __tryDeploy(
    mockProvider,
    "KMSVerifier",
    kmsVerifierAddress,
    kmsArtifact.path,
    kmsArtifact.artifact.deployedBytecode,
  );

  // Setup InputVerifier
  const inputArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("InputVerifier");
  const inputVerifierDeployment = await __tryDeploy(
    mockProvider,
    "InputVerifier",
    inputVerifierAddress,
    inputArtifact.path,
    inputArtifact.artifact.deployedBytecode,
  );

  // Setup HCULimit
  const hcuLimitArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("HCULimit");
  const hcuLimitDeployment = await __tryDeploy(
    mockProvider,
    "HCULimit",
    hcuLimitAddress,
    hcuLimitArtifact.path,
    hcuLimitArtifact.artifact.deployedBytecode,
  );

  // Setup DecryptionOracle
  const decryptionOracleArtifact = await fhevmPaths.getZamaFheOracleSolidityArtifact("DecryptionOracle");
  await __tryDeploy(
    mockProvider,
    "DecryptionOracle",
    decryptionOracleAddress,
    decryptionOracleArtifact.path,
    decryptionOracleArtifact.artifact.deployedBytecode,
  );

  const aclReadOnly = new EthersT.Contract(aclAddress, aclArtifact.artifact.abi, mockProvider.readonlyEthersProvider);
  const hcuLimitReadOnly = new EthersT.Contract(
    hcuLimitAddress,
    hcuLimitArtifact.artifact.abi,
    mockProvider.readonlyEthersProvider,
  );
  const inputVerifierReadOnly = new EthersT.Contract(
    inputVerifierAddress,
    inputArtifact.artifact.abi,
    mockProvider.readonlyEthersProvider,
  );
  const kmsVerifierReadOnly = new EthersT.Contract(
    kmsVerifierAddress,
    kmsArtifact.artifact.abi,
    mockProvider.readonlyEthersProvider,
  );

  const decryptionOracleReadOnly = new EthersT.Contract(
    decryptionOracleAddress,
    decryptionOracleArtifact.artifact.abi,
    mockProvider.readonlyEthersProvider,
  );

  const aclFHEVMExecutorAddress = await __tryCallGetFHEVMExecutorAddress(aclReadOnly, "ACL", aclAddress);
  const hcuLimitFHEVMExecutorAddress = await __tryCallGetFHEVMExecutorAddress(
    hcuLimitReadOnly,
    "HCULimit",
    hcuLimitAddress,
  );
  const fhevmExecutorACLAddress = await __tryCallGetACLAddress(
    fhevmExecutorReadOnly,
    "FHEVMExecutor",
    FHEVMExecutorAddress,
  );
  const fhevmExecutorHCULimitAddress = await __tryCallGetHCULimitAddress(
    fhevmExecutorReadOnly,
    "FHEVMExecutor",
    FHEVMExecutorAddress,
  );
  const fhevmExecutorInputVerifierAddress = await __tryCallGetInputVerifierAddress(
    fhevmExecutorReadOnly,
    "FHEVMExecutor",
    FHEVMExecutorAddress,
  );

  // Verify addresses
  __checkHardCodedAddress("ACL", aclAddress, aclFHEVMExecutorAddress, FHEVMExecutorAddress);
  __checkHardCodedAddress("HCULimit", hcuLimitAddress, hcuLimitFHEVMExecutorAddress, FHEVMExecutorAddress);
  __checkHardCodedAddress("FHEVMExecutor", FHEVMExecutorAddress, fhevmExecutorACLAddress, aclAddress);
  __checkHardCodedAddress("FHEVMExecutor", FHEVMExecutorAddress, fhevmExecutorHCULimitAddress, hcuLimitAddress);
  __checkHardCodedAddress(
    "FHEVMExecutor",
    FHEVMExecutorAddress,
    fhevmExecutorInputVerifierAddress,
    inputVerifierAddress,
  );

  const gatewayDecryptionAddress = getGatewayDecryptionAddress();
  const gatewayChainId = constants.SEPOLIA.gatewayChainId;
  const kmsInitialThreshold = getKMSThreshold();

  const kmsSigners = fhevmSigners.kms;
  if (kmsSigners.length !== 1) {
    throw new HardhatFhevmError(`Expecting 1 KMS Signer. Got ${kmsSigners.length} instead.`);
  }

  const coprocessorSigners = fhevmSigners.coprocessor;
  if (coprocessorSigners.length !== 1) {
    throw new HardhatFhevmError(`Expecting 1 Coprocessor Signer. Got ${coprocessorSigners.length} instead.`);
  }

  const zero = fhevmSigners.zero;
  const one = fhevmSigners.one;

  const zeroAddress = fhevmSigners.zeroAddress;
  const oneAddress = fhevmSigners.oneAddress;

  // No need to call:
  // - FHEVMExecutor.initializeFromEmptyProxy()
  // - ACL.initializeFromEmptyProxy()
  // - HCULimit.initializeFromEmptyProxy()
  // since these initializers are currently pretty much empty right now

  await __setContractOwner(
    mockProvider.minimalProvider,
    fhevmExecutorReadOnly,
    "FHEVMExecutor",
    zero,
    one,
    execDeployment.alreadyDeployed,
  );
  await __setContractOwner(mockProvider.minimalProvider, aclReadOnly, "ACL", zero, one, aclDeployment.alreadyDeployed);
  await __setContractOwner(
    mockProvider.minimalProvider,
    hcuLimitReadOnly,
    "HCULimit",
    zero,
    one,
    hcuLimitDeployment.alreadyDeployed,
  );

  const kmsOwner: `0x${string}` = await kmsVerifierReadOnly.owner();

  if (kmsDeployment.alreadyDeployed) {
    if (kmsOwner !== oneAddress) {
      throw new HardhatFhevmError(`Wrong KMSVerifier owner address. Got ${kmsOwner}, expected ${oneAddress}`);
    }
  } else {
    if (kmsOwner !== zeroAddress) {
      throw new HardhatFhevmError(`Wrong KMSVerifier owner address. Got ${kmsOwner}, expected ${zeroAddress}`);
    }
  }

  if (kmsOwner !== oneAddress) {
    // set KMSVerifier owner using setOwnableStorage cheat code
    await setOwnableStorage(mockProvider.minimalProvider, kmsVerifierAddress, oneAddress);
    if ((await kmsVerifierReadOnly.owner()) !== oneAddress) {
      throw new HardhatFhevmError(`Set KMSVerifier OwnableStorage failed.`);
    }

    // set KMSVerifier initializable struct using setInitializableStorage cheat code
    await setInitializableStorage(mockProvider.minimalProvider, kmsVerifierAddress, {
      initialized: 1n,
      initializing: false,
    });

    const kmsOne = kmsVerifierReadOnly.connect(one) as EthersT.Contract;

    // https://github.com/zama-ai/fhevm/blob/main/host-contracts/contracts/KMSVerifier.sol#L117
    let tx = await kmsOne.initializeFromEmptyProxy(
      // address verifyingContractSource,
      gatewayDecryptionAddress,
      // uint64 chainIDSource,
      gatewayChainId,
      // address[] calldata initialSigners,
      kmsSigners,
      // uint256 initialThreshold
      kmsInitialThreshold,
    );
    await tx.wait();
  }

  // Make sure everything is properly setup
  assertHHFhevm((await kmsVerifierReadOnly.getThreshold()) === BigInt(getKMSThreshold()));
  // Verify signers
  const _kmsSignersAddresses: string[] = await kmsVerifierReadOnly.getKmsSigners();
  await assertSignersMatchAddresses(kmsSigners, _kmsSignersAddresses);

  const inputVerifierVerifyingContractSource = getGatewayInputVerificationAddress();
  const inputVerifierOwner: `0x${string}` = await inputVerifierReadOnly.owner();

  if (inputVerifierDeployment.alreadyDeployed) {
    if (inputVerifierOwner !== oneAddress) {
      throw new HardhatFhevmError(
        `Wrong InputVerifier owner address. Got ${inputVerifierOwner}, expected ${oneAddress}`,
      );
    }
  } else {
    if (inputVerifierOwner !== zeroAddress) {
      throw new HardhatFhevmError(
        `Wrong InputVerifier owner address. Got ${inputVerifierOwner}, expected ${zeroAddress}`,
      );
    }
  }

  if (inputVerifierOwner !== oneAddress) {
    // set InputVerifier owner using setOwnableStorage cheat code
    await setOwnableStorage(mockProvider.minimalProvider, inputVerifierAddress, oneAddress);
    if ((await inputVerifierReadOnly.owner()) !== oneAddress) {
      throw new HardhatFhevmError(`Set InputVerifier OwnableStorage failed.`);
    }

    // set InputVerifier initializable struct using setInitializableStorage cheat code
    await setInitializableStorage(mockProvider.minimalProvider, inputVerifierAddress, {
      initialized: 1n,
      initializing: false,
    });

    const inputVerifierOne = inputVerifierReadOnly.connect(one) as EthersT.Contract;
    // https://github.com/zama-ai/fhevm/blob/main/host-contracts/contracts/InputVerifier.sol#L141
    let tx = await inputVerifierOne.initializeFromEmptyProxy(
      // address verifyingContractSource,
      inputVerifierVerifyingContractSource,
      // uint64 chainIDSource,
      gatewayChainId,
      // address[] calldata initialSigners
      coprocessorSigners,
    );
    await tx.wait();
  }

  // Verify signers
  const _inputSignersAddresses: string[] = await inputVerifierReadOnly.getCoprocessorSigners();
  await assertSignersMatchAddresses(coprocessorSigners, _inputSignersAddresses);

  // InputVerifier eip712Domain
  const _inputVerifier712Domain = await inputVerifierReadOnly.eip712Domain();
  assertIsEIP712Domain(_inputVerifier712Domain, "InputVerifier", {
    name: constantsBase.INPUT_VERIFICATION_EIP712.domain.name,
    version: constantsBase.INPUT_VERIFICATION_EIP712.domain.version,
    chainId: BigInt(gatewayChainId),
    verifyingContract: inputVerifierVerifyingContractSource,
  });

  // KMSVerifier eip712Domain
  const _kms712Domain = await kmsVerifierReadOnly.eip712Domain();
  assertIsEIP712Domain(_kms712Domain, "KMSVerifier", {
    name: constantsBase.PUBLIC_DECRYPT_EIP712.domain.name,
    version: constantsBase.PUBLIC_DECRYPT_EIP712.domain.version,
    chainId: BigInt(gatewayChainId),
    verifyingContract: gatewayDecryptionAddress,
  });

  debug(`${picocolors.cyanBright("ACL")} address              : ${aclAddress}`);
  debug(`${picocolors.cyanBright("FHEVMExecutor")} address    : ${FHEVMExecutorAddress}`);
  debug(`${picocolors.cyanBright("InputVerifier")} address    : ${inputVerifierAddress}`);
  debug(`${picocolors.cyanBright("KMSVerifier")} address      : ${kmsVerifierAddress}`);
  debug(`${picocolors.cyanBright("DecryptionOracle")} address : ${decryptionOracleAddress}`);
  debug(`Gateway chainId                         : ${gatewayChainId}`);
  debug(`InputVerifier verifying contract source : ${inputVerifierVerifyingContractSource}`);
  debug(`Gateway Decryption address              : ${gatewayDecryptionAddress}`);

  const repo = await contracts.FhevmContractsRepository.create(mockProvider.readonlyEthersProvider, {
    aclContractAddress: aclAddress,
    aclAbi: aclArtifact.artifact.abi,
    aclProperties: {
      fhevmExecutorAddress: aclFHEVMExecutorAddress,
    },
    fhevmExecutorAbi: execArtifact.artifact.abi,
    fhevmExecutorProperties: {
      aclAddress: fhevmExecutorACLAddress,
      hcuLimitAddress: fhevmExecutorHCULimitAddress,
      inputVerifierAddress: fhevmExecutorInputVerifierAddress,
    },
    hcuLimitAbi: hcuLimitArtifact.artifact.abi,
    inputVerifierAbi: inputArtifact.artifact.abi,
    kmsContractAddress: kmsVerifierAddress,
    kmsVerifierAbi: kmsArtifact.artifact.abi,
    zamaFheDecryptionOracleAbi: decryptionOracleArtifact.artifact.abi,
    zamaFheDecryptionOracleAddress: decryptionOracleAddress,
  });

  return {
    contracts: repo,
    config: {
      ACLAddress: aclAddress,
      ACLReadOnly: aclReadOnly,
      FHEVMExecutorAddress: FHEVMExecutorAddress,
      FHEVMExecutorReadOnly: fhevmExecutorReadOnly,
      InputVerifierAddress: inputVerifierAddress,
      InputVerifierReadOnly: inputVerifierReadOnly,
      KMSVerifierAddress: kmsVerifierAddress,
      KMSVerifierReadOnly: kmsVerifierReadOnly,
      DecryptionOracleAddress: decryptionOracleAddress,
      DecryptionOracleReadOnly: decryptionOracleReadOnly,
      gatewayInputVerificationAddress: inputVerifierVerifyingContractSource,
      gatewayChainId,
      gatewayDecryptionAddress: gatewayDecryptionAddress,
    },
    kmsSigners,
    coprocessorSigners,
  };
}

function __checkHardCodedAddress(
  contractName: FhevmContractName,
  contractAddress: string,
  hardCodedAddress: string,
  expectedHardCodedAddress: string,
) {
  if (hardCodedAddress !== expectedHardCodedAddress) {
    debug(
      `${picocolors.bgRedBright(picocolors.bold("ERROR"))} deployed ${contractName} contact at ${contractAddress} does not use the expected ACL address. Got ${hardCodedAddress}, expecting ${expectedHardCodedAddress}`,
    );
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.name} contracts.`);
  }
}

async function __setContractOwner(
  provider: MinimalProvider,
  contract: EthersT.Contract,
  contractName: string,
  currentOwnerSigner: EthersT.Signer,
  newOwnerSigner: EthersT.Signer,
  alreadyDeployed: boolean,
) {
  const ownerAddress = await contract.owner();
  const contractAddress = await contract.getAddress();

  const currentOwnerAddress = await currentOwnerSigner.getAddress();
  const newOwnerAddress = await newOwnerSigner.getAddress();

  if (alreadyDeployed) {
    if (ownerAddress !== newOwnerAddress) {
      throw new HardhatFhevmError(
        `Wrong ${contractName} owner address. Got ${ownerAddress}, expected ${newOwnerAddress}`,
      );
    }
  } else {
    if (ownerAddress !== currentOwnerAddress) {
      throw new HardhatFhevmError(
        `Wrong ${contractName} owner address. Got ${ownerAddress}, expected ${currentOwnerAddress}`,
      );
    }
  }

  if (ownerAddress === newOwnerAddress) {
    return;
  }

  // set contract owner using setOwnableStorage cheatcode
  await setOwnableStorage(provider, contractAddress, newOwnerAddress);

  assertHHFhevm(
    (await contract.owner()) === (await newOwnerSigner.getAddress()),
    `Set ${contractName} owner failed. Unexpected contract owner.`,
  );
}
