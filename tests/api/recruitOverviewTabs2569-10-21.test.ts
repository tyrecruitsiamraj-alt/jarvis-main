/**
 * ═══ หน้าภาพรวมงานสรรหาแยก 4 แท็บ (เจ้าของ 21 ต.ค. 2569 · Choice "แบ่งตามขั้น") ═══
 * ใบขอ · กรอกเข้ามา · คนโทรต่อ · นัดหมาย — เส้นทางรายชื่อ 5 ขั้นกระจายครบ ไม่ซ้ำ ไม่หาย · เลขขั้นนับต่อจากเส้นทางเต็ม
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OVERVIEW_TABS, journeyStepsOfTab, overviewTabOf } from '@/lib/recruitOverviewTabs';
import type { JourneyStep } from '@/lib/recruitJourney';

const step = (key: string): JourneyStep => ({ key, label: key, total: 0, parts: [] });
const journey = ['names', 'ai', 'staff', 'appointment', 'attendance'].map(step);

describe('แท็บภาพรวม', () => {
  it('ชื่อแท็บตามที่เจ้าของสั่ง เรียงตามนี้', () => {
    expect(OVERVIEW_TABS.map((t) => t.label)).toEqual(['ใบขอ', 'กรอกเข้ามา', 'คนโทรต่อ', 'นัดหมาย']);
  });

  it('?ov= ไม่รู้จัก = ใบขอ', () => {
    expect(overviewTabOf(null)).toBe('requests');
    expect(overviewTabOf('xx')).toBe('requests');
    expect(overviewTabOf('appt')).toBe('appt');
  });

  it('🔴 เส้นทาง 5 ขั้นกระจายครบทุกขั้น ไม่ซ้ำ · เลขขั้นแรกของแท็บนับจากเส้นทางเต็ม', () => {
    const apps = journeyStepsOfTab(journey, 'apps');
    const staff = journeyStepsOfTab(journey, 'staff');
    const appt = journeyStepsOfTab(journey, 'appt');
    const keys = [...apps.steps, ...staff.steps, ...appt.steps].map((s) => s.key);
    expect(keys).toEqual(journey.map((s) => s.key));
    expect([apps.start, staff.start, appt.start]).toEqual([1, 3, 4]);
  });

  it('หน้าใช้แท็บ shadcn + ทุกการ์ดเดิมยังอยู่ (ไม่มีอะไรหาย)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard-trends/RecruitOverview.tsx'), 'utf8');
    expect(src).toContain("from '@/components/ui/tabs'");
    for (const t of ['requests', 'apps', 'staff', 'appt']) expect(src).toContain(`<TabsContent value="${t}"`);
    for (const title of [
      'title="ใบขอ"',
      'title="งานค้างตอนนี้"',
      'title="รายชื่อที่กรอกมา"',
      'title="กรอกแล้วโทรวันไหน"',
      '<DailyCard',
      'title="รายชื่อที่กรอกในช่วงนี้ ไปถึงไหนแยกช่องทาง"',
      'title="ตำแหน่งที่สมัคร"',
      'title="เหตุผลที่ไม่สำเร็จ"',
      'title="ผลงานรายคน"',
      'title="คนแจ้งเข้าในช่วงนี้ มาจากช่องทางไหน"',
    ]) {
      expect(src).toContain(title);
    }
  });
});
