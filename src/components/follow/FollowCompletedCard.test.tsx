import React from 'react';
/**
 * การ์ด "ติดตามครบ" (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * 🔴 ด่าน:
 * - ว่างก็ยังอยู่ (หัวการ์ด 0 คน + แถว "ไม่มี…") — กติกาทั้งระบบวันเดียวกัน
 * - ย้าย = ลงทะเบียนดูแล → ตั้งรอบ **แผนละวัน group_id เดียว** หัวข้อถามความเป็นอยู่ → ปิดชุดเดิมเป็น "ไปแล้ว"
 * - ตั้งรอบล้มกลางทาง ⇒ **ห้ามปิดชุดเดิม** (คนต้องยังอยู่ในกอง) + บอกว่าตั้งไปแล้วกี่สาย
 * - ไม่ย้าย = เลือกผล 5 แบบ แล้วปิดทุกรอบที่ยังเปิด · หรือ **ติดตามต่อ** อีก N วัน (5 ต.ค. 2569)
 * - 🔴 5 ต.ค. 2569: วันของรอบดูแล = วันติดตามวันสุดท้าย + บวกต่อกัน (ชุดตัวอย่างจบ 30 ก.ย. ⇒ +3 = 3 ต.ค. · +7 = 10 ต.ค.)
 * - บอกว่าไม่ไป ⇒ ไม่มีปุ่มย้าย
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/** การ์ดมีปุ่มพาไปหน้าดูแลหลังเริ่มงาน (useNavigate) — ต้องอยู่ใต้ router (4 ต.ค. 2569) */
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
import type { FollowEntry } from '@/lib/followApi';
import { groupFollowEntries } from '@/lib/followGrouping';
import { AFTERCARE_TOPIC } from '@/lib/aftercareRounds';

const moveToAftercare = vi.fn();
const createFollowRounds = vi.fn();
const completeFollowEntry = vi.fn();
vi.mock('@/lib/aftercareApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/aftercareApi')>();
  return { ...mod, moveToAftercare: (...a: unknown[]) => moveToAftercare(...a) };
});
vi.mock('@/lib/followApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/followApi')>();
  return {
    ...mod,
    createFollowRounds: (...a: unknown[]) => createFollowRounds(...a),
    completeFollowEntry: (...a: unknown[]) => completeFollowEntry(...a),
  };
});

const { default: FollowCompletedCard } = await import('./FollowCompletedCard');

afterEach(() => {
  cleanup();
  moveToAftercare.mockReset();
  createFollowRounds.mockReset();
  completeFollowEntry.mockReset();
});

const NOW = () => new Date('2026-10-01T03:00:00Z'); // 1 ต.ค. 2569 10:00 เวลาไทย

const row = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: 'r',
    recipient_name: 'นายทดสอบ ระบบ',
    recipient_phone: '0812345678',
    topic: 'แจ้งเข้างาน',
    note: null,
    staff_phone: '0899999999',
    unit_name: 'หน่วยงาน ก',
    site_code: 'S1',
    scheduled_at: '2026-09-29T00:00:00Z',
    cancelled: false,
    call_status: 'completed',
    call_outcome: 'confirmed',
    called_at: '2026-09-29T00:05:00Z',
    completed_at: null,
    outcome_code: null,
    call_mode: 'ai',
    group_id: 'g-old',
    created_at: '2026-09-28T00:00:00Z',
    ...over,
  }) as FollowEntry;

const groupsOf = (rows: FollowEntry[]) => groupFollowEntries(rows, NOW());

const going = [
  row({ id: 'a1', scheduled_at: '2026-09-29T00:00:00Z' }),
  row({ id: 'a2', scheduled_at: '2026-09-30T00:00:00Z', call_outcome: 'no_answer' }),
];

