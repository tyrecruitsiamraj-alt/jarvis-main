// @vitest-environment node
/**
 * "เสนอทีละงาน" — คิวต้องไม่เสิร์ฟคนเดียวกันหลายใบขอพร้อมกัน
 *
 * โจทย์จากเจ้าของ: คนเดียวแมทได้หลายใบ → เสนอทีละใบ ไม่ใช่โทรถล่มคนเดียวกัน
 * ข้อมูลจริง: card 1805 อยู่ในผลแมท 113 ใบขอ · ช่อง reminder มีแถวถึงคิว 2,816 แถว
 * แต่เป็นคนแค่ 126 คน (เฉลี่ยคนละ ~22 ใบ)
 *
 * ⚠️ **เกณฑ์ที่เลือกเทสต์: "พังแล้วเงียบสนิท"** — ถ้าตัวกันหลุด ระบบยังตอบ 200
 * Lumos ยังได้งานไปโทร ทุกอย่างดูปกติทุกหน้าจอ ต่างกันแค่ผู้สมัครถูกโทร 20 สายในวันเดียว
 * ซึ่งไม่มีใครในบริษัทเห็นจนกว่าจะมีคนโทรมาด่า · เทสต์นี้จึงอ่านโครงสร้าง SQL ตรง ๆ
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(async () => ({ rows: [{ id: 1 }] })),
  isPgUndefinedTable: () => false,
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/logger.js', () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock('../../api/_lib/candidateCallHolds.js', () => ({ listHeldPhones: vi.fn(async () => new Set()) }));
vi.mock('../../api/_lib/callFollowup.js', () => ({
  listSuppressedPhones: vi.fn(async () => new Set()),
  applyCallFollowupToQueueRow: vi.fn(),
}));
vi.mock('../../api/_lib/callBatchStore.js', () => ({
  countPendingApprovalByJob: vi.fn(async () => new Map()),
  releaseDueCallBatches: vi.fn(async () => 0),
}));
vi.mock('../../api/_lib/callFollowupPolicyStore.js', () => ({
  getCallFollowupPolicy: vi.fn(async () => ({
    maxAttempts: 3,
    retryGapHours: 24,
    rescheduleDefaultHours: 4,
    quietFromHour: 20,
    quietToHour: 8,
    suppressDays: 30,
  })),
}));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { listHeldPhones } = await import('../../api/_lib/candidateCallHolds.js');
const { listSuppressedPhones } = await import('../../api/_lib/callFollowup.js');
const {
  TAKE_PENDING_SQL,
  buildInterviewPayload,
  buildReminderPayload,
  enqueueLumosInterviewForSelected,
} = await import('../../api/_lib/lumosDispatch.js');

/** ตัดเอาเฉพาะเนื้อใน not exists ก้อนที่ n (นับจาก 0) */
function notExistsBlock(sql: string, n: number): string {
  const parts = sql.split(/not exists\s*\(/i).slice(1);
  const body = parts[n] ?? '';
  // ตัดที่วงเล็บปิดที่สมดุล — ในก้อนมีวงเล็บซ้อน (เงื่อนไข status)
  let depth = 1;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '(') depth += 1;
    else if (body[i] === ')') {
      depth -= 1;
      if (depth === 0) return body.slice(0, i);
    }
  }
  return body;
}

const inFlight = notExistsBlock(TAKE_PENDING_SQL, 0);
const earliestFirst = notExistsBlock(TAKE_PENDING_SQL, 1);

