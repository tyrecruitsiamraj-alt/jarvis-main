// @vitest-environment node
/**
 * เติม "รายได้ต่อเดือน + สวัสดิการ" ตอนเสิร์ฟคิว (16 ส.ค. 2569)
 *
 * ทำไมต้องมีเทสต์: จุดนี้เป็น**ที่เดียว**ที่รู้หน่วยของค่าแรง — ตอนประกอบ payload
 * มีแต่ `payment_rate` ดิบ (รายวัน 2,608 แถวจาก 16,264 บนฐานจริง) พูดตรง ๆ =
 * บอกเลขผิดสูงสุด 30 เท่า · ถ้าตัวเติมนี้หลุด บทจะเงียบเรื่องเงินโดยไม่มีสัญญาณอะไรเลย
 *
 * ⚠️ ห้ามยิงเส้นเสิร์ฟจริงตอนตรวจ (`GET /api/lumos/interview/candidates` = ส่งคนจริง
 * ให้ Lumos โทร) — เทสต์นี้จึง mock ทั้ง DB และ ERP
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJobBenefitRates = vi.fn();

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(async () => ({ rows: [] })),
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
// ⚠️ mock เฉพาะตัวที่ยิง ERP — ตรรกะคิดเงิน/ประโยคสวัสดิการใช้ของจริง
// (mock ทั้งโมดูลแล้วเทสต์จะพิสูจน์แค่ว่า "เรียกฟังก์ชัน" ไม่ได้พิสูจน์ว่าเลขถูก)
vi.mock('../../api/_lib/siamrajJobBenefits.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/_lib/siamrajJobBenefits.js')>()),
  fetchJobBenefitRates,
}));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { takePendingLumosItems } = await import('../../api/_lib/lumosDispatch.js');
const { EXTRA_INFO_PREFIX } = await import('../../api/_lib/lumosCallScript.js');

/** อัตราจริงจากฐาน: เงินเดือนรายวัน 500 (D) + ค่าครองชีพ 1,000 (M) + โอที 1.5 */
const RATES_DAILY = [
  { fee_name: 'เงินเดือน', fee_rate: 500, unit: 'D', is_wage: true },
  { fee_name: 'ค่าครองชีพ', fee_rate: 1000, unit: 'M', is_wage: false },
  { fee_name: 'ค่าล่วงเวลา 1.5 เท่า', fee_rate: 93.75, unit: 'H', is_wage: false },
];

function serveRows(rows: Array<{ id: number; job_ref: string; payload: unknown }>) {
  vi.mocked(dbQuery).mockImplementation(async (sql: unknown) =>
    String(sql).includes('first_delivered_at') ? { rows: [] } : ({ rows } as never),
  );
}

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  fetchJobBenefitRates.mockReset();
  fetchJobBenefitRates.mockResolvedValue(new Map([['OPL6908026', RATES_DAILY]]));
});

describe('ช่อง interview', () => {
  it('เติมรายได้ต่อเดือนเป็นคำถามเพิ่ม 1 ข้อ — คิดจากหน่วยจริง ไม่ใช่เลขดิบ', async () => {
    serveRows([
      { id: 1, job_ref: 'siamraj-sql:OPL6908026', payload: { questions: ['ข้อ 1'], scheduled_at: '2030-01-01T00:00:00.000Z' } },
    ]);
    const [out] = (await takePendingLumosItems('interview', 10)) as Array<{ questions: string[] }>;
    expect(out.questions).toHaveLength(2);
    // 500/วัน × 30 = 15,000 + ค่าครองชีพ 1,000 = 16,000 (ไม่ใช่ "500 บาท")
    expect(out.questions[1]).toContain('16,000 บาทต่อเดือน');
    expect(out.questions[1]).not.toMatch(/(^|\D)500(\D|$)/);
    // โอทีบอกเลขได้ (หน่วยต่อชั่วโมงแน่นอน) — ปัดเป็นจำนวนเต็ม
    expect(out.questions[1]).toContain('94');
  });

  it('เสิร์ฟรอบสองไม่เติมซ้ำ (at-least-once ถึง 5 รอบ)', async () => {
    const payload = { questions: ['ข้อ 1'], scheduled_at: '2030-01-01T00:00:00.000Z' };
    serveRows([{ id: 1, job_ref: 'siamraj-sql:OPL6908026', payload }]);
    await takePendingLumosItems('interview', 10);
    const [out] = (await takePendingLumosItems('interview', 10)) as Array<{ questions: string[] }>;
    expect(out.questions.filter((q) => q.includes(EXTRA_INFO_PREFIX))).toHaveLength(1);
  });
});

