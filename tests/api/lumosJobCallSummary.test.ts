// @vitest-environment node
/**
 * `loadLumosJobCallSummaryMap()` — ตัวเลขที่ไปโผล่ข้างการ์ดใบขอในหน้า Matching
 *
 * เกณฑ์ "พังแล้วเงียบ": ทุกเคสในไฟล์นี้ถ้าพัง หน้าเว็บยังขึ้นตัวเลขสวย ๆ เหมือนเดิม
 * แค่เลขน้อยกว่าความจริง — ไม่มีใครรู้ว่าหายจนกว่าจะไปนับมือกับฐาน
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { loadLumosJobCallSummaryMap } = await import('../../api/_lib/lumosDispatch.js');

const undefinedColumn = Object.assign(new Error('column does not exist'), { code: '42703' });
const undefinedTable = Object.assign(new Error('no relation'), { code: '42P01' });
const otherDbError = Object.assign(new Error('connection lost'), { code: '57P01' });

type Row = Record<string, unknown>;

/** คิวรีสรุปคิว กับคิวรีนับชุดรออนุมัติ เป็นคนละคำสั่ง — แยกด้วยชื่อตาราง */
function mockDb(opts: { queueRows?: Row[]; batchRows?: Row[]; queueThrows?: unknown } = {}) {
  vi.mocked(dbQuery).mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (/from\s+lumos_call_batches/i.test(s)) return { rows: opts.batchRows ?? [] } as never;
    if (opts.queueThrows) throw opts.queueThrows;
    return { rows: opts.queueRows ?? [] } as never;
  });
}

const queueRow = (over: Row = {}): Row => ({
  job_ref: 'siamraj-sql:DS1',
  sent: '10',
  called: '4',
  confirmed: '1',
  declined: '1',
  no_answer: '2',
  reschedule: '0',
  needs_human: '0',
  ...over,
});

const sqlOf = (re: RegExp) =>
  String(vi.mocked(dbQuery).mock.calls.find((c) => re.test(String(c[0])))?.[0] ?? '');

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  mockDb();
});

describe('อ่าน outcome จากสองแหล่ง — ผลที่คนบันทึกต้องไม่หาย', () => {
  it('ใช้ coalesce(last_outcome, result->>\'outcome\') ไม่ใช่ result อย่างเดียว', async () => {
    await loadLumosJobCallSummaryMap();
    const sql = sqlOf(/from\s+lumos_dispatch_queue/i);
    // ผลที่ "คน" บันทึกเขียนแค่ last_outcome · ตั้งโทรซ้ำก็ล้าง result ทิ้ง
    // อ่าน result อย่างเดียวเมื่อไหร่ ตัวเลขข้างการ์ดจะน้อยกว่าความจริงแบบเงียบ ๆ
    expect(sql).toMatch(/coalesce\(last_outcome,\s*result->>'outcome'\)/i);
  });

  it('ไม่นับสายที่ถูกยกเลิกเป็น "โทรแล้ว"', async () => {
    await loadLumosJobCallSummaryMap();
    const sql = sqlOf(/from\s+lumos_dispatch_queue/i);
    expect(sql).toMatch(/oc is not null and oc <> 'cancelled'/i);
  });

  it('ไม่รวมงานโทรของหน้า Follow เข้ามาปนกับใบขอ', async () => {
    await loadLumosJobCallSummaryMap();
    expect(sqlOf(/from\s+lumos_dispatch_queue/i)).toMatch(/job_ref <> 'follow'/i);
  });

  it('แปลงเป็นตัวเลขครบทุกช่อง', async () => {
    mockDb({ queueRows: [queueRow({ reschedule: '3', needs_human: '2' })] });
    const map = await loadLumosJobCallSummaryMap();
    expect(map.get('siamraj-sql:DS1')).toEqual({
      pendingApproval: 0,
      sent: 10,
      called: 4,
      confirmed: 1,
      declined: 1,
      no_answer: 2,
      reschedule: 3,
      needsHuman: 2,
    });
  });
});

