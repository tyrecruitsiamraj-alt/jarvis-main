// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

/** ยอดใบขอเหลือหารายวัน (เจ้าของ 16 พ.ย. 2569 "จดทุกคืน") — เขียนทับยอดของวันนี้ · ตารางใหม่เพิ่มอย่างเดียว */
const queries: Array<[string, unknown[]]> = [];
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(async () => ({ rows: [] })),
  dbTransaction: vi.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({ query: async (sql: string, params: unknown[]) => (queries.push([sql, params]), { rows: [] }) })),
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
const { dailyRowsOf, runRequestDailySnapshotOnce } = await import('../../api/_lib/requestDailySnapshot.js');

const counts = {};
const req = (bu: string | null, reason: string, started: boolean, remaining = 1) =>
  ({ bu, reason, remaining, signals: { released: started, links: 0, post: null, counts, uncalled: 0, queued: 0 } }) as never;

describe('จดยอดใบขอเหลือหารายวัน', () => {
  it('BU × ขั้นที่ติด × เริ่มหาแล้ว · ใบ + อัตรา · ไม่รู้ BU ไม่นับ', () => {
    const rows = dailyRowsOf('2026-11-16', [req('LBD', 'not_released', false, 2), req('LBD', 'not_released', false), req('LBD', 'no_apps', true), req('LBA', 'no_appointment', true, 3), req(null, 'no_apps', true)]);
    expect(rows).toEqual([
      { day: '2026-11-16', bu: 'LBA', phase: 'closing', started: true, requests: 1, positions: 3 },
      { day: '2026-11-16', bu: 'LBD', phase: 'before', started: true, requests: 1, positions: 1 },
      { day: '2026-11-16', bu: 'LBD', phase: 'before', started: false, requests: 2, positions: 3 },
    ]);
  });

  it('เขียนทับวันนี้ในธุรกรรมเดียว (ลบแล้วใส่) · รันซ้ำไม่ซ้ำ', async () => {
    queries.length = 0;
    const n = await runRequestDailySnapshotOnce(async () => [req('LBD', 'no_apps', true)], new Date('2026-11-16T10:00:00Z'));
    expect(n).toBe(1);
    expect(queries[0][0]).toMatch(/^delete from recruit_request_daily where day = \$1::date/);
    expect(queries[0][1]).toEqual(['2026-11-16']);
    expect(queries[1][0]).toMatch(/^insert into recruit_request_daily/);
  });

  it('migration 181 ตารางใหม่ เพิ่มอย่างเดียว · worker ปิดได้ · เส้นอ่าน part=daily', () => {
    const sql = readFileSync('migrations/181_recruit_request_daily.sql', 'utf8');
    expect(sql).toMatch(/create table if not exists recruit_request_daily/);
    expect(sql).not.toMatch(/^\s*(delete|update|drop|alter) /im);
    expect(readFileSync('server/local-api.ts', 'utf8')).toContain('startRequestDailySnapshotWorker(() => loadOpenStuckRequestsAll());');
    expect(readFileSync('api/_lib/requestDailySnapshot.ts', 'utf8')).toContain("REQUEST_DAILY_SNAPSHOT_ENABLED || '').trim().toLowerCase() === 'false'");
    expect(readFileSync('api/_handlers/recruit-stuck.ts', 'utf8')).toContain("req.query?.part === 'daily' ? 'daily'");
  });
});
