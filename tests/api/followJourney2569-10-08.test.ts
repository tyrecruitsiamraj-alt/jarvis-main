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

describe('เก็บไปโทรเอง: ใบไม่ผูกใบขอ/ไม่มีเบอร์ ไม่ต้องบอก (เจ้าของ 8 ต.ค. 2569 "เอาออกไม่ต้องบอก")', () => {
  it('ไม่มีคำเตือน "ไม่ผูกใบขอ ล็อกเบอร์ไม่ได้" · ยังนับเป็นเก็บแล้ว', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('api/_handlers/application-call-choice.ts', 'utf8');
    expect(src).not.toContain('ใบไม่ผูกใบขอ ล็อกเบอร์ไม่ได้');
    expect(src).not.toContain('ไม่มีเบอร์ให้ล็อก');
    expect(src).toMatch(/if \(!r\.phone\?\.trim\(\) \|\| !r\.job_id\?\.trim\(\)\) \{\s*okIds\.push\(r\.id\);\s*continue;/);
  });
});

describe('หน้าตั้งค่าบทพูด: กดบทไหนค่อยกาง · ถอดวงกลมอักษรย่อ (8 ต.ค. 2569)', () => {
  it('บทพูดอยู่ที่ตั้งค่าที่เดียว · เปิดมาเห็นแค่ชื่อบท กดแล้วกาง · แก้ค้าง = กางค้าง', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    expect(existsSync('src/components/call-scripts/PageScriptsButton.tsx')).toBe(false);
    const tab = readFileSync('src/pages/settings/CallScriptsTab.tsx', 'utf8');
    expect(tab).toContain('const open = openKeys.has(s.key) || dirty;');
    expect(tab).toContain('aria-expanded={open}');
  });
  it('ไม่มีวงกลมอักษรย่อหน้าชื่อ (หน้าการติดต่อ · ตารางติดตาม)', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/pages/matching/MyCallsPage.tsx', 'utf8')).not.toContain('<NameAvatar');
    expect(readFileSync('src/components/follow/FollowPlanningCalendar.tsx', 'utf8')).not.toContain('initials(row.group.name)');
  });
});
