// @vitest-environment node
/**
 * funnel การโทรแยกตามต้นทาง (`?source=`)
 *
 * ที่มา: หน้า Follow โชว์ยอดรวมทั้งระบบ 5,307 ทั้งที่หน้านั้นส่งเองแค่ 1 คน
 * เจ้าของทัก 10 ส.ค. 2569 ("ส่ง 1 คนเองทำไมขึ้นตั้ง 5307") — ตัวเลขถูก
 * แต่ตอบคนละคำถามกับที่คนเปิดหน้านั้นอยากรู้
 *
 * ต้นทางแยกจาก prefix ของ `person_ref`: follow- / card- / ir-
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
vi.mock('../../api/_lib/http.js', async (orig) => {
  const actual = await orig<typeof import('../../api/_lib/http.js')>();
  return { ...actual, withRbac: (h: unknown) => h };
});

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { default: handler } = await import('../../api/_handlers/lumos-call-funnel.js');

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
const sqlOf = (i: number) => String(vi.mocked(dbQuery).mock.calls[i]?.[0] ?? '');

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
});

describe('?source= — กรองต้นทางด้วย prefix ของ person_ref', () => {
  it('follow = เฉพาะรายชื่อที่ลงในหน้า Follow', async () => {
    const { res } = mockRes();
    await handler({ method: 'GET', query: { source: 'follow' } } as never, res as never);
    expect(sqlOf(0)).toMatch(/person_ref like 'follow-%'/);
    expect(sqlOf(0)).not.toMatch(/card-%/);
  });

  it('board = เฉพาะคนบนบอร์ดที่ส่งจากหน้า Matching', async () => {
    const { res } = mockRes();
    await handler({ method: 'GET', query: { source: 'board' } } as never, res as never);
    expect(sqlOf(0)).toMatch(/person_ref like 'card-%'/);
  });

  it('irecruit = เฉพาะผลค้นหา iRecruit', async () => {
    const { res } = mockRes();
    await handler({ method: 'GET', query: { source: 'irecruit' } } as never, res as never);
    expect(sqlOf(0)).toMatch(/person_ref like 'ir-%'/);
  });

  it('ไม่ส่ง source = ทั้งระบบ (พฤติกรรมเดิม ลิงก์เก่าต้องไม่พัง)', async () => {
    const { res } = mockRes();
    await handler({ method: 'GET', query: {} } as never, res as never);
    expect(sqlOf(0)).not.toMatch(/person_ref like/);
  });

  it('ค่าที่ไม่รู้จัก = ถอยไปทั้งระบบ ไม่ใช่ error และไม่หลุดลง SQL', async () => {
    const { res, status, json } = mockRes();
    await handler(
      { method: 'GET', query: { source: "board'; drop table x --" } } as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0].source).toBe('all');
    expect(sqlOf(0)).not.toMatch(/drop table/i);
    expect(sqlOf(0)).not.toMatch(/person_ref like/);
  });

  it('ใช้ร่วมกับ since ได้ — เงื่อนไขต้องต่อด้วย and ไม่ใช่ where ซ้อน', async () => {
    const { res } = mockRes();
    await handler(
      { method: 'GET', query: { source: 'follow', since: '2026-08-01' } } as never,
      res as never,
    );
    const sql = sqlOf(0);
    expect(sql).toMatch(/created_at >= \$1/);
    expect(sql).toMatch(/and person_ref like 'follow-%'/);
    expect((sql.match(/\bwhere\b/gi) || []).length).toBe(1);
  });

  it('ถัง "ต้องคนตาม" ถูกกรองต้นทางเดียวกัน (ไม่งั้นตัวเลขกับรายชื่อขัดกันเอง)', async () => {
    const { res } = mockRes();
    await handler({ method: 'GET', query: { source: 'follow' } } as never, res as never);
    const allSql = vi.mocked(dbQuery).mock.calls.map((c) => String(c[0]));
    const needsHumanSql = allSql.find((q) => q.includes("followup_state = 'needs_human'"));
    expect(needsHumanSql).toBeTruthy();
    expect(needsHumanSql).toMatch(/person_ref like 'follow-%'/);
  });

  it('source=all ไม่กรองถังต้องคนตาม', async () => {
    const { res } = mockRes();
    await handler({ method: 'GET', query: {} } as never, res as never);
    const allSql = vi.mocked(dbQuery).mock.calls.map((c) => String(c[0]));
    const needsHumanSql = allSql.find((q) => q.includes("followup_state = 'needs_human'"));
    expect(needsHumanSql).not.toMatch(/person_ref like/);
  });
});

/**
 * แผง "AI โทร" หน้า Matching — field ใหม่ 14 ส.ค. 2569 (ข้อ 5 ของรอบสิบสอง)
 * queuedActive แยกยกเลิก · human block จาก candidate_call_holds · byAttempt มี cancelled
 */
