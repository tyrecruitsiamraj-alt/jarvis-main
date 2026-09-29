// @vitest-environment node
/**
 * ตัวส่งซ้ำสายที่ส่งไม่ถึง Lumos — ใบสมัคร + เลน Match (เจ้าของเคาะ 28 ก.ย. 2569) — คุมพฤติกรรมจริง
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ส่งซ้ำด้วย Idempotency-Key เดิม (`interview-<id คิว>`) ⇒ Lumos ตัดซ้ำ ไม่เกิดสายที่สอง
 * 2. ช่วงห้ามโทร ⇒ ไม่ยิงเลย · ยิงเมื่อไหร่เวลานัดต้องพ้นช่วงห้ามโทรเสมอ
 * 3. มีคนรับไป/บันทึกผลติดต่อ/Lead/เบอร์ถูกพัก/เบอร์มีคนถือ ⇒ ไม่ยิง + ปิดฝั่ง AI (fail-safe ไปทางไม่โทร)
 * 4. อ่านรายการพักเบอร์ไม่ได้ ⇒ รอบนี้ไม่ยิงใคร
 * 5. เกิน 24 ชม. ⇒ เลิกส่ง AI + `needs_human` (ขึ้นกล่องต้องเร่งจัดการ)
 * 6. ไม่มีคีย์ push (เครื่อง dev) ⇒ ไม่แตะฐานเลย
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const pushInterviews = vi.fn();
const pushReminders = vi.fn();
const getLumosPushConfig = vi.fn(() => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }) as unknown);
const listSuppressedPhones = vi.fn(async () => new Set<string>());
const listHeldPhones = vi.fn(async () => new Set<string>());

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushInterviews: (...a: unknown[]) => pushInterviews(...a),
  pushReminders: (...a: unknown[]) => pushReminders(...a),
  getLumosPushConfig: () => getLumosPushConfig(),
}));
vi.mock('../../api/_lib/callFollowup.js', () => ({ listSuppressedPhones: () => listSuppressedPhones() }));
vi.mock('../../api/_lib/candidateCallHolds.js', () => ({ listHeldPhones: () => listHeldPhones() }));
const releaseDueCallBatches = vi.fn(async () => 0);
vi.mock('../../api/_lib/callBatchStore.js', () => ({ releaseDueCallBatches: () => releaseDueCallBatches() }));
/** feed ใบขอเปิด (ชุดเดียวกับกล่องงาน) — เลน Match ต้องเช็คว่าใบยังเปิดก่อนโทรซ้ำ */
const OPEN_FEED = [{ id: 'siamraj-sql:OPL1', status: 'open' }];
const listSiamrajUnitRequests = vi.fn(async (_opts?: unknown): Promise<unknown[]> => OPEN_FEED);
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({
  listSiamrajUnitRequests: (opts: unknown) => listSiamrajUnitRequests(opts),
}));
vi.mock('../../api/_lib/callFollowupPolicyStore.js', async () => {
  const { DEFAULT_CALL_FOLLOWUP_POLICY } = await import('../../src/lib/callFollowupPolicy.js');
  return { getCallFollowupPolicy: async () => DEFAULT_CALL_FOLLOWUP_POLICY };
});

const { runLumosPushRetryOnce, withScheduledAt } = await import('../../api/_lib/lumosPushRetryWorker.js');
const { LUMOS_PUSH_RETRY_DEFAULTS: CFG } = await import('../../src/lib/lumosPushRetryPolicy.js');

const bkk = (s: string) => new Date(`${s}+07:00`);

const cand = (over: Record<string, unknown> = {}) => ({
  id: '17628',
  channel: 'interview',
  person_ref: 'app-1',
  payload: { phone: '+66811111111', client_interview_id: 'siamraj-sql:X::app-1::interview', scheduled_at: 'old' },
  created_at: bkk('2026-09-28T14:00:00'),
  next_attempt_at: null,
  app_exists: true,
  claimed: false,
  is_lead: false,
  contacted: false,
  ...over,
});

/** แยกคิวรีตามชนิด: แถว push ไม่ถึง · โทรซ้ำที่ถึงเวลา · ที่เหลือ (update) ไม่คืนแถว */
function stub(rows: unknown[], retries: unknown[] = []) {
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) => {
    const s = String(sql);
    if (/^\s*select/i.test(s) && s.includes("followup_state = 'retry_scheduled'")) return Promise.resolve({ rows: retries });
    if (/^\s*select/i.test(s)) return Promise.resolve({ rows });
    return Promise.resolve({ rows: [] });
  });
}
const updates = () => dbQuery.mock.calls.map((c) => String(c[0])).filter((s) => /^\s*update/i.test(s));

