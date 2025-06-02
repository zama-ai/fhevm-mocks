const fs = require("fs");
const path = require("path");

const newVersion = process.argv[2];

const pkgPath = path.resolve(__dirname, "../package.json");
// const mockUtilsPkgPath = path.resolve(__dirname, "../../mock-utils/src/package.json");

// const mockUtilsPkg = JSON.parse(fs.readFileSync(mockUtilsPkgPath, "utf8"));
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

// if (!mockUtilsPkg.version) {
//   console.error("❌ Could not find @fhevm/mock-utils version");
//   process.exit(1);
// }

if (!pkg.peerDependencies) {
  pkg.peerDependencies = {};
}

//pkg.peerDependencies["@fhevm/mock-utils"] = mockUtilsPkg.version;
pkg.peerDependencies["@fhevm/mock-utils"] = newVersion;

//console.log(`Update @fhevm/mock-utils=${mockUtilsPkg.version}`);
console.log(`Update @fhevm/mock-utils=${newVersion}`);

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
