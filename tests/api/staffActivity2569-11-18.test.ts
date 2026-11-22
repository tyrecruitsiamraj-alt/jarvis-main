/**
 * งานรายคน (เจ้าของ 18 พ.ย. 2569 "วันนี้ เมื่อวาน วันก่อน ใหม่ทำอะไรไป โพสต์มือเอง Autopost scrap")
 */
import { describe, expect, it, vi } from 'vitest';

const calls: Array<[string, unknown[]]> = [];
let reply: unknown[] = [];
/** ตอบตาม SQL (โหมดที่ยิงหลายคำถามพร้อมกัน) · null = ใช้ `reply` */
let replyFor: ((sql: string) => unknown[]) | null = null;
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: async (sql: string, p: unknown[]) => (calls.push([sql, p]), { rows: replyFor ? replyFor(sql) : reply }) }));
vi.mock('../../api/_lib/departmentScope.js', async (o) => ({ ...(await o<object>()), loadMatchingBuScope: async () => ({ mode: 'all' }) }));
vi.mock('../../api/_lib/http.js', async (o) => ({ ...(await o<object>()), withRbac: (h: unknown) => h }));

const { staffActivityHandler } = await import('../../api/_handlers/staff-activity');
const { staffActivityTotals } = await import('../../src/lib/staffActivity');

async function call(query: Record<string, string>) {
  let status = 0;
  let body: unknown = null;
  const res = { setHeader() {}, status: (s: number) => ((status = s), { json: (b: unknown) => (body = b) }) };
  await staffActivityHandler({ method: 'GET', query, user: { sub: 'u' } } as never, res as never);
  return { status, body: body as { rows?: unknown[]; items?: unknown[]; person?: Record<string, unknown> | null } };
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
    // 20 พ.ย. 2569 รายการมีเวลาที่ทำ + คีย์ใบขอ (แท็บงานรายคน)
    reply = [{ day: '2026-11-18', title: 'OPL6908011', sub: 'Facebook Group', application_id: null, request_no: 'OPL6908011', at: '2026-11-18T03:12:45.120Z', job_id: 'siamraj-sql:OPL6908011' }];
    const r = await call({ from: '2026-11-16', to: '2026-11-18', detail: '1', user: 'd3d2bc64-fbc1-48da-8411-f7e789596a04', kind: 'manualPosted' });
    expect(r.body.items).toEqual([
      { day: '2026-11-18', title: 'OPL6908011', sub: 'Facebook Group', applicationId: null, requestNo: 'OPL6908011', at: '2026-11-18T03:12:45.120Z', jobId: 'siamraj-sql:OPL6908011' },
    ]);
    expect(calls.at(-1)?.[1]).toEqual(['2026-11-16', '2026-11-18', 'd3d2bc64-fbc1-48da-8411-f7e789596a04']);
  });
});

describe('GET /api/staff-activity?roster=1 (แท็บ Scale ลง 20 พ.ย. 2569 "ใครไม่ทำอะไร หายไปกี่วัน")', () => {
  it('คนที่มีงานใน 60 วันล่าสุดนับถึงวันสุดท้ายของช่วง + วันทำล่าสุด — งานชุดเดียวกับตารางรายคน', async () => {
    reply = [
      { user_id: 'b', name: 'โอ๊ต', bu: 'LBD', last_day: '2026-10-28' },
      { user_id: 'a', name: 'คิว', bu: 'LBD', last_day: '2026-11-20' },
    ];
    const r = await call({ from: '2026-11-20', to: '2026-11-20', roster: '1', bu: 'LBD' });
    expect(r.status).toBe(200);
    expect((r.body as { roster?: unknown[] }).roster).toEqual([
      { userId: 'a', name: 'คิว', bu: 'LBD', lastDay: '2026-11-20' },
      { userId: 'b', name: 'โอ๊ต', bu: 'LBD', lastDay: '2026-10-28' },
    ]);
    const [sql, params] = calls.at(-1) ?? ['', []];
    // 60 วัน = 22 ก.ย. – 20 พ.ย.
    expect(params).toEqual(['2026-09-22', '2026-11-20', ['LBD']]);
    for (const t of ['job_posting_requests', 'recruit_posting_links', 'recruit_posting_link_posts', 'application_contact_logs']) expect(sql).toContain(t);
    expect(sql).toContain('max(ev.day)');
    expect(sql).not.toMatch(/\b(insert|update|delete)\b/i);
  });
});

