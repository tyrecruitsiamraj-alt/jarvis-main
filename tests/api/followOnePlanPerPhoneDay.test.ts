// @vitest-environment node
/**
 * ═══ 1 เบอร์ 1 วัน = 1 แผน (เจ้าของ 9 ต.ค. 2569 "ถ้ามันผิดที่เราก็ต้องแก้ที่เรา ไม่แก้ชุ่ยๆ") ═══
 *
 * เคสจริง 9 ต.ค. 2569: สลับสายส่งคนแทนเป็น AI ทีละสาย ⇒ เบอร์เดียวมี 2 แผนในวันเดียว (07:00 · 07:45)
 * ผลกลับแค่แผนเดียว 7 ใน 10 เบอร์ (อาการเดียวกับ 11 ก.ย. 2569 "1 รอบ = 1 แผน แผนหลังทับแผนแรก")
 *
 * 🔴 ด่าน:
 * 1. แบ่งแผนด้วย เบอร์ + วัน (เดิมแบ่งแค่วัน — สายของ 2 คนวันเดียวกันรวมแผนเดียวไปโทรเบอร์หัวขบวน)
 * 2. แก้ทั้งชุด (`replanFollowSetWithLumos`) ดึงสาย AI ที่รอโทรของเบอร์เดียวกันวันเดียวกันเข้ามารวมเสมอ
 * 3. ส่งใหม่ (`resyncFollowPlanWithLumos`) เจอแผนอื่นวันเดียวกัน ⇒ รวมเป็นแผนเดียว ไม่ส่งแผนที่สอง
 * 4. สร้างสายใหม่ (`enqueueFollowReminder`) ที่เบอร์นี้วันนี้มีแผนอยู่แล้ว ⇒ รวม ไม่ส่งแผนแยก
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const pushReminders = vi.fn();
const cancelPushedReminder = vi.fn();
const getLumosPushConfig = vi.fn(() => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }) as unknown);

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: () => false,
}));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushReminders: (...a: unknown[]) => pushReminders(...a),
  cancelPushedReminder: (...a: unknown[]) => cancelPushedReminder(...a),
  getLumosPushConfig: () => getLumosPushConfig(),
  pushInterviews: vi.fn(),
  cancelPushedInterview: vi.fn(),
  getEventStatus: vi.fn(),
}));

// ด่านของ insertQueueItems / บท — ไม่เกี่ยวกับเรื่องนี้ ปิดให้ผ่าน
vi.mock('../../api/_lib/candidateCallHolds.js', () => ({ listHeldPhones: async () => new Set<string>() }));
vi.mock('../../api/_lib/callFollowup.js', () => ({
  listSuppressedPhones: async () => new Set<string>(),
  applyCallFollowupToQueueRow: vi.fn(),
}));
vi.mock('../../api/_lib/callScriptStore.js', () => ({ ensureCallScriptsFresh: async () => undefined }));
vi.mock('../../api/_lib/interviewAdminPhone.js', () => ({ resolveInterviewAdminPhone: async () => null }));

const { enqueueFollowReminder, groupFollowPlans, replanFollowSetWithLumos, resyncFollowPlanWithLumos } = await import(
  '../../api/_lib/lumosDispatch.js'
);

const P1 = '+66812345678';
const P2 = '+66898765432';
const day = (offsetDays: number, hh: number, mm = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  const ymd = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return new Date(`${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`);
};
const row = (id: string, phone: string, at: Date) => ({
  id,
  recipient_name: `คน ${id}`,
  recipient_phone: phone,
  topic: 'ติดตามส่งคนแทน',
  note: 'เข้างาน 08:00 น.',
  staff_phone: null,
  unit_name: 'หน่วยงานทดสอบ',
  scheduled_at: at.toISOString(),
  call_times: null,
  call_round: 1,
});

/** ตัวปลอมฐาน: แยกตามรูป SQL ของแต่ละขั้น */
function stub(opts: {
  mates?: string[];
  oldRefs?: string[];
  planRef?: string | null;
  members: ReturnType<typeof row>[];
  /** แถวสมาชิกของ resync (แผนเดิม) — ถ้าไม่ส่ง ใช้ members */
  resyncMembers?: ReturnType<typeof row>[];
}) {
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string, params?: unknown[]) => {
    if (/select distinct m\.id::text as id/i.test(sql)) return Promise.resolve({ rows: (opts.mates ?? []).map((id) => ({ id })) });
    if (/insert into .*lumos_dispatch_queue/i.test(sql)) return Promise.resolve({ rows: [{ id: 1 }] });
    if (/select distinct coalesce\(plan_ref, person_ref\) as ref/i.test(sql)) {
      return Promise.resolve({ rows: (opts.oldRefs ?? []).map((ref) => ({ ref })) });
    }
    if (/select plan_ref from .*lumos_dispatch_queue/i.test(sql)) return Promise.resolve({ rows: [{ plan_ref: opts.planRef ?? null }] });
    // resync: สมาชิกแผนเดิม (join คิว + plan_ref = $1)
    if (/from .*follow_entries f\s+join/i.test(sql) && /select f\.id/i.test(sql)) {
      return Promise.resolve({ rows: opts.resyncMembers ?? opts.members });
    }
    // replan: สมาชิกชุด (f.id = any($1) …) — คืนเฉพาะ id ที่ถูกขอ (พิสูจน์ว่าตัวขยายชุดส่ง id เพื่อนเข้าไปจริง)
    if (/from .*follow_entries f/i.test(sql) && /select f\.id/i.test(sql)) {
      const ids = (params?.[0] as string[]) ?? [];
      return Promise.resolve({ rows: opts.members.filter((m) => ids.includes(m.id)) });
    }
    if (/select person_ref from .*lumos_dispatch_queue/i.test(sql)) {
      const refs = (params?.[0] as string[]) ?? [];
      return Promise.resolve({ rows: refs.map((person_ref) => ({ person_ref })) });
    }
    return Promise.resolve({ rows: [] });
  });
}

