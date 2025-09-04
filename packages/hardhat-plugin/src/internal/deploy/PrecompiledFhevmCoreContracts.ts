import { FhevmMockProvider } from "@fhevm/mock-utils";
import { exec } from "child_process";
import setupDebug from "debug";
import { ethers as EthersT } from "ethers";
import * as fs from "fs";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../../error";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INSTALL_SOLIDITY } from "../../task-names";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";
import constants from "../constants";
import { PrecompiledCoreContractsAddresses } from "../types";
import { computeDummyAddress } from "../utils/hh";

const debug = setupDebug("@fhevm/hardhat:addresses");

function __logPrecompiledAddresses(addresses: PrecompiledCoreContractsAddresses, useCache: boolean) {
  const prefix = !useCache ? "Resolve" : `${picocolors.yellowBright("Cache")}`;
  debug(`${prefix} precompiled ${picocolors.cyanBright("ACL")} address                  : ${addresses.ACLAddress}`);
  debug(
    `${prefix} precompiled ${picocolors.cyanBright("FHEVMExecutor")} address        : ${addresses.CoprocessorAddress}`,
  );
  debug(
    `${prefix} precompiled ${picocolors.cyanBright("InputVerifierAddress")} address : ${addresses.InputVerifierAddress}`,
  );
  debug(`${prefix} precompiled ${picocolors.cyanBright("HCULimitAddress")} address   : ${addresses.HCULimitAddress}`);
}

async function childProcessExecNpxHardhatFhevmInstallSolidity(alreadyRunning: boolean) {
  const cmd = `npx hardhat ${SCOPE_FHEVM} ${SCOPE_FHEVM_TASK_INSTALL_SOLIDITY} --network hardhat`;

  if (alreadyRunning) {
    throw new HardhatFhevmError(`Command '${cmd}' is already running.`);
  }

  debug(`Running command '${cmd}' ...`);

  const output: string = await new Promise((resolve, reject) => {
    const process = exec(
      cmd,
      {
        maxBuffer: 1024 * 1024 * 500,
      },
      (err, stdout) => {
        if (err !== null) {
          return reject(err);
        }
        resolve(stdout);
      },
    );

    process.stdin!.end();
  });

  debug(`Command '${cmd}' completed.`);
  console.log(output);
  return output;
}

export async function getPrecompiledFhevmCoreContractsAddresses(
  mockProvider: FhevmMockProvider,
  fhevmPaths: FhevmEnvironmentPaths,
): Promise<PrecompiledCoreContractsAddresses> {
  debug(
    `Resolving precompiled @fhevm/core-contracts addresses using artifacts at ${fhevmPaths.resolveFhevmCoreContractsArtifactRootDir()} ...`,
  );

  if (mockProvider.info.networkName !== "hardhat") {
    throw new HardhatFhevmError(
      `Can't retrieve ${constants.FHEVM_CORE_CONTRACTS_PACKAGE.name} precompiled addresses. This operation is only supported on 'hardhat' network. Current network: ${mockProvider.info.networkName}`,
    );
  }

  const precompiledFHEVMExecutorAddress = await retrievePreCompiledFHEVMExecutorAddressFromACLArtifact(
    mockProvider,
    fhevmPaths,
  );

  try {
    // Setup FHEVMExecutor
    const FHEVMExecutorArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("FHEVMExecutor");
    const FHEVMExecutorBytecode = FHEVMExecutorArtifact.artifact.deployedBytecode;
    await mockProvider.setCodeAt(precompiledFHEVMExecutorAddress, FHEVMExecutorBytecode);

    // Retrieve precompiled FHE addresses using FHEVMExecutor.
    const FHEVMExecutorReadOnly = new EthersT.Contract(
      precompiledFHEVMExecutorAddress,
      FHEVMExecutorArtifact.artifact.abi,
      mockProvider.readonlyEthersProvider,
    );

    const precompiledACLAddress = (await FHEVMExecutorReadOnly.getACLAddress()) as string;
    const precompiledHCULimitAddress = (await FHEVMExecutorReadOnly.getHCULimitAddress()) as string;
    const precompiledInputVerifierAddress = (await FHEVMExecutorReadOnly.getInputVerifierAddress()) as string;

    const addresses: PrecompiledCoreContractsAddresses = {
      ACLAddress: precompiledACLAddress,
      CoprocessorAddress: precompiledFHEVMExecutorAddress,
      HCULimitAddress: precompiledHCULimitAddress,
      InputVerifierAddress: precompiledInputVerifierAddress,
    };

    __logPrecompiledAddresses(addresses, false);

    return addresses;
  } finally {
    await mockProvider.setCodeAt(precompiledFHEVMExecutorAddress, "0x");
  }
}

