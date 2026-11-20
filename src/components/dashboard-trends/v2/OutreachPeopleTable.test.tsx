/**
 * ตารางรายคนของการสั่งงาน (เจ้าของ 19 พ.ย. 2569 "ใหม่กดดูได้ เจมส์กดดูไม่ได้มันตลกๆไหม")
 * ชื่อทุกคนที่มีบัญชีกดได้เหมือนกัน (= งานรายวัน · รวมการ์ดงานรายคนเข้ามา) · แถวที่ไม่ใช่คนกดไม่ได้ · กดเลข — โพสต์เอง/คลิก/กรอก = ลิงก์ของคนนั้น · รายชื่อ/สนใจ/นัด/มาจริง = รายชื่อ
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { OutreachPerson } from '@/lib/outreachByPerson';

const { default: OutreachPeopleTable } = await import('./OutreachPeopleTable');
afterEach(() => cleanup());

const person = (name: string, o: Partial<OutreachPerson>): OutreachPerson => ({ name, userId: null, autopost: 0, scrap: 0, gen: 0, posted: 0, clicks: 0, applicants: 0, contacts: 0, appts: 0, names: [], interested: [], booked: [], showed: [], ...o });

describe('OutreachPeopleTable', () => {
  it('ชื่อคนที่มีบัญชีกดได้ทุกคน (เจมส์ = ใหม่) · แถวที่ไม่ใช่คนกดไม่ได้ · เลขโพสต์เอง/รายชื่อกดได้ · มีคอลัมน์ลงผลติดต่อ/ลงนัด', () => {
    const onPerson = vi.fn();
    const onIds = vi.fn();
    const onStaff = vi.fn();
    render(
      <OutreachPeopleTable
        people={[
          person('เจมส์', { userId: 'u-6f1e2a', names: ['app-1a', 'app-2b'], scrap: 6 }),
          person('ใหม่', { userId: 'u-9c3b7d', names: ['app-3c'], posted: 3, clicks: 8, contacts: 12, appts: 2 }),
          person('ดึงจาก iRecruit', { names: ['app-4d'] }),
        ]}
        onPerson={onPerson}
        onStaff={onStaff}
        onIds={onIds}
      />,
    );
    expect(screen.getByText('ลงผลติดต่อ')).toBeTruthy();
    expect(screen.getByText('ลงนัด')).toBeTruthy();
    const rows = screen.getAllByRole('row');
    const james = rows.find((r) => r.textContent?.startsWith('เจมส์'))!;
    const mai = rows.find((r) => r.textContent?.startsWith('ใหม่'))!;
    const irecruit = rows.find((r) => r.textContent?.startsWith('ดึงจาก iRecruit'))!;
    fireEvent.click(within(james).getByRole('button', { name: 'เจมส์' }));
    expect(onStaff).toHaveBeenCalledWith('u-6f1e2a', 'เจมส์');
    expect(within(mai).getByRole('button', { name: 'ใหม่' })).toBeTruthy();
    expect(within(irecruit).queryByRole('button', { name: 'ดึงจาก iRecruit' })).toBeNull();
    fireEvent.click(within(mai).getAllByTestId('v2-outreach-person-links')[0]);
    expect(onPerson).toHaveBeenCalledWith('ใหม่');
    // โพสต์แล้ว = งานรายวันของคนที่วาง (กดเหมือนกดชื่อ)
    fireEvent.click(within(mai).getByTestId('v2-outreach-person-posted'));
    expect(onStaff).toHaveBeenCalledWith('u-9c3b7d', 'ใหม่');
    fireEvent.click(within(james).getByRole('button', { name: '2' }));
    expect(onIds).toHaveBeenCalledWith(expect.stringContaining('เจมส์'), ['app-1a', 'app-2b']);
  });
});
