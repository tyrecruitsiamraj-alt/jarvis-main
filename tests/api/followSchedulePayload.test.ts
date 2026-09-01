// @vitest-environment node
/**
 * Follow ตั้งตารางโทร (F2 · migration 092) — payload หลายรอบต่อวัน
 * โมเดล 1 วัน = 1 plan: หลายรอบ = หลาย step ในวันเดียว (Lumos stop_early หยุดที่เหลือ
 * เมื่อยืนยัน) · แต่ละ step scheduled_at = วันเดียวกับ scheduled_at + เวลารอบ (เวลาไทย)
 */
import { describe, expect, it } from 'vitest';
import { buildFollowReminderPayload } from '../../api/_lib/lumosDispatch.js';

const baseEntry = {
  id: 'f1',
  recipient_name: 'ทดสอบ ระบบ',
  recipient_phone: '+66812345678',
  topic: 'ติดตามนัดสัมภาษณ์',
  note: null,
  staffPhone: '0891112222',
  scheduled_at: new Date('2026-08-20T00:00:00+07:00'),
};

describe('buildFollowReminderPayload — หลายรอบต่อวัน', () => {
  it('ไม่มี callTimes → 1 step ที่ scheduled_at (แบบเดิม) — เขียนเป็นเวลาไทย +07:00', () => {
    const p = buildFollowReminderPayload(baseEntry);
    expect(p.steps.length).toBe(1);
    // instant เดียวกับ scheduled_at แต่รูปเวลาไทย (18 ส.ค. 2569 — Lumos ไม่ขึ้นรายการ
    // ข้อสงสัยหนึ่งคือเวลารูป UTC ถูกฝั่งเขาปัดทิ้ง)
    expect(p.steps[0].scheduled_at).toBe('2026-08-20T00:00:00+07:00');
    // 🔴 ห้ามมี `::` ในรหัสอ้างอิง — ใช้ follow-<id> ให้ตรงกับ person_ref
    // (ตัวรับผลจับคู่ด้วยค่าใน payload ของแถวนั้นเอง แถวเก่ารูป follow:: ยังจับคู่ได้)
    expect(p.client_contact_id).toBe('follow-f1');
    expect(p.client_contact_id).not.toContain('::');
  });

  it('2 รอบ 07:00/08:00 → 2 step วันเดียวกัน คนละเวลา และพูดคนละบท', () => {
    const p = buildFollowReminderPayload({ ...baseEntry, callTimes: ['07:00', '08:00'] });
    expect(p.steps.length).toBe(2);
    expect(p.steps[0].scheduled_at).toBe('2026-08-20T07:00:00+07:00');
    expect(p.steps[1].scheduled_at).toBe('2026-08-20T08:00:00+07:00');
    /**
     * 🔴 เปลี่ยนเมื่อ 31 ส.ค. 2569 — เดิมทุกรอบพูดบทเดียวกันเป๊ะ
     * เจ้าของสั่ง: *"การติดตามต้องมี 2 บทอะ เพราะโทรรอบแรกกับรอบที่ 2 มันไม่เหมือนกันอะ"*
     * ⇒ รอบแรก = บท "ติดตาม" · รอบถัดไป = บท "ติดตามรอบถัดไป" (ไม่แนะนำตัวใหม่)
     */
    expect(p.steps[0].type).toBe('remind');
    expect(p.steps[1].type).toBe('follow_up');
    expect(p.steps[1].message).not.toBe(p.steps[0].message);
    // ⚠️ บทใหม่ 1 ก.ย. 2569 ไม่พูด "เรื่อง" และไม่อ่านเบอร์ให้ผู้รับสายแล้ว
    // (เจ้าของเขียนบทมาคำต่อคำ) — ที่เหมือนกันทั้งสองรอบคือทักทายจากบริษัทเดียวกัน
    for (const step of p.steps) {
      expect(step.message).toContain('สยามราชธานี');
      expect(step.message).toContain('คุณทดสอบ ระบบ');
    }
  });

  it('รอบเวล่ารูปแบบผิด (ไม่ใช่ HH:MM) ถูกกรองทิ้ง — เหลือแต่รอบที่ถูก', () => {
    const p = buildFollowReminderPayload({ ...baseEntry, callTimes: ['07:00', 'บ่าย', ''] });
    expect(p.steps.length).toBe(1);
    expect(p.steps[0].scheduled_at).toBe('2026-08-20T07:00:00+07:00');
  });

  it('callTimes ว่าง → ถอยเป็น 1 step ที่ scheduled_at', () => {
    const p = buildFollowReminderPayload({ ...baseEntry, callTimes: [] });
    expect(p.steps.length).toBe(1);
  });
});