export async function retrievePreCompiledFHEVMExecutorAddressFromACLArtifact(
  mockProvider: FhevmMockProvider,
  fhevmPaths: FhevmEnvironmentPaths,
): Promise<string> {
  const DUMMY_ACL_ADDR = computeDummyAddress();

  if ((await mockProvider.getCodeAt(DUMMY_ACL_ADDR)) !== "0x") {
    throw new HardhatFhevmError("Unable to determine precompiled FHEVMExecutor address.");
  }

  try {
    const aclArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("ACL");
    const aclBytecode = aclArtifact.artifact.deployedBytecode;

    await mockProvider.setCodeAt(DUMMY_ACL_ADDR, aclBytecode);

    const dummyAcl = new EthersT.Contract(
      DUMMY_ACL_ADDR,
      aclArtifact.artifact.abi,
      mockProvider.readonlyEthersProvider,
    );

    const precompiledFHEVMExecutorAddress = await dummyAcl.getFHEVMExecutorAddress();
    return precompiledFHEVMExecutorAddress;
  } finally {
    await mockProvider.setCodeAt(DUMMY_ACL_ADDR, "0x");
  }
}

export async function loadPrecompiledFhevmCoreContractsAddresses(
  mockProvider: FhevmMockProvider,
  fhevmPaths: FhevmEnvironmentPaths,
  ignoreCache: boolean,
  isRunningInHHFHEVMInstallSolidity: boolean,
): Promise<PrecompiledCoreContractsAddresses> {
  const jsonPath = fhevmPaths.cachePrecompiledFhevmCoreContractsAddressesJson;

  if (fs.existsSync(jsonPath)) {
    if (ignoreCache) {
      debug(`Remove cache file ${jsonPath}.`);
      fs.rmSync(jsonPath);
    }
  }

  if (mockProvider.info.networkName !== "hardhat") {
    /*
      This address resolution method must be exclusively executed using the hardhat network.
      If it's not the case we spawn a process and run `npx hardhat --network hardhat ...` manually
      This will throw an error if we are running this command recursively.

      This mechanism is required to solve situations like
      - hardhat deploy --network localhost
      - hardhat compile --network localhost
    */
    if (!fs.existsSync(jsonPath)) {
      await childProcessExecNpxHardhatFhevmInstallSolidity(isRunningInHHFHEVMInstallSolidity);
      // Now the cache file must have been generated.
      if (!fs.existsSync(jsonPath)) {
        throw new HardhatFhevmError(`Unable to generated ${jsonPath}`);
      }
    }
  }

  if (fs.existsSync(jsonPath)) {
    debug(`Skip precompiled @fhevm/core-contracts addresses resolution. Cache file ${jsonPath} already exists.`);
    const str = fs.readFileSync(jsonPath, "utf8");
    const o = JSON.parse(str);

    __logPrecompiledAddresses(o, true);

    return {
      ACLAddress: o.ACLAddress,
      CoprocessorAddress: o.CoprocessorAddress,
      HCULimitAddress: o.HCULimitAddress,
      InputVerifierAddress: o.InputVerifierAddress,
    };
  }

  const addresses = await getPrecompiledFhevmCoreContractsAddresses(mockProvider, fhevmPaths);

  if (!fs.existsSync(fhevmPaths.cacheDir)) {
    fs.mkdirSync(fhevmPaths.cacheDir);
  }

  debug(`Save precompiled fhevm core contracts addresses cache file ${jsonPath}.`);

  fs.writeFileSync(jsonPath, JSON.stringify(addresses, null, 2), "utf8");

  return addresses;
}
