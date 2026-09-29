// @vitest-environment node
/**
 * หัวคอลัมน์ Lumos หน้าแรก — "ส่งให้ Lumos ทั้งระบบ" (เจ้าของสั่ง 28 ก.ย. 2569)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. ประชากร/เส้นทางชุดเดียวกับเลนของบอร์ด ⇒ ยอด "ทั้งหมด" = ส่งให้ AI ไปแล้ว ของสามเลนรวมกัน
 * 2. สถานะใช้นิยามกลาง `lumosQueueDefs` · วันที่ = ปฏิทินกรุงเทพ
 * 3. BU รหัสแผนก (LM) กับรหัสไซต์ (LML) ของ BU เดียวกันรวมเป็นแถวเดียว
 * 4. อ่านไม่ได้ ⇒ `lumosSent: null` + errors บอกเหตุ · เลนของบอร์ดยังขึ้นตามปกติ
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn() }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/http.js', async (orig) => {
  const actual = await orig<typeof import('../../api/_lib/http.js')>();
  return { ...actual, withAuth: (h: unknown) => h };
});
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({
  listSiamrajUnitRequests: vi.fn(async () => []),
}));
vi.mock('../../api/_lib/departmentScope.js', () => ({
  loadMatchingBuScope: vi.fn(async () => null),
}));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { default: handler } = await import('../../api/_handlers/office-team.js');

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, json };
}

const isSentSql = (sql: string) => sql.includes('as route');
const isLaneSql = (sql: string) => sql.includes('as lane') && !sql.includes('person_ref,');
const sqlOf = (pick: (s: string) => boolean) =>
  vi
    .mocked(dbQuery)
    .mock.calls.map((c) => String(c[0]))
    .find(pick) ?? '';

const SENT_ROWS = [
  { day: '2026-09-28', route: 'follow', bu: 'LM', state: 'pending', n: 2 },
  { day: '2026-09-28', route: 'follow', bu: 'LML', state: 'pending', n: 3 },
  { day: '2026-09-27', route: 'public', bu: null, state: 'done', n: 4 },
  { day: '2026-09-26', route: 'match', bu: 'LBD', state: 'แปลก', n: 1 },
  { day: null, route: 'match', bu: 'LBD', state: 'done', n: 9 },
];

const run = async () => {
  const { res, json } = mockRes();
  await handler({ method: 'GET', user: { sub: 'u1' }, query: {} } as never, res as never);
  return json.mock.calls[0][0];
};

/**
 * handler จำผลไว้ 30 วิต่อ scope (mock scope = null ตัวเดียวกันทุกเคส) ⇒ เลื่อนนาฬิกาข้ามแคชทุกเคส
 * ปลอมแค่ Date — ตัวจับเวลาอื่นปล่อยของจริง
 */
let tick = 0;
beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  tick += 1;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.UTC(2026, 8, 28, 3, 0, 0) + tick * 3_600_000));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ส่งให้ Lumos ทั้งระบบ — ข้อมูลรายวันบนบอร์ดทีม', () => {
  it('สถานะใช้นิยามกลาง · วันที่ตามเวลาไทย · ไม่นับซ้ำจาก join (แมปใบขอเป็น PK)', async () => {
    vi.mocked(dbQuery).mockImplementation((async (sql: string) =>
      isSentSql(String(sql)) ? { rows: SENT_ROWS } : { rows: [] }) as never);
    const body = await run();
    const sql = sqlOf(isSentSql);
    expect(sql).toContain(`timezone('Asia/Bangkok', q.created_at)`);
    expect(sql).toContain(`coalesce(q.status = 'cancelled'`); // queueCancelled('q') ที่ปิด NULL แล้ว
    expect(sql).toContain(`q.status = 'delivered'`); // queueWaiting
    expect(sql).toContain(`q.status = 'pending'`); // queuePending
    // BU ต่อสายใช้ตัวกลาง `queueBuSql` (29 ก.ย. 2569) — ตัวเดียวกับตัวกรอง BU ของหน้าหลักโฉม 3 ก้อน
    expect(sql).toContain('left join job_site_map q_bm on q_bm.job_id = q.job_ref');
    // งานติดตาม = แผนกของคนคีย์ก่อน แล้วค่อยไซต์ของรายการ (กติกาเดียวกับ home-kpis)
    expect(sql).toMatch(/coalesce\(nullif\(btrim\(q_bu\.department_code\), ''\), case when q_bf\.site_code/);
    expect(sql).toContain("when 'LML' then 'LM'"); // แปลงเป็นชุดแผนกก่อน แล้ว Node แปลงกลับเป็นชุดไซต์ (siteBuOf)
    expect(body.teams.lumosSent).toEqual([
      { day: '2026-09-26', bu: 'LBD', route: 'match', state: 'other', n: 1 },
      { day: '2026-09-27', bu: null, route: 'public', state: 'done', n: 4 },
      // LM (แผนกคนคีย์) + LML (ไซต์) = BU เดียวกัน ⇒ แถวเดียว 5 สาย
      { day: '2026-09-28', bu: 'LML', route: 'follow', state: 'pending', n: 5 },
    ]);
  });

  it('🔴 เส้นทางจัดด้วย CASE ชุดเดียวกับเลนของบอร์ด (ยอดทั้งหมด = สามเลนรวมกัน)', async () => {
    vi.mocked(dbQuery).mockImplementation((async () => ({ rows: [] })) as never);
    await run();
    const norm = (sql: string, alias: string) => {
      const m = /case\s+when\s+(q\.)?job_ref = 'follow'[\s\S]*?end/.exec(sql);
      return (m?.[0] ?? '').replace(new RegExp(`\\b${alias}\\.`, 'g'), '').replace(/\s+/g, ' ');
    };
    const lane = norm(sqlOf(isLaneSql), 'q');
    const sent = norm(sqlOf(isSentSql), 'q');
    expect(lane).toContain("then 'follow'");
    expect(sent).toBe(lane);
  });

  it('อ่านไม่ได้ ⇒ lumosSent เป็น null + บอกเหตุ · เลนของบอร์ดยังมาครบ', async () => {
    vi.mocked(dbQuery).mockImplementation((async (sql: string) => {
      if (isSentSql(String(sql))) throw new Error('relation "follow_entries" does not exist');
      return { rows: [] };
    }) as never);
    const body = await run();
    expect(body.teams.lumosSent).toBeNull();
    expect(body.teams.errors.lumosSent).toBe('อ่านยอดส่ง Lumos ไม่ได้');
    expect(body.teams.lumos).not.toBeNull();
    expect(body.teams.errors.lumos).toBeUndefined();
  });
});

