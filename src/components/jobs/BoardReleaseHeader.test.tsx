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
  releasable: 280,
  startedAlready: 11,
};

describe('หัวกล่องงานแบบสองสาย', () => {
  it('ใบขอทั้งหมด → ประกาศแล้ว (มีคนกรอก ใบ·คน / ยังไม่มีคนกรอก) · ยังไม่ประกาศ (ยังต้องหาคน / เริ่มงานแล้ว)', () => {
    render(<BoardReleaseHeader state={{ status: 'ready' } as never} ledger={ledger} lane={null} onLaneChange={() => {}} />);
    expect(screen.getByRole('button', { name: /ใบขอทั้งหมด\s*314 ใบ/ })).toBeTruthy();
    const rel = screen.getByTestId('board-release-released');
    expect(within(rel).getByRole('button', { name: /ประกาศแล้ว\s*23 ใบ/ })).toBeTruthy();
    expect(within(rel).getByRole('button', { name: /มีคนกรอก\s*10 ใบ\s*·\s*35 คน/ })).toBeTruthy();
    expect(within(rel).getByRole('button', { name: /ยังไม่มีคนกรอก\s*13 ใบ/ })).toBeTruthy();
    const unrel = screen.getByTestId('board-release-unreleased');
    expect(within(unrel).getByRole('button', { name: /ยังไม่ประกาศ\s*291 ใบ/ })).toBeTruthy();
    expect(within(unrel).getByRole('button', { name: /เริ่มงานแล้ว\s*11 ใบ/ })).toBeTruthy();
  });

  it('ทุกชิปยังกดกรองได้', () => {
    const onLaneChange = vi.fn();
    render(<BoardReleaseHeader state={{ status: 'ready' } as never} ledger={ledger} lane={null} onLaneChange={onLaneChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^มีคนกรอก/ }));
    fireEvent.click(screen.getByRole('button', { name: /เริ่มงานแล้ว/ }));
    expect(onLaneChange.mock.calls.map((c) => c[0])).toEqual(['applied', 'started']);
  });
});