describe('FollowCompletedCard', () => {
  it('🔴 ป๊อปสองตัวในการ์ดต้อง key ไม่ซ้ำกัน (เคยซ้ำเป็น "none" ตอนปิดอยู่ — React เตือนรัวทุกครั้งที่วาด)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<FollowCompletedCard groups={groupsOf(going)} onChanged={() => {}} now={NOW} />);
    const dup = spy.mock.calls.filter((c) => String(c[0]).includes('same key'));
    spy.mockRestore();
    expect(dup).toEqual([]);
  });

  it('🔴 ว่างก็ยังอยู่ — หัวการ์ด 0 คน + แถว "ไม่มีคนที่ติดตามครบ"', () => {
    render(<FollowCompletedCard groups={[]} onChanged={() => {}} now={NOW} />);
    expect(screen.getByText('ติดตามครบ')).toBeTruthy();
    expect(screen.getByText('0 คน')).toBeTruthy();
    expect(screen.getByText('ไม่มีคนที่ติดตามครบ')).toBeTruthy();
  });

  it('ตามครบแล้ว ⇒ ขึ้นแถวพร้อมป้ายผล + ปุ่มย้าย/ไม่ย้าย · ยังมีนัดข้างหน้า ⇒ ไม่ขึ้น', () => {
    const later = row({
      id: 'b1',
      recipient_name: 'ยังตามอยู่',
      recipient_phone: '0811111111',
      scheduled_at: '2026-10-05T00:00:00Z',
      call_status: 'pending',
      call_outcome: null,
      called_at: null,
    });
    render(<FollowCompletedCard groups={groupsOf([...going, later])} onChanged={() => {}} now={NOW} />);
    const rows = within(screen.getByTestId('follow-completed-rows')).getAllByRole('row');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('นายทดสอบ ระบบ')).toBeTruthy();
    expect(within(rows[0]).getByText('ตอบว่าไป')).toBeTruthy();
    expect(within(rows[0]).getByRole('button', { name: 'ย้ายไปดูแลหลังเริ่มงาน' })).toBeTruthy();
    expect(within(rows[0]).getByRole('button', { name: 'ไม่ย้าย' })).toBeTruthy();
    expect(screen.getByText('1 คน')).toBeTruthy();
  });

  it('ตอบว่าไม่ไป ⇒ ไม่มีปุ่มย้าย เหลือแต่ไม่ย้าย', () => {
    render(
      <FollowCompletedCard groups={groupsOf([row({ id: 'n1', call_outcome: 'declined' })])} onChanged={() => {}} now={NOW} />,
    );
    expect(screen.getByText('ตอบว่าไม่ไป')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'ย้ายไปดูแลหลังเริ่มงาน' })).toBeNull();
    expect(screen.getByRole('button', { name: 'ไม่ย้าย' })).toBeTruthy();
  });

  it('ชุดถามความเป็นอยู่ ⇒ ปุ่มเป็น "ตามต่อ" / "ไม่ตามต่อ"', () => {
    render(
      <FollowCompletedCard groups={groupsOf([row({ id: 'c1', topic: AFTERCARE_TOPIC })])} onChanged={() => {}} now={NOW} />,
    );
    expect(screen.getByRole('button', { name: 'ตามต่อ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ไม่ตามต่อ' })).toBeTruthy();
  });

  it('🔴 ย้าย 2 รอบ (อีก 3 วัน AI + ต่ออีก 7 วัน คนโทร) ⇒ ลงทะเบียน → ตั้งแผนละวัน group เดียว → ปิดชุดเดิมเป็น "ไปแล้ว"', async () => {
    moveToAftercare.mockResolvedValue({});
    createFollowRounds.mockResolvedValue([]);
    completeFollowEntry.mockResolvedValue({});
    const onChanged = vi.fn();
    render(
      <FollowCompletedCard groups={groupsOf(going)} followTeam="replacement" onChanged={onChanged} now={NOW} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ย้ายไปดูแลหลังเริ่มงาน' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByTestId('move-round')).toHaveLength(1);
    // QA 5 ต.ค. 2569: วันสุดท้าย (30/9) ผ่านมาแล้ว ⇒ นับจากวันนี้ (1/10) ไม่ใช่ตกอดีต
    expect(within(dialog).getByTestId('move-base-day').textContent).toBe('ติดตามวันสุดท้าย 30/9/2569 · นับจากวันนี้ 1/10/2569');
    expect(within(dialog).getByText('4/10/2569')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /เพิ่มรอบ/ }));
    const rounds = within(dialog).getAllByTestId('move-round');
    expect(rounds).toHaveLength(2);
    // บวกต่อจากรอบแรก: 4 ต.ค. + 7 = 11 ต.ค.
    expect(within(rounds[1]).getByText('11/10/2569')).toBeTruthy();
    fireEvent.click(within(rounds[1]).getByRole('button', { name: 'คนโทร' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'ย้ายไปดูแลหลังเริ่มงาน' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(moveToAftercare).toHaveBeenCalledWith({
      phone: '0812345678',
      full_name: 'นายทดสอบ ระบบ',
      unit_name: 'หน่วยงาน ก',
      site_code: 'S1',
      from_follow_id: 'a2',
      source: 'follow_done',
    });
    expect(createFollowRounds).toHaveBeenCalledTimes(2);
    const [first, second] = createFollowRounds.mock.calls.map((c) => c[0] as Record<string, unknown>);
    expect(first).toMatchObject({
      topic: AFTERCARE_TOPIC,
      follow_team: 'replacement',
      recipient_phone: '0812345678',
      staff_phone: '0899999999',
      scheduled_at: '2026-10-04T00:00:00.000Z',
      call_round: 1,
      call_mode: 'ai',
      unit_name: 'หน่วยงาน ก',
    });
    expect(second).toMatchObject({ scheduled_at: '2026-10-11T00:00:00.000Z', call_round: 2, call_mode: 'manual' });
    expect(first.group_id).toBeTruthy();
    expect(second.group_id).toBe(first.group_id);
    expect(first.group_id).not.toBe('g-old');
    expect(completeFollowEntry.mock.calls).toEqual([
      ['a1', 'went'],
      ['a2', 'went'],
    ]);
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('🔴 ตั้งรอบล้มกลางทาง ⇒ ไม่ปิดชุดเดิม + บอกว่าตั้งไปแล้วกี่สาย', async () => {
    moveToAftercare.mockResolvedValue({});
    createFollowRounds.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('เส้นล่ม'));
    const onChanged = vi.fn();
    render(<FollowCompletedCard groups={groupsOf(going)} onChanged={onChanged} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: 'ย้ายไปดูแลหลังเริ่มงาน' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /เพิ่มรอบ/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'ย้ายไปดูแลหลังเริ่มงาน' }));
    expect(await within(dialog).findByRole('alert')).toHaveProperty(
      'textContent',
      'เส้นล่ม — ตั้งไปแล้ว 1 จาก 2 สาย',
    );
    expect(completeFollowEntry).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('จำนวนวันผิด ⇒ ไม่ยิงอะไรเลย + บอกรอบที่ผิด (วันฐานไม่ตกอดีตแล้ว — QA 5 ต.ค. 2569)', async () => {
    render(<FollowCompletedCard groups={groupsOf(going)} onChanged={() => {}} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: 'ย้ายไปดูแลหลังเริ่มงาน' }));
    const dialog = await screen.findByRole('dialog');
    // 30 ก.ย. ผ่านแล้ว ⇒ 1 วัน = 2 ต.ค. (เดิมได้ 1 ต.ค. 07:00 ซึ่งผ่านไปแล้ว)
    fireEvent.change(within(dialog).getByLabelText('จำนวนวันของรอบที่ 1'), { target: { value: '1' } });
    expect(within(dialog).getByText('2/10/2569')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('จำนวนวันของรอบที่ 1'), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ย้ายไปดูแลหลังเริ่มงาน' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(moveToAftercare).not.toHaveBeenCalled();
    expect(createFollowRounds).not.toHaveBeenCalled();
  });

  it('🔴 ไม่ย้าย → ติดตามต่ออีก 3 วัน คนโทร ⇒ วันละสาย 2–4 ต.ค. เรื่องเดิม ทีมเดิม · ไม่ปิดชุดเดิม', async () => {
    createFollowRounds.mockResolvedValue([]);
    const onChanged = vi.fn();
    render(<FollowCompletedCard groups={groupsOf(going)} followTeam="replacement" onChanged={onChanged} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: 'ไม่ย้าย' }));
    const dialog = await screen.findByRole('dialog');
    const box = within(within(dialog).getByTestId('continue-follow'));
    fireEvent.click(box.getByRole('button', { name: '3' }));
    fireEvent.click(box.getByRole('button', { name: 'คนโทร' }));
    // จบ 30 ก.ย. ⇒ วันถัดไป 1 ต.ค. แต่วันนี้ 1 ต.ค. แล้ว ⇒ เริ่มพรุ่งนี้
    expect(box.getByTestId('continue-preview').textContent).toBe('2/10/2569 – 4/10/2569 · 3 สาย');
    fireEvent.click(box.getByRole('button', { name: 'ติดตามต่อ' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(createFollowRounds).toHaveBeenCalledTimes(3);
    const sent = createFollowRounds.mock.calls.map((c) => c[0] as Record<string, unknown>);
    expect(sent.map((x) => [x.scheduled_at, x.call_round, x.call_mode])).toEqual([
      ['2026-10-02T00:00:00.000Z', 3, 'manual'],
      ['2026-10-03T00:00:00.000Z', 4, 'manual'],
      ['2026-10-04T00:00:00.000Z', 5, 'manual'],
    ]);
    expect(sent[0]).toMatchObject({
      topic: 'แจ้งเข้างาน',
      follow_team: 'replacement',
      recipient_phone: '0812345678',
      staff_phone: '0899999999',
    });
    expect(new Set(sent.map((x) => x.group_id)).size).toBe(1);
    expect(sent[0].group_id).not.toBe('g-old');
    expect(completeFollowEntry).not.toHaveBeenCalled();
    expect(moveToAftercare).not.toHaveBeenCalled();
    expect((await screen.findByRole('status')).textContent).toContain('ต่อ 3 วัน');
  });

  it('ติดตามต่อล้มกลางทาง ⇒ บอกว่าตั้งไปแล้วกี่สาย · ไม่ปิดป๊อป', async () => {
    createFollowRounds.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('เส้นล่ม'));
    const onChanged = vi.fn();
    render(<FollowCompletedCard groups={groupsOf(going)} onChanged={onChanged} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: 'ไม่ย้าย' }));
    const dialog = await screen.findByRole('dialog');
    const box = within(within(dialog).getByTestId('continue-follow'));
    fireEvent.click(box.getByRole('button', { name: '3' }));
    fireEvent.click(box.getByRole('button', { name: 'ติดตามต่อ' }));
    expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', 'เส้นล่ม — ตั้งไปแล้ว 1 จาก 3 สาย');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('ชุดดูแลหลังเริ่มงาน ⇒ ป๊อปไม่ตามต่อไม่มีทางติดตามต่อ (มีปุ่มตามต่อบนแถวแล้ว)', async () => {
    render(
      <FollowCompletedCard groups={groupsOf([row({ id: 'c1', topic: AFTERCARE_TOPIC })])} onChanged={() => {}} now={NOW} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ไม่ตามต่อ' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByTestId('continue-follow')).toBeNull();
  });

  it('ไม่ย้าย ⇒ เลือก "ลา" แล้วปิดทุกรอบที่ยังเปิดด้วยผลนั้น', async () => {
    completeFollowEntry.mockResolvedValue({});
    const onChanged = vi.fn();
    const rows = [...going, row({ id: 'x', cancelled: true, call_outcome: null })];
    render(<FollowCompletedCard groups={groupsOf(rows)} onChanged={onChanged} now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: 'ไม่ย้าย' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'ลา' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(completeFollowEntry.mock.calls).toEqual([
      // + ขอบเขตหยุดสายที่เหลือ (5 ต.ค. 2569 — ทุกผล = วันนั้น)
      ['a1', 'leave', undefined, 'day'],
      ['a2', 'leave', undefined, 'day'],
    ]);
    expect(moveToAftercare).not.toHaveBeenCalled();
  });
});
