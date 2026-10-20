/**
 * หน้าการติดต่อของจับคู่งาน (เจ้าของ 20 ต.ค. 2569 "หน้าตาไม่เห็นเหมือนของฝั่ง menu งานสรรหาเลย" → Choice "ทำตามนี้")
 * ชิปเหมือนงานสรรหา · ตารางมีเบอร์กดโทร · ลงผลแล้วแถวยังอยู่ · หลุด 24 ชม. ไม่หายเงียบ
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SelectionContactRow } from '@/lib/selectionContacts';

const base: SelectionContactRow = {
  id: 'h1', cardId: 11, name: 'ทดสอบ หนึ่ง', phone: '0812345678', age: 30, sex: 'ชาย', area: 'บางปะอิน · พระนครศรีอยุธยา',
  jobId: 'siamraj-sql:OPL1', requestNo: 'OPL1', jobLabel: 'กรุงศรี', heldAt: '2026-10-20T03:00:00Z',
  expiresAt: '2099-10-21T03:00:00Z', open: true, expired: false, result: null, resultAt: null,
};
const rows: SelectionContactRow[] = [
  base,
  { ...base, id: 'h2', name: 'ทดสอบ สอง', open: false, result: 'confirmed', resultAt: '2026-10-20T04:00:00Z' },
  { ...base, id: 'h3', name: 'ทดสอบ สาม', open: false, result: 'no_answer', resultAt: '2026-10-20T04:00:00Z' },
  { ...base, id: 'h4', name: 'ทดสอบ สี่', open: false, expired: true },
];

vi.mock('@/lib/selectionContacts', async (orig) => ({
  ...(await orig<typeof import('@/lib/selectionContacts')>()),
  fetchSelectionContacts: vi.fn(async () => rows),
}));
vi.mock('@/lib/lumosDispatchApi', () => ({ dispatchLumosCalls: vi.fn(async () => ({ queued: 1, duplicated: [], skipped: [], items: [] })) }));
vi.mock('@/lib/callHoldsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/callHoldsApi')>()),
  releaseCallHold: vi.fn(async () => undefined),
  recordCallResult: vi.fn(async () => ({})),
}));

const { default: SelectionContactBoard } = await import('./SelectionContactBoard');
const { isInSelectionChip, SELECTION_CHIPS } = await import('@/lib/selectionContacts');

afterEach(cleanup);

describe('ชิปการติดต่อ (จับคู่งาน)', () => {
  it('ยังไม่โทร + โทรแล้ว = ทั้งหมด · สำเร็จ + ไม่สำเร็จ = โทรแล้ว', () => {
    const n = (c: (typeof SELECTION_CHIPS)[number]['id']) => rows.filter((r) => isInSelectionChip(r, c)).length;
    expect([n('all'), n('uncalled'), n('called'), n('ok'), n('fail')]).toEqual([4, 2, 2, 1, 1]);
  });
});

describe('หน้าการติดต่อของจับคู่งาน', () => {
  it('ตารางเหมือนงานสรรหา · เบอร์กดโทรได้ · ลงผลแล้วยังอยู่ · หลุดแล้วบอก · ลงผลเปิดป๊อป', async () => {
    render(
      <MemoryRouter>
        <SelectionContactBoard />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('ทดสอบ หนึ่ง')).toBeTruthy());
    for (const h of ['ผู้สมัคร', 'ที่อยู่', 'หน่วยงาน', 'เก็บเมื่อ', 'ผลล่าสุด', 'ตัวเลือก']) expect(screen.getByText(h)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'โทร' })[0].getAttribute('href')).toBe('tel:0812345678');
    expect(screen.getByText('สนใจ')).toBeTruthy();
    expect(screen.getByText('หลุดแล้ว · ครบ 24 ชม.')).toBeTruthy();
    // ลงผลได้เฉพาะคนที่ยังถืออยู่
    expect(screen.getAllByRole('button', { name: 'ลงผล' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'ลงผล' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('button', { name: 'บันทึกผล' })).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'ไม่รับสาย' })).toBeTruthy();
  });
  it('กดชิปสำเร็จ เหลือแถวที่ตอบสนใจ', async () => {
    render(
      <MemoryRouter>
        <SelectionContactBoard />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('ทดสอบ หนึ่ง')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^สำเร็จ/ }));
    expect(screen.queryByText('ทดสอบ หนึ่ง')).toBeNull();
    expect(screen.getByText('ทดสอบ สอง')).toBeTruthy();
  });
});
