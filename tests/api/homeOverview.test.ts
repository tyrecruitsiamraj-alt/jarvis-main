// @vitest-environment node
/**
 * GET /api/home-overview — ก้อน 1 (ผลงานเดือนนี้) + ก้อน 3 (วันนี้) ของหน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569)
 * 🔴 ด่าน: ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองเสมอ · กรอง BU ทุกคิวรีด้วยพารามิเตอร์ · ERP ล่ม = ก้อน 1 null + บอกเหตุ
 *    แต่ก้อน 3 ยังมา · ตัวเลือก BU = เหลือหา (อัตรา) ตามรหัสไซต์ของใบ + นับใบที่ไม่รู้ BU
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const loadMatchingBuScope = vi.fn();
const listSiamrajUnitRequests = vi.fn();
const loadRequestTrendPayload = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/http.js', async (orig) => ({ ...(await orig<typeof import('../../api/_lib/http.js')>()), withAuth: (h: unknown) => h }));
vi.mock('../../api/_lib/departmentScope.js', () => ({ loadMatchingBuScope: (...a: unknown[]) => loadMatchingBuScope(...a) }));
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({ listSiamrajUnitRequests: (...a: unknown[]) => listSiamrajUnitRequests(...a) }));
vi.mock('../../api/_lib/siamrajSqlServerPrequests.js', () => ({ PREQUEST_ID_PREFIX: 'siamraj-pre:' }));
vi.mock('../../api/_lib/requestTrendRows.js', () => ({
  loadRequestTrendPayload: (...a: unknown[]) => loadRequestTrendPayload(...a),
  requestTrendDataFrom: (today: string) => `${Number(today.slice(0, 4)) - 2}-01-01`,
}));

const mod = await import('../../api/_handlers/home-overview.js');
const handler = mod.default as unknown as (req: unknown, res: unknown) => Promise<void>;

/** `position_units` = อัตราของใบ (ตัวเดียวกับ `sumJobPositionUnits` ของหัวกล่องงาน) */
const FEED = [
  { id: 'siamraj-sql:A1', site_code: '66LML0011', position_units: 5 },
  { id: 'siamraj-sql:A2', site_code: '65LBDL0143', position_units: 2 },
  { id: 'siamraj-pre:P1', site_code: '65LBDL0144', position_units: 1 },
  { id: 'siamraj-sql:A3', site_code: '', position_units: 1 },
];

function run(query: Record<string, string> = {}) {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })), setHeader: vi.fn() };
  return handler({ method: 'GET', user: { sub: `u${Math.random()}`, role: 'admin' }, query }, res).then(() => json.mock.calls[0]?.[0]);
}

