// This script updates the version of @fhevm/mock-utils in the
// @fhevm/hardhat-plugin/package.json `peerDependencies` entry.
//
// It cannot be automated by simply reading the version from
// @fhevm/mock-utils's own package.json, because that version may not yet
// be updated during the version bump cycle.

// Usage: node update-peer-dependencies.js <new-version>

const fs = require("fs");
const path = require("path");

const newVersion = process.argv[2];

const pkgPath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

if (!pkg.peerDependencies) {
  pkg.peerDependencies = {};
}

pkg.peerDependencies["@fhevm/mock-utils"] = newVersion;

console.log(`Update @fhevm/mock-utils=${newVersion}`);

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
