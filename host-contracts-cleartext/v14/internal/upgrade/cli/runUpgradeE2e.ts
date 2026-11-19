// Run: npm run test:upgrade (the cross-generation lane: this file plus test/e2e/upgrade/create2.test.ts)
//
// Never skips: the sibling `<vN-1>` package is a workspace member (see ../runUpgradeE2e.ts).

import { runUpgradeE2e } from '../runUpgradeE2e.ts';

runUpgradeE2e();
