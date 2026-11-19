/**
 * รายชื่อเข้ามาไปถึงไหน รวมส่วนผู้สมัครและผลการติดต่อ (เจ้าของ 19 พ.ย. 2569 Choice "ถอดการ์ด 7 ใบ ใช้หัวกล่องแทน")
 * กดหัวกล่อง = แผงข้างของคนในกล่องนั้น ("2942 กดแล้วไม่ขึ้นไรเลย") · เทียบช่วงก่อนใต้เลข · กล่องแจ้งเข้า ERP
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import IntakeFlowPanel from './IntakeFlowPanel';

afterEach(cleanup);

let n = 0;
const fact = (p: Partial<RecruitAppFact>): RecruitAppFact =>
  ({ id: `7a2d${String((n += 1)).padStart(4, '0')}-6b2e-4c1a-9d3e-2a7b5c8e1f00`, createdAt: '2026-11-17T03:00:00Z', jobId: 'siamraj-sql:OPL6911059', channelLabel: 'Tiktok · Tiktok Live', calledByAi: false, calledByStaff: false, aiAnswer: null, appointmentAt: null, ...p }) as RecruitAppFact;

const cohort = [fact({}), fact({ calledByAi: true, aiAnswer: 'no_pickup' }), fact({ calledByAi: true, aiAnswer: 'said_yes' })];
const prev = [fact({}), fact({ calledByAi: true, aiAnswer: 'no_pickup' })];

describe('รายชื่อเข้ามาไปถึงไหน · กดหัวกล่อง', () => {
  it('กดหัวกล่อง = เปิดแผงของคนในกล่อง · เทียบช่วงก่อน · กล่อง ERP · โทรไปแล้วแยก AI / ทีมโทรเอง', () => {
    const open = vi.fn();
    render(<IntakeFlowPanel cohort={[...cohort, fact({ calledByStaff: true })]} onNames={() => {}} resetKey="k" prevCohort={prev} erpIds={[cohort[2].id as string]} prevErpIds={[]} onOpenBox={open} />);
    fireEvent.click(screen.getByTestId('v2-intake-head-apps'));
    expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'apps', title: 'คนสมัครเข้ามา' }));
    expect(open.mock.calls[0][0].ids).toHaveLength(4);
    fireEvent.click(screen.getByTestId('v2-intake-head-ai'));
    expect(open.mock.calls[1][0].ids).toHaveLength(2);
    // ช่วงก่อน AI โทร 1 → ตอนนี้ 2
    expect(screen.getByTestId('v2-intake-head-ai').textContent).toContain('เพิ่มขึ้น 1');
    expect(screen.getByTestId('v2-intake-head-erp').textContent).toContain('พบรายการแจ้งเข้า ERP');
    fireEvent.click(screen.getByTestId('v2-intake-head-erp'));
    expect(open.mock.calls[2][0].ids).toHaveLength(1);
    // กล่องคนสมัครเข้ามา: AI โทร 2 + ทีมโทรเอง 1 (ไม่มีแถว "โทรไปแล้ว" รวมก้อนแล้ว)
    const apps = screen.getByTestId('v2-intake-box-apps').textContent ?? '';
    expect(apps).toContain('AI โทร');
    expect(apps).toContain('ทีมโทรเอง');
    expect(apps).not.toContain('โทรไปแล้ว');
  });

  it('อ่าน ERP ไม่ได้ = กล่องบอกตรง ๆ ไม่ขึ้น 0 และกดเลือกไม่ได้', () => {
    render(<IntakeFlowPanel cohort={cohort} onNames={() => {}} resetKey="k" erpIds={null} />);
    expect(screen.getByText('อ่าน ERP ไม่ได้ในช่วงนี้ ไม่ทราบผล')).toBeTruthy();
    expect((screen.getByTestId('v2-intake-head-erp') as HTMLButtonElement).disabled).toBe(true);
  });
});
