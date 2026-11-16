/**
 * ภาพรวมงานสรรหาแบบ Scale ลง (เจ้าของ 13 พ.ย. 2569 "เปิดมาปุ้บเป็นภาพใหญ่ พอกดอะไรก็ Scale ลงไป" · "ต้องดูแนวโน้มได้ เพิ่มหรือลด")
 * ตัวตัดสินเพิ่มขึ้น/ลดลง + รายชื่อช่วงก่อน (ข้อมูลไม่ครบช่วงก่อน = เทียบไม่ได้ ห้ามโชว์ 0)
 */
import { describe, expect, it } from 'vitest';
import { LINK_CLICKS_SINCE, MANUAL_POSTED_SINCE, SCALE_MORE, SCALE_STRIP, SCALE_TITLES, comparableSince, isScaleSection, prevCohortOf, trendOf, trendTone } from '@/lib/recruitScale';
import type { RecruitAppFact, RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';

describe('เพิ่มขึ้น / ลดลง', () => {
  it('ส่วนต่างเป็นจำนวนจริง + % จากช่วงก่อน · ช่วงก่อน 0 = ใหม่ · เท่ากัน = ทรงตัว · ไม่มีเลข = เทียบไม่ได้', () => {
    expect(trendOf(808, 221)).toEqual({ kind: 'up', diff: 587, pct: 265.6, prev: 221 });
    expect(trendOf(0, 4)).toEqual({ kind: 'down', diff: 4, pct: 100, prev: 4 });
    expect(trendOf(1677, 0)).toEqual({ kind: 'new' });
    expect(trendOf(2, 2)).toEqual({ kind: 'same' });
    expect(trendOf(321, null)).toEqual({ kind: 'none' });
    expect(trendOf(null, 5)).toEqual({ kind: 'none' });
  });
  it('สีตามความหมาย ไม่ใช่ตามทิศ: ติดต่อไม่ได้เพิ่ม = แย่ · นัดได้ลด = แย่ · ที่สั่ง = ไม่ตัดสิน', () => {
    expect(trendTone(trendOf(34, 13), 'good')).toBe('good');
    expect(trendTone(trendOf(0, 4), 'good')).toBe('bad');
    expect(trendTone(trendOf(666, 61), 'bad')).toBe('bad');
    expect(trendTone(trendOf(1, 3), 'bad')).toBe('good');
    expect(trendTone(trendOf(5, 0), 'bad')).toBe('bad');
    expect(trendTone(trendOf(1677, 0), 'plain')).toBeNull();
    expect(trendTone(trendOf(2, 2), 'good')).toBeNull();
  });
});

describe('แถบบน + ข้อที่เลือก', () => {
  it('หัวข้อเป็นคำเจ้าของ 6 ช่อง + 3 ปุ่ม · ค่าใน URL แปลก ๆ ไม่นับเป็นข้อ', () => {
    expect(SCALE_STRIP.map((k) => SCALE_TITLES[k])).toEqual(['1. ใครต้องทำอะไร', '2. ทำแล้วเป็นไง', '3. ที่มามาจากใคร', '4. ช่องทางไหนทำได้ดี', '5. โพสต์ลงกลุ่ม Facebook', '6. โพสต์เอง']);
    expect(SCALE_MORE.map((k) => SCALE_TITLES[k])).toEqual(['พื้นที่ที่เหลือหา', 'เทียบเดือน', 'เหตุผลที่ไม่สำเร็จ']);
    expect(isScaleSection('why')).toBe(true);
    expect(isScaleSection('toString')).toBe(false);
    expect(isScaleSection(null)).toBe(false);
  });
  it('เลขที่เพิ่งเริ่มนับ: ช่วงก่อนเริ่มก่อนวันเริ่มนับ = เทียบไม่ได้', () => {
    expect(comparableSince('2026-10-01', MANUAL_POSTED_SINCE)).toBe(false);
    expect(comparableSince('2026-11-13', MANUAL_POSTED_SINCE)).toBe(true);
    expect(comparableSince('2026-11-09', LINK_CLICKS_SINCE)).toBe(false);
  });
});

describe('รายชื่อช่วงก่อน', () => {
  const fact = (id: string, createdAt: string) => ({ id, createdAt }) as unknown as RecruitAppFact;
  // 07:00 น. ไทย = 00:00Z · 15:00 น. ไทย = 08:00Z
  const apps = [fact('p1', '2026-10-05T00:00:00.000Z'), fact('p2', '2026-10-13T00:00:00.000Z'), fact('p3', '2026-10-13T08:00:00.000Z'), fact('c1', '2026-11-02T00:00:00.000Z')];
  const win = { month: '2026-11', from: '2026-11-01', to: '2026-11-13', prevFrom: '2026-10-01', prevTo: '2026-10-13', isCurrent: true, range: true } as RecruitOverviewResponse['window'];
  it('ช่วงยังไม่จบ = วันท้ายของช่วงก่อนนับถึงเวลาเดียวกับตอนนี้ (10:00 น.)', () => {
    expect(prevCohortOf(apps, win, '2026-08-20', '2026-11-13T03:00:00.000Z')?.map((f) => f.id)).toEqual(['p1', 'p2']);
    expect(prevCohortOf(apps, { ...win, isCurrent: false }, '2026-08-20', '2026-11-13T03:00:00.000Z')?.map((f) => f.id)).toEqual(['p1', 'p2', 'p3']);
  });
  it('ข้อมูลเริ่มกลางช่วงก่อน / เลือกทั้งหมด = เทียบไม่ได้ (null) ไม่ใช่ 0', () => {
    expect(prevCohortOf(apps, win, '2026-10-05', '2026-11-13T03:00:00.000Z')).toBeNull();
    expect(prevCohortOf(apps, win, null, '2026-11-13T03:00:00.000Z')).toBeNull();
    expect(prevCohortOf(apps, { ...win, all: true }, '2026-08-20', '2026-11-13T03:00:00.000Z')).toBeNull();
  });
});

describe('สัดส่วนโพสต์เอง (เจ้าของ 16 พ.ย. 2569 "แยกเป็น Gen link กับ โพสต์ จะได้รู้สัดส่วน")', () => {
  it('ทั้งหมด = โพสต์แล้ว + Gen link · % รวม 100 · ทั้งหมด 0 = ไม่มี %', async () => {
    const { manualPostSplit } = await import('../../src/lib/recruitScale');
    expect(manualPostSplit(1433, 342)).toEqual({ total: 1433, posted: 342, genlink: 1091, postedPct: 24, genlinkPct: 76 });
    expect(manualPostSplit(3, 1)).toEqual({ total: 3, posted: 1, genlink: 2, postedPct: 33, genlinkPct: 67 });
    expect(manualPostSplit(0, 0)).toEqual({ total: 0, posted: 0, genlink: 0, postedPct: null, genlinkPct: null });
  });
});
