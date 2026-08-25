// @vitest-environment node
/**
 * Phase 6.1-6.2 — ขั้นในกระบวนการจ้าง "ชุดเดียว" (`selection_progress` · migration 105)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **คีย์คือ (job_id, phone_e164)** ไม่ใช่ id ใบสมัคร/candidate_ref
 *    (บทเรียนล็อกโทร 068: คนเดียวมีหลายรหัส แต่เบอร์มีเบอร์เดียว) — ผิดข้อนี้แล้ว
 *    คนที่โผล่ทั้งในใบสมัครและในบอร์ดจะได้ขั้นคนละอันทั้งที่เป็นคนเดียวกัน
 * 2. **dual-write** — เขียนตารางกลาง **และ** คอลัมน์เดิม 094 เพื่อให้ถอยกลับได้
 * 3. **ตารางกลางเขียนก่อน** คอลัมน์เดิม (แหล่งที่ระบบอ่านก่อนต้องตรงกับที่เพิ่งกด)
 * 4. ตาราง/คอลัมน์ยังไม่ migrate **ต้องไม่พัง** (ทำงานต่อด้วยของเดิม)
 * 5. **ห้ามแตะ `status` เดิม** ของใบสมัคร (ตัวเลขทุกหน้านับจากตัวนั้น)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATION = read('migrations/105_selection_progress_central.sql');
const STORE = read('api/_lib/selectionProgressStore.ts');
const HANDLER = read('api/_handlers/selection-progress.ts');
const APPS_HANDLER = read('api/_handlers/job-applications.ts');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*--.*$/gm, '');

describe('migration 105', () => {
  it('คีย์เป็น (job_id, phone_e164) — ไม่ใช่ id ใบสมัคร', () => {
    const sql = stripComments(MIGRATION);
    expect(sql).toMatch(/primary key \(job_id, phone_e164\)/);
    /**
     * ⚠️ ตรวจเฉพาะบล็อก `create table` — `comment on column …` เป็น statement จริง
     * (ไม่ใช่คอมเมนต์ที่ strip ได้) และในนั้นมีคำว่า candidate_ref เพื่อ**เตือนห้ามใช้**
     */
    const createBlock = sql.slice(sql.indexOf('create table'), sql.indexOf(');'));
    expect(createBlock).not.toMatch(/application_id/);
    expect(createBlock).not.toMatch(/candidate_ref/);
  });

  it('เก็บทั้งขั้น เช็คลิสต์ และหน่วยงาน (6.6) + ร่องรอยคนแก้', () => {
    const sql = stripComments(MIGRATION);
    for (const col of [
      'selection_status',
      'prep_checklist',
      'unit_site_code',
      'unit_name',
      'updated_by_name',
    ]) {
      expect(sql).toContain(col);
    }
  });

  it('🔴 ไม่ลบ/ไม่แก้คอลัมน์เดิมของ 094 (ของเดิมต้องไม่หาย)', () => {
    const sql = stripComments(MIGRATION);
    expect(sql).not.toMatch(/drop\s+column/i);
    expect(sql).not.toMatch(/alter\s+table\s+public_job_applications\s+drop/i);
  });

  it('backfill idempotent (รันซ้ำได้) และเอาแถวที่อัปเดตล่าสุดเป็นตัวแทน', () => {
    const sql = stripComments(MIGRATION);
    expect(sql).toMatch(/on conflict \(job_id, phone_e164\) do nothing/);
    expect(sql).toMatch(/distinct on \(a\.job_id, a\.phone_e164\)/);
    expect(sql).toMatch(/order by[\s\S]*updated_at desc/);
  });
});

describe('store (adapter)', () => {
  const code = stripComments(STORE);

  it('เขียนตารางกลางก่อนคอลัมน์เดิม (ลำดับสำคัญ)', () => {
    const central = code.indexOf('insert into');
    const legacy = code.indexOf('update ${APPS}');
    expect(central).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(central);
  });

  it('อ่านคีย์คนด้วย E.164 เสมอ (ไม่รับเบอร์ดิบตรง ๆ)', () => {
    expect(code).toContain('toE164Thai');
    expect(code).toMatch(/reason: 'no_phone'/);
  });

  it('ตาราง/คอลัมน์ยังไม่มี = ไม่พัง (ทำงานต่อด้วยของเดิม)', () => {
    expect(code).toContain('isMissingSchema');
    expect(code).toMatch(/isPgUndefinedTable/);
    expect(code).toMatch(/42703/);
  });

  it('partial update — ไม่ส่งฟิลด์ = ไม่แตะของเดิม', () => {
    expect(code).toMatch(/case when \$9::boolean then excluded\.selection_status/);
    expect(code).toMatch(/case when \$10::boolean then excluded\.prep_checklist/);
  });

  it('🔴 ห้ามแตะ status เดิมของใบสมัคร', () => {
    // update ฝั่งคอลัมน์เดิมต้องมีแค่ selection_status/prep_checklist/updated_at
    const legacyBlock = code.slice(code.indexOf('update ${APPS}'));
    expect(legacyBlock).not.toMatch(/\bset status =|,\s*status =/);
  });
});

describe('เส้นของคนที่ยังไม่มีใบสมัคร (คนจาก match)', () => {
  it('รับ jobId + phone แล้วเช็ค BU scope ก่อนเขียน', () => {
    expect(HANDLER).toContain('assertJobInScope');
    expect(HANDLER).toContain('loadScopedJobIdSet');
  });

  it('เขียนผ่าน store ตัวเดียว (ไม่ยิง SQL เอง)', () => {
    const code = stripComments(HANDLER);
    expect(code).toContain('saveProgress');
    expect(code).not.toMatch(/insert into|update .*set /i);
  });

  it('ค่าที่ไม่รู้จักถูกปฏิเสธ (ไม่เดาเป็นขั้นแรก)', () => {
    expect(HANDLER).toContain('isSelectionStatus');
    expect(HANDLER).toContain('ขั้นไม่ถูกต้อง');
  });
});

describe('เส้นของคนที่มีใบสมัคร — dual-write ผ่าน store เดียวกัน', () => {
  it('patchSelectionProgress เรียก saveProgress ไม่ใช่ update ตรง ๆ', () => {
    const fn = APPS_HANDLER.slice(
      APPS_HANDLER.indexOf('async function patchSelectionProgress'),
      APPS_HANDLER.indexOf('async function patchLead'),
    );
    expect(fn).toContain('saveProgress');
    expect(fn).toContain('applicationId: id');
  });

  it('GET อ่านตารางกลางมาทับค่าบนใบ (แหล่งใหม่ชนะ)', () => {
    expect(APPS_HANDLER).toContain('loadProgressByJob');
  });
});
