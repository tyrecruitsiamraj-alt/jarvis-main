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
  it('ไม่มี callTimes → 1 step ที่ scheduled_at (แบบเดิม)', () => {
    const p = buildFollowReminderPayload(baseEntry);
    expect(p.steps.length).toBe(1);
    expect(p.steps[0].scheduled_at).toBe(baseEntry.scheduled_at.toISOString());
    expect(p.client_contact_id).toBe('follow::f1');
  });

  it('2 รอบ 07:00/08:00 → 2 step วันเดียวกัน คนละเวลา (เวลาไทย)', () => {
    const p = buildFollowReminderPayload({ ...baseEntry, callTimes: ['07:00', '08:00'] });
    expect(p.steps.length).toBe(2);
    // 07:00 เวลาไทย = 00:00Z · 08:00 = 01:00Z ของวันที่ 20
    expect(p.steps[0].scheduled_at).toBe('2026-08-20T00:00:00.000Z');
    expect(p.steps[1].scheduled_at).toBe('2026-08-20T01:00:00.000Z');
    // ทุก step พูดบทเดียวกัน (topic + เบอร์ติดต่อกลับ)
    expect(p.steps[0].message).toContain('ติดตามนัดสัมภาษณ์');
    // เบอร์ถูกอ่านเป็นกลุ่มตัวเลข (16 ส.ค. 2569 — ดู lumosCallScript.speakablePhoneTh)
    expect(p.steps[0].message).toContain('089 111 2222');
    expect(p.steps[1].message).toBe(p.steps[0].message);
  });

  it('รอบเวล่ารูปแบบผิด (ไม่ใช่ HH:MM) ถูกกรองทิ้ง — เหลือแต่รอบที่ถูก', () => {
    const p = buildFollowReminderPayload({ ...baseEntry, callTimes: ['07:00', 'บ่าย', ''] });
    expect(p.steps.length).toBe(1);
    expect(p.steps[0].scheduled_at).toBe('2026-08-20T00:00:00.000Z');
  });

  it('callTimes ว่าง → ถอยเป็น 1 step ที่ scheduled_at', () => {
    const p = buildFollowReminderPayload({ ...baseEntry, callTimes: [] });
    expect(p.steps.length).toBe(1);
  });
});