/**
 * `admin_phone` ของเลน Follow (เจ้าของสั่ง 27 ส.ค. 2569)
 * 🔴 คนละเรื่องกับเบอร์ที่ AI **พูด** ให้โทรกลับ (อันนั้นอยู่ใน steps[].message)
 * อันนี้คือเบอร์ที่ **AI โทรไปหา** เมื่อติดต่อผู้รับไม่ได้
 */
describe('admin_phone ในคิว Follow', () => {
  const base = {
    id: 'f1',
    recipient_name: 'สมชาย ใจดี',
    recipient_phone: '+66812345678',
    topic: 'ยืนยันวันเริ่มงาน',
    scheduled_at: new Date('2026-08-27T09:00:00+07:00'),
  };

  it('ส่งเบอร์ที่ให้มา และแปลงเป็น E.164 ตั้งแต่ตอนประกอบ payload', () => {
    const p = buildFollowReminderPayload(base, '+66898143230');
    expect(p.admin_phone).toBe('+66898143230');
  });

  it('ไม่มีเบอร์ = ไม่มีคีย์นี้เลย ห้ามส่งค่าว่างไปให้ AI โทร', () => {
    expect('admin_phone' in buildFollowReminderPayload(base)).toBe(false);
    expect('admin_phone' in buildFollowReminderPayload(base, null)).toBe(false);
    expect('admin_phone' in buildFollowReminderPayload(base, '')).toBe(false);
  });

  it('ไม่ไปทับเบอร์ที่ AI พูดให้โทรกลับ — สองช่องอยู่คนละที่', () => {
    const p = buildFollowReminderPayload({ ...base, staffPhone: '0812223333' }, '+66898143230');
    expect(p.admin_phone).toBe('+66898143230');
    /**
     * ⚠️ **บทใหม่ 1 ก.ย. 2569 ไม่อ่านเบอร์ให้ผู้รับสายแล้ว** (เจ้าของเขียนบทมาคำต่อคำ)
     * ที่ยังต้องกันคือ **เบอร์เจ้าหน้าที่ห้ามหลุดไปทับ `admin_phone`** — คนละช่อง คนละหน้าที่
     */
    expect(p.steps[0].message).not.toContain('081 222 3333');
  });
});

describe('สายที่เท่าไหร่ (call_round · เจ้าของสั่ง 1 ก.ย. 2569)', () => {
  it('🔴 แถวเดี่ยวที่คนบอกว่าเป็นสายที่ 2 ต้องพูดบทรอบถัดไป ไม่ใช่บทสายแรก', () => {
    const first = buildFollowReminderPayload({ ...baseEntry, callRound: 1 });
    const second = buildFollowReminderPayload({ ...baseEntry, callRound: 2 });
    expect(first.steps[0].type).toBe('remind');
    expect(second.steps[0].type).toBe('follow_up');
    expect(second.steps[0].message).not.toBe(first.steps[0].message);
  });

  it('สายที่ 3 ก็ใช้บทรอบถัดไปชุดเดียวกับสายที่ 2 (บทมีสองชุด)', () => {
    const second = buildFollowReminderPayload({ ...baseEntry, callRound: 2 });
    const third = buildFollowReminderPayload({ ...baseEntry, callRound: 3 });
    expect(third.steps[0].message).toBe(second.steps[0].message);
  });

  it('ไม่ส่ง callRound = สายแรกเหมือนเดิม (ของเก่าไม่พัง)', () => {
    const none = buildFollowReminderPayload(baseEntry);
    const one = buildFollowReminderPayload({ ...baseEntry, callRound: 1 });
    expect(none.steps[0].message).toBe(one.steps[0].message);
    expect(none.steps[0].type).toBe('remind');
  });

  it('โหมดตาราง: เริ่มที่สายที่ 2 แล้ว step ถัดไปนับต่อ — ทุก step เป็นบทรอบถัดไป', () => {
    const p = buildFollowReminderPayload({
      ...baseEntry,
      callTimes: ['07:00', '08:00'],
      callRound: 2,
    });
    expect(p.steps.map((x) => x.type)).toEqual(['follow_up', 'follow_up']);
  });
});
