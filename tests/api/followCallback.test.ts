// @vitest-environment node
/**
 * ═══ ตอบ AI ว่า "ขอให้โทรกลับ" → ระบบตั้งสายโทรกลับเอง (เจ้าของ 9 ต.ค. 2569 "ตั้งสายโทรกลับเองเลย") ═══
 *
 * เคสจริง: ศักดิ์ชาย 9 ต.ค. 06:30 "ขอให้ติดต่อกลับช่วงเวลาประมาณ 13:00 น." · Lumos ไม่ส่งเวลาเป็นช่อง (due_at = null)
 *
 * 🔴 ด่าน:
 * 1. อ่านเวลาจากข้อความสรุป (13:00 · 13.00 น. · อีก 30 นาที · บ่าย 2 โมง …) · ผ่านไปแล้ว = พรุ่งนี้
 * 2. ไม่บอกเวลา = อีก N ชม. ตามนโยบาย · ใกล้เกินไปดันออกไป 5 นาที
 * 3. โทรกลับต่อกันได้ไม่เกิน 2 ครั้ง (กันวนไม่จบ)
 * 4. สร้างสาย AI ใหม่ชุดเดิม + ส่งเข้าคิว · ผลซ้ำไม่สร้างซ้ำ · สายที่ยกเลิก/ลงผลเองแล้วไม่โทรกลับ
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CALLBACK_MAX_CHAIN,
  nextCallbackRef,
  parseCallbackTimeText,
  resolveCallbackAt,
} from '../../src/lib/followCallback';

// 9 ต.ค. 2569 06:32 เวลาไทย
const NOW = new Date('2026-10-08T23:32:00Z');
const bkk = (d: Date | null) => (d ? d.toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 16) : null);

describe('parseCallbackTimeText', () => {
  it('🔴 เคสศักดิ์ชาย: "ขอให้ติดต่อกลับช่วงเวลาประมาณ 13:00 น." = วันนี้ 13:00', () => {
    expect(bkk(parseCallbackTimeText('ผู้รับสายขอให้ติดต่อกลับช่วงเวลาประมาณ 13:00 น. ผู้แจ้งเตือนรับทราบ', NOW))).toBe('2026-10-09 13:00');
  });
  it('รูปแบบอื่น', () => {
    expect(bkk(parseCallbackTimeText('โทรมาใหม่ 13.30 น.', NOW))).toBe('2026-10-09 13:30');
    expect(bkk(parseCallbackTimeText('ขอให้โทรกลับอีก 30 นาที', NOW))).toBe('2026-10-09 07:02');
    expect(bkk(parseCallbackTimeText('สะดวกอีก 2 ชั่วโมง', NOW))).toBe('2026-10-09 08:32');
    expect(bkk(parseCallbackTimeText('โทรมาตอนบ่าย 2 โมง', NOW))).toBe('2026-10-09 14:00');
    expect(bkk(parseCallbackTimeText('พรุ่งนี้ 8 โมงเช้า', NOW))).toBe('2026-10-09 08:00');
    expect(bkk(parseCallbackTimeText('ตอนเที่ยง', NOW))).toBe('2026-10-09 12:00');
  });
  it('เวลาที่ผ่านไปแล้ววันนี้ = พรุ่งนี้เวลาเดียวกัน', () => {
    expect(bkk(parseCallbackTimeText('ขอให้โทรกลับ 06:00', NOW))).toBe('2026-10-10 06:00');
  });
  it('ไม่มีเวลา / จุดทศนิยม / วันที่ ⇒ null (ไม่เดา)', () => {
    expect(parseCallbackTimeText('ขอเลื่อนนัด กรุณาติดต่อกลับ', NOW)).toBeNull();
    expect(parseCallbackTimeText('ค่าแรง 1.50 บาท', NOW)).toBeNull();
    expect(parseCallbackTimeText(null, NOW)).toBeNull();
  });
});

describe('resolveCallbackAt', () => {
  it('ลำดับ: ช่องเวลา > due_at > ข้อความ > ค่าตามนโยบาย', () => {
    const iso = '2026-10-09T05:00:00Z';
    expect(resolveCallbackAt({ explicit: iso, dueAt: null, text: '13:00', now: NOW, defaultHours: 4 }).source).toBe('explicit');
    expect(resolveCallbackAt({ explicit: null, dueAt: iso, text: '13:00', now: NOW, defaultHours: 4 }).source).toBe('due_at');
    expect(resolveCallbackAt({ explicit: null, dueAt: null, text: '13:00', now: NOW, defaultHours: 4 }).source).toBe('text');
    const d = resolveCallbackAt({ explicit: null, dueAt: null, text: 'ขอเลื่อน', now: NOW, defaultHours: 4 });
    expect(d.source).toBe('default');
    expect(bkk(d.at)).toBe('2026-10-09 10:32');
  });
  it('เวลาในอดีตจากช่อง = ไม่ใช้ · ใกล้เกินไป = ดันออกไป 5 นาที', () => {
    expect(resolveCallbackAt({ explicit: '2026-10-01T00:00:00Z', now: NOW, defaultHours: 4 }).source).toBe('default');
    const soon = resolveCallbackAt({ text: 'อีก 1 นาที', now: NOW, defaultHours: 4 });
    expect(soon.at.getTime() - NOW.getTime()).toBe(5 * 60_000);
  });
});

describe('nextCallbackRef — กันวนไม่จบ', () => {
  it(`สายปกติ → ครั้งที่ 1 · โทรกลับแล้วขออีก → ครั้งที่ 2 · เกิน ${CALLBACK_MAX_CHAIN} = ไม่ตั้งอีก`, () => {
    expect(nextCallbackRef({ id: 'a', source_ref: 'irecruit-replace:SQT-1:lead60:x' })).toEqual({ ref: 'callback:a:1', depth: 1 });
    expect(nextCallbackRef({ id: 'b', source_ref: 'callback:a:1' })).toEqual({ ref: 'callback:a:2', depth: 2 });
    expect(nextCallbackRef({ id: 'c', source_ref: 'callback:a:2' })).toBeNull();
  });
});

// ── ตัวสร้างสาย (ฝั่ง API) ──
const dbQuery = vi.fn();
const enqueueFollowReminder = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a), isPgUndefinedTable: () => false }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({ enqueueFollowReminder: (...a: unknown[]) => enqueueFollowReminder(...a) }));
vi.mock('../../api/_lib/followStaffName.js', () => ({ staffNameOfPhone: async () => 'อ๋อม' }));
vi.mock('../../api/_lib/callFollowupPolicyStore.js', () => ({ getCallFollowupPolicy: async () => ({ rescheduleDefaultHours: 4 }) }));
vi.mock('../../api/_lib/callFollowup.js', () => ({ pickRequestedCallbackAt: () => null }));
vi.mock('../../api/_lib/lumosDispatchMode.js', () => ({ isAutoDispatchEnabled: async () => true }));

const { scheduleFollowCallbackFromResult } = await import('../../api/_lib/followCallback.js');

const SRC = {
  id: 'src-1',
  recipient_name: 'ศักดิ์ชาย',
  recipient_phone: '+66920000000',
  topic: 'ติดตามส่งคนแทน',
  note: 'เข้างาน 07:30 น.',
  staff_phone: '0901978515',
  unit_name: 'หน่วยงาน',
  source_ref: 'irecruit-replace:SQT-1:lead60:x',
  cancelled_at: null,
  completed_at: null,
  staff_call_outcome: null,
};
const RESULT = {
  client_contact_id: 'follow-plan-1',
  step_position: 0,
  outcome: 'reschedule_requested',
  status: 'completed',
  summary: 'ผู้รับสายขอให้ติดต่อกลับช่วงเวลาประมาณ 13:00 น.',
  next_action: { type: 'callback_requested', due_at: null },
};

function stub(opts: { src?: typeof SRC | null; inserted?: boolean }) {
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) => {
    if (/select person_ref from/.test(sql)) return Promise.resolve({ rows: [{ person_ref: 'follow-src-1' }] });
    if (/select id::text as id, recipient_name/.test(sql)) return Promise.resolve({ rows: opts.src === null ? [] : [opts.src ?? SRC] });
    if (/insert into/.test(sql)) return Promise.resolve({ rows: opts.inserted === false ? [] : [{ id: 'cb-1', call_round: 2 }] });
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  enqueueFollowReminder.mockReset().mockResolvedValue('queued');
});

describe('scheduleFollowCallbackFromResult', () => {
  it('🔴 เคสศักดิ์ชาย ⇒ สร้างสาย AI 13:00 ชุดเดิม + ส่งเข้าคิว (คิวรวมแผนเบอร์เดียววันเดียวให้เอง)', async () => {
    stub({});
    const out = await scheduleFollowCallbackFromResult(RESULT, NOW);
    expect(out.created).toBe('cb-1');
    expect(bkk(new Date(String(out.at)))).toBe('2026-10-09 13:00');
    const insert = dbQuery.mock.calls.find((c) => /insert into/.test(String(c[0])));
    expect(String(insert?.[0])).toMatch(/'ai', 'AI · ขอให้โทรกลับ'/);
    expect(String(insert?.[0])).toMatch(/on conflict \(source_ref\)/);
    expect(insert?.[1]).toEqual(['src-1', out.at, 'callback:src-1:1']);
    expect(enqueueFollowReminder).toHaveBeenCalledTimes(1);
    expect(enqueueFollowReminder.mock.calls[0][0]).toMatchObject({ id: 'cb-1', recipient_phone: SRC.recipient_phone, staffName: 'อ๋อม' });
  });

  it('ผลซ้ำ (ตั้งไว้แล้ว) ⇒ ไม่ส่งซ้ำ', async () => {
    stub({ inserted: false });
    const out = await scheduleFollowCallbackFromResult(RESULT, NOW);
    expect(out.created).toBeNull();
    expect(enqueueFollowReminder).not.toHaveBeenCalled();
  });

  it('🔴 สายที่ยกเลิก / ลงผลเองแล้ว ⇒ ไม่โทรกลับ', async () => {
    stub({ src: { ...SRC, cancelled_at: '2026-10-09T00:00:00Z' } as unknown as typeof SRC });
    expect((await scheduleFollowCallbackFromResult(RESULT, NOW)).created).toBeNull();
    stub({ src: { ...SRC, staff_call_outcome: 'confirmed' } as unknown as typeof SRC });
    expect((await scheduleFollowCallbackFromResult(RESULT, NOW)).created).toBeNull();
    expect(enqueueFollowReminder).not.toHaveBeenCalled();
  });

  it('โทรกลับครบเพดานแล้ว ⇒ ไม่ตั้งอีก', async () => {
    stub({ src: { ...SRC, source_ref: 'callback:root:2' } });
    expect((await scheduleFollowCallbackFromResult(RESULT, NOW)).created).toBeNull();
  });

  it('ผลอื่น / ไม่ใช่งานติดตาม ⇒ ไม่ทำอะไร', async () => {
    stub({});
    expect((await scheduleFollowCallbackFromResult({ ...RESULT, outcome: 'confirmed' }, NOW)).created).toBeNull();
    expect((await scheduleFollowCallbackFromResult({ ...RESULT, client_contact_id: 'app-1' }, NOW)).created).toBeNull();
    expect(dbQuery).not.toHaveBeenCalled();
  });
});
