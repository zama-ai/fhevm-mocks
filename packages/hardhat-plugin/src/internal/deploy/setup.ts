import {
  FhevmContractName,
  FhevmMockProvider,
  assertIsEIP712Domain,
  constants as constantsBase,
  contracts,
} from "@fhevm/mock-utils";
import setupDebug from "debug";
import { ethers as EthersT } from "ethers";
import * as picocolors from "picocolors";

import constants from "../../constants";
import { HardhatFhevmError } from "../../error";
import { FhevmEnvironmentAddresses, FhevmEnvironmentConfig, FhevmSigners } from "../FhevmEnvironment";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";
import { assertHHFhevm } from "../error";
import { assertSignersMatchAddresses } from "../utils/ethers";
import {
  getGatewayChainId,
  getGatewayDecryptionAddress,
  getGatewayInputVerificationAddress,
  getKMSThreshold,
} from "./addresses";

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
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME} contracts.`);
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
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME} contracts.`);
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
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME} contracts.`);
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
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME} contracts.`);
  }
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
  const FHEVMExecutorAddress = fhevmAddresses.FHEVMConfig.FHEVMExecutorAddress;
  const aclAddress = fhevmAddresses.FHEVMConfig.ACLAddress;
  const kmsVerifierAddress = fhevmAddresses.FHEVMConfig.KMSVerifierAddress;
  const inputVerifierAddress = fhevmAddresses.FHEVMConfig.InputVerifierAddress;
  const hcuLimitAddress = fhevmAddresses.HCULimitAddress;
  const decryptionOracleAddress = fhevmAddresses.SepoliaZamaOracleAddress;

  // Setup FHEVMExecutor
  const execArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("FHEVMExecutor");
  //const execBytecode = execArtifact.artifact.deployedBytecode;
  await __tryDeploy(
    mockProvider,
    "FHEVMExecutor",
    FHEVMExecutorAddress,
    execArtifact.path,
    execArtifact.artifact.deployedBytecode,
  );

  // Call reinitialize ?
  // console.log("TODO FHEVMExecutor.reinitialize is missing!");

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
  await __tryDeploy(mockProvider, "ACL", aclAddress, aclArtifact.path, aclArtifact.artifact.deployedBytecode);

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
  await __tryDeploy(
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

  // console.log("TODO ACL.reinitialize is missing!");
  // console.log("TODO HCULimit.reinitialize is missing!");

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
  const gatewayChainId: number = getGatewayChainId();
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

  const kmsOne = kmsVerifierReadOnly.connect(one) as EthersT.Contract;

  const kmsOwner = await kmsVerifierReadOnly.owner();
  const kmsDeployer = fhevmSigners.zeroAddress;
  const kmsDeployerSigner = zero;
  const expectedKmsOwner = fhevmSigners.oneAddress;
  const expectedKmsOwnerSigner = one;

  if (kmsDeployment.alreadyDeployed) {
    if (kmsOwner !== expectedKmsOwner) {
      throw new HardhatFhevmError(`Wrong KMSVerifier owner address. Got ${kmsOwner}, expected ${expectedKmsOwner}`);
    }
  } else {
    if (kmsOwner !== kmsDeployer) {
      throw new HardhatFhevmError(`Wrong KMSVerifier owner address. Got ${kmsOwner}, expected ${kmsDeployer}`);
    }
  }

  if (kmsOwner !== fhevmSigners.oneAddress) {
    // Setup KMS Verifier
    // 1. transfer ownership
    // 2. call reinitialize
    const kmsZero = kmsVerifierReadOnly.connect(kmsDeployerSigner) as EthersT.Contract;

    let tx = await kmsZero.transferOwnership(expectedKmsOwnerSigner);
    await tx.wait();

    tx = await kmsOne.acceptOwnership();
    await tx.wait();

    tx = await kmsOne.reinitialize(gatewayDecryptionAddress, gatewayChainId, kmsSigners, kmsInitialThreshold);
    await tx.wait();
  }

  // Make sure everything is properly setup
  assertHHFhevm((await kmsVerifierReadOnly.getThreshold()) === BigInt(getKMSThreshold()));
  // Verify signers
  const _kmsSignersAddresses: string[] = await kmsVerifierReadOnly.getKmsSigners();
  await assertSignersMatchAddresses(kmsSigners, _kmsSignersAddresses);

  const inputVerifierVerifyingContractSource = getGatewayInputVerificationAddress();

  // Setup Input Verifier
  // 1. transfer ownership
  // 2. call reinitialize
  const inputVerifierOne = inputVerifierReadOnly.connect(one) as EthersT.Contract;

  const inputVerifierOwner = await inputVerifierReadOnly.owner();
  const inputVerifierDeployer = fhevmSigners.zeroAddress;
  const inputVerifierDeployerSigner = zero;
  const expectedInputVerifierOwner = fhevmSigners.oneAddress;
  const expectedInputVerifierOwnerSigner = one;

  if (inputVerifierDeployment.alreadyDeployed) {
    if (inputVerifierOwner !== expectedInputVerifierOwner) {
      throw new HardhatFhevmError(
        `Wrong InputVerifier owner address. Got ${inputVerifierOwner}, expected ${expectedInputVerifierOwner}`,
      );
    }
  } else {
    if (inputVerifierOwner !== inputVerifierDeployer) {
      throw new HardhatFhevmError(
        `Wrong InputVerifier owner address. Got ${inputVerifierOwner}, expected ${inputVerifierDeployer}`,
      );
    }
  }

  if (inputVerifierOwner !== expectedInputVerifierOwner) {
    const inputVerifierZero = inputVerifierReadOnly.connect(inputVerifierDeployerSigner) as EthersT.Contract;

    let tx = await inputVerifierZero.transferOwnership(expectedInputVerifierOwnerSigner);
    await tx.wait();

    tx = await inputVerifierOne.acceptOwnership();
    await tx.wait();

    tx = await inputVerifierOne.reinitialize(inputVerifierVerifyingContractSource, gatewayChainId, coprocessorSigners);
    await tx.wait();
  }

  // Verify signers
  const _inputSignersAddresses: string[] = await inputVerifierReadOnly.getCoprocessorSigners();
  await assertSignersMatchAddresses(coprocessorSigners, _inputSignersAddresses);

  // InputVerifier eip712Domain
  const _inputVerifier712Domain = await inputVerifierReadOnly.eip712Domain();
  assertIsEIP712Domain(_inputVerifier712Domain, "InputVerifier", {
    name: constantsBase.INPUT_VERIFICATION_EIP712_DOMAIN.name,
    version: constantsBase.INPUT_VERIFICATION_EIP712_DOMAIN.version,
    chainId: BigInt(gatewayChainId),
    verifyingContract: inputVerifierVerifyingContractSource,
  });

  // KMSVerifier eip712Domain
  const _kms712Domain = await kmsVerifierReadOnly.eip712Domain();
  assertIsEIP712Domain(_kms712Domain, "KMSVerifier", {
    name: constantsBase.DECRYPTION_EIP712_DOMAIN.name,
    version: constantsBase.DECRYPTION_EIP712_DOMAIN.version,
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
    throw new HardhatFhevmError(`Unable to deploy ${constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME} contracts.`);
  }
}