type PushedRecord = { recipient_phone: string; steps: Array<{ scheduled_at: string }> };
const pushedRecords = (): PushedRecord[] =>
  pushReminders.mock.calls.map((c) => {
    const rec = c[0] as PushedRecord | { reminders: PushedRecord[] } | PushedRecord[];
    if (Array.isArray(rec)) return rec[0];
    return 'reminders' in rec ? rec.reminders[0] : rec;
  });

beforeEach(() => {
  pushReminders.mockReset().mockResolvedValue({ results: [{ event_id: 'evt' }] });
  cancelPushedReminder.mockReset().mockResolvedValue({ accepted: 1 });
  getLumosPushConfig.mockReturnValue({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' });
});

describe('groupFollowPlans — แผน = เบอร์ + วัน', () => {
  it('เบอร์เดียววันเดียว = แผนเดียว เรียงเวลา · หัวขบวน = สายแรก', () => {
    const plans = groupFollowPlans([
      { id: 'b', recipient_phone: P1, scheduled_at: day(1, 7, 45) },
      { id: 'a', recipient_phone: P1, scheduled_at: day(1, 7, 0) },
    ]);
    expect(plans.map((p) => p.map((e) => e.id))).toEqual([['a', 'b']]);
  });

  it('🔴 คนละเบอร์วันเดียวกัน = คนละแผน (เดิมรวมแผนเดียวไปโทรเบอร์หัวขบวน)', () => {
    const plans = groupFollowPlans([
      { id: 'a', recipient_phone: P1, scheduled_at: day(1, 7, 0) },
      { id: 'x', recipient_phone: P2, scheduled_at: day(1, 7, 30) },
    ]);
    expect(plans).toHaveLength(2);
    expect(plans.every((p) => new Set(p.map((e) => e.recipient_phone)).size === 1)).toBe(true);
  });

  it('เบอร์เดียวคนละวัน = แผนละวัน', () => {
    const plans = groupFollowPlans([
      { id: 'a', recipient_phone: P1, scheduled_at: day(1, 7, 0) },
      { id: 'c', recipient_phone: P1, scheduled_at: day(2, 7, 0) },
    ]);
    expect(plans.map((p) => p.map((e) => e.id))).toEqual([['a'], ['c']]);
  });
});

describe('replanFollowSetWithLumos — รวมทุกสายของเบอร์นั้นวันนั้น', () => {
  it('🔴 แก้สายเดียว (07:00) ⇒ สาย 07:45 ของเบอร์เดียวกันในแผนอื่นถูกดึงมารวม · ยกเลิกทั้ง 2 แผนเดิม · ส่งแผนเดียว 2 สาย', async () => {
    const members = [row('a', P1, day(1, 7, 0)), row('b', P1, day(1, 7, 45))];
    stub({ mates: ['a', 'b'], oldRefs: ['follow-a', 'follow-b'], members });
    const out = await replanFollowSetWithLumos({ memberIds: ['a'], cancelledIds: [], resolveStaffName: async () => null });
    expect(cancelPushedReminder.mock.calls.map((c) => c[0]).sort()).toEqual(['follow-a', 'follow-b']);
    expect(out).toMatchObject({ rounds: 2, plans: 1, pushedPlans: 1 });
    expect(pushedRecords()[0].steps).toHaveLength(2);
  });

  it('🔴 สองคนวันเดียวกันในชุดเดียว ⇒ 2 แผน แต่ละแผนโทรเบอร์ของตัวเอง', async () => {
    const members = [row('a', P1, day(1, 7, 0)), row('x', P2, day(1, 7, 30))];
    stub({ mates: [], oldRefs: ['follow-a', 'follow-x'], members });
    const out = await replanFollowSetWithLumos({ memberIds: ['a', 'x'], cancelledIds: [], resolveStaffName: async () => null });
    expect(out).toMatchObject({ plans: 2, pushedPlans: 2 });
    expect(pushedRecords().map((r) => r.recipient_phone).sort()).toEqual([P1, P2].sort());
    for (const r of pushedRecords()) expect(r.steps).toHaveLength(1);
  });

  it('สายที่ถูกยกเลิก/สลับเป็นคนโทรไม่ถูกดึงกลับเข้าแผน แม้ตัวหาเพื่อนคืนมา', async () => {
    const members = [row('a', P1, day(1, 7, 0)), row('b', P1, day(1, 7, 45))];
    stub({ mates: ['a', 'b'], oldRefs: ['follow-a'], members });
    const out = await replanFollowSetWithLumos({ memberIds: [], cancelledIds: ['a'], resolveStaffName: async () => null });
    expect(out).toMatchObject({ rounds: 1, plans: 1 });
    expect(pushedRecords()[0].steps).toHaveLength(1);
  });
});

describe('resyncFollowPlanWithLumos — เจอแผนอื่นวันเดียวกันต้องรวม', () => {
  it('🔴 มีสายเบอร์เดียวกันวันเดียวกันในแผนอื่น ⇒ ยกเลิกทั้งสองแผน ส่งแผนเดียว', async () => {
    const a = row('a', P1, day(1, 7, 0));
    const b = row('b', P1, day(1, 7, 45));
    stub({ mates: ['a', 'b'], oldRefs: ['follow-a', 'follow-b'], planRef: 'follow-a', members: [a, b], resyncMembers: [a] });
    const out = await resyncFollowPlanWithLumos('a', async () => null);
    expect(out).toMatchObject({ rounds: 2, pushed: true });
    expect(pushReminders).toHaveBeenCalledTimes(1);
    expect(pushedRecords()[0].steps).toHaveLength(2);
    expect(cancelPushedReminder.mock.calls.map((c) => c[0]).sort()).toEqual(['follow-a', 'follow-b']);
  });

  it('ไม่มีแผนอื่น ⇒ ทำแบบเดิม (ยกเลิกแผนตัวเอง แล้วส่งใหม่)', async () => {
    const a = row('a', P1, day(1, 7, 0));
    stub({ mates: ['a'], planRef: 'follow-a', members: [a] });
    const out = await resyncFollowPlanWithLumos('a', async () => null);
    expect(out).toMatchObject({ rounds: 1, cancelled: true, pushed: true });
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-a');
    expect(pushReminders).toHaveBeenCalledTimes(1);
  });
});

describe('enqueueFollowReminder — สร้างสายใหม่ที่เบอร์นี้วันนี้มีแผนอยู่แล้ว', () => {
  const input = (id: string, phone: string, at: Date) => ({
    id,
    recipient_name: `คน ${id}`,
    recipient_phone: phone,
    topic: 'ติดตามส่งคนแทน',
    note: 'เข้างาน 08:00 น.',
    staffPhone: null,
    staffName: null,
    unitName: 'หน่วยงานทดสอบ',
    scheduled_at: at,
    callTimes: null,
    callRound: 2,
  });

  it('🔴 เบอร์นี้วันนี้มีสาย 07:00 อยู่แล้ว ⇒ สาย 07:45 ที่เพิ่มใหม่รวมเป็นแผนเดียว (ไม่ส่งแผนที่สอง)', async () => {
    const a = row('a', P1, day(1, 7, 0));
    const n = row('n', P1, day(1, 7, 45));
    stub({ mates: ['a', 'n'], oldRefs: ['follow-a', 'follow-n'], members: [a, n] });
    const st = await enqueueFollowReminder(input('n', P1, day(1, 7, 45)));
    expect(st).toBe('queued');
    await vi.waitFor(() => expect(pushReminders).toHaveBeenCalledTimes(1));
    // ไม่มีการส่งแผนของสายใหม่แยก (คีย์ follow-n เปล่า ๆ) — ส่งแผนรวมที่หัวขบวน 07:00
    const keys = pushReminders.mock.calls.map((c) => String(c[1]));
    expect(keys.some((k) => k === 'follow-n')).toBe(false);
    expect(keys[0].startsWith('follow-a:v')).toBe(true);
    expect(pushedRecords()[0].steps).toHaveLength(2);
  });

  it('ไม่มีสายอื่นของเบอร์นี้วันนี้ ⇒ ส่งแผนของตัวเองตามเดิม', async () => {
    const n = row('n', P1, day(1, 7, 45));
    stub({ mates: ['n'], members: [n] });
    await enqueueFollowReminder(input('n', P1, day(1, 7, 45)));
    await vi.waitFor(() => expect(pushReminders).toHaveBeenCalledTimes(1));
    expect(String(pushReminders.mock.calls[0][1])).toBe('follow-n');
    expect(cancelPushedReminder).not.toHaveBeenCalled();
  });
});

describe('ตัวตรวจทุกนาที (followPlanMerge) — หาเบอร์ที่มีหลายแผนในวันเดียว', async () => {
  const { splitPlansSql } = await import('../../api/_lib/followPlanMerge.js');
  const sql = splitPlansSql();
  it('กลุ่ม = เบอร์ + วัน (ไทย) · มากกว่า 1 แผน · เฉพาะ AI ที่รอโทร · ไม่แตะสายใกล้ถึงเวลา/เพิ่งแก้', () => {
    expect(sql).toMatch(/group by f\.recipient_phone, \(f\.scheduled_at at time zone 'Asia\/Bangkok'\)::date/);
    expect(sql).toMatch(/count\(distinct coalesce\(q\.plan_ref, q\.person_ref\)\) > 1/);
    expect(sql).toMatch(/coalesce\(f\.call_mode, 'ai'\) = 'ai'/);
    expect(sql).toMatch(/q\.status = 'pending'/);
    expect(sql).toMatch(/now\(\) \+ interval '3 minutes'/);
    expect(sql).toMatch(/max\(q\.updated_at\) < now\(\) - interval '1 minute'/);
  });
});
