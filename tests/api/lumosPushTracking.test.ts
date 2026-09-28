// @vitest-environment node
/**
 * ส่งสายเข้า Lumos แบบจดผล (ใบสมัคร + เลน Match) + ด่านสายไฟ (เจ้าของเคาะ 28 ก.ย. 2569)
 *
 * 🔴 ที่มา: Lumos ไม่มาดึงคิวเองแล้ว — push ตอนกรอกล้มครั้งเดียว = ใบสมัครค้าง "อยู่ในคิว AI" ถาวร
 * (OPL6909083 3 ใบ 2–4 วัน ไม่มีใครโทร) ⇒ ทุกครั้งที่ยิงต้องจดผลไว้ที่แถวคิว
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const dbQuery = vi.fn();
const pushInterviews = vi.fn();
const pushReminders = vi.fn();
const getLumosPushConfig = vi.fn(() => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }) as unknown);
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushInterviews: (...a: unknown[]) => pushInterviews(...a),
  pushReminders: (...a: unknown[]) => pushReminders(...a),
  getLumosPushConfig: () => getLumosPushConfig(),
}));

const { pushQueuedRows, pushQueueRowsTracked } = await import('../../api/_lib/lumosPushTracking.js');

const ROOT = path.resolve(__dirname, '../..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

beforeEach(() => {
  dbQuery.mockReset().mockResolvedValue({ rows: [] });
  pushInterviews.mockReset().mockResolvedValue({ accepted: 1 });
  pushReminders.mockReset().mockResolvedValue({ accepted: 1 });
  getLumosPushConfig.mockReturnValue({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' });
});

describe('ยิงรอบแรกแบบจดผล', () => {
  it('หาแถวคิวของใบที่เพิ่งเข้า แล้วยิงทีละแถวด้วยคีย์ประจำแถว · จด กำลังส่ง → ถึงแล้ว', async () => {
    dbQuery.mockImplementation((sql: string) =>
      Promise.resolve({ rows: /^\s*select/i.test(sql) ? [{ id: '901', payload: { phone: '+66800000000' } }] : [] }),
    );
    await pushQueuedRows('interview', 'siamraj-sql:OPL1', ['app-1']);
    const select = String(dbQuery.mock.calls[0][0]);
    expect(select).toContain('channel = $1 and job_ref = $2 and person_ref = any($3::text[])');
    expect(dbQuery.mock.calls[0][1]).toEqual(['interview', 'siamraj-sql:OPL1', ['app-1']]);
    expect(pushInterviews).toHaveBeenCalledWith([{ phone: '+66800000000' }], 'interview-901');
    const states = dbQuery.mock.calls.map((c) => String(c[0])).filter((s) => /update/.test(s));
    expect(states[0]).toMatch(/push_state = 'push_pending'/);
    expect(states[1]).toMatch(/push_state = 'pushed'/);
  });

  it('ยิงล้ม ⇒ จด push_failed พร้อมเหตุ (ตัวส่งซ้ำตามต่อ) · ไม่โยน error ใส่ผู้เรียก', async () => {
    pushInterviews.mockRejectedValue(new Error('fetch failed'));
    const r = await pushQueueRowsTracked('interview', [{ id: '902', payload: { phone: 'x' } }]);
    expect(r).toEqual({ pushed: 0, failed: 1 });
    const failed = dbQuery.mock.calls.find((c) => /push_state = 'push_failed'/.test(String(c[0])));
    expect(failed?.[1]).toEqual(['902', expect.stringContaining('fetch failed')]);
  });

  it('🔴 ตอบ 202 แต่ไม่รับรายการ (accepted 0) ⇒ นับว่าไม่ถึง (ห้ามจดว่าถึง)', async () => {
    pushInterviews.mockResolvedValue({ status: 'success', code: 202, accepted: 0, results: [] });
    const r = await pushQueueRowsTracked('interview', [{ id: '904', payload: { phone: 'x' } }]);
    expect(r).toEqual({ pushed: 0, failed: 1 });
    expect(dbQuery.mock.calls.some((c) => /push_state = 'pushed'/.test(String(c[0])))).toBe(false);
    expect(dbQuery.mock.calls.some((c) => /push_state = 'push_failed'/.test(String(c[0])))).toBe(true);
  });

  it('ยังไม่ migrate 123 (42703) ⇒ ยังยิงได้ตามเดิม แค่ไม่จด', async () => {
    dbQuery.mockRejectedValue(Object.assign(new Error('column "push_state" does not exist'), { code: '42703' }));
    const r = await pushQueueRowsTracked('interview', [{ id: '903', payload: { phone: 'x' } }]);
    expect(r.pushed).toBe(1);
    expect(pushInterviews).toHaveBeenCalledTimes(1);
  });

  it('ช่อง reminder (เลน Match คนของเรา) ยิงด้วย pushReminders · คีย์ reminder-<id>', async () => {
    const r = await pushQueueRowsTracked('reminder', [{ id: '905', payload: { recipient_phone: 'x', steps: [] } }]);
    expect(r.pushed).toBe(1);
    expect(pushReminders).toHaveBeenCalledWith([{ recipient_phone: 'x', steps: [] }], 'reminder-905');
    expect(pushInterviews).not.toHaveBeenCalled();
  });

  it('ไม่มีคีย์ push ⇒ ไม่ทำอะไร', async () => {
    getLumosPushConfig.mockReturnValue(null);
    await pushQueuedRows('interview', 'siamraj-sql:OPL1', ['app-1']);
    expect(dbQuery).not.toHaveBeenCalled();
    expect(pushInterviews).not.toHaveBeenCalled();
  });
});

describe('สายไฟ — ทุกทางที่ส่งใบสมัครเข้าคิวต้องไปถึง Lumos', () => {
  it('เลนใบสมัครยิงแบบจดผล (ไม่ใช่ push ครั้งเดียวแล้วเงียบ)', () => {
    const d = code('api/_lib/lumosDispatch.ts');
    const fn = d.slice(d.indexOf('export async function enqueueLumosInterviewForApplications'));
    const body = fn.slice(0, fn.indexOf('\nexport '));
    expect(body).toContain("void pushQueuedRows('interview', jobId, added)");
    expect(body).not.toContain('pushInterviews(');
  });

  it('เลน Match ที่เจ้าหน้าที่เลือกส่ง (คนของเรา · iRecruit) ยิงแบบจดผลด้วย', () => {
    const d = code('api/_lib/lumosDispatch.ts');
    const body = (name: string) => {
      const fn = d.slice(d.indexOf(`export async function ${name}`));
      return fn.slice(0, fn.indexOf('\nexport '));
    };
    expect(body('enqueueLumosReminderForSelected')).toContain("void pushQueuedRows('reminder', result.jobId, added)");
    expect(body('enqueueLumosInterviewForSelected')).toContain("void pushQueuedRows('interview', result.jobId, added)");
    expect(body('enqueueLumosReminderForSelected')).not.toContain('pushReminders(');
    expect(body('enqueueLumosInterviewForSelected')).not.toContain('pushInterviews(');
  });

  it('ปุ่ม "🤖 ส่งให้ AI โทร" ในกล่องงาน push ด้วย (เดิมแค่เข้าคิวแล้วค้าง)', () => {
    expect(code('api/_handlers/application-dispatch.ts')).toContain(
      'enqueueLumosInterviewForApplications(jobId, eligible, { autoPush: true })',
    );
  });

  it('ทุกเส้นที่เรียกเลนใบสมัคร ส่ง autoPush: true', () => {
    for (const f of [
      'api/_handlers/public/apply.ts',
      'api/_handlers/application-call-choice.ts',
      'api/_lib/callChoiceWorker.ts',
      'api/_handlers/application-dispatch.ts',
    ]) {
      const src = code(f);
      const calls = src.match(/enqueueLumosInterviewForApplications\([\s\S]*?\)\s*;/g) ?? [];
      expect(calls.length, f).toBeGreaterThan(0);
      for (const c of calls) expect(c, f).toContain('autoPush: true');
    }
  });

  it('ตัวส่งซ้ำเริ่มตอนบูต process API (ตัวเดียวกับที่ supervisord รันบนเครื่องจริง)', () => {
    expect(code('server/local-api.ts')).toContain('startLumosPushRetryWorker();');
  });

  it('migration ยกเลิกช่วงห้ามโทร: แก้เฉพาะสองช่องของแถว default (ค่าอื่นคงเดิม)', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'migrations/125_remove_call_quiet_hours_2569_09_28.sql'), 'utf8');
    expect(sql).toContain(`payload = payload || '{"quietFromHour": 0, "quietToHour": 0}'::jsonb`);
    expect(sql).toContain("where id = 'default'");
  });

  it('migration กู้ 3 ใบ: แตะเฉพาะ 3 id และเฉพาะตอนยังค้างจริง · นัด 29 ก.ย. 09:00 เวลาไทย', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'migrations/124_rescue_application_push_2569_09_28.sql'), 'utf8');
    expect(sql).toContain('where id in (17628, 17630, 17690)');
    for (const guard of ["status = 'pending'", 'result is null', 'last_outcome is null', 'push_state is null']) {
      expect(sql).toContain(guard);
    }
    expect(sql).toContain("timestamptz '2026-09-29 09:00:00+07'");
    expect(sql).not.toMatch(/\bdelete\b/i);
  });
});
