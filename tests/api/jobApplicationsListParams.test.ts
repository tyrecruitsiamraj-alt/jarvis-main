// @vitest-environment node
/**
 * `GET /api/job-applications` — **จำนวน param ที่ส่งลง pg ต้องเท่ากับที่ SQL อ้างเสมอ**
 *
 * บั๊กจริงที่เจ้าของเจอเอง 13 ส.ค. 2569 ("โหลดรายชื่อผู้สมัครไม่สำเร็จ"):
 * handler push `viewerId` เข้า params ทุกครั้ง แต่ใส่เงื่อนไข claim ลง WHERE
 * เฉพาะตอน **ไม่มี** `job_id` → เรียกแบบ `?job_id=` ได้ params 2 ตัวแต่ SQL อ้างตัวเดียว
 * pg ตอบ `bind message supplies 2 parameters, but prepared statement requires 1`
 * แล้ว **ทั้ง endpoint ตาย 500** = dialog รายชื่อบนกล่องงานเปิดไม่ได้เลยสักใบ
 *
 * ⚠️ เทสต์เดิมจับไม่ได้เพราะไม่มีใครทดสอบเส้น `?job_id=` — ตัวนี้จำลองวิธีนับ param
 * ของ pg (เทียบ `$n` สูงสุดกับความยาว params) ซึ่งเป็นเงื่อนไขจริงที่ทำให้พัง
 */
import { describe, expect, it } from 'vitest';
import { buildApplicationsListQuery } from '../../api/_handlers/job-applications';

/** วิธีนับของ pg: `$n` สูงสุดที่ SQL อ้าง ต้องเท่ากับจำนวน param ที่ส่งไป */
function highestParamIndex(sql: string): number {
  const found = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  return found.length === 0 ? 0 : Math.max(...found);
}

const VIEWER = '11111111-2222-3333-4444-555555555555';

/** SQL ที่ยิงจริงคือหลังแทน {{claimWhere}} แล้ว — ต้องนับจากตัวนั้น */
function resolvedSql(q: { sql: string; claimWhere: string }): string {
  return q.sql.replace(/\{\{claimWhere\}\}/g, q.claimWhere);
}

describe('buildApplicationsListQuery — param ต้องตรงกับ SQL ทุกเส้น', () => {
  it('**?job_id= (dialog กล่องงาน) — param ต้องไม่เกินที่ SQL อ้าง**', () => {
    const q = buildApplicationsListQuery({
      jobId: 'siamraj-sql:LAM6908004',
      scopedJobIds: null,
      viewerId: VIEWER,
    });
    expect(q.params).toEqual(['siamraj-sql:LAM6908004']);
    expect(q.params).toHaveLength(highestParamIndex(resolvedSql(q)));
  });

  it('ไม่ระบุใบขอ + admin (เห็นทุกแผนก) — param ตรง และยังกรอง claim', () => {
    const q = buildApplicationsListQuery({ jobId: null, scopedJobIds: null, viewerId: VIEWER });
    expect(q.params).toEqual([VIEWER]);
    expect(q.params).toHaveLength(highestParamIndex(resolvedSql(q)));
    expect(resolvedSql(q)).toContain('claimed_by');
  });

  it('ไม่ระบุใบขอ + ถูกล็อก BU — param ตรงทั้งสองตัว', () => {
    const q = buildApplicationsListQuery({
      jobId: null,
      scopedJobIds: new Set(['siamraj-sql:A', 'siamraj-sql:B']),
      viewerId: VIEWER,
    });
    expect(q.params).toHaveLength(2);
    expect(q.params).toHaveLength(highestParamIndex(resolvedSql(q)));
  });

  it('เส้น legacy (schema เก่า) ก็ต้องอ้าง param ครบเท่ากัน', () => {
    // legacy ใช้เงื่อนไข no-op ที่ยังอ้าง param เดิม — ถ้าเปลี่ยนเป็น 'true' เฉย ๆ จะพังแบบเดียวกัน
    const q = buildApplicationsListQuery({ jobId: null, scopedJobIds: null, viewerId: VIEWER });
    const legacy = q.sql.replace(/\{\{claimWhere\}\}/g, q.legacyClaimWhere);
    expect(q.params).toHaveLength(highestParamIndex(legacy));
  });

  it('มุมมองรายใบ **ไม่ซ่อน** ใบที่คนอื่นเก็บ — dialog ต้องนับได้ครบ', () => {
    const q = buildApplicationsListQuery({
      jobId: 'siamraj-sql:X',
      scopedJobIds: null,
      viewerId: VIEWER,
    });
    expect(resolvedSql(q)).not.toContain('claimed_by is null');
  });

  it('feed รวม **ยังต้องซ่อน** ใบที่คนอื่นเก็บ (กติกาที่เจ้าของสั่งไว้)', () => {
    const q = buildApplicationsListQuery({ jobId: null, scopedJobIds: null, viewerId: VIEWER });
    expect(resolvedSql(q)).toContain('claimed_by is null');
  });
});

