// @vitest-environment node
/**
 * หลายรอบของคนเดียวกัน = **แผนเดียวหลาย step** (เจ้าของสั่ง 11 ก.ย. 2569)
 *
 * > *"1 สายโทรกี่รอบก็ต้องโทรทุกรอบ เว้นแต่สายไหนรายงานผลว่าไม่ไป/ยกเลิก"*
 * > *"ส่งผลกลับมาทุกสาย"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. หลายรอบ ⇒ **แผนเดียว** (ไม่ใช่แผนละรอบไปที่เบอร์เดียวกัน แล้วทับกัน)
 * 2. step เรียงตามเวลา และมีครบทุกรอบ
 * 3. รอบแรกใช้บท `remind` · รอบถัดไปใช้บท `follow_up` (คนละบท)
 */
import { describe, expect, it } from 'vitest';
import { buildFollowPlanPayload } from '../../api/_lib/lumosDispatch.js';
import { parseFollowRounds } from '../../api/_handlers/follow.js';

const at = (hhmm: string) => new Date(`2026-09-12T${hhmm}:00+07:00`);
const entry = (id: string, hhmm: string, callRound: number) => ({
  id,
  recipient_name: 'สมชาย ใจดี',
  recipient_phone: '+66812345678',
  topic: 'ติดตามเริ่มงาน',
  note: null,
  staffPhone: '+66898888888',
  scheduled_at: at(hhmm),
  callRound,
});

describe('buildFollowPlanPayload', () => {
  it('🔴 3 รอบ ⇒ แผนเดียว 3 step เรียงตามเวลา', () => {
    const plan = buildFollowPlanPayload(
      [entry('c', '11:00', 3), entry('a', '09:00', 1), entry('b', '10:00', 2)],
      '+66899999999',
    );
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((s) => s.scheduled_at.slice(11, 16))).toEqual(['09:00', '10:00', '11:00']);
  });

  it('🔴 ทั้งแผนใช้ client_contact_id ของ **แถวหัวขบวน** (เวลาที่เร็วที่สุด)', () => {
    const plan = buildFollowPlanPayload([entry('late', '11:00', 2), entry('first', '09:00', 1)]);
    expect(plan.client_contact_id).toBe('follow-first');
  });

  it('รอบแรกเป็นบท remind · รอบถัดไปเป็น follow_up (บทคนละแบบ)', () => {
    const plan = buildFollowPlanPayload([entry('a', '09:00', 1), entry('b', '10:00', 2)]);
    expect(plan.steps[0].type).toBe('remind');
    expect(plan.steps[1].type).toBe('follow_up');
    expect(plan.steps[0].message).not.toBe(plan.steps[1].message);
  });

  it('ข้อมูลผู้รับสายมาจากแถวหัวขบวน และมี admin_phone ติดไปด้วย', () => {
    const plan = buildFollowPlanPayload([entry('a', '09:00', 1), entry('b', '10:00', 2)], '+66811111111');
    expect(plan.recipient_phone).toBe('+66812345678');
    expect(plan.recipient_name).toBe('สมชาย ใจดี');
    expect((plan as { admin_phone?: string }).admin_phone).toBe('+66811111111');
  });

  it('รอบเดียวก็ยังได้แผนที่มี 1 step (ไม่พังกรณีปกติ)', () => {
    expect(buildFollowPlanPayload([entry('a', '09:00', 1)]).steps).toHaveLength(1);
  });
});

describe('parseFollowRounds', () => {
  const primary = { when: at('09:00'), staffPhone: '+66898888888', callRound: 1 };

  it('ไม่ส่ง rounds ⇒ รอบเดียวตามของเดิม (เส้นเก่ายังใช้ได้)', () => {
    expect(parseFollowRounds({}, primary)).toEqual([primary]);
    expect(parseFollowRounds({ rounds: [] }, primary)).toEqual([primary]);
    expect(parseFollowRounds(null, primary)).toEqual([primary]);
  });

  it('🔴 เรียงตามเวลาและตัดเวลาซ้ำ — ซ้ำ = Lumos โทรซ้ำเวลาเดียวกันสองครั้ง', () => {
    const out = parseFollowRounds(
      {
        rounds: [
          { scheduled_at: at('10:00').toISOString(), call_round: 2 },
          { scheduled_at: at('09:00').toISOString(), call_round: 1 },
          { scheduled_at: at('10:00').toISOString(), call_round: 3 },
        ],
      },
      primary,
    );
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.when.toISOString())).toEqual([
      at('09:00').toISOString(),
      at('10:00').toISOString(),
    ]);
  });

  it('รอบที่ไม่ระบุเบอร์เจ้าหน้าที่ ⇒ ใช้เบอร์ของรายการหลัก', () => {
    const out = parseFollowRounds({ rounds: [{ scheduled_at: at('09:00').toISOString() }] }, primary);
    expect(out[0].staffPhone).toBe('+66898888888');
  });

  it('เวลาอ่านไม่ออก/ไม่ใช่ object ⇒ ข้ามทิ้ง ไม่ทำให้ทั้งคำขอล้ม', () => {
    const out = parseFollowRounds(
      { rounds: ['ขยะ', null, { scheduled_at: 'พรุ่งนี้' }, { scheduled_at: at('09:00').toISOString() }] },
      primary,
    );
    expect(out).toHaveLength(1);
  });

  it('ไม่เหลือรอบที่ใช้ได้เลย ⇒ ถอยไปใช้รอบหลัก (ห้ามคืน array ว่างแล้วไม่สร้างอะไร)', () => {
    expect(parseFollowRounds({ rounds: [{ scheduled_at: 'มั่ว' }] }, primary)).toEqual([primary]);
  });
});