describe('ช่อง reminder', () => {
  it('เติมต่อท้ายข้อความทุก step — เลขรายได้ถูกถอดจากบทตอนประกอบแล้ว ต้องมาโผล่ที่นี่', async () => {
    serveRows([
      {
        id: 2,
        job_ref: 'siamraj-sql:OPL6908026',
        payload: { steps: [{ message: 'แจ้งงาน', scheduled_at: '2030-01-01T00:00:00.000Z' }] },
      },
    ]);
    const [out] = (await takePendingLumosItems('reminder', 10)) as Array<{ steps: Array<{ message: string }> }>;
    expect(out.steps[0].message).toContain('16,000 บาทต่อเดือน');
  });

  it('แถว Follow (job_ref = follow) ไม่มีเลขที่ใบขอ → ไม่มีอะไรให้ถาม ERP', async () => {
    serveRows([
      { id: 3, job_ref: 'follow', payload: { steps: [{ message: 'ตามเอกสาร', scheduled_at: '2030-01-01T00:00:00.000Z' }] } },
    ]);
    const [out] = (await takePendingLumosItems('reminder', 10)) as Array<{ steps: Array<{ message: string }> }>;
    // ส่งลิสต์เปล่าเข้าไป = `fetchJobBenefitRates` คืนทันทีโดยไม่แตะ mssql
    // (บทของ Follow เป็นเรื่องที่เจ้าหน้าที่ตั้งเอง ไม่ใช่การเสนองาน — ห้ามมีรายได้โผล่)
    expect(fetchJobBenefitRates).toHaveBeenCalledWith([]);
    expect(out.steps[0].message).toBe('ตามเอกสาร');
  });
});

describe('ERP ล่ม', () => {
  it('อ่านอัตราไม่ได้ = เสิร์ฟต่อแบบไม่พูดเรื่องเงิน (คิวห้ามหยุดเดิน)', async () => {
    fetchJobBenefitRates.mockRejectedValue(new Error('mssql timeout'));
    serveRows([
      { id: 4, job_ref: 'siamraj-sql:OPL6908026', payload: { questions: ['ข้อ 1'], scheduled_at: '2030-01-01T00:00:00.000Z' } },
    ]);
    const out = (await takePendingLumosItems('interview', 10)) as Array<{ questions: string[] }>;
    expect(out).toHaveLength(1);
    expect(out[0].questions).toHaveLength(1);
  });

  it('ไม่มีแถวค่าแรงหลัก = ไม่เดาเลขรายได้ แต่ยังพูดสวัสดิการได้', async () => {
    fetchJobBenefitRates.mockResolvedValue(
      new Map([['OPL6908026', [{ fee_name: 'เบี้ยขยัน', fee_rate: 500, unit: 'M', is_wage: false }]]]),
    );
    serveRows([
      { id: 5, job_ref: 'siamraj-sql:OPL6908026', payload: { questions: ['ข้อ 1'], scheduled_at: '2030-01-01T00:00:00.000Z' } },
    ]);
    const [out] = (await takePendingLumosItems('interview', 10)) as Array<{ questions: string[] }>;
    expect(out.questions[1]).toContain('เบี้ยขยัน');
    expect(out.questions[1]).not.toContain('ต่อเดือน');
  });
});
