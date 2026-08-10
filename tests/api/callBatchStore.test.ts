// @vitest-environment node
/**
 * `api/_lib/callBatchStore.ts` — ตัวสร้าง/อนุมัติ/ยกเลิก/ถอนคน/ปล่อยชุดโทรจริง
 *
 * เกณฑ์ที่เลือกเทสต์: "พังแล้วเงียบ" — ทุกเคสในไฟล์นี้ถ้าพัง ระบบยังตอบ 200 เหมือนเดิม
 * แต่ผลคือโทรหาคนซ้ำ / โทรทั้งที่ยกเลิกไปแล้ว / ชุดหายไปเฉย ๆ / ถอนคนผิดชุด
 *
 * ตรรกะฝั่งความหมายของสถานะอยู่ที่ `src/lib/callBatch.ts` มีเทสต์ของตัวเองที่
 * `tests/api/callBatch.test.ts` — ไฟล์นี้คุมเฉพาะ "เงื่อนไขที่ยิงลง DB จริง"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/appNotifications.js', () => ({ notifyRoles: vi.fn(async () => {}) }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { notifyRoles } = await import('../../api/_lib/appNotifications.js');
const { CALL_BATCH_UNDO_MINUTES } = await import('../../src/lib/callBatch.js');
const {
  approveCallBatch,
  cancelCallBatch,
  claimDueCallBatches,
  countPendingApprovalByJob,
  createCallBatch,
  getCallBatch,
  listCallBatches,
  removeCallBatchItem,
  releaseDueCallBatches,
  setCallBatchDispatcher,
} = await import('../../api/_lib/callBatchStore.js');

const undefinedTable = Object.assign(new Error('no relation'), { code: '42P01' });
const otherDbError = Object.assign(new Error('connection lost'), { code: '57P01' });

type Row = Record<string, unknown>;

function batchRow(over: Row = {}): Row {
  return {
    id: 'b-1',
    channel: 'reminder',
    job_id: 'siamraj-sql:DS1',
    request_no: 'DS1',
    status: 'pending_approval',
    release_at: null,
    created_by_name: 'ตั้ม',
    approved_by_name: null,
    approved_at: null,
    dispatched_at: null,
    cancelled_at: null,
    cancel_reason: null,
    note: null,
    created_at: '2026-08-10T02:00:00.000Z',
    ...over,
  };
}

function itemRow(over: Row = {}): Row {
  return {
    id: 'i-1',
    batch_id: 'b-1',
    source: 'board',
    candidate_ref: '1805',
    candidate_name: 'สมชาย',
    removed_at: null,
    ...over,
  };
}

/** ตอบตามชนิดของคิวรี — store ยิงหลายคิวรีต่อหนึ่งการเรียก (insert → insert item → select item) */
function mockDb(opts: { batchRows?: Row[]; itemRows?: Row[]; removeRows?: Row[] } = {}) {
  vi.mocked(dbQuery).mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (/update\s+lumos_call_batch_items/i.test(s)) return { rows: opts.removeRows ?? [] } as never;
    if (/insert into\s+lumos_call_batch_items/i.test(s)) return { rows: [] } as never;
    if (/from\s+lumos_call_batch_items/i.test(s)) return { rows: opts.itemRows ?? [] } as never;
    return { rows: opts.batchRows ?? [] } as never;
  });
}

const sqlCalls = () => vi.mocked(dbQuery).mock.calls.map((c) => String(c[0]));
const sqlMatching = (re: RegExp) => sqlCalls().filter((s) => re.test(s));
const callMatching = (re: RegExp) =>
  vi.mocked(dbQuery).mock.calls.find((c) => re.test(String(c[0])));

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(notifyRoles).mockClear();
  mockDb();
  // ตัวส่งเป็นตัวแปรระดับโมดูล ถอดออกไม่ได้ — ตั้งเป็น no-op ให้แต่ละเคสเริ่มเหมือนกัน
  // (เคส "ยังไม่ได้เสียบตัวส่ง" ใช้โมดูลที่โหลดใหม่จึงไม่โดนตัวนี้)
  setCallBatchDispatcher(async () => {});
});

