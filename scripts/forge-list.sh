#!/usr/bin/env bash
#
# Prints the forge test functions that `forge test` selects with the same arguments, one per line, and
# runs none of them. It is the list command of the forge tests in ALL_TESTS.json: give it the arguments
# that the test gives to forge-test.sh, from the same folder.
#
# Each line names the package folder, the file, the contract and the function, and the Foundry profile
# when FOUNDRY_PROFILE sets one:
#
#   host-contracts-cleartext/v14/test/forge/ForkUserDecrypt.t.sol:ForkUserDecryptTest.test_x
#   foundry/forge-fhevm-std/test/fork/TwoForks.t.sol:TwoForksTest.test_y [fhevm-debug]
#
# So the same function of two packages, or of two profiles, gives two lines that differ. It compiles
# what is not compiled yet, and calls no network.
#
# Usage: ./scripts/forge-list.sh [forge test args...]

set -euo pipefail

folder="$(git rev-parse --show-prefix)"
profile="${FOUNDRY_PROFILE:-}"

forge test --list --json --offline "$@" | node -e '
  const [folder, profile] = process.argv.slice(1);
  const suffix = profile === "" || profile === "default" ? "" : ` [${profile}]`;
  let text = "";

  process.stdin.on("data", (chunk) => (text += chunk));
  process.stdin.on("end", () => {
    // forge can print a line about its compiler before the JSON.
    const tree = JSON.parse(text.slice(text.indexOf("{")));

    for (const [file, contracts] of Object.entries(tree)) {
      for (const [contract, functions] of Object.entries(contracts)) {
        for (const name of functions) console.log(`${folder}${file}:${contract}.${name}${suffix}`);
      }
    }
  });
' "$folder" "$profile"
