/**
 * ตัวแก้ตารางทั้งชุด (เจ้าของ Choice 1 ต.ค. 2569) — ฝังในกล่องแก้ไข ไม่ซ้อน Dialog
 * 🔴 ด่าน: สายที่โทรไปแล้วอ่านอย่างเดียว · ลบ/เพิ่ม/สลับคนโทรแล้วยิงคำขอเดียวที่ถูก · ไม่เปลี่ยนอะไร = กดบันทึกไม่ได้ ·
 *    AI ยังไม่ได้ตารางใหม่ต้องบอกบนจอ · ป้ายเป็น "วันที่ D · สายที่ N" ไม่ใช่เลขต่อทั้งชุด (เจ้าของสั่ง 1 ต.ค. 2569)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FollowEntry } from '@/lib/followApi';

const replaceFollowSchedule = vi.fn();
vi.mock('@/lib/followApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/followApi')>();
  return { ...mod, replaceFollowSchedule: (...a: unknown[]) => replaceFollowSchedule(...a) };
});

const { default: FollowScheduleEditor } = await import('./FollowScheduleEditor');

afterEach(() => {
  cleanup();
  replaceFollowSchedule.mockReset();
});

const inDays = (d: number, hh: number) => {
  const day = new Date(Date.now() + d * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return new Date(`${day}T${String(hh).padStart(2, '0')}:00:00+07:00`).toISOString();
};
const row = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: 'r',
    recipient_name: 'ทดสอบ',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: inDays(1, 9),
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    called_at: null,
    call_mode: 'ai',
    group_id: 'g1',
    ...over,
  }) as FollowEntry;

const setRows = [
  row({ id: 'done', scheduled_at: inDays(-1, 9), call_status: 'completed', call_outcome: 'confirmed', call_round: 1 }),
  row({ id: 'a', scheduled_at: inDays(1, 9), call_round: 2 }),
  row({ id: 'b', scheduled_at: inDays(2, 9), call_round: 3 }),
];

describe('FollowScheduleEditor', () => {
  it('🔴 สายที่โทรไปแล้วอยู่ในรายการอ่านอย่างเดียว · สายที่ยังไม่ถึงเวลาแก้ได้ · ยังไม่เปลี่ยน = บันทึกไม่ได้', () => {
    render(<FollowScheduleEditor anchor={setRows[1]} setRows={setRows} onBack={() => {}} onSaved={() => {}} />);
    expect(screen.getByText('โทรไปแล้ว / เลยเวลา')).toBeTruthy();
    // ชุดนี้: เมื่อวาน (โทรแล้ว) · พรุ่งนี้ · มะรืน ⇒ วันที่ 1 / 3 / 4 นับวันตามปฏิทินจากวันแรกของชุด
    expect(screen.getByText('ครั้งที่ 1 · สายที่ 1')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^เอาครั้งที่ \d · สายที่ 1 ออก$/ })).toHaveLength(2);
    expect(screen.queryByText(/รอบโทรที่/)).toBeNull();
    expect((screen.getByRole('button', { name: 'บันทึกตาราง' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('🔴 เอาสายออก + เพิ่มสาย + บันทึก = คำขอเดียว (สายที่หาย = เอาออก · สายใหม่ไม่มี id) · AI ยังไม่ได้ต้องบอก', async () => {
    replaceFollowSchedule.mockResolvedValue({
      group_id: 'g1',
      kept: 1,
      cancelled: 1,
      created: 1,
      lumos: { pushed: false, plans: 2, rounds: 2, reason: 'push ปิดอยู่' },
    });
    const onSaved = vi.fn();
    render(<FollowScheduleEditor anchor={setRows[1]} setRows={setRows} onBack={() => {}} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'เอาครั้งที่ 4 · สายที่ 1 ออก' }));
    fireEvent.click(screen.getByRole('button', { name: /เพิ่มสาย/ }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกตาราง' }));
    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalledTimes(1));
    const [anchorId, body] = replaceFollowSchedule.mock.calls[0] as [string, { replace_ids: string[]; rounds: Array<{ id?: string; scheduled_at: string; call_mode: string }> }];
    expect(anchorId).toBe('a');
    expect(body.replace_ids.sort()).toEqual(['a', 'b']);
    expect(body.rounds).toHaveLength(2);
    expect(body.rounds[0]).toMatchObject({ id: 'a', call_mode: 'ai' });
    expect(body.rounds[1].id).toBeUndefined();
    // สายใหม่ = เวลาเดิมของสายสุดท้ายในวันถัดไป
    expect(Date.parse(body.rounds[1].scheduled_at) - Date.parse(setRows[1].scheduled_at!)).toBe(86_400_000);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(String(onSaved.mock.calls[0][0])).toMatch(/ยังส่งให้ AI ไม่สำเร็จ/);
  });

  it('สลับเป็นคนโทร = เปลี่ยนแล้ว บันทึกได้ · ส่ง call_mode manual', async () => {
    replaceFollowSchedule.mockResolvedValue({ group_id: 'g1', kept: 2, cancelled: 0, created: 0, lumos: { pushed: true, plans: 1, rounds: 1, reason: null } });
    render(<FollowScheduleEditor anchor={setRows[1]} setRows={setRows} onBack={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'ครั้งที่ 4 · สายที่ 1 — คนโทร' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกตาราง' }));
    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalled());
    const body = replaceFollowSchedule.mock.calls[0][1] as { rounds: Array<{ id?: string; call_mode: string }> };
    expect(body.rounds.find((r) => r.id === 'b')?.call_mode).toBe('manual');
  });

  it('🔴 สองสายวันเดียวกัน = "สายที่ 1" "สายที่ 2" ของวันนั้น · ย้ายเวลาข้ามวันแล้วป้ายเปลี่ยนตาม', () => {
    const rows = [
      row({ id: 'p', scheduled_at: inDays(1, 9), call_round: 1 }),
      row({ id: 'q', scheduled_at: inDays(1, 15), call_round: 2 }),
      row({ id: 'r2', scheduled_at: inDays(2, 9), call_round: 3 }),
      row({ id: 's', scheduled_at: inDays(2, 15), call_round: 4 }),
    ];
    render(<FollowScheduleEditor anchor={rows[0]} setRows={rows} onBack={() => {}} onSaved={() => {}} />);
    const names = screen
      .getAllByRole('button', { name: /^เอา.* ออก$/ })
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'เอาครั้งที่ 1 · สายที่ 1 ออก',
      'เอาครั้งที่ 1 · สายที่ 2 ออก',
      'เอาครั้งที่ 2 · สายที่ 1 ออก',
      'เอาครั้งที่ 2 · สายที่ 2 ออก',
    ]);
  });

  it('🔴 วันที่ยกเลิกไปแล้วยังนับเป็นวันของชุด — ป้ายตรงกับตารางรายวัน (สายที่เหลือวันแรก = "วันที่ 1")', () => {
    const live = [row({ id: 'p', scheduled_at: inDays(1, 9), call_round: 1 }), row({ id: 'q', scheduled_at: inDays(1, 15), call_round: 2 })];
    const gone = [row({ id: 'z', scheduled_at: inDays(4, 9), call_round: 3, cancelled: true })];
    render(<FollowScheduleEditor anchor={live[0]} setRows={live} cancelledRows={gone} onBack={() => {}} onSaved={() => {}} />);
    expect(screen.getByRole('button', { name: 'เอาครั้งที่ 1 · สายที่ 2 ออก' })).toBeTruthy();
    cleanup();
    // ไม่มีวันอื่นเลย = ชุดวันเดียว ไม่มีเลขวัน
    render(<FollowScheduleEditor anchor={live[0]} setRows={live} onBack={() => {}} onSaved={() => {}} />);
    expect(screen.getByRole('button', { name: 'เอาสายที่ 2 ออก' })).toBeTruthy();
  });

  it('ฝังในกล่องแก้ไข — ไม่มี Dialog ซ้อน · มีปุ่มเปิดในกล่อง "รอบโทรของคนนี้"', () => {
    const dialog = fs.readFileSync(path.resolve(__dirname, 'FollowEditDialog.tsx'), 'utf8');
    const editor = fs.readFileSync(path.resolve(__dirname, 'FollowScheduleEditor.tsx'), 'utf8');
    expect(dialog).toContain('<FollowScheduleEditor');
    expect(dialog).toContain('แก้ตารางทั้งชุด');
    expect(editor).not.toMatch(/<Dialog|<AlertDialog|<Sheet/);
  });
});
