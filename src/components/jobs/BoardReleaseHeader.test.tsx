import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import BoardReleaseHeader from './BoardReleaseHeader';
import type { ReleaseLedger } from '@/lib/boardRelease';

afterEach(cleanup);

// เจ้าของ 28 ต.ค. 2569 "ก้อนตรงนี้ทำให้มันเห็นภาพ — ใบขอทั้งหมด → ประกาศแล้ว → มีคนกรอก (กี่คน) / ยังไม่มีคนกรอก · ยังไม่ประกาศ · เริ่มงานแล้ว"
const ledger: ReleaseLedger = {
  all: 314,
  released: 23,
  unreleased: 291,
  percent: 7,
  steps: [],
  releasedWithApplicants: 10,
  releasedSilent: 13,
  applicantHeads: 35,
};

// 11 พ.ย. 2569 เป็นกล่องตัวเลข (Visual Control) — เจ้าของ "อยากได้มันเป็น Visual Control ที่กดเพื่อพาไปลิสต์นั้นๆ"
describe('หัวกล่องงานแบบสองสาย', () => {
  it('ใบขอทั้งหมด → ประกาศแล้ว (มีคนกรอก ใบ·คน / ยังไม่มีคนกรอก) · ยังไม่ประกาศ (25 พ.ย. 2569 ไม่มีก้อนย่อยแล้ว)', () => {
    render(<BoardReleaseHeader state={{ status: 'ready' } as never} ledger={ledger} lane={null} onLaneChange={() => {}} />);
    expect(screen.getByRole('button', { name: /ใบขอทั้งหมด\s*314\s*ใบ/ })).toBeTruthy();
    // 11 พ.ย. 2569 แบบ C: แถบเดียว เรียงซ้ายไปขวา · 25 พ.ย. 2569 เหลือ 5 ช่อง
    const tree = screen.getByTestId('board-release-tree');
    expect([...tree.children].map((c) => c.getAttribute('data-testid'))).toEqual([
      'board-lane-all', 'board-lane-released', 'board-lane-applied', 'board-lane-silent', 'board-lane-unreleased',
    ]);
    expect(within(tree).getByRole('button', { name: /ประกาศแล้ว\s*23\s*ใบ/ })).toBeTruthy();
    expect(within(tree).getByRole('button', { name: /มีคนกรอก\s*10\s*ใบ\s*35 คน/ })).toBeTruthy();
    expect(within(tree).getByRole('button', { name: /ยังไม่มีคนกรอก\s*13\s*ใบ/ })).toBeTruthy();
    expect(within(tree).getByRole('button', { name: /ยังไม่ประกาศ\s*291\s*ใบ/ })).toBeTruthy();
    expect(within(tree).queryByRole('button', { name: /เริ่มงานแล้ว/ })).toBeNull();
    expect(within(tree).queryByRole('button', { name: /ยังต้องหาคน/ })).toBeNull();
  });

  it('ทุกชิปยังกดกรองได้', () => {
    const onLaneChange = vi.fn();
    render(<BoardReleaseHeader state={{ status: 'ready' } as never} ledger={ledger} lane={null} onLaneChange={onLaneChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^มีคนกรอก/ }));
    fireEvent.click(screen.getByRole('button', { name: /^ยังไม่ประกาศ/ }));
    expect(onLaneChange.mock.calls.map((c) => c[0])).toEqual(['applied', 'unreleased']);
  });
});
