import assert from "assert";
import { ethers as EthersT } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import constants from "../constants";
import { FhevmEnvironmentConfig } from "./FhevmEnvironment";
import { retrievePreCompiledFHEVMExecutorAddressFromACLArtifact } from "./PrecompiledCoreContracts";
import {
  getACLAddress,
  getCoprocessorSigners,
  getDecryptionOracleAddress,
  getFHEGasLimitAddress,
  getFHEVMExecutorAddress,
  getFhevmCoreContractsArtifact,
  getGatewayChainId,
  getGatewayDecryptionAddress,
  getGatewayInputVerificationAddress,
  getInputVerifierAddress,
  getKMSSigners,
  getKMSThreshold,
  getKMSVerifierAddress,
  getZamaFheOracleSolidityArtifact,
} from "./addresses";
import { getCodeAt, setCodeAt } from "./utils/hh";

const OneAddress = "0x0000000000000000000000000000000000000001";

export async function setupMockUsingCoreContractsArtifacts(
  hre: HardhatRuntimeEnvironment,
): Promise<FhevmEnvironmentConfig> {
  const precompiledFHEVMExecutorAddress = await retrievePreCompiledFHEVMExecutorAddressFromACLArtifact(hre);

  const aclAddress = getACLAddress();
  const FHEVMExecutorAddress = getFHEVMExecutorAddress();
  const kmsVerifierAddress = getKMSVerifierAddress();
  const inputVerifierAddress = getInputVerifierAddress();
  const fheGasLimitAddress = getFHEGasLimitAddress();
  const decryptionOracleAddress = getDecryptionOracleAddress();

  assert(precompiledFHEVMExecutorAddress === constants.FHEVM_EXECUTOR_CONTRACT_ADDRESS);
  assert(aclAddress === constants.ACL_CONTRACT_ADDRESS);
  assert(FHEVMExecutorAddress === constants.FHEVM_EXECUTOR_CONTRACT_ADDRESS);
  assert(kmsVerifierAddress === constants.KMS_VERIFIER_CONTRACT_ADDRESS);
  assert(inputVerifierAddress === constants.INPUT_VERIFIER_CONTRACT_ADDRESS);
  assert(fheGasLimitAddress === constants.FHE_GASLIMIT_CONTRACT_ADDRESS);
  assert(decryptionOracleAddress === constants.DECRYPTION_ORACLE_ADDRESS);

  // Setup FHEVMExecutor
  const execArtifact = await getFhevmCoreContractsArtifact("FHEVMExecutor");
  const execBytecode = execArtifact.deployedBytecode;
  assert((await getCodeAt(hre, precompiledFHEVMExecutorAddress)) === "0x");
  await setCodeAt(hre, precompiledFHEVMExecutorAddress, execBytecode);
  // Call reinitialize ?
  console.log("TODO FHEVMExecutor.reinitialize is missing!");

  // Retrieve precompiled FHE addresses using FHEVMExecutor.
  const fhevmExecutorReadOnly = new hre.ethers.Contract(FHEVMExecutorAddress, execArtifact.abi, hre.ethers.provider);

  const precompiledACLAddress = (await fhevmExecutorReadOnly.getACLAddress()) as string;
  const precompiledFHEGasLimitAddress = (await fhevmExecutorReadOnly.getFHEGasLimitAddress()) as string;
  const precompiledInputVerifierAddress = (await fhevmExecutorReadOnly.getInputVerifierAddress()) as string;

  assert(precompiledFHEVMExecutorAddress === FHEVMExecutorAddress);
  assert(precompiledACLAddress === aclAddress);
  assert(precompiledFHEGasLimitAddress === fheGasLimitAddress);
  assert(precompiledInputVerifierAddress === inputVerifierAddress);

  // Setup ACL
  const aclArtifact = await getFhevmCoreContractsArtifact("ACL");
  const aclBytecode = aclArtifact.deployedBytecode;
  assert((await getCodeAt(hre, aclAddress)) === "0x");
  await setCodeAt(hre, aclAddress, aclBytecode);
  console.log("aclAddress=" + aclAddress);

  // Setup KMSVerifier
  const kmsArtifact = await getFhevmCoreContractsArtifact("KMSVerifier");
  const kmsBytecode = kmsArtifact.deployedBytecode;
  assert((await getCodeAt(hre, kmsVerifierAddress)) === "0x");
  await setCodeAt(hre, kmsVerifierAddress, kmsBytecode);

  // Setup InputVerifier
  const inputArtifact = await getFhevmCoreContractsArtifact("InputVerifier");
  const inputBytecode = inputArtifact.deployedBytecode;
  assert((await getCodeAt(hre, inputVerifierAddress)) === "0x");
  await setCodeAt(hre, inputVerifierAddress, inputBytecode);

  // Setup FHEGasLimit
  const fheGasLimitArtifact = await getFhevmCoreContractsArtifact("FHEGasLimit");
  const fheGasLimitBytecode = fheGasLimitArtifact.deployedBytecode;
  assert((await getCodeAt(hre, fheGasLimitAddress)) === "0x");
  await setCodeAt(hre, fheGasLimitAddress, fheGasLimitBytecode);

  // Setup DecryptionOracle
  const decryptionOracleArtifact = await getZamaFheOracleSolidityArtifact("DecryptionOracle");
  const decryptionOracleBytecode = decryptionOracleArtifact.deployedBytecode;
  assert((await getCodeAt(hre, decryptionOracleAddress)) === "0x");
  await setCodeAt(hre, decryptionOracleAddress, decryptionOracleBytecode);

  const aclReadOnly = new hre.ethers.Contract(aclAddress, aclArtifact.abi, hre.ethers.provider);
  const fheGasLimitReadOnly = new hre.ethers.Contract(fheGasLimitAddress, fheGasLimitArtifact.abi, hre.ethers.provider);
  const inputVerifierReadOnly = new hre.ethers.Contract(inputVerifierAddress, inputArtifact.abi, hre.ethers.provider);
  const kmsVerifierReadOnly = new hre.ethers.Contract(kmsVerifierAddress, kmsArtifact.abi, hre.ethers.provider);

  const decryptionOracleReadOnly = new hre.ethers.Contract(
    decryptionOracleAddress,
    decryptionOracleArtifact.abi,
    hre.ethers.provider,
  );

  console.log("TODO ACL.reinitialize is missing!");
  console.log("TODO FHEGasLimit.reinitialize is missing!");

  // Verify addresses
  assert((await aclReadOnly.getFHEVMExecutorAddress()) === FHEVMExecutorAddress);
  assert((await fheGasLimitReadOnly.getFHEVMExecutorAddress()) === FHEVMExecutorAddress);
  assert((await fhevmExecutorReadOnly.getACLAddress()) === aclAddress);
  assert((await fhevmExecutorReadOnly.getFHEGasLimitAddress()) === fheGasLimitAddress);
  assert((await fhevmExecutorReadOnly.getInputVerifierAddress()) === inputVerifierAddress);

  const zero = await impersonateAddress(hre, EthersT.ZeroAddress, hre.ethers.parseEther("100"));
  const one = await impersonateAddress(hre, OneAddress, hre.ethers.parseEther("100"));

  // Setup KMS Verifier
  // 1. transfer ownership
  // 2. call reinitialize
  const kmsZero = kmsVerifierReadOnly.connect(zero) as EthersT.Contract;
  const kmsOne = kmsVerifierReadOnly.connect(one) as EthersT.Contract;

  await kmsZero.transferOwnership(one);
  await kmsOne.acceptOwnership();

  const gatewayDecryptionAddress = getGatewayDecryptionAddress();
  const gatewayChainId: number = getGatewayChainId();
  const kmsInitialThreshold = getKMSThreshold();

  const kmsSigners = await getKMSSigners(hre);
  assert(kmsSigners.length === 1);

  await kmsOne.reinitialize(gatewayDecryptionAddress, gatewayChainId, kmsSigners, kmsInitialThreshold);

  /// Little test
  assert((await kmsVerifierReadOnly.getThreshold()) === BigInt(getKMSThreshold()));
  // Verify signers
  const _kmsSigners: string[] = await kmsVerifierReadOnly.getKmsSigners();
  assert(Array.isArray(_kmsSigners));
  assert(_kmsSigners.length === kmsSigners.length);
  for (let i = 0; i < _kmsSigners.length; ++i) {
    assert(_kmsSigners[i] === (await kmsSigners[i].getAddress()));
  }

  // Setup Input Verifier
  // 1. transfer ownership
  // 2. call reinitialize
  const inputVerifierZero = inputVerifierReadOnly.connect(zero) as EthersT.Contract;
  const inputVerifierOne = inputVerifierReadOnly.connect(one) as EthersT.Contract;

  await inputVerifierZero.transferOwnership(one);
  await inputVerifierOne.acceptOwnership();

  const gatewayInputVerificationAddress = getGatewayInputVerificationAddress();
  const coprocessorSigners = await getCoprocessorSigners(hre);
  assert(coprocessorSigners.length === 1);
  await inputVerifierOne.reinitialize(gatewayInputVerificationAddress, gatewayChainId, coprocessorSigners);

  // Verify signers
  const _inputSigners: string[] = await inputVerifierReadOnly.getCoprocessorSigners();
  assert(Array.isArray(_inputSigners));
  assert(_inputSigners.length === coprocessorSigners.length);
  for (let i = 0; i < _inputSigners.length; ++i) {
    assert(_inputSigners[i] === (await coprocessorSigners[i].getAddress()));
  }

  // InputVerifier eip712Domain
  const _inputVerifier712Domain = await inputVerifierReadOnly.eip712Domain();
  assert(Array.isArray(_inputVerifier712Domain));
  assert(_inputVerifier712Domain[1] === constants.INPUT_VERIFICATION_EIP712_DOMAIN.name);
  assert(_inputVerifier712Domain[2] === constants.INPUT_VERIFICATION_EIP712_DOMAIN.version); // version
  assert(_inputVerifier712Domain[3] === BigInt(gatewayChainId));
  assert(_inputVerifier712Domain[4] === gatewayInputVerificationAddress);

  // KMSVerifier eip712Domain
  const _kms712Domain = await kmsVerifierReadOnly.eip712Domain();
  assert(Array.isArray(_kms712Domain));
  assert(_kms712Domain[1] === constants.DECRYPTION_EIP712_DOMAIN.name);
  assert(_kms712Domain[2] === constants.DECRYPTION_EIP712_DOMAIN.version);
  assert(_kms712Domain[3] === BigInt(gatewayChainId));
  assert(_kms712Domain[4] === gatewayDecryptionAddress);

  return {
    ACLAddress: precompiledACLAddress,
    ACLReadOnly: aclReadOnly,
    FHEVMExecutorAddress: precompiledFHEVMExecutorAddress,
    FHEVMExecutorReadOnly: fhevmExecutorReadOnly,
    InputVerifierAddress: precompiledInputVerifierAddress,
    KMSVerifierAddress: kmsVerifierAddress,
    DecryptionOracleAddress: decryptionOracleAddress,
    DecryptionOracleReadOnly: decryptionOracleReadOnly,
    kmsSigners,
    coprocessorSigners,
    gatewayInputVerificationAddress: gatewayInputVerificationAddress,
    gatewayChainId,
    gatewayDecryptionAddress: gatewayDecryptionAddress,
  };
}

async function impersonateAddress(hre: HardhatRuntimeEnvironment, address: string, amount: bigint) {
  // for mocked mode
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  await hre.network.provider.send("hardhat_setBalance", [address, hre.ethers.toBeHex(amount)]);
  const impersonatedSigner = await hre.ethers.getSigner(address);
  return impersonatedSigner;
}