describe('ยังไม่ได้รัน migration 070 (ไม่มีคอลัมน์ last_outcome/followup_state)', () => {
  it('ถอยไปใช้สูตรเดิม แทนที่จะทำให้ตัวเลขหายทั้งแถบ', async () => {
    let first = true;
    vi.mocked(dbQuery).mockImplementation(async (sql: string) => {
      if (/from\s+lumos_call_batches/i.test(String(sql))) return { rows: [] } as never;
      if (first) {
        first = false;
        throw undefinedColumn;
      }
      return { rows: [queueRow()] } as never;
    });
    const map = await loadLumosJobCallSummaryMap();
    expect(map.get('siamraj-sql:DS1')?.sent).toBe(10);
    // สูตรถอยหลังไม่มีสองช่องนี้ ต้องเป็น 0 ไม่ใช่ undefined/NaN
    expect(map.get('siamraj-sql:DS1')?.reschedule).toBe(0);
    expect(map.get('siamraj-sql:DS1')?.needsHuman).toBe(0);
  });

  it('DB ล้มด้วยเหตุอื่น → โยนต่อ ไม่กลืนเป็น "ไม่มีข้อมูล"', async () => {
    mockDb({ queueThrows: otherDbError });
    await expect(loadLumosJobCallSummaryMap()).rejects.toThrow('connection lost');
  });
});

describe('ชุดที่รออนุมัติ — ต่อเข้ากับตัวเลขของใบเดียวกัน', () => {
  it('นับเข้าใบที่ตรงกัน', async () => {
    mockDb({
      queueRows: [queueRow()],
      batchRows: [{ job_id: 'siamraj-sql:DS1', n: '5' }],
    });
    const map = await loadLumosJobCallSummaryMap();
    expect(map.get('siamraj-sql:DS1')?.pendingApproval).toBe(5);
  });

  it('ใบที่มีแต่ชุดรออนุมัติ ยังไม่เคยเข้าคิวเลย ต้องมีแถวของตัวเอง', async () => {
    // ไม่งั้นการ์ดใบนั้นจะว่างเปล่าทั้งที่มีคนรอให้กดอนุมัติอยู่ — เคสจริงของใบที่เพิ่งตั้งชุด
    mockDb({ queueRows: [], batchRows: [{ job_id: 'siamraj-sql:NEW1', n: '3' }] });
    const map = await loadLumosJobCallSummaryMap();
    expect(map.get('siamraj-sql:NEW1')).toEqual({
      pendingApproval: 3,
      sent: 0,
      called: 0,
      confirmed: 0,
      declined: 0,
      no_answer: 0,
      reschedule: 0,
      needsHuman: 0,
    });
  });

  it('ตารางชุดยังไม่ migrate → ตัวเลขที่เหลือต้องยังมาครบ (แค่รออนุมัติเป็น 0)', async () => {
    vi.mocked(dbQuery).mockImplementation(async (sql: string) => {
      if (/from\s+lumos_call_batches/i.test(String(sql))) throw undefinedTable;
      return { rows: [queueRow()] } as never;
    });
    const map = await loadLumosJobCallSummaryMap();
    expect(map.get('siamraj-sql:DS1')?.sent).toBe(10);
    expect(map.get('siamraj-sql:DS1')?.pendingApproval).toBe(0);
  });

  it('อ่านตารางชุดล้มด้วยเหตุอื่น → โยนต่อ ห้ามกลายเป็น "รออนุมัติ 0"', async () => {
    // 0 ที่แปลว่า "เช็คไม่ได้" อันตรายกว่าไม่มีตัวเลข — คนอ่านจะคิดว่าไม่มีใครรอให้กดอนุมัติ
    vi.mocked(dbQuery).mockImplementation(async (sql: string) => {
      if (/from\s+lumos_call_batches/i.test(String(sql))) throw otherDbError;
      return { rows: [queueRow()] } as never;
    });
    await expect(loadLumosJobCallSummaryMap()).rejects.toThrow('connection lost');
  });
});
