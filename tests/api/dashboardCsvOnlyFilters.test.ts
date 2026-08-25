// @vitest-environment node
/**
 * ตัวกรองบน Dashboard ที่มีผล **เฉพาะไฟล์ CSV** (เจ้าของเคาะ 23 ส.ค. 2569: เขียนกำกับให้ชัด)
 *
 * 🔴 ข้อเท็จจริงที่วัดจากจอจริง: dropdown "กรองตารางงานติดตาม" กับช่องค้นหาบนหัว Dashboard
 * ทั้งสองอันกรอง `data.workQueue` ซึ่งมีผู้ใช้เดียวคือปุ่ม Export CSV —
 * ตารางที่ควรแสดง (`DashboardWorkQueueTable`) เป็น dead code ไม่มีใครเรนเดอร์
 * วัดจริง: เปลี่ยนตัวกรอง/พิมพ์คำค้น → ข้อความบนจอไม่เปลี่ยนแม้ตัวอักษรเดียว
 *
 * เทสต์นี้กันคำบนจอ **ไหลกลับ** ไปอ้างถึงตารางที่ไม่มี (ป้ายที่ชี้ของที่ไม่มี = ความงง)
 * ⚠️ ถ้าวันหนึ่งเอาตารางกลับมาเรนเดอร์จริง ให้แก้เทสต์นี้พร้อมกับถอดคำกำกับ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const FILTER_BAR = read('src/components/dashboard/analytics/DashboardFilterBar.tsx');
const SHELL = read('src/components/dashboard/analytics/DashboardShell.tsx');

/** เอาแต่ข้อความที่ผู้ใช้เห็น (ตัดคอมเมนต์ที่อธิบายกับดักออก ไม่งั้นเทสต์จับคอมเมนต์ตัวเอง) */
const visible = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^\s*\/\/.*$/gm, '');

describe('คำบนจอต้องบอกว่ามีผลกับ CSV', () => {
  it('ป้ายตัวกรองเลิกอ้าง "ตาราง" ที่ไม่มีบนจอ', () => {
    const v = visible(FILTER_BAR);
    expect(v).not.toContain('กรองตารางงานติดตาม');
    expect(v).not.toContain('ทุกสถานะ (ตาราง)');
    expect(v).toContain('กรองข้อมูลในไฟล์ CSV');
  });

  it('มีคำอธิบายกำกับว่าไม่เปลี่ยนตัวเลขบนหน้า + ชี้ไปปุ่ม Export CSV', () => {
    const v = visible(FILTER_BAR);
    expect(v).toContain('Export CSV');
    expect(v).toMatch(/ไม่เปลี่ยนตัวเลข/);
  });

  it('ช่องค้นหาบนหัว Dashboard บอกตรง ๆ ว่ากรองไฟล์ CSV', () => {
    const v = visible(SHELL);
    expect(v).not.toContain('placeholder="ค้นหาใบงาน, คน, ปลายทาง..."');
    expect(v).toMatch(/placeholder="ค้นหาเพื่อกรองไฟล์ CSV[^"]*"/);
    // มี title กำกับให้คนที่ hover อ่านได้ด้วย
    expect(v).toMatch(/title="[^"]*Export CSV[^"]*"/);
  });
});

describe('ข้อเท็จจริงที่คำกำกับอ้างอิงต้องยังจริง', () => {
  it('ตาราง DashboardWorkQueueTable ยังไม่มีใครเรนเดอร์ (ถ้าเรนเดอร์แล้วต้องถอดคำกำกับ)', () => {
    for (const f of [
      'src/components/dashboard/analytics/DashboardShell.tsx',
      'src/pages/dashboard/SupervisorDashboard.tsx',
    ]) {
      expect(read(f)).not.toContain('<DashboardWorkQueueTable');
    }
  });

  it('workQueue ยังมีผู้ใช้เดียวคือ export CSV', () => {
    const page = read('src/pages/dashboard/SupervisorDashboard.tsx');
    expect(page).toContain('exportWorkQueueCsv(data.workQueue');
  });
});