describe('GET /api/staff-activity?person=1 (แท็บงานรายคน 20 พ.ย. 2569)', () => {
  const U = '5f4b2fcd-7f64-4bb8-92cf-7c118d9a0bef';
  it('งานของคนเดียววันเดียว เทียบวันก่อน + 7 วัน + ช่องทาง + ใบไหน — ทุกยอดลงตัวกัน', async () => {
    replyFor = (sql) =>
      sql.includes('ev.user_id = $3::uuid')
        ? [
            { day: '2026-11-20', kind: 'links', n: 161 },
            { day: '2026-11-20', kind: 'manualPosted', n: 125 },
            { day: '2026-11-20', kind: 'scrap', n: 80 },
            { day: '2026-11-20', kind: 'autopost', n: 2 },
            { day: '2026-11-19', kind: 'links', n: 11 },
            { day: '2026-11-19', kind: 'scrap', n: 6 },
          ]
        : sql.includes("'links'::text as kind")
          ? [
              { kind: 'links', label: 'Facebook · Facebook Group', n: 158, extra: null },
              { kind: 'links', label: 'ไม่ระบุช่องทาง', n: 3, extra: null },
              { kind: 'manualPosted', label: 'Facebook · Facebook Group', n: 125, extra: null },
              { kind: 'scrap', label: 'rejected', n: 74, extra: null },
              { kind: 'scrap', label: 'completed', n: 5, extra: null },
              { kind: 'scrap', label: 'filled', n: 1, extra: null },
              { kind: 'autopost', label: 'Clarissa Glady', n: 2, extra: 12 },
            ]
          : sql.includes("'clicks'::text as what")
            ? [
                { what: 'clicks', day: '2026-11-20', n: 819 },
                { what: 'clicks', day: '2026-11-19', n: 897 },
                { what: 'applicants', day: '2026-11-20', n: 42 },
              ]
            : [
                { job: 'siamraj-sql:LMO6911008', kind: 'links', n: 161, kind_label: null },
                { job: 'siamraj-sql:LMO6911008', kind: 'autopost', n: 2, kind_label: null },
                { job: 'siamraj-pre:LBM6910008', kind: 'scrap', n: 80, kind_label: null },
                { job: 'siamraj-sql:OPL6910061', kind: 'manualPosted', n: 125, kind_label: null },
                { job: 'standalone:thai_executive', kind: 'clicks', n: 819, kind_label: 'ผู้บริหารคนไทย' },
                { job: 'standalone:thai_executive', kind: 'applicants', n: 42, kind_label: 'ผู้บริหารคนไทย' },
              ];
    const r = await call({ from: '2026-11-14', to: '2026-11-20', person: '1', user: U, day: '2026-11-20' });
    replyFor = null;
    expect(r.status).toBe(200);
    const p = r.body.person as {
      prevDay: string;
      week: Array<{ day: string; links: number }>;
      cur: Record<string, number>;
      prev: Record<string, number>;
      channels: Record<string, Array<{ label: string; n: number }>>;
      results: Record<string, number>;
      jobs: Array<Record<string, string | number>>;
    };
    expect(p.prevDay).toBe('2026-11-19');
    // 7 วันครบ วันว่าง = 0
    expect(p.week.map((w) => [w.day, w.links])).toEqual([
      ['2026-11-14', 0], ['2026-11-15', 0], ['2026-11-16', 0], ['2026-11-17', 0], ['2026-11-18', 0], ['2026-11-19', 11], ['2026-11-20', 161],
    ]);
    expect(p.cur).toEqual({ autopost: 2, scrap: 80, links: 161, manualPosted: 125, contacts: 0, appts: 0 });
    expect(p.prev).toMatchObject({ links: 11, scrap: 6, manualPosted: 0 });
    // ช่องทางรวมเท่ายอดของชนิดงาน · Scrap แยกผล (completed + filled = สำเร็จ)
    const sum = (k: string) => p.channels[k].reduce((n, c) => n + c.n, 0);
    for (const k of ['links', 'manualPosted', 'scrap', 'autopost']) expect(sum(k)).toBe(p.cur[k]);
    expect(p.channels.scrap).toEqual([{ label: 'สำเร็จ', n: 6 }, { label: 'ไม่สำเร็จ', n: 74 }]);
    expect(p.channels.autopost).toEqual([{ label: 'Clarissa Glady 12 กลุ่ม', n: 2 }]);
    expect(p.results).toEqual({ clicks: 819, clicksPrev: 897, applicants: 42, applicantsPrev: 0 });
    // รายใบ: รวมเท่าแถวแม่ · ใบขอชั่วคราว/กล่องลอยมีป้ายบอก
    const col = (k: string) => p.jobs.reduce((n, j) => n + Number(j[k]), 0);
    expect([col('links'), col('manualPosted'), col('scrap'), col('autopost'), col('clicks'), col('applicants')]).toEqual([161, 125, 80, 2, 819, 42]);
    expect(p.jobs.map((j) => j.label)).toEqual(['LMO6911008', 'OPL6910061', 'LBM6910008 · ใบขอชั่วคราว', 'กล่องลอย · ผู้บริหารคนไทย']);
    // ทุกคำถามกรองด้วยคนที่ถาม
    for (const c of calls.slice(-4)) expect(c[1]).toContain(U);
  });
  it('วันที่ดูอยู่นอกช่วง / ช่วงยาวเกิน / ไม่บอกคน = 400', async () => {
    expect((await call({ from: '2026-11-14', to: '2026-11-20', person: '1', user: U, day: '2026-11-21' })).status).toBe(400);
    expect((await call({ from: '2026-09-01', to: '2026-11-20', person: '1', user: U, day: '2026-11-20' })).status).toBe(400);
    expect((await call({ from: '2026-11-14', to: '2026-11-20', person: '1', user: 'x', day: '2026-11-20' })).status).toBe(400);
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
