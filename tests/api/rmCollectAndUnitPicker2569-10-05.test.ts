/**
 * 5 ต.ค. 2569:
 * - แท็บผู้สมัคร: ปุ่ม "รอเก็บใบสมัคร" ถอดออก (เจ้าของสั่ง) — ลิงก์เก่า ?list=collect ถอยไปรายชื่อทั้งหมด
 * - ป๊อปนัดหมาย "ลงหน่วยงาน" = ชื่อหน่วยงาน + ตำแหน่ง (เลขที่ใบขอ) · พิมพ์ค้นได้
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RM_LIST_VIEWS, RM_LIST_VIEWS_SHOWN, isShownRmListView } from '../../src/lib/recruitRm';

describe('ปุ่มมุมมองแท็บผู้สมัคร', () => {
  it('โชว์ 3 ปุ่ม ไม่มีรอเก็บใบสมัคร · นิยาม collect ยังอยู่', () => {
    expect([...RM_LIST_VIEWS_SHOWN]).toEqual(['all', 'interested', 'declined']);
    expect(RM_LIST_VIEWS).toContain('collect');
    expect(isShownRmListView('collect')).toBe(false);
    expect(isShownRmListView('interested')).toBe(true);
  });
  it('RmWorkspace วาดจากชุดที่โชว์ และ ?list=collect ถอยไปทั้งหมด', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/recruit-rm/RmWorkspace.tsx'), 'utf8');
    expect(src).toContain('RM_LIST_VIEWS_SHOWN.map((v)');
    expect(src).toContain("isShownRmListView(listParam) ? listParam : 'all'");
  });
});

describe('ลงหน่วยงาน = ชื่อ + ค้นได้', () => {
  it('ใช้ SearchableSelect · ป้าย = ชื่อจุดทำงาน · ตำแหน่ง (เลขที่ใบขอ) · บันทึกคำเดียวกัน', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/recruit-rm/ApplicantContactDialog.tsx'), 'utf8');
    expect(src).toContain('<SearchableSelect');
    expect(src).toContain('label: appointmentUnitLabel(j)');
    expect(src).toContain("jobLabel: booked ? (selectedJob ? appointmentUnitLabel(selectedJob) : 'หาล่วงหน้า') : null");
    expect(src).not.toContain('unitRequestCardTitle(j)');
  });
});
