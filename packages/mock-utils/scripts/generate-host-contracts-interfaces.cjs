const fs = require("fs");
const path = require("path");

const hostContractsPkgPath = require.resolve("@fhevm/host-contracts/package.json");
const hostContractsVersion = JSON.parse(fs.readFileSync(hostContractsPkgPath, "utf8")).version;

const oraclePkgPath = require.resolve("@zama-fhe/oracle-solidity/package.json");
const oracleVersion = JSON.parse(fs.readFileSync(oraclePkgPath, "utf8")).version;

const hostContractsDir = path.join(path.dirname(hostContractsPkgPath), "artifacts", "contracts");
const oracleContractsDir = path.join(path.dirname(oraclePkgPath), "artifacts", "contracts");

function listArtifacts(dir) {
  const entries = fs.readdirSync(dir, { recursive: false });
  const out = [];
  for (let i = 0; i < entries.length; ++i) {
    const ext = path.extname(entries[i]);
    if (ext !== ".sol") {
      continue;
    }
    const absPath = path.join(dir, entries[i]);
    let stats = fs.statSync(absPath);
    if (!stats.isDirectory()) {
      continue;
    }
    const artifactsPath = path.join(absPath, `${path.parse(absPath).name}.json`);
    stats = fs.statSync(artifactsPath);
    if (!stats.isFile()) {
      throw new Error(`Unable to locate ${artifactsPath}`);
    }
    out.push(artifactsPath);
  }
  return out;
}

const outDir = path.join(__dirname, "../src/fhevm/contracts/interfaces");

let artifacts = listArtifacts(hostContractsDir);
for (let i = 0; i < artifacts.length; ++i) {
  const name = path.parse(artifacts[i]).name;
  const outFile = path.join(outDir, `${name}.itf.ts`);
  const json = fs.readFileSync(artifacts[i], "utf8");
  const c = JSON.parse(json);
  const code = `import { ethers as EthersT } from "ethers";

// version "${hostContractsVersion}"
export const ${name}InterfaceVersion = "${hostContractsVersion}";

export const ${name}PartialInterface: EthersT.Interface = new EthersT.Interface(
${JSON.stringify(c.abi, null, 2)}
);
`;
  fs.writeFileSync(path.join(outDir, `${name}.itf.ts`), code, "utf8");
  console.log(`✅ Generated ${outFile}`);
}

artifacts = listArtifacts(oracleContractsDir);
for (let i = 0; i < artifacts.length; ++i) {
  const name = path.parse(artifacts[i]).name;
  const outFile = path.join(outDir, `${name}.itf.ts`);
  const json = fs.readFileSync(artifacts[i], "utf8");
  const c = JSON.parse(json);
  const code = `import { ethers as EthersT } from "ethers";

// version "${oracleVersion}"
export const ZamaFhe${name}InterfaceVersion = "${oracleVersion}";

export const ZamaFhe${name}Interface: EthersT.Interface = new EthersT.Interface(
${JSON.stringify(c.abi, null, 2)}
);
`;
  fs.writeFileSync(path.join(outDir, `ZamaFhe${name}.itf.ts`), code, "utf8");
  console.log(`✅ Generated ${outFile}`);
}

console.log(__dirname);
