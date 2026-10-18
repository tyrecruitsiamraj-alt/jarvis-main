import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageErrorBoundary from './PageErrorBoundary';
import LoadErrorNotice from './LoadErrorNotice';

const Boom: React.FC = () => {
  throw new Error('bad shape');
};

describe('PageErrorBoundary (QA 17 ต.ค. 2569 ข้อ 45 — กันจอขาวทั้งหน้า)', () => {
  it('หน้าพังตอนวาด = กล่องบอก + ปุ่มโหลดหน้าใหม่ · เปลี่ยนหน้าแล้วหาย', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <PageErrorBoundary resetKey="/aftercare">
        <Boom />
      </PageErrorBoundary>,
    );
    expect(screen.getByText('หน้านี้แสดงไม่ได้')).toBeTruthy();
    expect(screen.getByRole('button', { name: /โหลดหน้าใหม่/ })).toBeTruthy();
    rerender(
      <PageErrorBoundary resetKey="/follow">
        <p>หน้าติดตาม</p>
      </PageErrorBoundary>,
    );
    expect(screen.getByText('หน้าติดตาม')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('LoadErrorNotice', () => {
  it('มีปุ่มลองใหม่เมื่อส่ง onRetry', () => {
    const onRetry = vi.fn();
    render(<LoadErrorNotice message="โหลดรายชื่อไม่สำเร็จ" onRetry={onRetry} />);
    screen.getByRole('button', { name: /ลองใหม่/ }).click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert').textContent).toContain('โหลดรายชื่อไม่สำเร็จ');
  });
});
