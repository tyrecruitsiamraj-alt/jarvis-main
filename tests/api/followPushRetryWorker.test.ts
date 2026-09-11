// @vitest-environment node
/**
 * ตัวส่งซ้ำไปหา Lumos — คุมพฤติกรรมจริง ไม่ใช่แค่กติกา
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ส่งซ้ำด้วย **Idempotency-Key เดิม** (`follow-<id>`) ⇒ Lumos ตัดซ้ำให้ ไม่เกิดสายที่สอง
 * 2. สำเร็จ ⇒ ล้างธง `push_failed` ไม่งั้นวนส่งซ้ำไม่จบ
 * 3. ล้มอีก ⇒ **คงธงไว้** + จดเหตุใหม่ รอบหน้าลองต่อ
 * 4. เลยเพดานเวลา ⇒ ไม่ส่ง (ห้ามโทรกวนคนช้าครึ่งวัน)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbQuery = vi.fn();
const pushReminders = vi.fn();
const getLumosPushConfig = vi.fn(() => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }));

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushReminders: (...a: unknown[]) => pushReminders(...a),
  getLumosPushConfig: () => getLumosPushConfig(),
}));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  buildFollowPushRecord: (payload: unknown) => payload,
}));

const { runFollowPushRetryOnce } = await import('../../api/_lib/followPushRetryWorker.js');
const { FOLLOW_PUSH_RETRY_DEFAULTS } = await import('../../src/lib/followPushRetryPolicy.js');

const NOW = new Date('2026-09-11T10:00:00+07:00');
const cfg = FOLLOW_PUSH_RETRY_DEFAULTS;

/** แถวค้างหนึ่งแถว แล้วตามด้วย update ที่ worker ยิงกลับ */
function stubRows(rows: unknown[]) {
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) => {
    if (/select/i.test(sql)) return Promise.resolve({ rows });
    return Promise.resolve({ rows: [] });
  });
}

const stuck = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  scheduled_at: '2026-09-11T10:30:00+07:00',
  payload: { recipient_name: 'ก', steps: [] },
  ...over,
});

beforeEach(() => {
  pushReminders.mockReset().mockResolvedValue({ accepted: 1 });
  getLumosPushConfig.mockReturnValue({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' });
});

describe('runFollowPushRetryOnce', () => {
  it('🔴 ส่งซ้ำด้วย Idempotency-Key เดิม — ไม่ใช่สายใหม่', async () => {
    stubRows([stuck()]);
    const run = await runFollowPushRetryOnce(cfg, NOW);
    expect(run.sent).toBe(1);
    expect(pushReminders).toHaveBeenCalledTimes(1);
    expect(pushReminders.mock.calls[0][1]).toBe('follow-e1');
  });

  it('สำเร็จ ⇒ ล้างธง push_failed (ไม่งั้นวนส่งซ้ำไม่จบ)', async () => {
    stubRows([stuck()]);
    await runFollowPushRetryOnce(cfg, NOW);
    const updates = dbQuery.mock.calls.map((c) => String(c[0])).filter((s) => /update/i.test(s));
    expect(updates.some((s) => /dispatch_state = 'queued'/.test(s))).toBe(true);
  });

  it('ล้มอีก ⇒ คงธงไว้ + จดเหตุใหม่ · รอบหน้าลองต่อ', async () => {
    stubRows([stuck()]);
    pushReminders.mockRejectedValue(
      new TypeError('fetch failed', { cause: Object.assign(new Error('x'), { code: 'ECONNRESET' }) }),
    );
    const run = await runFollowPushRetryOnce(cfg, NOW);
    expect(run.failed).toBe(1);
    expect(run.sent).toBe(0);
    const writes = dbQuery.mock.calls.filter((c) => /update/i.test(String(c[0])));
    const reason = String((writes.at(-1)?.[1] as unknown[])?.[1] ?? '');
    expect(reason).toContain('ECONNRESET');
    // ห้ามล้างธง
    expect(writes.some((c) => /dispatch_state = 'queued'/.test(String(c[0])))).toBe(false);
  });

  it('🔴 เลยเพดานเวลา ⇒ ไม่ส่ง (ห้ามโทรกวนคนช้าครึ่งวัน)', async () => {
    stubRows([stuck({ scheduled_at: '2026-09-11T06:00:00+07:00' })]);
    const run = await runFollowPushRetryOnce(cfg, NOW);
    expect(run.tooLate).toBe(1);
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('ไม่มี payload ⇒ ส่งซ้ำไม่ได้ นับเป็นล้ม + บอกเหตุตรง ๆ', async () => {
    stubRows([stuck({ payload: null })]);
    const run = await runFollowPushRetryOnce(cfg, NOW);
    expect(run.sent).toBe(0);
    expect(run.failed).toBe(1);
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('ไม่ได้ตั้งค่า push ⇒ ไม่ทำอะไรเลย (ระบบไม่ได้ใช้โหมดนี้)', async () => {
    stubRows([stuck()]);
    getLumosPushConfig.mockReturnValue(null as never);
    const run = await runFollowPushRetryOnce(cfg, NOW);
    expect(run.found).toBe(0);
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('🔴 เงื่อนไขคัดแถวต้องกันสายที่ Lumos ได้ไปแล้ว', async () => {
    stubRows([]);
    await runFollowPushRetryOnce(cfg, NOW);
    const sql = String(dbQuery.mock.calls.find((c) => /select/i.test(String(c[0])))?.[0] ?? '');
    expect(sql).toContain("q.status = 'pending'");
    expect(sql).toContain('q.result is null');
    expect(sql).toContain('f.cancelled_at is null');
    expect(sql).toContain('f.completed_at is null');
    expect(sql).toContain("f.dispatch_state = 'push_failed'");
  });

  it('อ่านฐานไม่ได้ ⇒ ไม่ล้มทั้ง process แค่รอบนี้ว่าง', async () => {
    dbQuery.mockReset().mockRejectedValue(new Error('ฐานล่ม'));
    const run = await runFollowPushRetryOnce(cfg, NOW);
    expect(run.found).toBe(0);
    expect(run.sent).toBe(0);
  });
});