beforeEach(() => {
  releaseDueCallBatches.mockReset().mockResolvedValue(0);
  listSiamrajUnitRequests.mockReset().mockResolvedValue(OPEN_FEED);
  pushInterviews.mockReset().mockResolvedValue({ accepted: 1 });
  pushReminders.mockReset().mockResolvedValue({ accepted: 1 });
  getLumosPushConfig.mockReturnValue({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' });
  listSuppressedPhones.mockReset().mockResolvedValue(new Set());
  listHeldPhones.mockReset().mockResolvedValue(new Set());
});

describe('runLumosPushRetryOnce', () => {
  it('🔴 ส่งซ้ำด้วย Idempotency-Key เดิม + นัดโทรอีก 10 นาที (เวลาไทย) · สำเร็จแล้วจด pushed', async () => {
    stub([cand()]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(run).toMatchObject({ found: 1, sent: 1, failed: 0 });
    expect(pushInterviews).toHaveBeenCalledTimes(1);
    const [records, key] = pushInterviews.mock.calls[0] as [Array<Record<string, unknown>>, string];
    expect(key).toBe('interview-17628');
    expect(records[0].scheduled_at).toBe('2026-09-28T14:15:00+07:00');
    expect(records[0].client_interview_id).toBe('siamraj-sql:X::app-1::interview');
    expect(updates().some((s) => /push_state = 'pushed'/.test(s))).toBe(true);
  });

  it('🔴 ช่วงห้ามโทร ⇒ ไม่ยิงเลย', async () => {
    stub([cand({ created_at: bkk('2026-09-28T21:00:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T21:05:00'));
    expect(run.waiting).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
  });

  it('เคสกู้ 3 ใบ: นัดไว้ 09:00 ⇒ 08:00 ยิงโดยนัด 09:00 ตรง', async () => {
    stub([cand({ next_attempt_at: bkk('2026-09-29T09:00:00'), created_at: bkk('2026-09-24T14:31:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T08:00:00'));
    expect(run.sent).toBe(1);
    const [records] = pushInterviews.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(records[0].scheduled_at).toBe('2026-09-29T09:00:00+07:00');
  });

  it.each([
    [{ claimed: true }, 'มีเจ้าหน้าที่รับไปโทรเองแล้ว'],
    [{ contacted: true }, 'มีบันทึกผลติดต่อแล้ว'],
    [{ is_lead: true }, 'ย้ายไปเป็น Lead แล้ว'],
    [{ app_exists: false }, 'ไม่พบใบสมัครแล้ว'],
  ])('มีเจ้าของแล้ว %o ⇒ ไม่ยิง + ปิดฝั่ง AI', async (over, reason) => {
    stub([cand(over)]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(run.skipped).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
    const call = dbQuery.mock.calls.find((c) => /push_skipped|status = 'cancelled'/.test(String(c[0])));
    expect(String(call?.[0])).toMatch(/status = 'cancelled'/);
    expect(call?.[1]).toEqual(['17628', 'push_skipped', reason]);
  });

  it('เบอร์ถูกพัก / มีคนถือเบอร์ ⇒ ไม่ยิง', async () => {
    stub([cand()]);
    listSuppressedPhones.mockResolvedValue(new Set(['+66811111111']));
    expect((await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'))).skipped).toBe(1);
    stub([cand()]);
    listSuppressedPhones.mockResolvedValue(new Set());
    listHeldPhones.mockResolvedValue(new Set(['+66811111111']));
    expect((await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'))).skipped).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
  });

  it('🔴 อ่านรายการพักเบอร์ไม่ได้ ⇒ รอบนี้ไม่ยิงใคร (ไม่ปิดฝั่ง AI ด้วย รอบหน้าลองใหม่)', async () => {
    stub([cand()]);
    listSuppressedPhones.mockRejectedValue(new Error('db down'));
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(run.waiting).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
    // ไม่ปิดฝั่ง AI (รอบหน้าลองใหม่) — update ที่มีได้มีแค่ตัวเช็คสายเงียบประจำรอบ
    expect(updates().filter((s) => /push_skipped|status = 'cancelled'/.test(s) && !/q\.push_state = 'pushed'/.test(s))).toHaveLength(0);
  });

  it('🔴 เกิน 24 ชม. ⇒ เลิกส่ง AI + needs_human (ขึ้นกล่องต้องเร่งจัดการ) · ไม่ยิง', async () => {
    stub([cand({ created_at: bkk('2026-09-27T10:00:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T10:30:00'));
    expect(run.gaveUp).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
    const sql = updates().join('\n');
    expect(sql).toMatch(/status = 'cancelled'/);
    expect(sql).toMatch(/followup_state = 'needs_human'/);
  });

  it('ยิงแล้วล้มอีก ⇒ จด push_failed + เหตุ รอบหน้าลองต่อ', async () => {
    stub([cand()]);
    pushInterviews.mockRejectedValue(new Error('Lumos push interviews ล้มเหลว: 503'));
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(run.failed).toBe(1);
    expect(updates().some((s) => /push_state = 'push_failed'/.test(s))).toBe(true);
  });

  it('ไม่มีคีย์ push (เครื่อง dev) ⇒ ไม่แตะฐานเลย · ไม่ปล่อยชุดโทร', async () => {
    stub([cand()]);
    getLumosPushConfig.mockReturnValue(null);
    await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(dbQuery).not.toHaveBeenCalled();
    expect(pushInterviews).not.toHaveBeenCalled();
    expect(releaseDueCallBatches).not.toHaveBeenCalled();
  });

  it('คิวรีหยิบเฉพาะแถวที่ยังไม่มีผล และจดว่าส่งไม่ถึง/ค้างกลางทาง · 🔴 ไม่แตะงานติดตาม · แถวเก่า push_state null ไม่แตะ', async () => {
    stub([]);
    await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    const sql = String(dbQuery.mock.calls[0][0]);
    expect(sql).toContain("q.job_ref <> 'follow'");
    expect(sql).toContain("q.person_ref like 'app-%'");
    expect(sql).toContain("q.person_ref like 'ir-%'");
    expect(sql).toContain("q.channel = 'reminder' and q.person_ref like 'card-%'");
    expect(sql).toContain("q.status = 'pending'");
    expect(sql).toContain("q.push_state = 'push_failed'");
    expect(sql).toContain("q.push_state = 'push_pending'");
    expect(sql).not.toMatch(/push_state is null/);
  });

  it('เลน Match (คนของเรา card-) ⇒ ส่งซ้ำทางช่อง reminder · คีย์ reminder-<id> · เลื่อนเวลาใน steps', async () => {
    stub([
      cand({
        id: '555',
        channel: 'reminder',
        person_ref: 'card-9',
        app_exists: false,
        payload: { recipient_phone: '+66822222222', client_contact_id: 'j::card-9', steps: [{ scheduled_at: 'old', offset: 0 }] },
      }),
    ]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(run.sent).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
    const [records, key] = pushReminders.mock.calls[0] as [Array<Record<string, unknown>>, string];
    expect(key).toBe('reminder-555');
    expect(records[0].steps).toEqual([{ scheduled_at: '2026-09-28T14:15:00+07:00', offset: 0 }]);
    expect('scheduled_at' in records[0]).toBe(false);
  });

  it('เลน Match iRecruit (ir-) ไม่มีใบสมัคร ⇒ ไม่ถูกปัดว่า "ไม่พบใบสมัคร" · ส่งซ้ำทาง interview', async () => {
    stub([cand({ id: '777', person_ref: 'ir-12', app_exists: false })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(run).toMatchObject({ sent: 1, skipped: 0 });
    expect(pushInterviews.mock.calls[0][1]).toBe('interview-777');
  });

  it('เบอร์ของช่อง reminder อ่านจาก recipient_phone — ถูกพักก็ไม่ยิง', async () => {
    stub([cand({ id: '556', channel: 'reminder', person_ref: 'card-1', app_exists: false, payload: { recipient_phone: '+66833333333', steps: [] } })]);
    listSuppressedPhones.mockResolvedValue(new Set(['+66833333333']));
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(run.skipped).toBe(1);
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('ไม่มีช่วงห้ามโทร (migration 125) ⇒ กลางคืนก็ส่งซ้ำ', async () => {
    const { DEFAULT_CALL_FOLLOWUP_POLICY } = await import('../../src/lib/callFollowupPolicy.js');
    const store = await import('../../api/_lib/callFollowupPolicyStore.js');
    const spy = vi.spyOn(store, 'getCallFollowupPolicy').mockResolvedValue({ ...DEFAULT_CALL_FOLLOWUP_POLICY, quietFromHour: 0, quietToHour: 0 });
    stub([cand({ created_at: bkk('2026-09-28T23:00:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-28T23:05:00'));
    expect(run.sent).toBe(1);
    spy.mockRestore();
  });
});

const retry = (over: Record<string, unknown> = {}) => ({
  id: '800',
  channel: 'interview',
  person_ref: 'app-5',
  job_ref: 'siamraj-sql:OPL1',
  payload: { phone: '+66844444444', client_candidate_id: 'siamraj-sql:OPL1::app-5', client_interview_id: 'siamraj-sql:OPL1::app-5::interview', scheduled_at: 'old' },
  created_at: bkk('2026-09-27T14:00:00'),
  next_attempt_at: bkk('2026-09-29T18:00:00'),
  attempt_count: 2,
  push_state: 'pushed',
  step_position: null,
  last_outcome: 'no_answer',
  last_call_at: bkk('2026-09-28T14:05:00'),
  app_exists: true,
  claimed: false,
  is_lead: false,
  contacted: false,
  follow_exists: false,
  follow_closed: false,
  staff_resulted: false,
  ...over,
});

/** เลน Match คนของเรา (board Match ⇒ ช่อง reminder แผนรอบเดียว) — โทรไป 14:37 ไม่รับ ⇒ นัดวันถัดไป 14:37 */
const matchReminder = (over: Record<string, unknown> = {}) =>
  retry({
    id: '950',
    channel: 'reminder',
    person_ref: 'card-77',
    job_ref: 'siamraj-sql:OPL1',
    payload: {
      client_contact_id: 'siamraj-sql:OPL1::card-77',
      recipient_phone: '+66866666666',
      steps: [{ position: 0, scheduled_at: 'old' }],
    },
    step_position: null,
    next_attempt_at: bkk('2026-09-29T14:37:00'),
    last_call_at: bkk('2026-09-28T14:37:00'),
    ...over,
  });
const closeCall = () => dbQuery.mock.calls.find((c) => /set followup_state = \$2, next_attempt_at = null/.test(String(c[0])));

describe('โทรซ้ำที่ถึงเวลา (ใบสมัคร คละช่วงเวลา · งานติดตาม วันถัดไป)', () => {
  it('ทุกรอบปล่อยชุดโทรที่อนุมัติแล้วถึงเวลา (เดิมรอคนเปิดแผง)', async () => {
    stub([]);
    await runLumosPushRetryOnce(CFG, bkk('2026-09-29T10:00:00'));
    expect(releaseDueCallBatches).toHaveBeenCalledTimes(1);
  });

  it('🔴 ใบสมัคร: ถึงช่อง 18:00 ⇒ ส่งเป็นงานใหม่ (::r2 · คีย์ประจำรอบ) · ผลยังจับด้วย client_candidate_id เดิม', async () => {
    stub([], [retry()]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T17:30:00'));
    expect(run.retriesSent).toBe(1);
    const [records, key] = pushInterviews.mock.calls[0] as [Array<Record<string, unknown>>, string];
    expect(key).toBe('interview-800-r2');
    expect(records[0].client_interview_id).toBe('siamraj-sql:OPL1::app-5::interview::r2');
    expect(records[0].client_candidate_id).toBe('siamraj-sql:OPL1::app-5');
    expect(records[0].scheduled_at).toBe('2026-09-29T18:00:00+07:00');
    // ส่งถึงแล้ว = เลิกเป็น "รอโทรซ้ำ" (รอผลรอบใหม่)
    expect(updates().some((s) => /followup_state = null/.test(s))).toBe(true);
  });

  it('ใบสมัคร: นัดแบบเดิม (เวลาเดิม +24 ชม.) หรือค้างเก่า ⇒ นัดช่องเวลาใหม่ ไม่โทรทันที', async () => {
    stub([], [retry({ next_attempt_at: bkk('2026-09-26T14:05:00'), last_call_at: bkk('2026-09-25T14:05:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T07:45:00'));
    expect(run.retriesReplanned).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
    const call = dbQuery.mock.calls.find((c) => /set next_attempt_at = \$2::timestamptz/.test(String(c[0])));
    expect(call?.[1]).toEqual(['800', bkk('2026-09-29T18:00:00').toISOString()]);
  });

  it('🔴 ใบสมัคร: นัดแบบเดิมที่บังเอิญตรงช่องเดียวกับสายที่ไม่ติด (โทร 14:26 ⇒ นัด 14:00) ⇒ ย้ายไปช่องถัดไป 18:00 · ย้ายแล้วไม่ย้ายวน', async () => {
    stub([], [retry({ next_attempt_at: bkk('2026-09-29T14:00:00'), last_call_at: bkk('2026-09-28T14:26:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T13:05:00'));
    expect(run.retriesReplanned).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
    const call = dbQuery.mock.calls.find((c) => /set next_attempt_at = \$2::timestamptz/.test(String(c[0])));
    expect(call?.[1]).toEqual(['800', bkk('2026-09-29T18:00:00').toISOString()]);
    // รอบถัดไปเจอแถวที่ย้ายแล้ว ⇒ ส่งตามช่องใหม่ ไม่ย้ายซ้ำ
    stub([], [retry({ next_attempt_at: bkk('2026-09-29T18:00:00'), last_call_at: bkk('2026-09-28T14:26:00') })]);
    const next = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T17:05:00'));
    expect(next.retriesReplanned).toBe(0);
    expect(next.retriesSent).toBe(1);
  });

  it('🔴 ผู้สมัครขอให้โทรกลับ 16:30 (reschedule_requested) ⇒ โทรตามเวลานั้น ห้ามย้ายช่อง · เลยเวลามาแล้วก็โทรเร็วสุด ไม่ย้ายไปพรุ่งนี้', async () => {
    const asked = { last_outcome: 'reschedule_requested', next_attempt_at: bkk('2026-09-29T16:30:00'), last_call_at: bkk('2026-09-29T11:12:00') };
    stub([], [retry(asked)]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T15:45:00'));
    expect(run.retriesReplanned).toBe(0);
    expect(run.retriesSent).toBe(1);
    const [records] = pushInterviews.mock.calls[0] as [Array<Record<string, unknown>>, string];
    expect(records[0].scheduled_at).toBe('2026-09-29T16:30:00+07:00');
    // เครื่องหยุดไปชั่วโมงหนึ่ง (เลยนัด 60 นาที) ⇒ ยังโทรวันนี้ (อีก 10 นาที) ไม่ถูกนัดช่องพรุ่งนี้
    pushInterviews.mockClear();
    stub([], [retry(asked)]);
    const late = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T17:30:00'));
    expect(late.retriesReplanned).toBe(0);
    expect((pushInterviews.mock.calls[0] as [Array<Record<string, unknown>>])[0][0].scheduled_at).toBe('2026-09-29T17:40:00+07:00');
  });

  it('คิวรีโทรซ้ำอ่านผลรอบก่อน + เวลาสายล่าสุดจากเวลาได้ผลเท่านั้น (ไม่ถอยไป updated_at ที่การนัดใหม่แตะทุกรอบ)', async () => {
    stub([], []);
    await runLumosPushRetryOnce(CFG, bkk('2026-09-29T10:00:00'));
    const sql = dbQuery.mock.calls.map((c) => String(c[0])).find((s) => /^\s*select/i.test(s) && s.includes("followup_state = 'retry_scheduled'")) ?? '';
    expect(sql).toContain('q.last_outcome');
    expect(sql).toContain('coalesce(q.last_result_at, q.first_result_at) as last_call_at');
    expect(sql).not.toMatch(/updated_at\) as last_call_at/);
    // เลน Match ทั้งสองช่อง + ธง "เจ้าหน้าที่บันทึกผลแล้ว" · เฉพาะแถว pending (ค้างเก่า ส.ค. เป็น delivered ⇒ ไม่หยิบ)
    expect(sql).toContain("q.channel = 'interview' and (q.person_ref like 'card-%' or q.person_ref like 'ir-%')");
    expect(sql).toContain("q.channel = 'reminder' and q.person_ref like 'card-%'");
    expect(sql).toContain('as staff_resulted');
    expect(sql).toContain("q.status = 'pending'");
  });
  it('ใบสมัคร: มีเจ้าหน้าที่ติดต่อแล้ว ⇒ ปิดธงโทรซ้ำ ไม่โทร', async () => {
    stub([], [retry({ contacted: true })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T17:30:00'));
    expect(run.retriesClosed).toBe(1);
    expect(pushInterviews).not.toHaveBeenCalled();
    const call = dbQuery.mock.calls.find((c) => /set followup_state = \$2, next_attempt_at = null/.test(String(c[0])));
    expect(call?.[1]).toEqual(['800', 'closed', 'มีบันทึกผลติดต่อแล้ว']);
  });

  it('🔴 งานติดตามที่ปิดแล้ว (ไปแล้ว/ถึงแล้ว/ยกเลิก) ⇒ ปิดธง ไม่โทรซ้ำ (49 แถวค้างของเดิม)', async () => {
    stub([], [retry({ id: '900', channel: 'reminder', person_ref: 'follow-1', job_ref: 'follow', follow_exists: true, follow_closed: true, next_attempt_at: bkk('2026-09-16T08:00:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T08:00:00'));
    expect(run.retriesClosed).toBe(1);
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('งานติดตามที่ยังเปิด ⇒ วันถัดไปส่งรอบเดียวของแถวนี้ · client_contact_id ต่อ -r2 · คีย์ follow-<id>-r2', async () => {
    const plan = {
      client_contact_id: 'follow-900',
      recipient_phone: '+66855555555',
      steps: [{ position: 0, scheduled_at: 'a' }, { position: 1, scheduled_at: 'b' }],
    };
    stub([], [retry({ id: '900', channel: 'reminder', person_ref: 'follow-900', job_ref: 'follow', follow_exists: true, follow_closed: false, payload: plan, step_position: 0, next_attempt_at: bkk('2026-09-29T10:00:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T09:55:00'));
    expect(run.retriesSent).toBe(1);
    const [records, key] = pushReminders.mock.calls[0] as [Array<Record<string, unknown>>, string];
    expect(key).toBe('follow-900-r2');
    expect(records[0].client_contact_id).toBe('follow-900-r2');
    expect(records[0].steps).toEqual([{ position: 0, scheduled_at: '2026-09-29T10:05:00+07:00' }]);
  });

  it('ส่งโทรซ้ำไม่ถึงเกิน 24 ชม. ⇒ ให้เจ้าหน้าที่ (needs_human)', async () => {
    stub([], [retry({ push_state: 'push_failed', next_attempt_at: bkk('2026-09-28T10:00:00') })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T10:30:00'));
    expect(run.gaveUp).toBe(1);
    const call = dbQuery.mock.calls.find((c) => /set followup_state = \$2, next_attempt_at = null/.test(String(c[0])));
    expect(call?.[1]?.[1]).toBe('needs_human');
  });

  it('🔴 ส่งถึงแล้วแต่ไม่มีผลเกิน 24 ชม. ⇒ ขึ้นให้เจ้าหน้าที่ (เฉพาะแถวที่จด push ไว้)', async () => {
    stub([]);
    await runLumosPushRetryOnce(CFG, bkk('2026-09-29T10:00:00'));
    const sql = dbQuery.mock.calls.map((c) => String(c[0])).find((s) => /push_state = 'push_gave_up'/.test(s) && /q\.push_state = 'pushed'/.test(s)) ?? '';
    expect(sql).toContain("followup_state = 'needs_human'");
    expect(sql).toContain('q.result is null');
    expect(sql).toContain('q.followup_state is null');
  });
});

describe('โทรซ้ำเลน Match (เจ้าของสั่ง 29 ก.ย. 2569: "เลน Match ทำโทรซ้ำเหมือนงานติดตามด้วย")', () => {
  it('🔴 คนของเรา (card-): วันถัดไปเวลาเดิม (ไม่คละช่วงเวลา) · ส่งเป็นงานใหม่ client_contact_id -r2 · คีย์ reminder-<id>-r2', async () => {
    stub([], [matchReminder()]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T14:00:00'));
    expect(run.retriesSent).toBe(1);
    expect(run.retriesReplanned).toBe(0);
    const [records, key] = pushReminders.mock.calls[0] as [Array<Record<string, unknown>>, string];
    expect(key).toBe('reminder-950-r2');
    expect(records[0].client_contact_id).toBe('siamraj-sql:OPL1::card-77-r2');
    expect(records[0].steps).toEqual([{ position: 0, scheduled_at: '2026-09-29T14:37:00+07:00' }]);
    expect(listSiamrajUnitRequests).toHaveBeenCalledTimes(1);
  });

  it('iRecruit (ir-) ช่อง interview ⇒ ::r2 · คีย์ interview-<id>-r2 · เวลาเดิมวันถัดไป', async () => {
    stub([], [
      retry({
        id: '960',
        person_ref: 'ir-5',
        payload: { phone: '+66877777777', client_candidate_id: 'siamraj-sql:OPL1::ir-5', client_interview_id: 'siamraj-sql:OPL1::ir-5::interview', scheduled_at: 'old' },
        next_attempt_at: bkk('2026-09-29T14:37:00'),
        last_call_at: bkk('2026-09-28T14:37:00'),
      }),
    ]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T14:00:00'));
    expect(run.retriesSent).toBe(1);
    expect(run.retriesReplanned).toBe(0);
    const [records, key] = pushInterviews.mock.calls[0] as [Array<Record<string, unknown>>, string];
    expect(key).toBe('interview-960-r2');
    expect(records[0].client_interview_id).toBe('siamraj-sql:OPL1::ir-5::interview::r2');
    expect(records[0].client_candidate_id).toBe('siamraj-sql:OPL1::ir-5');
    expect(records[0].scheduled_at).toBe('2026-09-29T14:37:00+07:00');
  });

  it('🔴 ใบขอปิดแล้ว (ไม่อยู่ในชุดเปิดของกล่องงาน) ⇒ ปิดธง ไม่โทร', async () => {
    listSiamrajUnitRequests.mockResolvedValue([{ id: 'siamraj-sql:OPL9', status: 'open' }]);
    stub([], [matchReminder()]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T14:00:00'));
    expect(run.retriesClosed).toBe(1);
    expect(pushReminders).not.toHaveBeenCalled();
    expect(closeCall()?.[1]).toEqual(['950', 'closed', 'ใบขอปิดแล้ว — ไม่โทรซ้ำ']);
  });

  it('🔴 อ่าน feed ใบขอไม่ได้ / ได้ชุดว่าง ⇒ รอบนี้ไม่โทร และไม่ปิดธง (ห้ามตีความว่าปิดหมดทุกใบ)', async () => {
    for (const feed of [() => Promise.reject(new Error('ERP down')), () => Promise.resolve([])]) {
      listSiamrajUnitRequests.mockReset().mockImplementation(feed);
      pushReminders.mockClear();
      stub([], [matchReminder()]);
      const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T14:00:00'));
      expect(run.waiting).toBe(1);
      expect(run.retriesClosed).toBe(0);
      expect(pushReminders).not.toHaveBeenCalled();
      expect(closeCall()).toBeUndefined();
    }
  });

  it('เจ้าหน้าที่รับไปโทรแล้วบันทึกผลหลังสายของ AI ⇒ ปิดธง ไม่โทรทับ', async () => {
    stub([], [matchReminder({ staff_resulted: true })]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T14:00:00'));
    expect(run.retriesClosed).toBe(1);
    expect(pushReminders).not.toHaveBeenCalled();
    expect(closeCall()?.[1]).toEqual(['950', 'closed', 'เจ้าหน้าที่โทรบันทึกผลแล้ว — ไม่โทรซ้ำ']);
  });

  it('เบอร์มีเจ้าหน้าที่ถืออยู่ ⇒ ปิดธง ไม่โทร (กติกาเดียวกับทุกเลน)', async () => {
    listHeldPhones.mockResolvedValue(new Set(['+66866666666']));
    stub([], [matchReminder()]);
    const run = await runLumosPushRetryOnce(CFG, bkk('2026-09-29T14:00:00'));
    expect(run.retriesClosed).toBe(1);
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('รอบที่ไม่มีโทรซ้ำเลน Match ⇒ ไม่อ่าน feed ใบขอเลย (ไม่ยิงระบบงานหลักทุกนาที)', async () => {
    stub([], [retry()]);
    await runLumosPushRetryOnce(CFG, bkk('2026-09-29T17:30:00'));
    expect(listSiamrajUnitRequests).not.toHaveBeenCalled();
  });
});

describe('withScheduledAt', () => {
  it('interview = ช่องเดียว · reminder ที่มี steps = ทุกรอบในแผน (เลน Match รอบเดียว)', () => {
    expect(withScheduledAt({ scheduled_at: 'a', x: 1 }, 'T')).toEqual({ scheduled_at: 'T', x: 1 });
    expect(withScheduledAt({ steps: [{ scheduled_at: 'a' }] }, 'T')).toEqual({ steps: [{ scheduled_at: 'T' }] });
  });
});
