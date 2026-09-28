/**
 * หัวคอลัมน์ Lumos หน้าแรก — "ส่งให้ Lumos ทั้งระบบ" (เจ้าของสั่ง 28 ก.ย. 2569)
 * 🔴 ด่าน: สามตัวเลข วันนี้ · เดือนนี้ · ทั้งหมด อยู่บนก้อนเลย · อ่านไม่ได้ = "วัดไม่ได้" · ยังไม่รู้ = ขีด (ห้าม 0 ปลอม)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import LumosSentBlock from './LumosSentBlock';
import type { LumosSentRow } from '@/lib/officeTeam';

const rows: LumosSentRow[] = [
  { day: '2026-09-28', bu: 'LBD', route: 'public', state: 'pending', n: 3 },
  { day: '2026-09-28', bu: 'LML', route: 'follow', state: 'done', n: 2 },
  { day: '2026-09-02', bu: 'LBD', route: 'match', state: 'done', n: 40 },
  { day: '2026-08-15', bu: null, route: 'match', state: 'cancelled', n: 1200 },
];

const renderBlock = (props: React.ComponentProps<typeof LumosSentBlock>) =>
  render(
    <ul>
      <LumosSentBlock {...props} />
    </ul>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-28T05:00:00Z')); // 12:00 น. เวลาไทย 28 ก.ย.
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ยอดส่ง Lumos ทั้งระบบ บนหัวคอลัมน์', () => {
  it('วันนี้ · เดือนนี้ · ทั้งหมด + แจกสถานะ + แจกเส้นทาง บนก้อนเลย', () => {
    renderBlock({ rows });
    expect(screen.getByText('ส่งให้ Lumos ทั้งระบบ')).toBeTruthy();
    const dd = [...document.querySelectorAll('dd')].map((d) => d.textContent);
    expect(dd).toEqual(['5', '45', '1,245']);
    expect(screen.getByText(/รอโทร 3 · รอผล 0 · รู้ผลแล้ว 42 · ยกเลิก 1,200/)).toBeTruthy();
    expect(screen.getByText('หน้าสาธารณะ 3 · หน้า Match 1,240 · หน้า Follow 2')).toBeTruthy();
    // ไม่ได้กรอง BU ⇒ ไม่มีบรรทัด "ไม่รู้ BU"
    expect(screen.queryByText(/ไม่รู้ BU/)).toBeNull();
  });

  it('อ่านไม่ได้ ⇒ บอก "วัดไม่ได้" ไม่ใช่ 0', () => {
    renderBlock({ rows: null, error: 'อ่านยอดส่ง Lumos ไม่ได้' });
    expect(screen.getByText('วัดไม่ได้ — อ่านยอดส่ง Lumos ไม่ได้')).toBeTruthy();
    expect(document.querySelectorAll('dd')).toHaveLength(0);
  });

  it('ยังโหลดไม่เสร็จ ⇒ ขีด ห้าม 0 ปลอม', () => {
    renderBlock({ rows: null, loading: true });
    expect([...document.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['—', '—', '—']);
  });

  it('เซิร์ฟเวอร์รุ่นเก่ายังไม่ส่งข้อมูลนี้ ⇒ ไม่วาดก้อนเลย', () => {
    renderBlock({ rows: undefined });
    expect(screen.queryByText('ส่งให้ Lumos ทั้งระบบ')).toBeNull();
  });
});