/** เส้นจำผล 30 วิต่อ (ขอบเขต, BU) ⇒ เลื่อนนาฬิกาข้ามแคชทุกเคส (ปลอมแค่ Date) */
let tick = 0;
beforeEach(() => {
  tick += 1;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.UTC(2026, 8, 29, 3, 0, 0) + tick * 3_600_000));
  dbQuery.mockReset().mockResolvedValue({ rows: [] });
  loadMatchingBuScope.mockReset().mockResolvedValue({ mode: 'all' });
  listSiamrajUnitRequests.mockReset().mockResolvedValue(FEED);
  loadRequestTrendPayload.mockReset().mockResolvedValue({ requests: [], informs: [], source: 'fresh', ageSeconds: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ขอบเขต + BU', () => {
  it('🔴 ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองเสมอ (ไม่สนพารามิเตอร์) · แปลงเป็นชุดแผนก', async () => {
    loadMatchingBuScope.mockResolvedValue({ mode: 'code', code: 'LM' });
    const body = await run({ bu: 'LBD' });
    expect(body.scope).toBe('code');
    expect(body.forced_bu).toBe('LM');
    expect(body.bu).toBe('LM');
  });

  it('ผู้ใช้เห็นทั้งหมด: รับ bu จากพารามิเตอร์ (รหัสไซต์ก็ได้) · ไม่ส่ง = ทั้งหมด', async () => {
    expect((await run({ bu: 'lml' })).bu).toBe('LM');
    expect((await run({})).bu).toBeNull();
  });

  it('ยังไม่ผูกแผนก (none) = ไม่มีตัวเลข + บอกเหตุ ไม่ยิงคิวรีข้อมูล', async () => {
    loadMatchingBuScope.mockResolvedValue({ mode: 'none' });
    const body = await run({});
    expect(body.result).toBeNull();
    expect(body.today).toBeNull();
    expect(body.errors.result).toContain('ยังไม่ได้ผูกแผนก');
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('ตัวเลือก BU = เหลือหาเป็นอัตราตามรหัสไซต์ของใบ · ใบที่ไม่รู้ BU นับแยก (ไม่หายเงียบ)', () => {
    const { options, unknown } = mod.buildBuOptions(FEED as never);
    expect(unknown).toBe(1);
    // เรียงตามเหลือหามากสุด: LM 5 อัตรา · LBD 2 + ใบขอล่วงหน้า 1 = 3 อัตรา
    expect(options.map((o) => [o.bu, o.remaining, o.openJobs])).toEqual([
      ['LM', 5, 1],
      ['LBD', 3, 2],
    ]);
  });
});

describe('ก้อน 3 — คิวรี', () => {
  it('ไม่ส่ง bu = ไม่มีเงื่อนไข BU · ส่ง = ทุกคิวรีกรอง BU กลางด้วยพารามิเตอร์ตัวสุดท้าย', () => {
    const off = mod.todaySql(false);
    const on = mod.todaySql(true);
    for (const k of ['applied', 'aiCalls', 'staff'] as const) {
      expect(off[k]).not.toContain('$2');
      expect(on[k]).toMatch(/= \$2$/);
    }
    expect(off.arrived).not.toContain('$3');
    expect(on.arrived).toMatch(/= \$3$/);
  });

  it('🔴 สายของ AI ไม่นับเลนติดตาม · ใช้เวลาของผลล่าสุด · วันเป็นปฏิทินไทย', () => {
    const q = mod.todaySql(false).aiCalls;
    expect(q).toContain("not (q.job_ref = 'follow' or q.person_ref like 'follow-%')");
    expect(q).toContain('coalesce(q.last_result_at, q.first_result_at, q.updated_at)');
    expect(q).toContain("timezone('Asia/Bangkok'");
  });

  it('ไปถึงงาน = ผลติดตามชุดสำเร็จกลาง (FOLLOW_OUTCOME_SUCCESS) ส่งเป็นพารามิเตอร์ ไม่พิมพ์เอง', async () => {
    await run({});
    const call = dbQuery.mock.calls.find((c) => String(c[0]).includes('f.outcome_code = any($2::text[])'));
    expect(call?.[1]?.[1]).toEqual(['went', 'arrived', 'done']);
  });
});

describe('ก้อนล้มแยกกัน', () => {
  it('🔴 ERP อ่านไม่ได้ ⇒ ก้อน 1 null + บอกเหตุ · ก้อน 3 ยังมาครบ', async () => {
    loadRequestTrendPayload.mockRejectedValue(new Error('ERP down'));
    const body = await run({});
    expect(body.result).toBeNull();
    expect(body.errors.result).toBe('อ่านใบขอจาก ERP ไม่ได้ตอนนี้');
    expect(body.today?.steps).toHaveLength(6);
  });

  it('ก้อน 1: เหลือหาตอนนี้ = feed ของ BU ที่เลือก (ตัวเดียวกับหัวกล่องงาน) · ใบขอล่วงหน้าแยกเลข · ใบขอ ERP กรอง BU เดียวกัน', async () => {
    const body = await run({ bu: 'LBD' });
    expect(loadRequestTrendPayload).toHaveBeenCalledTimes(1);
    const keep = loadRequestTrendPayload.mock.calls[0][2] as (bu: string | null) => boolean;
    expect(keep('LBD')).toBe(true);
    expect(keep('LM')).toBe(false);
    expect(body.result.boardOpen).toBe(3);
    expect(body.result.boardPre).toBe(1);
    // 🔴 ปลายช่วงใบขอเผื่อใบล่วงหน้า (วันนี้ + 183 วัน) — ตัวเดียวกับแท็บ Dashboard
    expect(loadRequestTrendPayload.mock.calls[0][1]).toBe('2027-03-31');
  });
});
