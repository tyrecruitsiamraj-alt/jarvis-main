/**
 * ปิดงานแล้วหยุดสายที่เหลือ (เจ้าของ 5 ต.ค. 2569): ทุกผล = วันนั้น · "ยกเลิก" ถามก่อนว่า แค่วันนี้ / ทั้งชุด
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FollowCompleteControls from './FollowCompleteControls';

afterEach(cleanup);

describe('FollowCompleteControls — หยุดสายที่เหลือ', () => {
  it('ผลทั่วไป (ถึงแล้ว) = ส่งทันที scope day', () => {
    const onComplete = vi.fn();
    render(<FollowCompleteControls alwaysOpen onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'ถึงแล้ว' }));
    expect(onComplete).toHaveBeenCalledWith('arrived', undefined, 'day');
  });
  it('"ยกเลิก" ถามก่อน · เลือกทั้งชุด = scope set · แค่วันนี้ = day · ไม่ยกเลิก = ไม่ส่ง', () => {
    const onComplete = vi.fn();
    render(<FollowCompleteControls alwaysOpen onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByTestId('cancel-stop-scope')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ไม่ยกเลิก' }));
    expect(screen.queryByTestId('cancel-stop-scope')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    fireEvent.click(screen.getByRole('button', { name: 'ทั้งชุด' }));
    expect(onComplete).toHaveBeenLastCalledWith('cancelled', undefined, 'set');
  });
});
