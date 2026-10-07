/**
 * สมุดบัญชีติดตาม (7 ต.ค. 2569) — ยอดหัวหน้าลงตัว · แท็บคิดยอดใหม่ · กรองรายการไม่เปลี่ยนยอด
 */
import React from 'react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FollowLedgerPage from '@/pages/FollowLedgerPage';
import type { FollowLedgerResponse, LedgerCall } from '@/lib/followLedger';

const now = Date.now();
const iso = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const call = (p: Partial<LedgerCall> & { id: string }): LedgerCall => ({
  name: `คน ${p.id}`,
  unit: 'หน่วย ก',
  bu: null,
  team: 'main',
  caller: 'ai',
  scheduledAt: iso(10),
  createdAt: iso(60),
  createdBy: 'a@x',
  sentAt: null,
  exit: null,
  ...p,
});

vi.mock('@/lib/homeAiShareApi', () => ({
  fetchFollowLedger: (w: { from: string | null; to: string | null }) =>
    Promise.resolve({
      generated_at: new Date().toISOString(),
      from: w.from,
      to: w.to,
      bu: null,
      notes: [{ callId: '3', at: iso(20), kind: 'edit', by: 'b@x' }],
      error: null,
      calls: [
        call({ id: '1', sentAt: iso(55), exit: { kind: 'result', at: iso(30), by: 'AI', result: 'agreed' } }),
        call({ id: '2', exit: { kind: 'cancel', at: iso(25), by: 'b@x', result: 'cancelled' } }),
        call({ id: '3', team: 'replacement', caller: 'manual', createdBy: 'iRecruit' }),
      ],
    } satisfies FollowLedgerResponse),
}));

beforeAll(() => {
  // Radix Select/Tabs ใช้ pointer capture ที่ jsdom ไม่มี
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
});

const num = (id: string) => (screen.getByTestId(id).textContent ?? '').replace(/\D/g, '');

describe('FollowLedgerPage', () => {
  it('ยกมา + เพิ่ม − ได้ผล − ยกเลิก = คงเหลือ · แท็บคิดยอดใหม่', async () => {
    render(<FollowLedgerPage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(num('ledger-added')).toBe('3'));
    expect(num('ledger-opening')).toBe('0');
    expect(num('ledger-results')).toBe('1');
    expect(num('ledger-cancelled')).toBe('1');
    expect(num('ledger-closing')).toBe('1');
    expect(screen.getByTestId('ledger-equation').textContent).toBe('0 + 3 − 1 − 1 = 1');
    // ทุกรายการ: เพิ่ม 3 + ส่ง 1 + ได้ผล 1 + ยกเลิก 1 + แก้ 1
    const table = screen.getByTestId('ledger-table');
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 7);
    // บรรทัดบนสุด (ใหม่สุด) คงเหลือ = คงเหลือ
    const top = within(table).getAllByRole('row')[1];
    expect(top.textContent).toContain('แก้ไข');
    expect(top.textContent?.endsWith('1')).toBe(true);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'ติดตามส่งคนแทน' }));
    await waitFor(() => expect(num('ledger-added')).toBe('1'));
    expect(screen.getByTestId('ledger-equation').textContent).toBe('0 + 1 − 0 − 0 = 1');
  });
});
