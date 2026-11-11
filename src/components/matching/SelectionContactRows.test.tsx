/**
 * คนที่เก็บจากจับคู่งาน = แถวในตารางการติดต่อ (เจ้าของ 11 พ.ย. 2569 รวมตารางเดียว)
 * ป้ายจับคู่งาน · เบอร์กดโทร · ลงผลแล้วยังอยู่ · หลุด 24 ชม. ไม่หายเงียบ · ลงผล/ส่ง AI เฉพาะคนที่ยังถืออยู่
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { SelectionContactRow } from '@/lib/selectionContacts';

const base: SelectionContactRow = {
  id: 'h1', cardId: 11, name: 'ทดสอบ หนึ่ง', phone: '0812345678', age: 30, sex: 'ชาย', area: 'บางปะอิน · พระนครศรีอยุธยา',
  jobId: 'siamraj-sql:OPL6910001', requestNo: 'OPL6910001', jobLabel: 'กรุงศรี', heldAt: '2026-10-20T03:00:00Z',
  expiresAt: '2099-10-21T03:00:00Z', open: true, expired: false, result: null, resultAt: null,
};
const rows: SelectionContactRow[] = [
  base,
  { ...base, id: 'h2', name: 'ทดสอบ สอง', open: false, result: 'confirmed', resultAt: '2026-10-20T04:00:00Z' },
  { ...base, id: 'h3', name: 'ทดสอบ สาม', open: false, result: 'no_answer', resultAt: '2026-10-20T04:00:00Z' },
  { ...base, id: 'h4', name: 'ทดสอบ สี่', open: false, expired: true },
];

vi.mock('@/lib/lumosDispatchApi', () => ({ dispatchLumosCalls: vi.fn(async () => ({ queued: 1, duplicated: [], skipped: [], items: [] })) }));
vi.mock('@/lib/callHoldsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/callHoldsApi')>()),
  releaseCallHold: vi.fn(async () => undefined),
  recordCallResult: vi.fn(async () => ({})),
}));

const { SelectionContactRows, SelectionContactDialogs, selectionRowMatchesKeyword } = await import('./SelectionContactRows');
const { isInSelectionChip, SELECTION_CHIPS } = await import('@/lib/selectionContacts');
const { CONTACT_CHIPS } = await import('@/lib/recruitRm');

afterEach(cleanup);

describe('ชิปการติดต่อ (จับคู่งาน)', () => {
  it('ชุดเดียวกับชิปการติดต่อของงานสรรหา · ยังไม่โทร + โทรแล้ว = ทั้งหมด · สำเร็จ + ไม่สำเร็จ = โทรแล้ว', () => {
    expect(SELECTION_CHIPS.map((c) => c.id)).toEqual(CONTACT_CHIPS.map((c) => c.id));
    const n = (c: (typeof SELECTION_CHIPS)[number]['id']) => rows.filter((r) => isInSelectionChip(r, c)).length;
    expect([n('all'), n('uncalled'), n('called'), n('ok'), n('fail')]).toEqual([4, 2, 2, 1, 1]);
  });
  it('คำค้นแถบบนใช้กับชื่อ · เบอร์ · เลขใบขอ', () => {
    expect(selectionRowMatchesKeyword(base, 'หนึ่ง')).toBe(true);
    expect(selectionRowMatchesKeyword(base, '0812')).toBe(true);
    expect(selectionRowMatchesKeyword(base, 'opl6910001')).toBe(true);
    expect(selectionRowMatchesKeyword(base, 'ไม่มีคำนี้')).toBe(false);
  });
});

describe('แถวจับคู่งานในตารางการติดต่อ', () => {
  it('7 ช่องเท่าหัวตาราง · ป้ายจับคู่งาน · เบอร์กดโทร · ลงผล/ส่ง AI เฉพาะคนที่ยังถือ · หลุดแล้วบอก', () => {
    const onResult = vi.fn();
    const onSendAi = vi.fn();
    render(
      <table>
        <tbody>
          <SelectionContactRows rows={rows} onResult={onResult} onSendAi={onSendAi} />
        </tbody>
      </table>,
    );
    const trs = screen.getAllByTestId('match-contact-row');
    expect(trs).toHaveLength(4);
    for (const tr of trs) expect(tr.querySelectorAll('td')).toHaveLength(7);
    expect(screen.getAllByText('จับคู่งาน')).toHaveLength(4);
    expect(within(trs[0]).getByRole('link', { name: /โทร/ }).getAttribute('href')).toBe('tel:0812345678');
    expect(screen.getByText('สนใจ')).toBeTruthy();
    expect(screen.getByText('หลุดแล้ว · ครบ 24 ชม.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'ลงผล' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /ส่ง AI โทร/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'ลงผล' }));
    expect(onResult).toHaveBeenCalledWith(rows[0]);
  });
  it('ลงผลเปิดป๊อปฟอร์มเดิม · ส่ง AI มีหน้ายืนยัน', async () => {
    const { rerender } = render(<SelectionContactDialogs resultFor={base} aiFor={null} onClose={() => {}} onDone={() => {}} />);
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('button', { name: 'บันทึกผล' })).toBeTruthy();
    rerender(<SelectionContactDialogs resultFor={null} aiFor={base} onClose={() => {}} onDone={() => {}} />);
    expect(await screen.findByText('ส่ง AI โทร ทดสอบ หนึ่ง?')).toBeTruthy();
  });
});
