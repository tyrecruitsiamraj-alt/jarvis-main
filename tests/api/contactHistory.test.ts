// @vitest-environment node
/**
 * GET /api/matching/contact-history — contract ของเส้นเวลาการติดต่อรายคน
 *
 * ทำไมต้องมีเทสต์: ฟีเจอร์นี้รวมประวัติของ **ทุกแผนก** เข้าด้วยกันโดยคีย์ด้วยเบอร์
 * จึงมีข้อห้ามที่ผิดแล้วเป็นข้อมูลรั่ว ไม่ใช่แค่หน้าเพี้ยน:
 *   1. ห้ามส่งเบอร์กลับไปในผลลัพธ์
 *   2. ห้าม dump payload ของคิว Lumos (มีบทที่ AI จะพูด + ข้อมูลภายใน)
 * และมีกับดักที่เคยทำให้ตัวเลขดูเหมือนพัง: แถวก่อน migration 070 ไม่มี last_outcome
 * ถ้าไม่ถอยไปอ่าน result->>'outcome' จะเห็น "มีผลกลับแต่โทรติด 0"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/http.js', async (orig) => {
  const actual = await orig<typeof import('../../api/_lib/http.js')>();
  return { ...actual, withRbac: (h: unknown) => h };
});

import { dbQuery } from '../../api/_lib/postgres.js';
import handler from '../../api/_handlers/matching-contact-history.js';

const undefinedTable = Object.assign(new Error('relation does not exist'), { code: '42P01' });
const otherDbError = Object.assign(new Error('connection terminated'), { code: '57P01' });

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
function req(query: Record<string, string> = {}, method = 'GET') {
  return { method, query, headers: {} };
}
function bodyOf(json: ReturnType<typeof vi.fn>) {
  return json.mock.calls[0]?.[0] as { items: Array<Record<string, unknown>> };
}
function sqlOf(i: number) {
  return String(vi.mocked(dbQuery).mock.calls[i]?.[0] ?? '');
}
function paramsOf(i: number) {
  return (vi.mocked(dbQuery).mock.calls[i]?.[1] ?? []) as unknown[];
}

const humanRow = {
  held_at: '2026-08-06T10:00:00.000Z',
  request_no: 'DS5812003',
  job_id: 'siamraj-sql:DS5812003',
  held_by_name: 'ตั้ม',
  result_outcome: 'no_answer',
  result_scope: null,
};
const aiRow = {
  updated_at: '2026-08-07T10:00:00.000Z',
  job_ref: 'OPL6905039',
  status: 'completed',
  attempt_count: 2,
  last_outcome: 'confirmed',
  result_outcome: null,
};

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
});

describe('contact-history — ข้อห้ามเรื่องข้อมูลรั่ว', () => {
  it('ไม่ส่งเบอร์กลับไปในผลลัพธ์ ไม่ว่าฝั่งไหน', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [humanRow] } as never)
      .mockResolvedValueOnce({ rows: [aiRow] } as never);
    const { res, json } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);

    const serialized = JSON.stringify(bodyOf(json));
    expect(serialized).not.toMatch(/\+66/);
    expect(serialized).not.toMatch(/0812345678/);
    for (const item of bodyOf(json).items) {
      expect(Object.keys(item)).not.toContain('phone');
      expect(Object.keys(item)).not.toContain('phone_e164');
    }
  });

  it('ไม่ดึง payload ของคิว Lumos ทั้งก้อน (มีบทที่ AI จะพูด)', async () => {
    const { res } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);
    const lumosSql = sqlOf(1);
    expect(lumosSql).toMatch(/from lumos_dispatch_queue/);
    // ใช้ payload เป็นเงื่อนไขค้นหาได้ แต่ห้ามอยู่ในรายการคอลัมน์ที่ดึงออกมา
    expect(lumosSql).toMatch(/where payload->>'recipient_phone' = \$1/);
    const selectClause = lumosSql.slice(
      lumosSql.toLowerCase().indexOf('select'),
      lumosSql.toLowerCase().indexOf(' from '),
    );
    expect(selectClause).not.toMatch(/payload/);
    expect(selectClause.length).toBeGreaterThan(0);
  });
});

describe('contact-history — คีย์ต้องเป็นเบอร์ E.164 เสมอ', () => {
  it('เบอร์ในประเทศถูกแปลงเป็น E.164 ก่อนค้น (คนเดียวมีหลาย ref แต่เบอร์เดียว)', async () => {
    const { res } = mockRes();
    await handler(req({ phone: '081-234-5678' }) as never, res as never);
    expect(paramsOf(0)[0]).toBe('+66812345678');
    expect(paramsOf(1)[0]).toBe('+66812345678');
  });

  it('เบอร์ไม่ถูกต้อง = 400 และไม่แตะ DB', async () => {
    const { res, status } = mockRes();
    await handler(req({ phone: 'ไม่ใช่เบอร์' }) as never, res as never);
    expect(status).toHaveBeenCalledWith(400);
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it('ไม่ส่ง phone มาเลย = 400', async () => {
    const { res, status } = mockRes();
    await handler(req({}) as never, res as never);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('เมธอดอื่นที่ไม่ใช่ GET = 405', async () => {
    const { res, status } = mockRes();
    await handler(req({ phone: '0812345678' }, 'POST') as never, res as never);
    expect(status).toHaveBeenCalledWith(405);
  });
});

describe('contact-history — รวมคนกับ AI เป็นเส้นเวลาเดียว', () => {
  it('เรียงใหม่→เก่า ข้ามแหล่ง และติดป้าย kind ถูกฝั่ง', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [humanRow] } as never)
      .mockResolvedValueOnce({ rows: [aiRow] } as never);
    const { res, json } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);

    const items = bodyOf(json).items;
    expect(items.map((i) => i.kind)).toEqual(['ai', 'human']);
    expect(items[0].at).toBe(aiRow.updated_at);
    expect(items[0].byName).toBeNull();
    expect(items[0].queueStatus).toBe('completed');
    expect(items[1].byName).toBe('ตั้ม');
    expect(items[1].queueStatus).toBeNull();
  });

  it('แถวเก่าก่อน migration 070 ต้องถอยไปอ่าน result->>outcome', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{ ...aiRow, last_outcome: null, result_outcome: 'declined' }],
      } as never);
    const { res, json } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);
    // ถ้าไม่ coalesce จะได้ null แล้วหน้าเว็บโชว์ "มีผลกลับ แต่โทรติด 0"
    expect(bodyOf(json).items[0].outcome).toBe('declined');
  });

  it('ฝั่งคนใช้ request_no เป็น jobRef ถ้ามี ไม่งั้นถอยไปใช้ job_id', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [humanRow, { ...humanRow, request_no: null }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const { res, json } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);
    expect(bodyOf(json).items[0].jobRef).toBe('DS5812003');
    expect(bodyOf(json).items[1].jobRef).toBe('siamraj-sql:DS5812003');
  });

  it('แยก "ไม่เอางานนี้" กับ "ไม่หางานแล้ว" ด้วย scope (ปลายทางต่างกัน)', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({
        rows: [{ ...humanRow, result_outcome: 'declined', result_scope: 'all' }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    const { res, json } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);
    expect(bodyOf(json).items[0].scope).toBe('all');
  });
});

describe('contact-history — ตารางยังไม่ migrate ต้องไม่พังทั้งหน้า', () => {
  it('ไม่มีตารางล็อกโทร = ยังได้ฝั่ง AI ตามปกติ', async () => {
    vi.mocked(dbQuery)
      .mockRejectedValueOnce(undefinedTable)
      .mockResolvedValueOnce({ rows: [aiRow] } as never);
    const { res, json, status } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);
    expect(status).toHaveBeenCalledWith(200);
    expect(bodyOf(json).items).toHaveLength(1);
    expect(bodyOf(json).items[0].kind).toBe('ai');
  });

  it('ไม่มีตารางคิว Lumos = ยังได้ฝั่งคนตามปกติ', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [humanRow] } as never)
      .mockRejectedValueOnce(undefinedTable);
    const { res, json } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);
    expect(bodyOf(json).items).toHaveLength(1);
    expect(bodyOf(json).items[0].kind).toBe('human');
  });

  it('DB ล้มด้วยเหตุอื่น ต้องไม่กลืน (ไม่งั้นเข้าใจผิดว่าไม่เคยติดต่อ)', async () => {
    vi.mocked(dbQuery).mockRejectedValueOnce(otherDbError);
    const { res, status } = mockRes();
    await handler(req({ phone: '0812345678' }) as never, res as never);
    expect(status).not.toHaveBeenCalledWith(200);
  });
});
