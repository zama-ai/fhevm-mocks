// Run: npm run test:upgrade (the cross-generation lane: this file plus test/e2e/upgrade/create2.test.ts)
//
// Cannot skip: the previous generation is a workspace member, so an unresolvable import fails loudly.

import { runUpgradeE2e } from '../runUpgradeE2e.ts';

runUpgradeE2e();
