import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * ตัวกรอง "ใบขอเปิดตั้งแต่ปี 2567" (เจ้าของเคาะ 14 ส.ค. 2569)
 *
 * ⚠️ อ่าน source ตรง ๆ เพราะ SQL อยู่ใน closure ไม่ได้ export — เกณฑ์ที่ต้องล็อก:
 * ต้องกรองที่ **list เท่านั้น** ห้ามหลุดเข้า by-id (เปิดใบเก่ารายใบต้องยังได้เสมอ)
 * เจ้าหน้าที่ค้นด้วยเลขที่ใบเก่า/เปิดลิงก์เก่าแล้วเจอ null = ของหายโดยไม่มีใครรู้สาเหตุ
 */
const SRC = fs.readFileSync(
  path.join(process.cwd(), 'api/_lib/siamrajSqlServerRequests.ts'),
  'utf8',
);

describe('ตัวกรองปีใบขอเปิด (SIAMRAJ_OPEN_REQUEST_MIN_DATE)', () => {
  it('list (CTE recent) ต้องมีเงื่อนไข request_date >= @minRequestDate', () => {
    const recentBlock = SRC.slice(SRC.indexOf('WITH recent AS'), SRC.indexOf('base AS'));
    expect(recentBlock).toMatch(/A\.request_date >= CONVERT\(datetime, @minRequestDate, 120\)/);
  });

  it('ส่ง minRequestDate เข้า params ของ list query', () => {
    expect(SRC).toMatch(/minRequestDate: OPEN_REQUEST_MIN_DATE/);
  });

  it('⚠️ by-id ต้องไม่กรองปี — fetchSqlServerUnitRequestRows ห้ามอ้าง minRequestDate', () => {
    const byIdFn = SRC.slice(
      SRC.indexOf('async function fetchSqlServerUnitRequestRows'),
      SRC.indexOf('export async function getSiamrajSqlServerUnitRequestById'),
    );
    expect(byIdFn).not.toMatch(/minRequestDate/);
    expect(byIdFn).not.toMatch(/request_date >=/);
  });

  it('BASE_SQL_BY_ID ต้องไม่มีตัวกรองปี (ต่างจาก recent)', () => {
    const byIdConst = SRC.slice(
      SRC.indexOf('const BASE_SQL_BY_ID'),
      SRC.indexOf('const SELECT_COLUMNS'),
    );
    expect(byIdConst).not.toMatch(/minRequestDate/);
  });

  it('default = 2024-01-01 (1 ม.ค. 2567) · env ว่างต้องไม่กลายเป็น "ไม่กรอง"', () => {
    // env ว่าง → default ก่อนถึงค่า (กันบั๊ก parseIntEnv pattern: ว่าง = ไม่กรอง)
    expect(SRC).toMatch(
      /\(process\.env\.SIAMRAJ_OPEN_REQUEST_MIN_DATE \|\| ''\)\.trim\(\) \|\| '2024-01-01'/,
    );
  });
});
