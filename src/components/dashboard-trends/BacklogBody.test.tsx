import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { BacklogBody } from './RecruitOverviewParts';
import type { RecruitBacklog } from '@/lib/recruitOverviewTypes';

afterEach(cleanup);
const rc = (bkk: number, upcountry: number, unknown: number) => ({ bkk, upcountry, unknown });

// เจ้าของ 28 ต.ค. 2569 "ตอบ AI ไม่ถึง 1 วัน 36 เป็นกรุงเทพและปริมณฑล · ต่างจังหวัด · ไม่ระบุจังหวัด เท่าไหร่ไง"
const backlog: RecruitBacklog = {
  uncalled: { total: 6, d0_3: 3, d4_7: 2, over7: 1, inQueue: 0, badPhone: 0 },
  waitingStaff: { total: 36, d0: 36, d1_3: 0, over3: 0 },
  appointments: { overdue: 1, next7: 0 },
  regions: { uncalled: rc(2, 2, 2), waitingStaff: rc(20, 10, 6), appointments: rc(1, 0, 0) },
  regionRows: {
    uncalled: { d0_3: rc(1, 1, 1), d4_7: rc(1, 1, 0), over7: rc(0, 0, 1) },
    waitingStaff: { d0: rc(20, 10, 6), d1_3: rc(0, 0, 0), over3: rc(0, 0, 0) },
    appointments: { overdue: rc(1, 0, 0), next7: rc(0, 0, 0) },
  },
};

describe('งานค้างตอนนี้ = ตารางไขว้ ช่วงอายุ × พื้นที่', () => {
  it('แถว "ตอบ AI ไม่ถึง 1 วัน" แยก กรุงเทพและปริมณฑล · ต่างจังหวัด · ไม่ระบุจังหวัด', () => {
    render(<BacklogBody backlog={backlog} />);
    const table = screen.getByTestId('backlog-waiting-table');
    const head = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(head).toEqual(['', 'รวม', 'กรุงเทพและปริมณฑล', 'ต่างจังหวัด', 'ไม่ระบุจังหวัด']);
    const row = within(table).getByText('ตอบ AI ไม่ถึง 1 วัน').closest('tr')!;
    expect([...row.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['ตอบ AI ไม่ถึง 1 วัน', '36', '20', '10', '6']);
  });
  it('มีแถวรวมทุกกล่อง', () => {
    render(<BacklogBody backlog={backlog} />);
    const total = screen.getByTestId('backlog-uncalled-regions');
    expect([...total.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['รวม', '6', '2', '2', '2']);
  });
});
