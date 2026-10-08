/**
 * ไล่ Journey หน้าติดตาม 8 ต.ค. 2569 — ข้อที่เจ้าของเคาะ
 * 6. ตารางทุกแท็บอยู่ "วันที่โทร" ("วันที่โทร ไม่งั้นงงตาย")
 * 7. ส่งคนแทน · สายคนโทรที่เลยเวลา = เลยเวลานัด ("ขึ้นว่าเลยเวลาบอกไว้ละกัน") · แท็บคนเริ่มงานคงเดิม
 */
import { describe, expect, it } from 'vitest';
import { followEntryYmd, followRoundState } from '@/lib/followPlanning';
import type { FollowEntry } from '@/lib/followApi';

const NOW = new Date('2026-10-08T05:00:00Z'); // 12:00 น.
const e = (over: Partial<FollowEntry>): FollowEntry =>
  ({ id: 'x', recipient_name: 'ก', recipient_phone: '+66800000000', topic: 'ติดตามเริ่มงาน', scheduled_at: '2026-10-08T01:00:00Z', cancelled: false, completed_at: null, call_status: null, call_mode: 'manual', ...over }) as unknown as FollowEntry;

describe('วันที่ของสาย = วันที่โทร', () => {
  it('สายคอนเฟิร์ม 16:00 วันก่อนเข้างาน อยู่วันที่โทร ไม่ใช่วันเข้างาน', () => {
    const confirm = e({ follow_team: 'replacement', source_ref: 'irecruit-replace:J1:confirm:p', scheduled_at: '2026-10-07T09:00:00.000Z', note: 'ยืนยันเวลาเข้างาน 8/10 06:00 น.' });
    expect(followEntryYmd(confirm)).toBe('2026-10-07');
  });
});

describe('ส่งคนแทน · สายคนโทรเลยเวลา', () => {
  it('ส่งคนแทน คนโทร เลยเวลา = overdue · ยังไม่ถึง = sent', () => {
    expect(followRoundState(e({ follow_team: 'replacement' }), NOW)).toBe('overdue');
    expect(followRoundState(e({ follow_team: 'replacement', scheduled_at: '2026-10-08T09:00:00Z' }), NOW)).toBe('sent');
  });
  it('แท็บคนเริ่มงานคงเดิม (ไม่ได้ส่ง) · สาย AI ที่ส่งไม่ได้ยังเป็นไม่ได้ส่ง', () => {
    expect(followRoundState(e({}), NOW)).toBe('notSent');
    expect(followRoundState(e({ follow_team: 'replacement', call_mode: 'ai' }), NOW)).toBe('notSent');
  });
});
