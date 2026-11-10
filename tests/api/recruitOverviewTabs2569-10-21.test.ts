/**
 * ═══ หน้าภาพรวมงานสรรหาแยก 4 แท็บ (เจ้าของ 21 ต.ค. 2569 · Choice "แบ่งตามขั้น") ═══
 * ใบขอ · กรอกเข้ามา · คนโทรต่อ · นัดหมาย — เส้นทางรายชื่อ 5 ขั้นกระจายครบ ไม่ซ้ำ ไม่หาย · เลขขั้นนับต่อจากเส้นทางเต็ม
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { journeyStepsOfTab } from '@/lib/recruitOverviewTabs';
import type { JourneyStep } from '@/lib/recruitJourney';

const step = (key: string): JourneyStep => ({ key, label: key, total: 0, parts: [] });
const journey = ['names', 'ai', 'staff', 'appointment', 'attendance'].map(step);

describe('แท็บภาพรวม', () => {
  it('🔴 เส้นทาง 5 ขั้นกระจายครบทุกขั้น ไม่ซ้ำ · เลขขั้นแรกของแท็บนับจากเส้นทางเต็ม', () => {
    const apps = journeyStepsOfTab(journey, 'apps');
    const staff = journeyStepsOfTab(journey, 'staff');
    const appt = journeyStepsOfTab(journey, 'appt');
    const keys = [...apps.steps, ...staff.steps, ...appt.steps].map((s) => s.key);
    expect(keys).toEqual(journey.map((s) => s.key));
    expect([apps.start, staff.start, appt.start]).toEqual([1, 3, 4]);
  });

  it('4 พ.ย. 2569 "เอา 3 แท็บมันรวมกันเลย" — หน้าเดียว ไม่มีแท็บ/?ov= · การติดต่อ/นัดหมาย พับไว้ · ทุกการ์ดเดิมยังอยู่ (ไม่มีอะไรหาย)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard-trends/RecruitOverview.tsx'), 'utf8');
    expect(src).not.toContain("from '@/components/ui/tabs'");
    expect(src).not.toContain("searchParams.get('ov')");
    expect(src).toContain('<FoldSection title="การติดต่อ" testId="recruit-ov-contact">');
    expect(src).toContain('<FoldSection title="นัดหมาย" testId="recruit-ov-appt">');
    // ส่วนการติดต่อ/นัดหมายตามตัวกรองบนสุด (ชุดรายชื่อ fv)
    expect(src).toContain('<ContactTab apps={fv.cohort}');
    expect(src).toContain("drillCard('appt', 'นัดหมาย', fv)");
    for (const title of [
      // การ์ดใบขอรวมเข้าการ์ดแนวโน้มใบขอ (27 ต.ค. 2569)
      "title: 'แนวโน้มใบขอ'",
      'title="งานค้างตอนนี้"',
      "drillCard('apps', 'รายชื่อที่กรอกมา', fv)",
      'title="โทรหลังกรอก"',
      '<DailyCard',
      'title="รายชื่อที่กรอกในช่วงนี้ แยกช่องทาง"',
      'title="ตำแหน่งที่สมัคร"',
      'title="เหตุผลที่ไม่สำเร็จ"',
      'title="ผลงานรายคน"',
      'title="คนแจ้งเข้าในช่วงนี้ แยกช่องทาง"',
    ]) {
      expect(src).toContain(title);
    }
  });
});
