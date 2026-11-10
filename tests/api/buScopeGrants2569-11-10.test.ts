// @vitest-environment node
/**
 * ตรวจทั้งระบบ 10 พ.ย. 2569 — ข้อ 4 (เจ้าของ Choice "เห็นเฉพาะ BU ตัวเอง" + "ล็อกที่เซิร์ฟเวอร์ด้วย")
 * - หน้าติดตาม · ดูแลหลังเริ่มงาน เห็นเฉพาะ BU ในสิทธิ์ (ไม่รู้ BU = เห็นทุกคน · admin ทุก BU)
 * - ปิดสิทธิ์ในหน้า "บทบาทและสิทธิ์" = API ปฏิเสธด้วย · ค่าเริ่มไม่ล็อกเพิ่ม (วันที่ขึ้นไม่มีใครเสียสิทธิ์)
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));

import { buVisibleSql } from '../../api/_lib/homeBuSql';
import { grantFunctionFor } from '../../api/_lib/rbac';
import { grantSwitchedOff } from '../../api/_lib/roleFunctionGrants';

const read = (p: string) => readFileSync(p, 'utf8');

beforeEach(() => dbQuery.mockReset());

describe('เห็นเฉพาะ BU ในสิทธิ์', () => {
  it('เงื่อนไข: ไม่กรอง (admin) · ไม่รู้ BU = เห็น · อยู่ในชุด = เห็น', () => {
    expect(buVisibleSql('x', '$3')).toBe('($3::text[] is null or x is null or x = any($3::text[]))');
  });
  it('หน้าติดตาม: รายการและยอดรวมกรองชุดเดียวกัน · BU ของสาย = นิยามหน้าหลัก (followBuSql)', () => {
    const f = read('api/_handlers/follow.ts');
    expect(f).toContain('const buSet = await viewerBuSet(req.user);');
    expect(f).toContain("buVisibleSql(followBuSql('f'), band ? '$6' : '$3')");
    expect(f).toContain("buVisibleSql(followBuSql('f'), band ? '$4' : '$1')");
    expect(f).toContain('select f.* from ${followTable} f ${followBuJoin(\'f\')} ${listWhere}');
    expect(f).toContain('select count(*)::text as n from ${followTable} f ${followBuJoin(\'f\')} ${countWhere}');
  });
  it('ดูแลหลังเริ่มงาน: กรองด้วยรหัสไซต์ของแถว', () => {
    expect(read('api/_handlers/aftercare.ts')).toContain("buVisibleSql(aftercareBuSql('a'), '$1')");
  });
  it('ชุด BU ของผู้ใช้ = BU หลัก + ดูเพิ่ม (แปลงชุดแผนก) · admin = ไม่กรอง · ไม่มี BU = ชุดว่าง', () => {
    const src = read('api/_lib/homeBuSql.ts');
    expect(src).toContain("if (scope.mode === 'all') return null;");
    expect(src).toContain("if (scope.mode === 'none') return [];");
    expect(src).toContain('scope.codes.map((c) => normalizeTrendBu(c) ?? c)');
  });
});

describe('ปิดสิทธิ์ = ล็อกที่เซิร์ฟเวอร์', () => {
  it('ล็อกเฉพาะแถวที่ปิดไว้ (enabled=false) · เปิด/ไม่มีแถว = ไม่ล็อก · อ่านตารางไม่ได้ = ไม่ล็อก', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ role: 'staff', function_id: 'follow_read', enabled: false }, { role: 'staff', function_id: 'candidates_edit', enabled: true }] });
    expect(await grantSwitchedOff('staff', 'follow_read', 1_000_000)).toBe(true);
    expect(await grantSwitchedOff('staff', 'candidates_edit', 1_000_001)).toBe(false);
    expect(await grantSwitchedOff('staff', 'jobs_read', 1_000_002)).toBe(false);
    dbQuery.mockRejectedValueOnce(new Error('db down'));
    expect(await grantSwitchedOff('staff', 'follow_read', 9_000_000)).toBe(false);
  });
  it('เส้นไหนคุมด้วยสิทธิ์อะไร · ใบสมัครคุมแค่การอ่าน (ลงผลโทรเป็นงานประจำ)', () => {
    expect(grantFunctionFor('follow', 'GET')).toBe('follow_read');
    expect(grantFunctionFor('follow', 'PATCH')).toBe('follow_manage');
    expect(grantFunctionFor('candidates', 'POST')).toBe('candidates_create');
    expect(grantFunctionFor('candidates', 'DELETE')).toBe('candidates_edit');
    expect(grantFunctionFor('job-applications', 'GET')).toBe('candidates_read');
    expect(grantFunctionFor('job-applications', 'PATCH')).toBeNull();
    expect(grantFunctionFor('matching-board', 'GET')).toBeNull();
  });
  it('withRbac เช็กหลังด่าน role · หน้าดูแลหลังเริ่มงานเช็ก aftercare_read', () => {
    expect(read('api/_lib/http.ts')).toContain('if (fn && (await grantSwitchedOff(req.user.role, fn))) {');
    expect(read('api/_handlers/aftercare.ts')).toContain("await grantSwitchedOff(req.user.role, 'aftercare_read')");
  });
});