describe('คลังกลาง — ใบขอปิดแล้วรายชื่อต้องไม่หาย', () => {
  it('**ผู้ใช้ที่ถูกล็อก BU เห็นใบที่จำแผนกตัวเองไว้ แม้ใบขอไม่อยู่ในลิสต์ที่เปิดอยู่**', () => {
    // เจ้าของเคาะ 13 ส.ค. 2569: "เก็บคนไว้ที่คลังกลาง" — scopedJobIds สร้างจาก
    // ใบขอที่ **เปิดอยู่** เท่านั้น ยึดตัวเดียวแปลว่าใบขอปิด = คนหายจากระบบ
    const q = buildApplicationsListQuery({
      jobId: null,
      scopedJobIds: new Set(['siamraj-sql:OPEN1']),
      viewerId: VIEWER,
      viewerDepartment: 'LBD',
    });
    const sql = resolvedSql(q);
    expect(sql).toContain('department_code');
    expect(q.params).toContain('LBD');
    expect(q.params).toHaveLength(highestParamIndex(sql));
  });

  it('⚠️ สิทธิ์ต้องไม่ผ่อน — เทียบแผนกตรงตัว ไม่ใช่ปล่อยผ่านทุกใบ', () => {
    const q = buildApplicationsListQuery({
      jobId: null,
      scopedJobIds: new Set(['siamraj-sql:OPEN1']),
      viewerId: VIEWER,
      viewerDepartment: 'LBD',
    });
    const sql = resolvedSql(q);
    // ต้องเป็น "ใบขอที่เห็นได้ **หรือ** แผนกตรงกัน" ไม่ใช่เงื่อนไขที่จริงเสมอ
    expect(sql).toMatch(/job_id = any\(\$\d+::text\[\]\) or department_code = \$\d+/);
  });

  it('admin (เห็นทุกแผนก) ไม่ต้องมีเงื่อนไขแผนก — เห็นครบอยู่แล้ว', () => {
    const q = buildApplicationsListQuery({
      jobId: null,
      scopedJobIds: null,
      viewerId: VIEWER,
      viewerDepartment: null,
    });
    expect(resolvedSql(q)).not.toContain('department_code');
  });

  it('ไม่รู้แผนกผู้ใช้ → ถอยไปใช้ job_id อย่างเดียว (พฤติกรรมเดิม ไม่ regress)', () => {
    const q = buildApplicationsListQuery({
      jobId: null,
      scopedJobIds: new Set(['siamraj-sql:A']),
      viewerId: VIEWER,
      viewerDepartment: null,
    });
    const sql = resolvedSql(q);
    expect(sql).not.toContain('department_code');
    expect(q.params).toHaveLength(highestParamIndex(sql));
  });
});
