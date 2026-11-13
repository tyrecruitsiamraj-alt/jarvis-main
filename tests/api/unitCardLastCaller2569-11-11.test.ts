/**
 * การ์ดผู้สมัครในหน้าใบขอ (เจ้าของ 11 พ.ย. 2569): ทุกใบหน้าตาเดียวกัน · สถานะ + "ล่าสุด AI/คนโทร" ท้ายแถว · ไม่มีแผงขั้นตอนในการ์ด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unitMatchLastCaller, unitMatchStatusCounts } from '../../src/lib/unitMatchingView';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

const app = (p: Partial<PublicApplication>) => ({ id: '5c657959-d0b0-48a9-90c8-861ddfef345e', ...p }) as PublicApplication;

describe('ใครโทรล่าสุด', () => {
  it('ยังไม่มีร่องรอย = null', () => {
    expect(unitMatchLastCaller(app({}))).toBeNull();
  });
  it('ผลโทรล่าสุดจาก AI และไม่มีอะไรใหม่กว่า = AI', () => {
    expect(unitMatchLastCaller(app({ last_call_at: '2026-11-10T03:00:00Z', last_call_by: 'ai' }))).toBe('ai');
  });
  it('AI โทรแล้วเจ้าหน้าที่บันทึกผลติดต่อทีหลัง = คน', () => {
    expect(
      unitMatchLastCaller(app({ last_call_at: '2026-11-10T03:00:00Z', last_call_by: 'ai', last_contact_at: '2026-11-10T05:00:00Z' })),
    ).toBe('staff');
  });
  it('เจ้าหน้าที่กดโทรแล้วยังไม่ลงผล แต่ AI โทรทีหลัง = AI', () => {
    expect(
      unitMatchLastCaller(app({ dialed_last_at: '2026-11-09T03:00:00Z', last_call_at: '2026-11-10T03:00:00Z', last_call_by: 'ai' })),
    ).toBe('ai');
  });
  it('ผลโทรที่คนบันทึกเอง = คน', () => {
    expect(unitMatchLastCaller(app({ last_call_at: '2026-11-10T03:00:00Z', last_call_by: 'staff' }))).toBe('staff');
  });
});

describe('การ์ดไม่มีแผงขั้นตอนแล้ว', () => {
  it('หมวดตามที่มาไม่วางแผงขั้นตอนในการ์ด · server ส่ง last_call_by', () => {
    const page = readFileSync('src/pages/jobs/UnitRequestTabPage.tsx', 'utf8');
    expect(page).not.toContain('isInterestedOutcome(a.last_call_outcome) || a.selection_status');
    expect(page).toContain('UNIT_MATCH_CALLER_LABEL[caller]');
    expect(readFileSync('api/_handlers/job-applications.ts', 'utf8')).toContain('.last_call_by = hit.by;');
  });
});

describe('ชิปนับบนแท็บผู้สมัคร', () => {
  it('นับตามป้ายท้ายการ์ด · รวมกัน = ทั้งหมด · นัดแล้ว/สนใจ/รอโทร อยู่เสมอ · แยกโทรแล้ว·ไม่ตอบ', () => {
    const items = [
      app({ last_call_outcome: 'confirmed', last_call_at: '2026-11-10T03:00:00Z' }),
      app({ last_call_outcome: 'unresponsive', last_call_at: '2026-11-10T03:00:00Z' }),
      app({ last_call_outcome: 'unresponsive', last_call_at: '2026-11-10T04:00:00Z' }),
    ];
    const chips = unitMatchStatusCounts(items);
    expect(chips.reduce((n, c) => n + c.count, 0)).toBe(items.length);
    expect(chips.map((c) => c.text)).toEqual(['นัดแล้ว', 'สนใจ', expect.stringMatching(/^โทรแล้ว · /), 'รอโทร']);
    expect(chips.find((c) => c.text === 'สนใจ')?.count).toBe(1);
    expect(chips.find((c) => c.text.startsWith('โทรแล้ว'))?.count).toBe(2);
    expect(chips.find((c) => c.text === 'รอโทร')?.count).toBe(0);
  });
  it('ไม่มีผู้สมัคร = ชิปพื้นฐานยังอยู่ ค่า 0 · ถอด "ต้องการ N อัตรา" แล้ว', () => {
    expect(unitMatchStatusCounts([]).map((c) => [c.text, c.count])).toEqual([['นัดแล้ว', 0], ['สนใจ', 0], ['รอโทร', 0]]);
    expect(readFileSync('src/pages/jobs/UnitRequestTabPage.tsx', 'utf8')).not.toContain('อัตรา</span>');
  });
});

describe('ถอดแท็บการติดต่อของใบขอ + ไอคอนหัวข้อขั้นตอนของสาย (เจ้าของ 11 พ.ย. 2569)', () => {
  it('ใบขอเหลือ 3 แท็บ · ลิงก์เก่า /contact พาไปแท็บผู้สมัคร', () => {
    // 13 พ.ย. 2569: AI Match ถอด (ย้ายไปหน้างานสรรหา) · เพิ่มแท็บ Autopost / Scrap / โพสต์เอง
    expect(readFileSync('src/components/jobs/UnitRequestTabs.tsx', 'utf8')).toContain("export const UNIT_TAB_IDS = ['detail', 'applicants', 'actions'] as const;");
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('<Route path="/jobs/siamraj/:id/ai-match" element={<Navigate to="/jobs/board?view=match" replace />} />');
    expect(readFileSync('src/App.tsx', 'utf8')).toContain('<Route path="/jobs/siamraj/:id/contact" element={<UnitContactMovedRedirect />} />');
    expect(readFileSync('src/pages/jobs/UnitRequestTabPage.tsx', 'utf8')).not.toContain('<MyCallsSection');
  });
  it('หัวข้อ "ขั้นตอนของสาย" ไม่มีไอคอน', () => {
    expect(readFileSync('src/components/follow/FollowCallRoundsPanel.tsx', 'utf8')).not.toContain('<GitBranch');
  });
});