describe('เบอร์เดียวกันต้องมีสายเดียวที่กำลังเดิน', () => {
  it('มีตัวกันครบสองชั้น', () => {
    expect(TAKE_PENDING_SQL.match(/not exists/gi)?.length).toBe(2);
  });

  it('ชั้นที่ 1 — เบอร์ที่ส่งไปแล้วยังไม่มีผลกลับ ต้องบังใบอื่นไว้', () => {
    expect(inFlight).toMatch(/f\.result is null/);
    expect(inFlight).toMatch(/f\.status = 'delivered'/);
    // ต้องมีเพดานเวลา ไม่งั้นแถวที่ Lumos ทิ้งหายจะบังใบอื่นค้างถาวร
    expect(inFlight).toMatch(/f\.delivered_at >= now\(\) - interval/);
  });

  it('ชั้นที่ 2 — ในบรรดาใบที่ถึงคิวของเบอร์เดียวกัน เสิร์ฟใบที่มาก่อนใบเดียว', () => {
    // เทียบเป็น row comparison — เทียบ created_at อย่างเดียวจะเสมอกันได้เมื่อเข้าคิวพร้อมกัน
    // (เข้าคิวทีเดียวหลายใบเป็นเรื่องปกติของหน้านี้) แล้วจะไม่มีใครถูกเสิร์ฟเลย หรือถูกเสิร์ฟทั้งคู่
    expect(earliestFirst).toMatch(/\(e\.created_at, e\.id\) < \(c\.created_at, c\.id\)/);
  });

  it('ชั้นที่ 2 ต้องนับเฉพาะแถวที่ "ถึงคิว" ด้วยเกณฑ์เดียวกับแถวที่กำลังพิจารณา', () => {
    // ถ้านับแถวที่ยังไม่ถึงเวลานัด/ครบเพดานส่งแล้วด้วย แถวเหล่านั้นจะบังใบอื่นค้างถาวร
    for (const cond of [
      /e\.result is null/,
      /e\.delivery_count < \d+/,
      /e\.next_attempt_at is null or e\.next_attempt_at <= now\(\)/,
      /e\.status = 'pending'/,
    ]) {
      expect(earliestFirst).toMatch(cond);
    }
  });

  it('ทั้งสองชั้นต้องเทียบเบอร์ ไม่ใช่เทียบ person_ref', () => {
    // คนเดียวมีหลายรหัส (card-<id> ของบอร์ด · ir-<id> ของ iRecruit) แต่เบอร์ที่ดังมีเบอร์เดียว
    // เทียบด้วย ref จะกันไม่อยู่จริง — กติกาเดียวกับล็อก "รับไปโทรเอง"
    for (const block of [inFlight, earliestFirst]) {
      expect(block).toMatch(/payload->>'recipient_phone'/);
      expect(block).toMatch(/payload->>'phone'/);
      expect(block).not.toMatch(/person_ref/);
    }
  });

  it('ทั้งสองชั้นต้องข้ามช่อง — ห้ามกรอง channel ในตัวกัน', () => {
    // คนเดียวอยู่ได้ทั้งคิว reminder และ interview · กันเฉพาะช่องตัวเอง
    // = โดนโทรสองสายพร้อมกันจากคนละช่อง ซึ่งเป็นอาการเดิมเป๊ะ
    for (const block of [inFlight, earliestFirst]) {
      expect(block).not.toMatch(/channel/);
    }
    // แต่ตัวเลือกหลักยังต้องกรองช่องของตัวเอง (endpoint แยกกันคนละช่อง)
    expect(TAKE_PENDING_SQL).toMatch(/c\.channel = \$1/);
  });

  it('ทั้งสองชั้นต้องไม่บังตัวเอง', () => {
    expect(inFlight).toMatch(/f\.id <> c\.id/);
    expect(earliestFirst).toMatch(/e\.id <> c\.id/);
  });

  it('ยังต้อง claim แบบ skip locked — สอง request พร้อมกันห้ามได้แถวเดียวกัน', () => {
    expect(TAKE_PENDING_SQL).toMatch(/for update skip locked/);
  });
});

