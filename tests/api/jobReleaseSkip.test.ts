// @vitest-environment node
/**
 * `/api/job-release-skip` — ตั้ง/ยกเลิก "ไม่ปล่อย + เหตุผล" (migration 129 · 29 ก.ย. 2569)
 * 🔴 ด่าน: id ต้องเต็ม · เหตุผลตรวจด้วยตัวเดียวกับฟอร์ม · ใบที่ขึ้นหน้าสาธารณะอยู่ตั้งไม่ได้ (409) ·
 *    ตารางยังไม่ migrate = อ่านได้รายการว่าง (หน้าอื่นไม่พัง) · บันทึกใครกด
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/http.js', async (orig) => ({ ...(await orig<typeof import('../../api/_lib/http.js')>()), withRbac: (h: unknown) => h }));

const { default: handler } = (await import('../../api/_handlers/job-release-skip.js')) as unknown as {
  default: (req: unknown, res: unknown) => Promise<void>;
};

let released: Array<{ job_id: string; request_no: string | null }> = [];

function run(method: string, body: unknown = {}, query: Record<string, string> = {}) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return handler({ method, body, query, user: { sub: '00000000-0000-0000-0000-000000000001', email: 'a@x.com', role: 'staff' } }, { status, setHeader: vi.fn() }).then(
    () => ({ code: (status.mock.calls[0] as unknown[] | undefined)?.[0], body: json.mock.calls[0]?.[0] }),
  );
}

beforeEach(() => {
  released = [];
  dbQuery.mockReset().mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes('from job_public_releases')) return { rows: released };
    if (sql.startsWith('select') && sql.includes('from job_release_skips')) {
      return { rows: [{ job_id: 'siamraj-sql:R1', request_no: 'R1', reason: 'filled', note: null, skipped_at: '2026-09-29T00:00:00Z', skipped_by_name: 'a@x.com' }] };
    }
    if (sql.startsWith('insert into job_release_skips')) {
      const [job_id, request_no, reason, note, , name] = params as unknown[];
      return { rows: [{ job_id, request_no, reason, note, skipped_at: '2026-09-29T00:00:00Z', skipped_by_name: name }] };
    }
    if (sql.startsWith('delete from job_release_skips')) return { rows: [{ job_id: (params as unknown[])[0] }] };
    return { rows: [] };
  });
});

describe('ไม่ปล่อย + เหตุผล', () => {
  it('GET = รายการทั้งหมด · ตารางยังไม่ migrate = รายการว่าง ไม่ใช่ 500', async () => {
    const ok = await run('GET');
    expect(ok.code).toBe(200);
    expect(ok.body.skips).toHaveLength(1);
    dbQuery.mockRejectedValueOnce(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
    const missing = await run('GET');
    expect(missing.code).toBe(200);
    expect(missing.body.skips).toEqual([]);
  });

  it('POST: id ไม่เต็ม = 400 · เหตุผลผิด = 400 · อื่น ๆ ไม่พิมพ์ = 400', async () => {
    expect((await run('POST', { jobId: 'R1', reason: 'filled' })).code).toBe(400);
    expect((await run('POST', { jobId: 'siamraj-sql:R1', reason: 'nope' })).code).toBe(400);
    expect((await run('POST', { jobId: 'siamraj-sql:R1', reason: 'other', note: '' })).code).toBe(400);
    expect(dbQuery.mock.calls.some(([sql]) => String(sql).startsWith('insert'))).toBe(false);
  });

  it('🔴 ใบที่ขึ้นหน้าสาธารณะอยู่ ตั้งไม่ปล่อยไม่ได้ (409) — ต้องดึงลงก่อน', async () => {
    released = [{ job_id: 'siamraj-sql:R1', request_no: 'R1' }];
    const r = await run('POST', { jobId: 'siamraj-sql:R1', reason: 'unit_hold' });
    expect(r.code).toBe(409);
    expect(dbQuery.mock.calls.some(([sql]) => String(sql).startsWith('insert'))).toBe(false);
  });

  it('POST สำเร็จ = บันทึกเหตุผล + ใครกด · id เต็ม + เลขที่ใบ', async () => {
    const r = await run('POST', { jobId: 'siamraj-pre:LBM6908001', reason: 'other', note: ' ลูกค้าเลื่อน ' });
    expect(r.code).toBe(200);
    expect(r.body.skip).toMatchObject({ job_id: 'siamraj-pre:LBM6908001', request_no: 'LBM6908001', reason: 'other', note: 'ลูกค้าเลื่อน', skipped_by_name: 'a@x.com' });
  });

  it('DELETE ทาง query = ยกเลิก (body ของ DELETE ไม่ถึง handler ในเซิร์ฟเวอร์ท้องถิ่น)', async () => {
    const r = await run('DELETE', {}, { jobId: 'siamraj-sql:R1' });
    expect(r.code).toBe(200);
    expect(r.body).toMatchObject({ ok: true, action: 'cleared', count: 1 });
  });
});
