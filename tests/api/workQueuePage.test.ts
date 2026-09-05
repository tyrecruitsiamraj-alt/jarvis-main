// @vitest-environment node
/**
 * ═══ ด่านของหน้า "คิวงานของฉัน" (หน้าเดียวจบงาน) ═══
 *
 * หน้านี้เป็นการ **ออกแบบใหม่จริง** รอบแรก (5 ก.ย. 2569) หลังเจ้าของตีกลับว่า
 * *"ไม่ได้มีอะไรใหม่เลย ก็ที่ฉันเคยทำไว้ทั้งนั้น"* ⇒ ต้องคุมสามเรื่องให้แน่น:
 * ปลอดภัยกับ production · ตัวเลขตรงกับหน้าแรก · ไม่เพิ่มภาระให้ ERP
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const page = read('src/pages/work/WorkQueuePage.tsx');
const home = read('src/pages/HomePage.tsx');

describe('ปลอดภัยกับ production', () => {
  it('🔴 ไม่ได้เปิดสวิตช์ = เด้งกลับหน้าแรก (พนักงานทั่วไปไม่มีทางหลงเข้ามา)', () => {
    expect(page).toContain('useUiV2');
    expect(page).toMatch(/if \(!uiV2\) return <Navigate to="\/" replace \/>;/);
  });

  it('เมนูโชว์รายการนี้เฉพาะคนที่เปิดสวิตช์', () => {
    const drawer = read('src/components/layout/AppNavDrawer.tsx');
    expect(drawer).toMatch(/uiV2 \? \([\s\S]{0,400}\/work/);
  });

  it('ของเดิมไม่ถูกแตะ — หน้าแรกยังมีทั้งสองโฉมครบ', () => {
    expect(home).toContain('<CommandDeck');
    expect(home).toContain('<HomeDeckV2');
  });
});

describe('ตัวเลขต้องตรงกับหน้าแรก (ห้ามคิดเอง)', () => {
  /** ดึงพารามิเตอร์ที่ป้อนให้ buildNextTasks ออกมาเทียบกันสองไฟล์ */
  const inputsOf = (src: string): string[] => {
    const m = src.match(/buildNextTasks\(\{([\s\S]*?)\}\)/);
    if (!m) return [];
    return m[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'))
      .map((l) => l.replace(/\s+/g, ''));
  };

  it('🔴 ป้อนค่าชุดเดียวกับหน้าแรกทุกช่อง', () => {
    const a = inputsOf(home);
    const b = inputsOf(page);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it('ใช้ตรรกะกลาง `buildNextTasks` ไม่เขียนเงื่อนไขคิวเอง', () => {
    expect(page).toContain("from '@/lib/nextTask'");
  });
});

describe('ห้ามเพิ่มภาระให้ระบบงานหลัก', () => {
  it('🔴 ใช้เฉพาะสองเส้นที่หน้าแรกโหลดอยู่แล้ว — ไม่มี apiFetch ตรง ๆ', () => {
    expect(page).toContain('fetchFlowSummary');
    expect(page).toContain('fetchOfficeFloor');
    expect(page).not.toContain('apiFetch(');
  });

  it('ปุ่มจองตัวใช้เส้นเดิม (กติกา 1 คนจองได้ใบเดียวติดมาเอง)', () => {
    expect(page).toContain('saveProposal');
    expect(page).toContain('bookingActionFor');
    // ปิดปุ่มเมื่อไหร่ต้องบอกเหตุผลเสมอ
    expect(page).toMatch(/action\.disabled \? action\.reason/);
  });
});

describe('สีพื้น hover ต้องไม่ใช่สีแบรนด์', () => {
  it('🔴 branding เลิกทับ --accent แล้ว (ไม่งั้นแถวที่เลือกเป็นบล็อกสีทั้งก้อน)', () => {
    const b = read('src/lib/brandingStorage.ts');
    expect(b).toMatch(/removeProperty\('--accent'\)/);
    expect(b).not.toMatch(/setProperty\('--accent', c\.primaryHsl\)/);
  });
});
