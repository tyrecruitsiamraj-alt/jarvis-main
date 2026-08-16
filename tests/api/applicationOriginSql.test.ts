// @vitest-environment node
/**
 * "คนนี้มาจากไหน" ของใบสมัคร (16 ส.ค. 2569) — โครง SQL
 *
 * พังเงียบที่คุมไว้:
 * - ไม่มี temporal guard → คนที่สมัครเข้ามาเอง แล้ววันหลัง AI ไปเจอเบอร์เดิมในฐาน
 *   จะถูกตีตราย้อนหลังว่า "AI หาให้" ทั้งที่เขามาเอง
 * - เผลอนับ person_ref `app-%` → ทุกคนที่ AI โทรหลังสมัครกลายเป็น "AI หาให้" หมด
 * - เผลอใส่ param ในนิพจน์ → จำนวน param ที่ pg นับเพี้ยน = ทั้ง endpoint 500
 */
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_ORIGINS,
  applicationOriginColumn,
  applicationOriginExpr,
  isApplicationOrigin,
} from '../../api/_lib/applicationOriginSql.js';

const sql = applicationOriginExpr('a');

describe('applicationOriginExpr', () => {
  it('มีครบ 3 ที่มา', () => {
    expect(APPLICATION_ORIGINS).toEqual(['self_apply', 'ai_found', 'staff_added']);
    for (const o of APPLICATION_ORIGINS) expect(sql).toContain(`'${o}'`);
  });

  it('นับเฉพาะคิวที่ AI ไปหาคนที่ยังไม่สมัคร (ir-/card-) ไม่ใช่ app-', () => {
    expect(sql).toContain(`q.person_ref like 'ir-%'`);
    expect(sql).toContain(`q.person_ref like 'card-%'`);
    expect(sql).not.toContain(`'app-%'`);
  });

  it('มี temporal guard — AI ต้องถูกส่งไปตามก่อนใบสมัครจะเกิด', () => {
    expect(sql).toContain('q.created_at <= a.created_at');
  });

  it('ผูกกับใบขอเดียวกัน + เบอร์เดียวกัน (E.164)', () => {
    expect(sql).toContain('q.job_ref = a.job_id');
    expect(sql).toContain('a.phone_e164');
  });

  it('เบอร์ในคิวอ่านสองคีย์ (reminder ใช้ recipient_phone · interview ใช้ phone)', () => {
    expect(sql).toContain(`coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`);
  });

  it('ไม่มี param เลย — ต่อท้าย select list ได้โดยไม่ทำให้ $n เพี้ยน', () => {
    expect(sql).not.toMatch(/\$\d/);
  });

  it('ลำดับตัดสิน: AI มาก่อน แล้วค่อยดูว่าเจ้าหน้าที่คีย์ — ที่เหลือคือสมัครเอง', () => {
    expect(sql.indexOf("'ai_found'")).toBeLessThan(sql.indexOf("'staff_added'"));
    expect(sql.indexOf("'staff_added'")).toBeLessThan(sql.indexOf("'self_apply'"));
  });

  it('เปลี่ยน alias ได้ (คิวรีอื่นอาจตั้งชื่อไม่เหมือนกัน)', () => {
    const other = applicationOriginExpr('x');
    expect(other).toContain('q.job_ref = x.job_id');
    expect(other).not.toContain('a.job_id');
  });

  it('applicationOriginColumn ตั้งชื่อคอลัมน์ origin', () => {
    expect(applicationOriginColumn('a').trimEnd().endsWith('as origin')).toBe(true);
  });
});

describe('isApplicationOrigin', () => {
  it('รับเฉพาะค่าที่รู้จัก', () => {
    expect(isApplicationOrigin('ai_found')).toBe(true);
    expect(isApplicationOrigin('self_apply')).toBe(true);
    expect(isApplicationOrigin('unknown')).toBe(false);
    expect(isApplicationOrigin(null)).toBe(false);
    expect(isApplicationOrigin(undefined)).toBe(false);
  });
});

describe('ต่อเข้ากับคิวรีรายชื่อจริง', () => {
  it('LIST_COLUMNS ของ job-applications มีคอลัมน์ origin', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.join(import.meta.dirname, '../../api/_handlers/job-applications.ts'),
      'utf8',
    );
    expect(src).toContain("applicationOriginColumn('a')");
    // ค่าที่ไม่รู้จักต้องกลายเป็น undefined ไม่ใช่เดาเป็น self_apply
    expect(src).toContain('isApplicationOrigin(r.origin) ? r.origin : undefined');
  });
});
