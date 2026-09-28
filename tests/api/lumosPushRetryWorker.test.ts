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

function stub(rows: unknown[]) {
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) =>
    Promise.resolve({ rows: /^\s*select/i.test(sql) ? rows : [] }),
  );
}
const updates = () => dbQuery.mock.calls.map((c) => String(c[0])).filter((s) => /^\s*update/i.test(s));

beforeEach(() => {
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
    expect(updates()).toHaveLength(0);
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

  it('ไม่มีคีย์ push (เครื่อง dev) ⇒ ไม่แตะฐานเลย', async () => {
    stub([cand()]);
    getLumosPushConfig.mockReturnValue(null);
    await runLumosPushRetryOnce(CFG, bkk('2026-09-28T14:05:00'));
    expect(dbQuery).not.toHaveBeenCalled();
    expect(pushInterviews).not.toHaveBeenCalled();
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

describe('withScheduledAt', () => {
  it('interview = ช่องเดียว · reminder ที่มี steps = ทุกรอบในแผน (เลน Match รอบเดียว)', () => {
    expect(withScheduledAt({ scheduled_at: 'a', x: 1 }, 'T')).toEqual({ scheduled_at: 'T', x: 1 });
    expect(withScheduledAt({ steps: [{ scheduled_at: 'a' }] }, 'T')).toEqual({ steps: [{ scheduled_at: 'T' }] });
  });
});
