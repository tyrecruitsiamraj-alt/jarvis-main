import '../api/_lib/env.js';
import { isSiamrajUnitRequestsEnabled, listSiamrajUnitRequests } from '../api/_lib/siamrajUnitRequests.js';

console.log('enabled', isSiamrajUnitRequestsEnabled());
const items = await listSiamrajUnitRequests({ limit: 3 });
console.log('count', items.length);
if (items[0]) console.log(JSON.stringify(items[0], null, 2));
