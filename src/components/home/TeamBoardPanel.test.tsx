/**
 * บอร์ดทีมหน้าแรก — **สรุปผลโทรต้องอ่านได้เลย ไม่ต้องกดเข้าไปดู**
 * (เจ้าของสั่ง 7 ก.ย. 2569: *"บอกด้วยว่าโทรไปแล้วเท่าไหร่ สนใจลงงานอะไรยังไง
 *  ไม่เอาแค่คำว่า ผลการโทร แบบนั้นก็ต้องกดเข้าไปเพื่อดูอีก"*)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ไม่ส่ง `callDigest` (= v1) ⇒ ได้ปุ่มเดิม "ผลโทรวันนี้ … เปิดดูรายชื่อ" เป๊ะ
 * 2. ส่ง `callDigest` (= v2) ⇒ เห็นยอดโทร · ผลแยก 4 กล่อง · ชื่อคนที่สนใจ + งานที่สนใจ
 * 3. ยอดต้องเป็น **ยอดจริง** (137) ไม่ใช่ความยาวลิสต์ที่ SQL ตัดที่ 50
 * 4. ป๊อปเดิมยังเปิดได้ (ห้ามเอาออก)
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import TeamBoardPanel from './TeamBoardPanel';
import { buildCallDigest } from '@/lib/homeCallDigest';
import type { FlowFollowUpItem, FlowSummary } from '@/lib/flowSummaryApi';

const person = (n: number, over: Partial<FlowFollowUpItem> = {}): FlowFollowUpItem => ({
  job_ref: `job-${n}`,
  request_no: `OPL69071${n}`,
  person_ref: `card-${n}`,
  channel: 'lumos',
  name: `ผู้สมัคร ${n}`,
  phone: '0800000000',
  summary: null,
  outcome: 'confirmed',
  updated_at: '2026-09-07T03:00:00.000Z',
  job_position: `ตำแหน่ง ${n}`,
  job_unit: `หน่วยงาน ${n}`,
  ...over,
});

const flow = {
  lumos: { outcomes_month: { confirmed: 12, declined: 4, no_answer: 9 } },
  call_boxes: {
    confirmed: Array.from({ length: 50 }, (_, i) => person(i + 1)),
    retry: [],
    needs_human: [],
    declined: [],
  },
  call_box_counts: { confirmed: 137, retry: 6, needs_human: 3, declined: 21 },
} as unknown as FlowSummary;

const floor = {
  aiCalls: { pending: 1, waitingResult: 2, staleOverDay: 0, resultToday: 8 },
  follow: { today: 0, pastDue: 0, upcoming: 0 },
  intake: { untouched: 0, claimedIdle: 0 },
  aftercare: { count: 0 },
} as never;

const renderPanel = (props: Record<string, unknown>) =>
  render(
    <MemoryRouter>
      <TeamBoardPanel team={null} floor={floor} {...props} />
    </MemoryRouter>,
  );

beforeEach(cleanup);

describe('ของเดิม (v1) — ไม่ส่ง callDigest', () => {
  it('ยังเป็นปุ่มเดียวที่ต้องกดเข้าไปดู', () => {
    renderPanel({ onOpenCallResults: () => {} });
    expect(screen.getByText(/ผลโทรวันนี้ 8 สาย/)).toBeTruthy();
    expect(screen.queryByText('สนใจลงงาน · 137 ราย')).toBeNull();
  });
});

describe('โฉมใหม่ (v2) — สรุปผลโทรอยู่บนกล่องทีมเลย', () => {
  const digest = buildCallDigest(flow)!;

  it('บอก "โทรไปแล้วเท่าไหร่" ทั้งวันนี้และเดือนนี้', () => {
    renderPanel({ callDigest: digest });
    expect(screen.getByText('ผลกลับมาวันนี้')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('ผลกลับมาเดือนนี้')).toBeTruthy();
    // 12 + 4 + 9 = 25 ผลกลับทุกแบบ
    expect(screen.getByText('25')).toBeTruthy();
  });

  it('ผลแยกเป็นอะไรบ้าง อ่านได้ครบ 4 กล่องโดยไม่ต้องกด', () => {
    renderPanel({ callDigest: digest });
    for (const label of [
      'สนใจงาน',
      'ไม่สะดวก — รอ AI โทรซ้ำ',
      'ไม่สะดวก — ต้องเร่งจัดการ',
      'ไม่สนใจงาน',
    ]) {
      expect(screen.getByText(label), label).toBeTruthy();
    }
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('21')).toBeTruthy();
  });

  it('🔴 ยอด "สนใจงาน" เป็นยอดจริง 137 ไม่ใช่ 50 ที่ลิสต์ถูกตัด', () => {
    renderPanel({ callDigest: digest });
    expect(screen.getByText('สนใจลงงาน · 137 ราย')).toBeTruthy();
    expect(screen.getByText('137')).toBeTruthy();
    // โชว์ชื่อได้ 4 ⇒ เหลืออีก 133 (ไม่ใช่ 46)
    expect(screen.getByText('…และอีก 133 ราย')).toBeTruthy();
  });

  it('คนที่สนใจ = ชื่อคน + งานที่สนใจ (ตำแหน่ง · หน่วยงาน) อยู่บนกล่องเลย', () => {
    renderPanel({ callDigest: digest });
    expect(screen.getByText('ผู้สมัคร 1')).toBeTruthy();
    expect(screen.getByText('ตำแหน่ง 1 · หน่วยงาน 1')).toBeTruthy();
    expect(screen.getByText('OPL690711')).toBeTruthy();
  });

  it('กดชื่อ → เปิดรายละเอียดคนคนนั้น (ไม่ต้องผ่านป๊อปกลาง)', () => {
    const onOpenPerson = vi.fn();
    renderPanel({ callDigest: digest, onOpenPerson });
    fireEvent.click(screen.getByText('ผู้สมัคร 2').closest('button')!);
    expect(onOpenPerson).toHaveBeenCalledTimes(1);
    expect(onOpenPerson.mock.calls[0][0].person_ref).toBe('card-2');
  });

  it('🔴 ป๊อปเดิม (มีปุ่มจองตัว) ยังเปิดได้ — ห้ามหาย', () => {
    const onOpenCallResults = vi.fn();
    renderPanel({ callDigest: digest, onOpenCallResults });
    fireEvent.click(screen.getByText(/เปิดดูรายชื่อทั้ง 4 กล่อง/));
    expect(onOpenCallResults).toHaveBeenCalledTimes(1);
  });

  it('ยังไม่มีใครสนใจ ⇒ บอกตรง ๆ ไม่ใช่กล่องว่าง', () => {
    const empty = buildCallDigest({
      ...flow,
      call_boxes: { confirmed: [], retry: [], needs_human: [], declined: [] },
      call_box_counts: { confirmed: 0, retry: 0, needs_human: 0, declined: 0 },
    } as unknown as FlowSummary)!;
    renderPanel({ callDigest: empty });
    expect(screen.getByText('ยังไม่มีใครตอบว่าสนใจ')).toBeTruthy();
  });

  it('ยังไม่รู้ผลโทรวันนี้ (floor ยังไม่มา) ⇒ ขีด ห้ามโชว์ 0 ปลอม', () => {
    render(
      <MemoryRouter>
        <TeamBoardPanel team={null} floor={null} callDigest={digest} />
      </MemoryRouter>,
    );
    expect(screen.getByText('ผลกลับมาวันนี้')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
