import fs from "fs";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import constants from "../constants";
import { HardhatFhevmError } from "../error";
import { FhevmEnvironment } from "./FhevmEnvironment";
import { getFhevmCoreContractsArtifact } from "./addresses";
import { PrecompiledCoreContractsAddresses } from "./types";
import { computeDummyAddress, getCodeAt, setCodeAt } from "./utils/hh";

export async function getPrecompiledCoreContractsAddresses(
  hre: HardhatRuntimeEnvironment,
): Promise<PrecompiledCoreContractsAddresses> {
  if (hre.network.name !== "hardhat") {
    throw new HardhatFhevmError(
      `Can't retrieve ${constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME} precompiled addresses. This operation is only supported on 'hardhat' network. Current network: ${hre.network.name}`,
    );
  }

  const precompiledFHEVMExecutorAddress = await retrievePreCompiledFHEVMExecutorAddressFromACLArtifact(hre);

  try {
    // Setup FHEVMExecutor
    const FHEVMExecutorArtifact = await getFhevmCoreContractsArtifact("FHEVMExecutor");
    const FHEVMExecutorBytecode = FHEVMExecutorArtifact.deployedBytecode;
    await setCodeAt(hre, precompiledFHEVMExecutorAddress, FHEVMExecutorBytecode);

    // Retrieve precompiled FHE addresses using FHEVMExecutor.
    const FHEVMExecutorReadOnly = new hre.ethers.Contract(
      precompiledFHEVMExecutorAddress,
      FHEVMExecutorArtifact.abi,
      hre.ethers.provider,
    );

    const precompiledACLAddress = (await FHEVMExecutorReadOnly.getACLAddress()) as string;
    const precompiledFHEGasLimitAddress = (await FHEVMExecutorReadOnly.getFHEGasLimitAddress()) as string;
    const precompiledInputVerifierAddress = (await FHEVMExecutorReadOnly.getInputVerifierAddress()) as string;

    return {
      ACLAddress: precompiledACLAddress,
      FHEVMExecutorAddress: precompiledFHEVMExecutorAddress,
      FHEGasLimitAddress: precompiledFHEGasLimitAddress,
      InputVerifierAddress: precompiledInputVerifierAddress,
    };
  } finally {
    await setCodeAt(hre, precompiledFHEVMExecutorAddress, "0x");
  }
}

export async function retrievePreCompiledFHEVMExecutorAddressFromACLArtifact(
  hre: HardhatRuntimeEnvironment,
): Promise<string> {
  const DUMMY_ACL_ADDR = computeDummyAddress(hre);

  if ((await getCodeAt(hre, DUMMY_ACL_ADDR)) !== "0x") {
    throw new HardhatFhevmError("Unable to determine precompiled FHEVMExecutor address.");
  }

  try {
    const aclArtifact = await getFhevmCoreContractsArtifact("ACL");
    const aclBytecode = aclArtifact.deployedBytecode;

    await setCodeAt(hre, DUMMY_ACL_ADDR, aclBytecode);

    const dummyAcl = new hre.ethers.Contract(DUMMY_ACL_ADDR, aclArtifact.abi, hre.ethers.provider);

    const precompiledFHEVMExecutorAddress = await dummyAcl.getFHEVMExecutorAddress();
    return precompiledFHEVMExecutorAddress;
  } finally {
    await setCodeAt(hre, DUMMY_ACL_ADDR, "0x");
  }
}

export async function loadPrecompiledCoreContractsAddresses(
  fhevmEnv: FhevmEnvironment,
): Promise<PrecompiledCoreContractsAddresses> {
  const jsonPath = fhevmEnv.paths.cachePrecompiledCoreContractsAddressesJson;

  if (fs.existsSync(jsonPath)) {
    const str = fs.readFileSync(jsonPath, "utf8");
    const o = JSON.parse(str);
    return {
      ACLAddress: o.ACLAddress,
      FHEVMExecutorAddress: o.FHEVMExecutorAddress,
      FHEGasLimitAddress: o.FHEGasLimitAddress,
      InputVerifierAddress: o.InputVerifierAddress,
    };
  }

  const addresses = await getPrecompiledCoreContractsAddresses(fhevmEnv.hre);

  if (!fs.existsSync(fhevmEnv.paths.cache)) {
    fs.mkdirSync(fhevmEnv.paths.cache);
  }

  fs.writeFileSync(jsonPath, JSON.stringify(addresses, null, 2), "utf8");

  return addresses;
}
