// @vitest-environment node
/**
 * 🔴 **เงินบนการ์ดกล่องงานต้องบอกหน่วยเสมอ** (เจ้าของทัก 16 ก.ย. 2569)
 *
 * ของจริงบนจอ: `฿12,000` อยู่ข้าง ๆ `฿400` ในรูปแบบเดียวกันเป๊ะ — ตัวหลังคือ
 * ค่าแรง**รายวัน** (วัดเจอ 20 จาก 200 ใบ) ⇒ กวาดตาผ่าน ๆ อ่านเป็น "เงินเดือน 400"
 *
 * ด่านนี้คุมสองอย่าง:
 * 1. การ์ดต้องใช้ `incomeDisplay()` ตัวกลาง ห้ามปั้นสูตรเองอีก (หนึ่งเมตริกหนึ่งนิยาม)
 * 2. คำเตือนที่พูดถึง ERP เป็นภาษาภายใน — ห้ามหลุดไปหน้าสมัครสาธารณะ
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { incomeDisplay } from '../../src/lib/incomeLabel.js';

const src = readFileSync(resolve(process.cwd(), 'src/components/jobs/JobBoardView.tsx'), 'utf-8');

describe('การ์ดกล่องงานต้องใช้ตัวกลางเรื่องหน่วยเงิน', () => {
  it('🔴 ต้องเรียก incomeDisplay ไม่ใช่ปั้นสูตรเอง', () => {
    expect(src).toContain("import { incomeDisplay } from '@/lib/incomeLabel'");
    expect(src).toContain('incomeDisplay({');
  });

  it('🔴 สูตรเดิมที่พิมพ์ตัวเลขเปล่า ๆ ต้องไม่กลับมา', () => {
    expect(src).not.toContain('`฿${job.total_income.toLocaleString(');
    expect(src).not.toContain('`฿${job.monthly_income.toLocaleString(');
  });

  it('🔴 คำเตือนภาษาภายในต้องกั้นด้วย isStaff', () => {
    const at = src.indexOf('incomeDisplay({');
    const block = src.slice(at - 900, at + 900);
    expect(block).toContain('isStaff && money.hint');
  });
});

describe('ตัวกลางบอกหน่วยถูกต้อง — ไม่รู้ต้องไม่เดา', () => {
  it('อัตราดิบที่ไม่รู้หน่วย = ไม่ติดป้าย /เดือน แต่ต้องมีคำเตือน', () => {
    const d = incomeDisplay({ totalIncome: 400 });
    expect(d?.period).toBe('unknown');
    expect(d?.text).toBe('400 บาท');
    expect(d?.text).not.toContain('เดือน');
    expect(d?.hint).toBeTruthy();
  });

  it('ค่าที่แปลงเป็นต่อเดือนแล้ว = ติดป้าย /เดือน ได้', () => {
    const d = incomeDisplay({ totalIncome: 400, monthlyIncome: 12000 });
    expect(d?.period).toBe('monthly');
    expect(d?.text).toContain('บาท/เดือน');
  });

  it('ไม่มีข้อมูลเลย = null (จอไม่ต้องพิมพ์บรรทัดนี้)', () => {
    expect(incomeDisplay({ totalIncome: 0, monthlyIncome: 0 })).toBeNull();
  });
});