describe('createCallBatch — สร้างชุด', () => {
  it('ไม่มีคนในชุด → ไม่แตะฐานเลย (กันชุดเปล่าที่กดอนุมัติแล้วไม่มีอะไรเกิดขึ้น)', async () => {
    const out = await createCallBatch({ channel: 'reminder', jobId: 'j1', items: [] });
    expect(out).toBeNull();
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('ปกติ → pending_approval + ยังไม่ตั้งเวลาปล่อย + เด้งบอกคนอนุมัติ', async () => {
    mockDb({ batchRows: [batchRow()], itemRows: [itemRow()] });
    const out = await createCallBatch({
      channel: 'reminder',
      jobId: 'siamraj-sql:DS1',
      requestNo: 'DS1',
      createdByName: 'ตั้ม',
      items: [{ source: 'board', candidateRef: '1805', candidateName: 'สมชาย' }],
    });

    const insert = callMatching(/insert into\s+lumos_call_batches/i)!;
    expect((insert[1] as unknown[])[3]).toBe('pending_approval');
    // release_at ต้องยังว่าง — ตั้งเวลาปล่อยตั้งแต่ตอนสร้าง = ส่งโดยไม่มีใครอนุมัติ
    expect(String(insert[0])).not.toMatch(/interval/i);

    expect(vi.mocked(notifyRoles)).toHaveBeenCalledTimes(1);
    const [roles, payload] = vi.mocked(notifyRoles).mock.calls[0];
    expect(roles).toEqual(['admin', 'supervisor']);
    expect(payload.type).toBe('batch_pending');
    expect(payload.dedupeKey).toContain('b-1');
    // หน้างานโทรถูกปิด — แผงอนุมัติย้ายไปหน้าหลัก แจ้งเตือนต้องพาไปที่ที่กดอนุมัติได้จริง
    expect(payload.link).toBe('/');

    expect(out?.items).toEqual([
      { id: 'i-1', source: 'board', candidateRef: '1805', candidateName: 'สมชาย', removed: false },
    ]);
  });

  it('autoApprove → approved + ตั้งเวลาปล่อยเป็นช่วงถอนคำ + ไม่ต้องเด้งขออนุมัติ', async () => {
    mockDb({ batchRows: [batchRow({ status: 'approved' })] });
    await createCallBatch({
      channel: 'interview',
      jobId: 'j1',
      autoApprove: true,
      items: [{ source: 'irecruit', candidateRef: '209375' }],
    });

    const insert = callMatching(/insert into\s+lumos_call_batches/i)!;
    expect((insert[1] as unknown[])[3]).toBe('approved');
    expect(String(insert[0])).toContain(`interval '${CALL_BATCH_UNDO_MINUTES} minutes'`);
    // ไม่มีใครต้องอนุมัติแล้ว เด้งไปก็เป็นเสียงรบกวน
    expect(vi.mocked(notifyRoles)).not.toHaveBeenCalled();
  });

  it('ติ๊กคนซ้ำในชุดเดียว → กันที่ DB ด้วย on conflict do nothing ไม่ใช่เชื่อฝั่งหน้าเว็บ', async () => {
    mockDb({ batchRows: [batchRow()] });
    await createCallBatch({
      channel: 'reminder',
      jobId: 'j1',
      items: [
        { source: 'board', candidateRef: '1805' },
        { source: 'board', candidateRef: '1805' },
      ],
    });
    const inserts = sqlMatching(/insert into\s+lumos_call_batch_items/i);
    expect(inserts.length).toBe(2);
    for (const s of inserts) {
      expect(s).toMatch(/on conflict\s*\(batch_id, source, candidate_ref\)\s*do nothing/i);
    }
  });

  it('insert ชุดไม่คืนแถว → หยุดตรงนั้น ไม่ใส่คนลงชุดที่ไม่มีอยู่จริง', async () => {
    mockDb({ batchRows: [] });
    const out = await createCallBatch({
      channel: 'reminder',
      jobId: 'j1',
      items: [{ source: 'board', candidateRef: '1805' }],
    });
    expect(out).toBeNull();
    expect(sqlMatching(/insert into\s+lumos_call_batch_items/i)).toHaveLength(0);
    expect(vi.mocked(notifyRoles)).not.toHaveBeenCalled();
  });
});

describe('approveCallBatch — อนุมัติ', () => {
  it('อนุมัติได้เฉพาะชุดที่ยังไม่ถูกตัดสิน (กันอนุมัติชุดที่ยกเลิก/ส่งไปแล้วซ้ำ)', async () => {
    mockDb({ batchRows: [batchRow({ status: 'approved' })] });
    await approveCallBatch('b-1', { userId: 'u1', name: 'หัวหน้า' });
    const sql = callMatching(/update\s+lumos_call_batches/i)![0] as string;
    expect(sql).toMatch(/where id = \$1 and status in \('draft', 'pending_approval'\)/i);
  });

  it('เวลาปล่อยต้องอยู่ข้างหน้า ไม่ใช่ now() — ไม่งั้นช่วงถอนคำหายไปเงียบ ๆ', async () => {
    mockDb({ batchRows: [batchRow({ status: 'approved' })] });
    await approveCallBatch('b-1', { name: 'หัวหน้า' });
    const sql = callMatching(/update\s+lumos_call_batches/i)![0] as string;
    expect(sql).toContain(`release_at = now() + interval '${CALL_BATCH_UNDO_MINUTES} minutes'`);
  });

  it('ไม่เข้าเงื่อนไข (สถานะไม่ใช่) → null ไม่ใช่ชุดเปล่า', async () => {
    mockDb({ batchRows: [] });
    expect(await approveCallBatch('b-1', { name: 'หัวหน้า' })).toBeNull();
  });
});

describe('cancelCallBatch — ยกเลิก', () => {
  it('ล้าง release_at ทิ้งด้วย — ไม่งั้นตัวปล่อยยังหยิบชุดที่ยกเลิกแล้วไปโทร', async () => {
    mockDb({ batchRows: [batchRow({ status: 'cancelled' })] });
    await cancelCallBatch('b-1', { name: 'ตั้ม', reason: 'ส่งผิดใบ' });
    const sql = callMatching(/update\s+lumos_call_batches/i)![0] as string;
    expect(sql).toContain('release_at = null');
    expect(sql).toMatch(/status in \('draft', 'pending_approval', 'approved'\)/i);
    // ส่งเข้าคิวไปแล้วยกเลิกไม่ได้ — คนอาจถูกโทรไปแล้ว
    expect(sql).not.toMatch(/'dispatched'/);
  });
});

describe('removeCallBatchItem — ถอนคนออกจากชุด', () => {
  it('ผูกทั้ง batch_id และ item id + ยังไม่ถูกถอน + ชุดต้องยังแก้ได้', async () => {
    mockDb({ removeRows: [{ id: 'i-1' }] });
    expect(await removeCallBatchItem('b-1', 'i-1', 'ตั้ม')).toBe(true);
    const call = callMatching(/update\s+lumos_call_batch_items/i)!;
    const sql = String(call[0]);
    // ถอนด้วย item id อย่างเดียว = ถอนคนออกจากชุดของแผนกอื่นได้
    expect(sql).toMatch(/i\.id = \$2 and i\.batch_id = \$1/i);
    expect(sql).toMatch(/i\.removed_at is null/i);
    expect(sql).toMatch(/status in \('draft', 'pending_approval', 'approved'\)/i);
    expect(call[1]).toEqual(['b-1', 'i-1', 'ตั้ม']);
  });

  it('ไม่มีแถวไหนเข้าเงื่อนไข → false (หน้าเว็บต้องได้รู้ว่าถอนไม่สำเร็จ)', async () => {
    mockDb({ removeRows: [] });
    expect(await removeCallBatchItem('b-1', 'i-9', 'ตั้ม')).toBe(false);
  });
});

describe('countPendingApprovalByJob — เลข "รออนุมัติ" ข้างการ์ดใบขอ', () => {
  it('นับทั้งรอกดและอนุมัติแล้วแต่ยังไม่ปล่อย + ไม่นับคนที่ถูกถอนออก', async () => {
    mockDb({ batchRows: [{ job_id: 'siamraj-sql:DS1', n: '4' }] });
    const map = await countPendingApprovalByJob();
    const sql = callMatching(/from\s+lumos_call_batches/i)![0] as string;
    // อนุมัติแล้วแต่ยังอยู่ในช่วงถอนคำ = ยังไม่ได้โทร ต้องนับด้วย
    expect(sql).toMatch(/status in \('pending_approval', 'approved'\)/i);
    // ถอนคนออกแล้วยังนับอยู่ = เลขบนการ์ดบอกว่ามีคนรอโทรทั้งที่ไม่มี
    expect(sql).toMatch(/i\.removed_at is null/i);
    expect(map.get('siamraj-sql:DS1')).toBe(4);
  });

  it('ตารางยังไม่ migrate → คืน map ว่าง ไม่ล้ม', async () => {
    vi.mocked(dbQuery).mockRejectedValue(undefinedTable);
    expect((await countPendingApprovalByJob()).size).toBe(0);
  });

  it('DB ล้มด้วยเหตุอื่น → โยนต่อ', async () => {
    vi.mocked(dbQuery).mockRejectedValue(otherDbError);
    await expect(countPendingApprovalByJob()).rejects.toThrow('connection lost');
  });
});

describe('claimDueCallBatches — claim-then-work กัน 2 request ปล่อยชุดเดียวกันซ้ำ', () => {
  it('mark dispatched พร้อมเงื่อนไข approved + ถึงเวลา + skip locked ในคิวรีเดียว', async () => {
    mockDb({ batchRows: [batchRow({ status: 'dispatched' })] });
    await claimDueCallBatches();
    const sql = callMatching(/update\s+lumos_call_batches/i)![0] as string;
    expect(sql).toMatch(/set status = 'dispatched'/i);
    expect(sql).toMatch(/where status = 'approved'/i);
    expect(sql).toMatch(/release_at is not null and release_at <= now\(\)/i);
    // ถอด skip locked ออก = 2 request ที่เข้ามาพร้อมกันปล่อยชุดเดียวกันได้ → โทรซ้ำ
    expect(sql).toMatch(/for update skip locked/i);
  });

  it('ตารางยังไม่ migrate → คืนว่าง ไม่ล้ม', async () => {
    vi.mocked(dbQuery).mockRejectedValue(undefinedTable);
    expect(await claimDueCallBatches()).toEqual([]);
  });

  it('DB ล้มด้วยเหตุอื่น → โยนต่อ ไม่กลืนเป็น "ไม่มีชุดถึงเวลา"', async () => {
    vi.mocked(dbQuery).mockRejectedValue(otherDbError);
    await expect(claimDueCallBatches()).rejects.toThrow('connection lost');
  });
});

describe('releaseDueCallBatches — ปล่อยจริง', () => {
  it('ยังไม่ได้เสียบตัวส่ง → ห้าม claim (ไม่งั้นชุดถูก mark dispatched ทั้งที่ไม่มีใครส่ง = หายเงียบ)', async () => {
    vi.resetModules();
    const pg = await import('../../api/_lib/postgres.js');
    const fresh = await import('../../api/_lib/callBatchStore.js');
    vi.mocked(pg.dbQuery).mockReset();

    expect(await fresh.releaseDueCallBatches()).toBe(0);
    expect(vi.mocked(pg.dbQuery)).not.toHaveBeenCalled();
  });

  it('ชุดหนึ่งส่งไม่สำเร็จ ต้องไม่ทำให้ชุดที่เหลือไม่ถูกส่ง', async () => {
    mockDb({
      batchRows: [batchRow({ id: 'b-1' }), batchRow({ id: 'b-2' }), batchRow({ id: 'b-3' })],
      itemRows: [],
    });
    const seen: string[] = [];
    setCallBatchDispatcher(async (b) => {
      seen.push(b.id);
      if (b.id === 'b-2') throw new Error('lumos ไม่ตอบ');
    });

    expect(await releaseDueCallBatches()).toBe(2);
    expect(seen).toEqual(['b-1', 'b-2', 'b-3']);
  });
});

describe('อ่านชุด — การจับคู่คนเข้าชุดและการกันตารางหาย', () => {
  it('คนถูกจัดเข้าชุดของตัวเอง ไม่ปนข้ามชุด', async () => {
    mockDb({
      batchRows: [batchRow({ id: 'b-1' }), batchRow({ id: 'b-2' })],
      itemRows: [
        itemRow({ id: 'i-1', batch_id: 'b-1' }),
        itemRow({ id: 'i-2', batch_id: 'b-2', candidate_ref: '2000' }),
        itemRow({ id: 'i-3', batch_id: 'b-1', candidate_ref: '3000' }),
      ],
    });
    const list = await listCallBatches();
    expect(list.map((b) => b.items.map((i) => i.candidateRef))).toEqual([
      ['1805', '3000'],
      ['2000'],
    ]);
  });

  it('ถอนแล้วต้องติดธง removed — ตัวปล่อยใช้ธงนี้ตัดคนออก', async () => {
    mockDb({
      batchRows: [batchRow()],
      itemRows: [itemRow({ removed_at: '2026-08-10T04:00:00.000Z' })],
    });
    const b = await getCallBatch('b-1');
    expect(b?.items[0].removed).toBe(true);
  });

  it('ค่าช่อง/ต้นทางที่ไม่รู้จักจากข้อมูลเก่า → ตกลง reminder/board ไม่ปล่อยค่าดิบออกหน้าเว็บ', async () => {
    mockDb({
      batchRows: [batchRow({ channel: 'weird' })],
      itemRows: [itemRow({ source: 'weird' })],
    });
    const b = await getCallBatch('b-1');
    expect(b?.channel).toBe('reminder');
    expect(b?.items[0].source).toBe('board');
  });

  it('limit ถูกบีบอยู่ในช่วง 1–200 เสมอ (กันดึงทั้งตารางหรือดึง 0 แถว)', async () => {
    // คิวรีของ listCallBatches เอง — แยกจาก update ของ claimDueCallBatches ที่ถูกเรียกก่อนหน้า
    const listQuery = /order by \(status in/i;
    mockDb({ batchRows: [] });
    await listCallBatches(1_000_000);
    expect((callMatching(listQuery)![1] as unknown[])[0]).toBe(200);

    vi.mocked(dbQuery).mockClear();
    await listCallBatches(0);
    expect((callMatching(listQuery)![1] as unknown[])[0]).toBe(1);
  });

  it('ตารางยังไม่ migrate → getCallBatch null · listCallBatches ว่าง (หน้าเว็บไม่พัง)', async () => {
    vi.mocked(dbQuery).mockRejectedValue(undefinedTable);
    expect(await getCallBatch('b-1')).toBeNull();
    expect(await listCallBatches()).toEqual([]);
  });

  it('DB ล้มด้วยเหตุอื่น → โยนต่อทั้งสองทาง', async () => {
    vi.mocked(dbQuery).mockRejectedValue(otherDbError);
    await expect(getCallBatch('b-1')).rejects.toThrow('connection lost');
    await expect(listCallBatches()).rejects.toThrow('connection lost');
  });
});
