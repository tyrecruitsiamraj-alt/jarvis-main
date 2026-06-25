import '../api/_lib/env.js';
import { getSiamrajDbSource, listSiamrajUnitRequests } from '../api/_lib/siamrajUnitRequests.js';

console.log('db source', getSiamrajDbSource());
const items = await listSiamrajUnitRequests({ limit: 3 });
console.log('count', items.length);
if (items[0]) console.log(JSON.stringify(items[0], null, 2));
