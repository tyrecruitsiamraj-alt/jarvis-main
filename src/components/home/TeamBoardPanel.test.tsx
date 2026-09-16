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
import type { LaneCounts } from '@/lib/officeTeam';
import type { OfficeTeamResponse } from '@/lib/officeTeamApi';

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

/**
 * 🔴 รอบแก้เลขคิว Lumos 7 ก.ย. 2569 — สองจุดที่เจ้าของสั่งให้ "บอกความจริงให้ครบ"
 * 1. รอโทรที่ค้างเกิน 2 วัน ต้องมีธงกำกับ ไม่ใช่จมอยู่ในเลขรวม
 * 2. Success Rate ต้องบอกช่วงวันที่ของสายที่นับ ("7 วันล่าสุด" ตอบไม่ได้ว่าวันไหน)
 */
const lane = (over: Partial<LaneCounts> = {}): LaneCounts => ({
  total: 0,
  pending: 0,
  stalePending: 0,
  waiting: 0,
  done: 0,
  cancelled: 0,
  results: null,
  ...over,
});

const teamWithLanes = (follow: LaneCounts): OfficeTeamResponse =>
  ({
    generated_at: '2026-09-07T03:00:00.000Z',
    open_total: 3,
    teams: {
      online: null,
      recruit: null,
      lumos: { public: lane(), match: lane(), follow },
      errors: {},
    },
  }) as OfficeTeamResponse;

describe('ธงงานค้างของ "รอโทร"', () => {
  it('รอโทรค้างเกิน 2 วัน ⇒ มีแถวกำกับพร้อมจำนวน', () => {
    renderPanel({ team: teamWithLanes(lane({ total: 22, pending: 11, stalePending: 11, done: 11 })) });
    expect(screen.getByText('ค้างเกิน 2 วัน')).toBeTruthy();
    // 11 โผล่ทั้งแถว "รอโทร" และแถวธงค้าง
    expect(screen.getAllByText('11').length).toBeGreaterThanOrEqual(2);
  });

  it('ไม่มีของค้าง ⇒ ไม่ต้องมีบรรทัดขยะ 0 ทุกวัน', () => {
    renderPanel({ team: teamWithLanes(lane({ total: 40, done: 40 })) });
    expect(screen.queryByText('ค้างเกิน 2 วัน')).toBeNull();
  });
});

describe('Success Rate ต้องบอกช่วงวันที่ของสายที่นับ', () => {
  it('มีช่วงวันที่ ⇒ เขียนกำกับใต้ตัวเลข', () => {
    renderPanel({ successRate: { pct: 42, connected: 12, fromYmd: '2026-09-01', toYmd: '2026-09-07' } });
    // 🔴 ฐานเปลี่ยนเป็น "สายที่ได้คุยจริง" 15 ก.ย. 2569 — ตัวหารเดียวกับหน้าติดตาม
    expect(screen.getByText('จากสายที่ได้คุยจริง 12 สาย')).toBeTruthy();
    expect(screen.getByText(/นับจากสายที่ส่งเข้า .*1 ก\.ย\..*7 ก\.ย\./)).toBeTruthy();
  });

  it('ไม่รู้ช่วง ⇒ ไม่เดาให้ (ไม่มีบรรทัดช่วงวันที่)', () => {
    renderPanel({ successRate: { pct: 42, connected: 12 } });
    expect(screen.queryByText(/นับจากสายที่ส่งเข้า/)).toBeNull();
  });
});

/**
 * ═══ ผลจริงใต้ "รู้ผลแล้ว" (เจ้าของสั่ง 16 ก.ย. 2569: *"เอาผลละเอียดมาดี้"*) ═══
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. เลนติดตามพูดว่า ไป/ไม่ไป · เลนอื่นพูดว่า สนใจ/ไม่สนใจ (คำถามคนละคำถาม)
 * 2. ถังที่เป็น 0 ห้ามขึ้นบรรทัด (กติกาเดียวกับแถว "ยกเลิก")
 * 3. ยังไม่มีผลกลับเลย ⇒ ไม่วาดแถวผล ห้ามวาด 0 ปลอม
 */
describe('ผลจริงของสายที่คุยจบแล้ว', () => {
  const results = (over: Partial<NonNullable<LaneCounts['results']>> = {}) => ({
    yes: 0,
    no: 0,
    notYet: 0,
    unclear: 0,
    noPickup: 0,
    wrongPerson: 0,
    silent: 0,
    ...over,
  });

  it('🔴 เลน Follow ใช้คำว่า ไป / ไม่ไป', () => {
    renderPanel({
      team: teamWithLanes(lane({ total: 48, done: 48, results: results({ yes: 40, no: 3 }) })),
    });
    expect(screen.getByText('บอกว่าไป')).toBeTruthy();
    expect(screen.getByText('บอกว่าไม่ไป')).toBeTruthy();
    expect(screen.queryByText('ตอบว่าสนใจ')).toBeNull();
  });

  it('ถังที่เป็น 0 ไม่ขึ้นบรรทัด', () => {
    renderPanel({
      team: teamWithLanes(lane({ total: 10, done: 10, results: results({ yes: 10 }) })),
    });
    expect(screen.queryByText('บอกว่าไม่ไป')).toBeNull();
    expect(screen.queryByText('ยังเตรียมตัวอยู่')).toBeNull();
  });

  it('🔴 ยังไม่มีผลกลับ ⇒ ไม่วาดแถวผลเลย (ห้าม 0 ปลอม)', () => {
    renderPanel({ team: teamWithLanes(lane({ total: 5, pending: 5, results: null })) });
    expect(screen.queryByText('บอกว่าไป')).toBeNull();
    expect(screen.queryByText('ไม่รับสาย')).toBeNull();
  });
});
