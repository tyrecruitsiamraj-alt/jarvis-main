// @vitest-environment node
/**
 * นิยามตัวเลข Dashboard ศูนย์คุมงานสรรหา (S5) — สองด่านที่ห้ามหลุด:
 *
 * 1. **sum-check**: ประชากรเดียวหั่นเป็นถังต้องรวมกลับได้พอดี (บทเรียน "โทรไปแล้ว
 *    304.7% ของกรอกมา" — แต่ละช่องนับคนละประชากรแล้วไม่มีใครรู้)
 * 2. **bucket-parity**: เลขบนกล่องกับแถวที่กดเข้ามาเห็นต้องมาจากเงื่อนไขเดียวกัน
 *    (bucketCondition ที่เดียว) — ที่นี่ยิงกับฐานจริงเมื่อมี DATABASE_URL (read-only)
 *
 * โครงสร้าง SQL ตรวจแบบ static เสมอ (ไม่ต้องมี DB) — กับดักที่เคยเจ็บ:
 * เบอร์ในคิวต้อง coalesce สองคีย์ · outcome ต้อง coalesce last_outcome ·
 * temporal guard ต้องอยู่ในหลักฐานที่จับด้วยเบอร์
 */
import { describe, expect, it } from 'vitest';
import {
  CALLED_SQL,
  OVERVIEW_BUCKETS,
  bucketCondition,
  buildClaimedIdleSql,
  buildOverviewSql,
  isOverviewBucket,
  type OverviewBucket,
} from '../../api/_lib/applicantOverviewSql.js';

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe('โครงสร้าง SQL (static — กับดักที่เคยเจ็บจริง)', () => {
  it('เบอร์ในคิว coalesce สองคีย์เสมอ (reminder=recipient_phone · interview=phone)', () => {
    expect(CALLED_SQL).toContain(`coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`);
    expect(CALLED_SQL).not.toMatch(/payload->>'recipient_phone'\s*=\s*a\.phone_e164/);
  });

  it('outcome ในคิว coalesce กับ last_outcome เสมอ (ผลที่คนบันทึก/หลัง retry)', () => {
    // ทุกจุดที่อ่าน outcome จากคิวต้องผ่าน coalesce — ห้ามมี result->>'outcome' โดด ๆ
    const bare = CALLED_SQL.replace(/coalesce\(q\.last_outcome, q\.result->>'outcome'\)/g, '');
    expect(bare).not.toContain(`result->>'outcome'`);
  });

  it('หลักฐานที่จับด้วยเบอร์ต้องมี temporal guard (เวลาเหตุการณ์ ≥ เวลากรอกใบ)', () => {
    // ใบใหม่ของเบอร์เดิมห้ามเกิดมาพร้อมสถานะ "โทรแล้ว" จากผลเก่า
    expect(CALLED_SQL).toContain('>= a.created_at');
  });

  it('ห้ามอ่าน status ของใบ (status ขยับจากขั้นที่คนกด — ตอบคนละคำถาม)', () => {
    expect(buildOverviewSql()).not.toMatch(/a\.status|\bstatus\s*=\s*'contacted'|\bstatus\s*=\s*'converted'/);
    for (const cond of Object.values(OVERVIEW_BUCKETS)) {
      expect(cond).not.toMatch(/\ba\.status\b/);
    }
  });

  it('claimed_idle นับเฉพาะความคืบหน้า "หลังเวลาเก็บ" (ผลงานก่อน claim ไม่นับแทน)', () => {
    expect(OVERVIEW_BUCKETS.claimed_idle).toContain('>= a.claimed_at');
  });

  it('isOverviewBucket รับเฉพาะชื่อถังที่รู้จัก (กัน SQL จาก client)', () => {
    expect(isOverviewBucket('bad_phone')).toBe(true);
    expect(isOverviewBucket('claimed_idle')).toBe(true);
    expect(isOverviewBucket("1=1; drop table x")).toBe(false);
    expect(isOverviewBucket('')).toBe(false);
    expect(isOverviewBucket(undefined)).toBe(false);
  });
});

describe.skipIf(!hasDb)('sum-check + bucket-parity กับฐานจริง (read-only)', () => {
  it('ถังการโทรรวมกลับเป็น total เป๊ะ: called + in_queue + held + untouched = total', async () => {
    const { dbQuery } = await import('../../api/_lib/postgres.js');
    const { rows } = await dbQuery<Record<string, number>>(buildOverviewSql(), [null, null]);
    const o = rows[0];
    expect(Number(o.called) + Number(o.in_queue_awaiting) + Number(o.held_or_claimed) + Number(o.untouched)).toBe(
      Number(o.total),
    );
    // โทรแล้วทุกใบต้องตกถังใดถังหนึ่ง: success + failed = called (outcome แปลกปลอมตก failed ห้ามหล่น)
    expect(Number(o.contact_success) + Number(o.contact_failed)).toBe(Number(o.called));
    // นัดได้ + ยังนัดไม่ได้ = สำเร็จ
    expect(Number(o.scheduled) + Number(o.success_unscheduled)).toBe(Number(o.contact_success));
    // aging ของยังไม่โทร: 0-3 + 4-7 + >7 = total - called
    expect(Number(o.uncalled_age_0_3) + Number(o.uncalled_age_4_7) + Number(o.uncalled_age_over7)).toBe(
      Number(o.total) - Number(o.called),
    );
  });

  it('เลขบนกล่อง = จำนวนแถวจาก bucketCondition เดียวกัน (parity ทุกถัง)', async () => {
    const { dbQuery } = await import('../../api/_lib/postgres.js');
    const { tableInAppSchema } = await import('../../api/_lib/schema.js');
    const APPS = tableInAppSchema('public_job_applications');
    const { rows } = await dbQuery<Record<string, number>>(buildOverviewSql(), [null, null]);
    const o = rows[0];
    const expected: Partial<Record<OverviewBucket, number>> = {
      bad_phone: Number(o.invalid_phone),
      called: Number(o.called),
      in_queue: Number(o.in_queue_awaiting),
      held: Number(o.held_or_claimed),
      untouched: Number(o.untouched),
      contact_success: Number(o.contact_success),
      contact_failed: Number(o.contact_failed),
      scheduled: Number(o.scheduled),
      success_unscheduled: Number(o.success_unscheduled),
      over5d: Number(o.over5d_uncalled),
    };
    for (const [bucket, want] of Object.entries(expected)) {
      const { rows: cnt } = await dbQuery<{ n: number }>(
        `select count(*)::int as n from ${APPS} a where ${bucketCondition(bucket as OverviewBucket)}`,
      );
      expect(`${bucket}=${cnt[0].n}`).toBe(`${bucket}=${want}`);
    }
  });

  it('claimed_idle breakdown รวมเท่ากับถัง claimed_idle', async () => {
    const { dbQuery } = await import('../../api/_lib/postgres.js');
    const { tableInAppSchema } = await import('../../api/_lib/schema.js');
    const APPS = tableInAppSchema('public_job_applications');
    const { rows: byUser } = await dbQuery<{ n: number }>(buildClaimedIdleSql(), [null, null]);
    const { rows: direct } = await dbQuery<{ n: number }>(
      `select count(*)::int as n from ${APPS} a where ${bucketCondition('claimed_idle')}`,
    );
    expect(byUser.reduce((s, r) => s + Number(r.n), 0)).toBe(Number(direct[0].n));
  });
});
