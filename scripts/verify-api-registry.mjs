/**
 * ตรวจว่า API registry โหลดได้และมี matching routes (ใช้หลัง deploy ใน Docker)
 * รัน: node scripts/verify-api-registry.mjs
 */
import { apiRoutes } from '../api/_handlers/registry.ts';

const required = [
  '/api/matching/suggestions',
  '/api/matching/parse-branch-demand-job',
  '/api/recruit-registrations',
];

for (const path of required) {
  if (!apiRoutes[path]) {
    console.error(`missing route: ${path}`);
    process.exit(1);
  }
}

console.log('api registry ok');