describe('เบอร์ใน payload — ต้องอ่านได้ทั้งสองช่อง', () => {
  const JOB = { unit_name: 'หน่วยงาน ก', job_description_code_1: 'ขับรถ' };
  const RESULT = { jobId: 'siamraj-sql:J1', request_no: 'J1', job_family_label: 'งานขับรถ' };

  it('reminder ใช้คีย์ recipient_phone · interview ใช้คีย์ phone', () => {
    // ⚠️ นี่คือต้นเหตุของบั๊กที่แก้ไปพร้อมกัน: payloadPhone() เดิมอ่านแค่ recipient_phone
    // ฝั่ง interview จึงได้ null ทุกแถว → ล็อก "รับไปโทรเอง" กับการพักเบอร์ไม่เคยมีผลกับ iRecruit
    const rem = buildReminderPayload(JOB, RESULT, { card_id: 1, full_name: 'ก', mobile: '0812345678' });
    const itv = buildInterviewPayload(JOB, RESULT, {
      id: 2,
      full_name: 'ข',
      phone_number: '0812345678',
      job_name_th: null,
      position_name: null,
    });
    expect(rem!.recipient_phone).toBe('+66812345678');
    expect(itv!.phone).toBe('+66812345678');
    expect(itv as unknown as Record<string, unknown>).not.toHaveProperty('recipient_phone');

    // SQL ต้องอ่านครบทั้งสองคีย์ ไม่งั้นเทียบเบอร์ข้ามช่องไม่เจอกัน
    for (const key of Object.keys({ recipient_phone: 1, phone: 1 })) {
      expect(TAKE_PENDING_SQL).toContain(`payload->>'${key}'`);
    }
  });
});

/**
 * ฝั่ง JS ของบั๊กเดียวกัน — `insertQueueItems()` คือคอขวดเดียวของการเข้าคิวทุกเส้น
 * ถ้ามันอ่านเบอร์ของ payload ฝั่ง iRecruit ไม่ออก ตัวกรองทั้งสองอย่าง (ล็อก + พักเบอร์)
 * จะถูก **ข้ามไปเงียบ ๆ** เพราะโค้ดเช็คเฉพาะเมื่อมีเบอร์
 */
describe('ล็อก "รับไปโทรเอง" + พักเบอร์ ต้องมีผลกับช่อง interview ด้วย', () => {
  const JOB = { unit_name: 'หน่วยงาน ก', job_description_code_1: 'ขับรถ' };
  const RESULT = { jobId: 'siamraj-sql:J1', request_no: 'J1', job_family_label: 'งานขับรถ' };
  const PERSON = {
    id: 7,
    full_name: 'สมชาย',
    phone_number: '0812345678',
    job_name_th: null,
    position_name: null,
  };

  beforeEach(() => {
    vi.mocked(dbQuery).mockClear();
    vi.mocked(listHeldPhones).mockResolvedValue(new Set());
    vi.mocked(listSuppressedPhones).mockResolvedValue(new Set());
  });

  const insertCalls = () =>
    vi.mocked(dbQuery).mock.calls.filter((c) => /insert into\s+lumos_dispatch_queue/i.test(String(c[0])));

  it('เบอร์ที่เจ้าหน้าที่ถือไว้ → ไม่เข้าคิว และรายงานว่าถูกถือ', async () => {
    vi.mocked(listHeldPhones).mockResolvedValue(new Set(['+66812345678']));
    const out = await enqueueLumosInterviewForSelected(JOB, RESULT, [PERSON]);
    expect(insertCalls()).toHaveLength(0);
    expect(out.queued).toBe(0);
    expect(out.skipped[0].reason).toContain('รับไปโทรเอง');
  });

  it('เบอร์ที่ถูกพัก (ไม่หางานแล้ว) → ไม่เข้าคิว และรายงานว่าถูกพัก', async () => {
    vi.mocked(listSuppressedPhones).mockResolvedValue(new Set(['+66812345678']));
    const out = await enqueueLumosInterviewForSelected(JOB, RESULT, [PERSON]);
    expect(insertCalls()).toHaveLength(0);
    expect(out.queued).toBe(0);
    expect(out.skipped[0].reason).toContain('พัก');
  });

  it('อ่านรายการพักเบอร์ไม่ได้ → ไม่ส่ง (เผลอโทรคนที่เลิกหางานแล้วเสียหายกว่า)', async () => {
    vi.mocked(listSuppressedPhones).mockRejectedValue(new Error('db down'));
    const out = await enqueueLumosInterviewForSelected(JOB, RESULT, [PERSON]);
    expect(insertCalls()).toHaveLength(0);
    expect(out.queued).toBe(0);
  });

  it('ไม่ติดอะไรเลย → เข้าคิวตามปกติ', async () => {
    const out = await enqueueLumosInterviewForSelected(JOB, RESULT, [PERSON]);
    expect(insertCalls()).toHaveLength(1);
    expect(out.queued).toBe(1);
  });
});
