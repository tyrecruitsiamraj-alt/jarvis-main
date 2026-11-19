/**
 * โหลดไม่ขึ้น = น้องใบขอท่า "ติดปัญหา" + ข้อความ + ลองใหม่ (เจ้าของ 19 พ.ย. 2569)
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { TrendState } from './TrendParts';
import MascotState from './MascotState';

afterEach(cleanup);

describe('กล่องโหลดไม่ขึ้น', () => {
  it('มีน้องใบขอ · ข้อความเดิม · ปุ่มลองใหม่ยิงซ้ำ', () => {
    const retry = vi.fn();
    render(<TrendState loading={false} error="โหลดภาพรวมงานสรรหาไม่สำเร็จ (HTTP 504)" onRetry={retry} />);
    const img = screen.getByAltText('น้องใบขอติดปัญหา') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/mascot/request-trouble.png');
    expect(existsSync('public/mascot/request-trouble.png')).toBe(true);
    expect(screen.getByText('โหลดภาพรวมงานสรรหาไม่สำเร็จ (HTTP 504)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('กำลังโหลด = น้องใบขอท่ากำลังทำ กลางหน้า (เจ้าของ "ใส่ท่ากำลังทำตอนโหลดด้วย แล้วใส่ไว้กลางหน้าเลย")', () => {
    render(<MascotState pose="working" testId="x">กำลังโหลด…</MascotState>);
    expect((screen.getByAltText('น้องใบขอกำลังทำงาน') as HTMLImageElement).getAttribute('src')).toBe('/mascot/request-working.png');
    expect(existsSync('public/mascot/request-working.png')).toBe(true);
    expect(screen.getByTestId('x').className).toContain('items-center');
    expect(screen.getByText('กำลังโหลด…')).toBeTruthy();
  });

  it('ไม่มีปัญหา = ไม่ขึ้นอะไร', () => {
    const { container } = render(<TrendState loading={false} error={null} />);
    expect(container.textContent).toBe('');
  });
});
