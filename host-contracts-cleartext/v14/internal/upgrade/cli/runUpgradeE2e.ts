// Run: npm run test:upgrade
//
// Exits 0 when the sibling v13 package is unavailable, so this is safe to wire into a test chain.

import { runUpgradeE2e } from '../runUpgradeE2e.ts';

runUpgradeE2e();
