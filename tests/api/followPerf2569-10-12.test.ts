/**
 * QA รอบ 3 ข้อ 16 + รอบ 2 ข้อ 50 (12 ต.ค. 2569) — หน้าติดตามสลับแท็บค้าง 3–4 วิ / ข้อมูลเกินเพดานตัดทิ้งเงียบ
 * ต้นเหตุ: `toLocaleDateString/TimeString(..., options)` ในตัวช่วยที่วิ่งทุกสาย = สร้างตัวจัดรูปใหม่ทุกครั้ง
 * (5,245 แถว: buildFollowPlanningRows 1,235 → 35 ms · groupFollowEntries 262 → 23 ms หลังย้ายไประดับโมดูล)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FollowEntry } from '../../src/lib/followApi';
import { groupFollowEntries } from '../../src/lib/followGrouping';
import { buildFollowPlanningRows } from '../../src/lib/followPlanning';

const HOT = ['src/lib/followPlanning.ts', 'src/lib/followGrouping.ts', 'src/lib/followListFilter.ts', 'src/lib/aftercarePlanning.ts'];

describe('ตัวจัดรูปวันเวลาระดับโมดูล', () => {
  it('🔴 ไฟล์ที่วิ่งทุกสายไม่เรียก toLocale*(..., { timeZone }) ต่อแถวแล้ว', () => {
    for (const f of HOT) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/\.toLocale(Date|Time)?String\('[a-z-]+', \{[^}]*timeZone/i);
    }
  });

  it('3,000 สาย: จัดกลุ่ม + สร้างแถว ไม่ถึง 1 วิ (เดิม ~1.4 วิต่อรอบ)', () => {
    const entries = Array.from({ length: 3000 }, (_, i) => ({
      id: `e${i}`,
      recipient_name: `คน ${i % 900}`,
      recipient_phone: `08${String(10000000 + (i % 900)).padStart(8, '0')}`,
      topic: 'ติดตามเริ่มงาน',
      note: null,
      scheduled_at: new Date(Date.UTC(2026, 9, 1 + (i % 28), 1 + (i % 8))).toISOString(),
      created_by_name: null,
      created_at: '2026-10-01T00:00:00Z',
      cancelled: false,
      call_status: null,
      call_outcome: null,
      call_summary: null,
      next_action: null,
      called_at: null,
    })) as unknown as FollowEntry[];
    const t0 = performance.now();
    buildFollowPlanningRows(groupFollowEntries(entries));
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe('เพดานรายการ (QA รอบ 2 ข้อ 50)', () => {
  it('โหลดไม่ครบ = จดไว้ให้หน้าติดตามขึ้นคำเตือน (ไม่ตัดเงียบ)', () => {
    const api = readFileSync('src/lib/followApi.ts', 'utf8');
    expect(api).toContain('if (total > all.length) lastFollowListShortfall = { loaded: all.length, total };');
    const page = readFileSync('src/pages/follow/FollowPage.tsx', 'utf8');
    expect(page).toContain('setListShortfall(followListShortfall());');
    expect(page).toMatch(/ตัวเลขบนหน้านี้ยังไม่ครบ/);
  });
});
