export const istanbulReporter = ["html", "lcov"];
export const providerOptions = {
  mnemonic: process.env.MNEMONIC,
  default_balance_ether: '10000000000000000000000000',
};
export const skipFiles = ["test", "fhevmTemp"];
export const mocha = {
  fgrep: "[skip-on-coverage]",
  invert: true,
};

/*
// Work around stack too deep for coverage
  configureYulOptimizer: true,
  solcOptimizerDetails: {
    yul: true,
    yulDetails: {
      optimizerSteps: '',
    },
  },
*/