/**
 * ═══ ตัวกรอง BU ของหน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569 · เพิ่มอย่างเดียว) ═══
 * 🔴 ไม่ส่ง bu = คิวรีเดิม (หน้าเดิมไม่ขยับ) · ส่ง = ใบเปิดตามรหัสไซต์ + ใบสมัคร/คิวของ BU กลางนั้น
 */
describe('office-team + bu', () => {
  const runWith = async (query: Record<string, string>) => {
    const { res, json } = mockRes();
    await handler({ method: 'GET', user: { sub: 'u1' }, query } as never, res as never);
    return json.mock.calls[0][0];
  };
  const OPEN = [
    { id: 'siamraj-sql:A1', site_code: '66LML0011' },
    { id: 'siamraj-sql:A2', site_code: '65LBDL0143' },
    { id: 'siamraj-sql:A3', site_code: '' },
  ];

  it('🔴 ไม่ส่ง bu = ไม่มีเงื่อนไข BU ในคิวรีใด ๆ · ใบเปิดครบทุกใบ', async () => {
    const { listSiamrajUnitRequests } = await import('../../api/_lib/siamrajUnitRequests.js');
    vi.mocked(listSiamrajUnitRequests).mockResolvedValueOnce(OPEN as never);
    vi.mocked(dbQuery).mockImplementation((async () => ({ rows: [] })) as never);
    const body = await runWith({});
    expect(body.bu).toBeNull();
    expect(body.open_total).toBe(3);
    for (const sql of vi.mocked(dbQuery).mock.calls.map((c) => String(c[0]))) {
      expect(sql).not.toMatch(/select ab\.id|select qb\.id/);
    }
  });

  it('ส่ง bu=lml ⇒ BU กลาง LM · ใบเปิดเฉพาะไซต์ LML · ใบสมัคร/นัด/ผลมาตามนัด/เลนคิว กรองด้วยพารามิเตอร์', async () => {
    const { listSiamrajUnitRequests } = await import('../../api/_lib/siamrajUnitRequests.js');
    vi.mocked(listSiamrajUnitRequests).mockResolvedValueOnce(OPEN as never);
    vi.mocked(dbQuery).mockImplementation((async () => ({ rows: [] })) as never);
    const body = await runWith({ bu: 'lml' });
    expect(body.bu).toBe('LM');
    expect(body.open_total).toBe(1);
    const calls = vi.mocked(dbQuery).mock.calls.map((c) => ({ sql: String(c[0]), params: c[1] as unknown[] | undefined }));
    const apps = calls.find((c) => c.sql.includes('as total') && c.sql.includes('as jobs'));
    expect(apps?.sql).toContain('where id in (select ab.id');
    expect(apps?.params).toEqual([['siamraj-sql:A1'], 'LM']);
    for (const col of ['appointment_at is not null', 'group by result']) {
      const c = calls.find((x) => x.sql.includes(col));
      expect(c?.sql, col).toContain('application_id in (select ab.id');
      expect(c?.params, col).toEqual(['LM']);
    }
    const lane = calls.find((c) => isLaneSql(c.sql));
    expect(lane?.sql).toContain('where id in (select qb.id');
    expect(lane?.params).toEqual(['LM']);
    // ยอดส่ง Lumos ทั้งระบบยังมาครบ (ก้อนนั้นกรองเองจากแถวรายวัน)
    const sent = calls.find((c) => isSentSql(c.sql));
    expect(sent?.sql).not.toContain('select qb.id');
  });
});
