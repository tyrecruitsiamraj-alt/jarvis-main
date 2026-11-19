/**
 * ตารางรายคนของการสั่งงาน (เจ้าของ 19 พ.ย. 2569 "ใหม่กดดูได้ เจมส์กดดูไม่ได้มันตลกๆไหม")
 * ชื่อไม่เป็นลิงก์ทุกแถวเหมือนกัน · กดเลขแทน — โพสต์เอง/คลิก/กรอก = ลิงก์ของคนนั้น · รายชื่อ/สนใจ/นัด/มาจริง = รายชื่อ
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { OutreachPerson } from '@/lib/outreachByPerson';

const { default: OutreachPeopleTable } = await import('./OutreachPeopleTable');
afterEach(() => cleanup());

const person = (name: string, o: Partial<OutreachPerson>): OutreachPerson => ({ name, autopost: 0, scrap: 0, gen: 0, posted: 0, clicks: 0, applicants: 0, names: [], interested: [], booked: [], showed: [], ...o });

describe('OutreachPeopleTable', () => {
  it('ชื่อไม่ใช่ปุ่มทุกแถว · เลขโพสต์เองกดได้ · เลขรายชื่อกดได้', () => {
    const onPerson = vi.fn();
    const onIds = vi.fn();
    render(
      <OutreachPeopleTable
        people={[person('เจมส์', { names: ['app-1a', 'app-2b'], scrap: 6 }), person('ใหม่', { names: ['app-3c'], posted: 3, clicks: 8 })]}
        onPerson={onPerson}
        onIds={onIds}
      />,
    );
    const rows = screen.getAllByRole('row');
    const james = rows.find((r) => r.textContent?.startsWith('เจมส์'))!;
    const mai = rows.find((r) => r.textContent?.startsWith('ใหม่'))!;
    expect(within(james).queryByRole('button', { name: 'เจมส์' })).toBeNull();
    expect(within(mai).queryByRole('button', { name: 'ใหม่' })).toBeNull();
    fireEvent.click(within(mai).getAllByTestId('v2-outreach-person-links')[0]);
    expect(onPerson).toHaveBeenCalledWith('ใหม่');
    fireEvent.click(within(james).getByRole('button', { name: '2' }));
    expect(onIds).toHaveBeenCalledWith(expect.stringContaining('เจมส์'), ['app-1a', 'app-2b']);
  });
});
