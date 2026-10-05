/**
 * ปุ่มบนแถวแท็บการติดต่อ = แบบ iRecruit (เจ้าของสั่ง 4 ต.ค. 2569)
 * iRecruit: โทร (call · จดการโทรแล้วเปิด tel:) · ดำเนินการ (rule · ป๊อป) · ลบ Lead (person_remove · ส่งกลับ ไม่ถามยืนยัน)
 * ปุ่มกลมไม่มีกรอบ สีเทา — ของเราใช้ Button ghost ของ shadcn
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RM_ROW_ACTIONS, rmRowActionLabel, telHref } from '../../src/lib/recruitRm';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('แท็บการติดต่อ — ปุ่มแบบ iRecruit', () => {
  it('3 ปุ่ม ลำดับเดียวกับ iRecruit: โทร · ดำเนินการ · ถอย Lead (เดิม "ลบ Lead" · เจ้าของเรียกถอย Lead 5 ต.ค. 2569)', () => {
    expect(RM_ROW_ACTIONS.contact.map((a) => rmRowActionLabel('contact', a))).toEqual(['โทร', 'ดำเนินการ', 'ถอย Lead']);
  });

  it('แท็บอื่นคำเดิม (ผู้สมัคร "ดูรายละเอียด" ไม่เปลี่ยน)', () => {
    expect(rmRowActionLabel('candidates', 'view')).toBe('ดูรายละเอียด');
    expect(rmRowActionLabel('appointments', 'rule')).toBe('บันทึกผลนัดหมาย');
  });

  it('โทร: จดเวลาก่อน แล้วเปิดหน้าโทรด้วยการคลิกลิงก์ tel: (ไม่เปลี่ยน URL หน้า)', () => {
    const ws = read('../../src/components/recruit-rm/RmWorkspace.tsx');
    const block = ws.slice(ws.indexOf("if (action === 'dial')"), ws.indexOf("if (action === 'view' && tab === 'candidates')"));
    expect(block.indexOf('markApplicationDialed(row.id)')).toBeLessThan(block.indexOf('link.click()'));
    expect(block).not.toMatch(/location\.href\s*=/);
  });

  it('telHref: เก็บแต่ตัวเลข · เบอร์สั้น/ไม่มีเบอร์ = ไม่เปิด', () => {
    expect(telHref('081-234-5678')).toBe('tel:0812345678');
    expect(telHref('+66 81 234 5678')).toBe('tel:+66812345678');
    expect(telHref('')).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref('1234')).toBeNull();
  });

  it('ปุ่มบนแถวเป็น Button ของ shadcn แบบ ghost กลม (ไม่ปั้น <button> เอง)', () => {
    const t = read('../../src/components/recruit-rm/RmTable.tsx');
    const block = t.slice(t.indexOf('{actions.map((a) => {'), t.indexOf('</tbody>'));
    expect(block).toContain('variant="ghost"');
    expect(block).toContain('rounded-full');
    expect(block).not.toContain('<button');
  });
});