describe('field ฝั่ง AI โทร + คนเก็บไปโทร', () => {
  const holdsSqlOf = () =>
    vi
      .mocked(dbQuery)
      .mock.calls.map((c) => String(c[0]))
      .find((q) => q.includes('candidate_call_holds'));

  it('human: board รวม application · irecruit แยก · follow ไม่ยิงคิวรีเลย', async () => {
    await handler({ method: 'GET', query: { source: 'board' } } as never, mockRes().res as never);
    expect(holdsSqlOf()).toMatch(/source in \('board','application'\)/);

    vi.mocked(dbQuery).mockReset();
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
    await handler({ method: 'GET', query: { source: 'irecruit' } } as never, mockRes().res as never);
    expect(holdsSqlOf()).toMatch(/source = 'irecruit'/);

    vi.mocked(dbQuery).mockReset();
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
    await handler({ method: 'GET', query: { source: 'follow' } } as never, mockRes().res as never);
    // Follow ไม่มีล็อก "รับไปโทรเอง" — ต้องไม่แตะตาราง holds เลย
    expect(holdsSqlOf()).toBeUndefined();
  });

  it('queuedActive แยกแถวยกเลิกออก · byAttempt มีถัง cancelled', async () => {
    // mock: queue คืน 2 กลุ่ม (active pending + cancelled) · holds คืนว่าง
    vi.mocked(dbQuery).mockImplementation((async (sql: string) => {
      if (String(sql).includes('attempt_no')) {
        return {
          rows: [
            {
              status: 'pending', last_outcome: null, followup_state: null,
              has_result: false, scheduled_ahead: false, attempt_no: 1, n: '10',
            },
            {
              status: 'cancelled', last_outcome: null, followup_state: null,
              has_result: false, scheduled_ahead: false, attempt_no: 1, n: '3',
            },
          ],
        };
      }
      return { rows: [] };
    }) as never);
    const { res, json } = mockRes();
    await handler({ method: 'GET', query: {} } as never, res as never);
    const { funnel } = json.mock.calls[0][0];
    expect(funnel.queued).toBe(13); // รวมยกเลิก
    expect(funnel.queuedActive).toBe(10); // ไม่รวมยกเลิก
    const round1 = funnel.byAttempt.find((a: { attempt: number }) => a.attempt === 1);
    expect(round1.cancelled).toBe(3);
    expect(round1.pending).toBe(10); // ยกเลิกไม่ตกไปปนกับ pending
  });

  it('retryScheduledState นับจาก followup_state ไม่ใช่ next_attempt_at', async () => {
    vi.mocked(dbQuery).mockImplementation((async (sql: string) => {
      if (String(sql).includes('attempt_no')) {
        return {
          rows: [
            {
              status: 'pending', last_outcome: 'no_answer', followup_state: 'retry_scheduled',
              has_result: false, scheduled_ahead: false, attempt_no: 2, n: '5',
            },
          ],
        };
      }
      return { rows: [] };
    }) as never);
    const { res, json } = mockRes();
    await handler({ method: 'GET', query: {} } as never, res as never);
    const { funnel } = json.mock.calls[0][0];
    expect(funnel.retryScheduledState).toBe(5);
    expect(funnel.retryScheduled).toBe(0); // scheduled_ahead=false → ตัวเก่าไม่นับ
  });
});
