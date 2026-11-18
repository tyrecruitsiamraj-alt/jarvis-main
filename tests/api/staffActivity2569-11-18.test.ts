/**
 * งานรายคน (เจ้าของ 18 พ.ย. 2569 "วันนี้ เมื่อวาน วันก่อน ใหม่ทำอะไรไป โพสต์มือเอง Autopost scrap")
 */
import { describe, expect, it, vi } from 'vitest';

const calls: Array<[string, unknown[]]> = [];
let reply: unknown[] = [];
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: async (sql: string, p: unknown[]) => (calls.push([sql, p]), { rows: reply }) }));
vi.mock('../../api/_lib/departmentScope.js', async (o) => ({ ...(await o<object>()), loadMatchingBuScope: async () => ({ mode: 'all' }) }));
vi.mock('../../api/_lib/http.js', async (o) => ({ ...(await o<object>()), withRbac: (h: unknown) => h }));

const { staffActivityHandler } = await import('../../api/_handlers/staff-activity');
const { staffActivityTotals } = await import('../../src/lib/staffActivity');

async function call(query: Record<string, string>) {
  let status = 0;
  let body: unknown = null;
  const res = { setHeader() {}, status: (s: number) => ((status = s), { json: (b: unknown) => (body = b) }) };
  await staffActivityHandler({ method: 'GET', query, user: { sub: 'u' } } as never, res as never);
  return { status, body: body as { rows?: unknown[]; items?: unknown[] } };
}

describe('GET /api/staff-activity', () => {
  it('รวมแถวต่อคนต่อวัน 6 ชนิด · วันตามปฏิทินกรุงเทพ', async () => {
    reply = [
      { user_id: 'a', name: 'ใหม่', bu: 'LBA', day: '2026-11-18', kind: 'links', n: 30 },
      { user_id: 'a', name: 'ใหม่', bu: 'LBA', day: '2026-11-18', kind: 'manualPosted', n: 128 },
      { user_id: 'b', name: 'แบงค์', bu: 'LBD', day: '2026-11-18', kind: 'autopost', n: 5 },
    ];
    const r = await call({ from: '2026-11-16', to: '2026-11-18' });
    expect(r.status).toBe(200);
    expect(r.body.rows).toEqual([
      { userId: 'b', name: 'แบงค์', bu: 'LBD', day: '2026-11-18', autopost: 5, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0 },
      { userId: 'a', name: 'ใหม่', bu: 'LBA', day: '2026-11-18', autopost: 0, scrap: 0, links: 30, manualPosted: 128, contacts: 0, appts: 0 },
    ]);
    const sql = calls.at(-1)?.[0] ?? '';
    for (const t of ['job_posting_requests', 'recruit_posting_links', 'recruit_posting_link_posts', 'application_contact_logs']) expect(sql).toContain(t);
    expect(sql).toContain("at time zone 'Asia/Bangkok'");
  });
  it('ช่วงผิด / ชนิดผิด = 400 ไม่ถามฐาน', async () => {
    expect((await call({ from: '2026-11-18', to: '2026-11-16' })).status).toBe(400);
    expect((await call({ from: '2026-11-16', to: '2026-11-18', detail: '1', user: 'd3d2bc64-fbc1-48da-8411-f7e789596a04', kind: 'drop' })).status).toBe(400);
  });
  it('รายการของช่องที่กด · ไม่ส่งวัน = ทั้งช่วง', async () => {
    reply = [{ day: '2026-11-18', title: 'OPL6908011', sub: 'Facebook Group', application_id: null, request_no: 'OPL6908011' }];
    const r = await call({ from: '2026-11-16', to: '2026-11-18', detail: '1', user: 'd3d2bc64-fbc1-48da-8411-f7e789596a04', kind: 'manualPosted' });
    expect(r.body.items).toEqual([{ day: '2026-11-18', title: 'OPL6908011', sub: 'Facebook Group', applicationId: null, requestNo: 'OPL6908011' }]);
    expect(calls.at(-1)?.[1]).toEqual(['2026-11-16', '2026-11-18', 'd3d2bc64-fbc1-48da-8411-f7e789596a04']);
  });
});

describe('ตัวกรองทุกคน = รวมทั้งช่วงต่อคน', () => {
  it('บวกทุกวัน · เรียงงานมากไปน้อย', () => {
    const z = { scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0 };
    const t = staffActivityTotals([
      { userId: 'b', name: 'แบงค์', bu: 'LBD', day: '2026-11-17', autopost: 3, ...z },
      { userId: 'b', name: 'แบงค์', bu: 'LBD', day: '2026-11-18', autopost: 5, ...z, contacts: 88 },
      { userId: 'a', name: 'ใหม่', bu: 'LBA', day: '2026-11-18', autopost: 0, ...z, links: 30 },
    ]);
    expect(t.map((r) => [r.name, r.autopost, r.contacts, r.links])).toEqual([
      ['แบงค์', 8, 88, 0],
      ['ใหม่', 0, 0, 30],
    ]);
  });
});
