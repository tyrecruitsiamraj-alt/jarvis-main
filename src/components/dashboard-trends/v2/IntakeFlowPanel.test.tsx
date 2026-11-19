/**
 * รายชื่อเข้ามาไปถึงไหน รวมส่วนผู้สมัครและผลการติดต่อ (เจ้าของ 19 พ.ย. 2569 Choice "ถอดการ์ด 7 ใบ ใช้หัวกล่องแทน")
 * กดหัวกล่อง = เรื่องเล่าข้างล่างเป็นคนในกล่องนั้น · เทียบช่วงก่อนใต้เลข · กล่องแจ้งเข้า ERP
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
  it('ค่าเริ่ม = คนสมัครเข้ามา · กด AI โทร = เรื่องเล่าเป็นคนที่ AI โทร · เทียบช่วงก่อน · กล่อง ERP', () => {
    const scope = vi.fn((box: { key: string; ids: readonly string[] }) => <p>{`เลือก ${box.key} ${box.ids.length}`}</p>);
    render(<IntakeFlowPanel cohort={cohort} onNames={() => {}} resetKey="k" prevCohort={prev} erpIds={[cohort[2].id as string]} prevErpIds={[]} renderScope={scope} />);
    expect(screen.getByText('เลือก apps 3')).toBeTruthy();
    fireEvent.click(screen.getByTestId('v2-intake-head-ai'));
    expect(screen.getByText('เลือก ai 2')).toBeTruthy();
    expect(screen.getByTestId('v2-intake-head-ai').getAttribute('aria-pressed')).toBe('true');
    // ช่วงก่อน AI โทร 1 → ตอนนี้ 2
    expect(screen.getByTestId('v2-intake-head-ai').textContent).toContain('เพิ่มขึ้น 1');
    expect(screen.getByTestId('v2-intake-head-erp').textContent).toContain('พบรายการแจ้งเข้า ERP');
    fireEvent.click(screen.getByTestId('v2-intake-head-erp'));
    expect(screen.getByText('เลือก erp 1')).toBeTruthy();
  });

  it('อ่าน ERP ไม่ได้ = กล่องบอกตรง ๆ ไม่ขึ้น 0 และกดเลือกไม่ได้', () => {
    render(<IntakeFlowPanel cohort={cohort} onNames={() => {}} resetKey="k" erpIds={null} />);
    expect(screen.getByText('อ่าน ERP ไม่ได้ในช่วงนี้ ไม่ทราบผล')).toBeTruthy();
    expect((screen.getByTestId('v2-intake-head-erp') as HTMLButtonElement).disabled).toBe(true);
  });
});
