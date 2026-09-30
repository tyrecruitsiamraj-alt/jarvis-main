/**
 * ใครอยู่ในระบบ ในตาราง ตั้งค่า › ผู้ใช้งาน (ย้ายมาจากท้ายหน้าหลัก 30 ก.ย. 2569)
 * 🔴 ด่าน: เจ้าของเลือก "รวมเข้าตารางผู้ใช้งาน" ⇒ ใต้ชื่อบอก Online (ใช้งานกี่นาทีก่อน) / Offline (เข้าล่าสุดเมื่อไหร่) /
 *    ยังไม่เข้าระบบ · บัญชีที่ไม่มีสถานะไม่ขึ้นอะไร · ปุ่มกรองบอกจำนวนแต่ละสถานะ กดแล้วส่งตัวกรองออกไป
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PresenceFilterChips, PresenceLine } from './UserPresence';
import type { PresencePerson } from '@/lib/homePresence';

afterEach(() => cleanup());

const NOW = new Date('2026-09-30T05:00:00Z'); // 12:00 น. เวลาไทย

const person = (over: Partial<PresencePerson>): PresencePerson => ({
  id: 'u1',
  name: 'คนหนึ่ง',
  bu: 'LBD',
  role: 'staff',
  status: 'online',
  lastLoginAt: '2026-09-30T02:00:00Z',
  lastActiveAt: '2026-09-30T04:55:00Z',
  ...over,
});

describe('บรรทัดสถานะใต้ชื่อ', () => {
  it('Online = ใช้งานกี่นาทีก่อน', () => {
    const { container } = render(<PresenceLine person={person({})} now={NOW} />);
    expect(container.textContent).toBe('Online· ใช้งาน 5 นาทีก่อน');
  });

  it('Offline = เข้าระบบล่าสุดเมื่อไหร่', () => {
    const { container } = render(
      <PresenceLine person={person({ status: 'offline', lastActiveAt: null, lastLoginAt: '2026-09-29T10:40:00Z' })} now={NOW} />,
    );
    expect(container.textContent).toBe('Offline· เข้าล่าสุด เมื่อวาน 17:40');
  });

  it('ยังไม่เข้าระบบ = บอกคำเดียว · ไม่มีสถานะ (บัญชีปิดใช้งาน) = ไม่ขึ้นอะไร', () => {
    const { container } = render(
      <PresenceLine person={person({ status: 'never', lastLoginAt: null, lastActiveAt: null })} now={NOW} />,
    );
    expect(container.textContent).toBe('ยังไม่เข้าระบบ');
    cleanup();
    const empty = render(<PresenceLine person={undefined} now={NOW} />);
    expect(empty.container.textContent).toBe('');
  });
});

describe('ปุ่มกรองสถานะเหนือตาราง', () => {
  it('บอกจำนวนแต่ละสถานะ · ทั้งหมด = ทุกบัญชีในตาราง · กดแล้วส่งตัวกรองออกไป', () => {
    const onChange = vi.fn();
    render(
      <PresenceFilterChips
        counts={{ total: 57, online: 3, offline: 53, never: 1 }}
        total={58}
        value="all"
        onChange={onChange}
        updatedAt="2026-09-30T05:00:00Z"
      />,
    );
    expect(screen.getByRole('button', { name: 'ทั้งหมด 58' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Online 3/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Offline 53/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /ยังไม่เข้าระบบ 1/ }));
    expect(onChange).toHaveBeenCalledWith('never');
    expect(screen.getByText('อัปเดต 12:00')).toBeTruthy();
  });
});
