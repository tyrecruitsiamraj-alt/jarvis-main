// @vitest-environment node
/**
 * เส้น `/api/job-applications-import` (1 ต.ค. 2569)
 * 🔴 ด่าน: ไฟล์ตัวอย่างอ่านกลับได้หัวเดิม · dry run ไม่เขียนอะไร · เบอร์ที่สมัครภายใน 14 วันโชว์ว่าข้าม + วันที่ได้ ·
 *    บันทึกในธุรกรรมเดียว ล็อกเบอร์ทีละแถวเรียงตามเบอร์ (มีคนสมัครเข้ามาระหว่างดูตัวอย่าง = ข้ามแถวนั้น ที่เหลือบันทึก) ·
 *    ผู้ใช้ที่ถูกล็อก BU นำเข้าได้ ใบจำแผนกตัวเอง (11 ต.ค. 2569) · ล็อกแต่ไม่รู้แผนก = 403 ·
 *    ขาดคอลัมน์ที่ต้องมี = 400 บอกชื่อคอลัมน์ · AI ไม่ถูกเรียก (นำเข้าจากแท็บผู้สมัคร)
 * 🔴 นำเข้าตามกล่อง (15 ต.ค. 2569): `job_id` ผูกทุกแถว + `send_ai` ส่งเข้าคิว AI เส้นเดียวกับปุ่มส่ง AI ·
 *    ใบนอก BU = 403 · ใบปิด/ไม่เจอ = 404 · ซ้ำ iRecruit ไม่ส่ง · ส่งล้ม = นำเข้ายังสำเร็จ + บอกให้ส่งเอง ·
 *    dry run บอกล่วงหน้าเมื่อใบยังไม่ตั้งรายได้
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { repeatImportReason } from '../../src/lib/applicationRepeat.js';

const dbQuery = vi.fn();
const txQuery = vi.fn();
const audit = vi.fn(async () => undefined);
const scoped = vi.fn(async (): Promise<Set<string> | null> => null);
type DeptScope = { mode: 'all' } | { mode: 'code'; code: string } | { mode: 'none' };
const deptScope = vi.fn(async (): Promise<DeptScope> => ({ mode: 'all' }));

vi.mock('../../api/_lib/postgres.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/postgres.js')>();
  return {
    ...mod,
    dbQuery: (...a: unknown[]) => dbQuery(...a),
    dbTransaction: async (fn: (c: { query: typeof txQuery }) => Promise<unknown>) => fn({ query: txQuery }),
  };
});
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: (...a: unknown[]) => audit(...(a as [])) }));
const jobById = vi.fn(async (): Promise<Record<string, unknown> | null> => ({ id: 'J1', unit_name: 'ไซต์ ก' }));
vi.mock('../../api/_lib/siamrajUnitRequests.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/siamrajUnitRequests.js')>();
  return { ...mod, loadScopedJobIdSet: () => scoped(), getSiamrajUnitRequestById: () => jobById() };
});
vi.mock('../../api/_lib/departmentScope.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/departmentScope.js')>();
  return { ...mod, loadUserDepartmentScope: () => deptScope() };
});
const enqueue = vi.fn(async (_jobId: string, apps: Array<{ id: string }>) => ({
  queued: apps.length,
  duplicated: [] as string[],
  skipped: [] as Array<{ ref: string; name: string; reason: string }>,
}));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  enqueueLumosInterviewForApplications: (...a: unknown[]) => enqueue(...(a as [string, Array<{ id: string }>])),
  NO_INCOME_REASON: 'ใบขอยังไม่ตั้งรายได้',
}));
const facts = vi.fn(async (): Promise<{ loaded?: boolean; monthlyIncome?: number | null }> => ({ loaded: true, monthlyIncome: 12000 }));
vi.mock('../../api/_lib/applyScriptFacts.js', () => ({ loadApplyScriptFacts: () => facts() }));
const dupIds = new Set<string>();
vi.mock('../../api/_lib/irecruitDuplicates.js', () => ({
  splitIrecruitDuplicates: async (apps: Array<{ id: string }>) => ({
    send: apps.filter((a) => !dupIds.has(a.id)),
    dups: apps.filter((a) => dupIds.has(a.id)).map((app) => ({ app, dup: { irecruitId: 1, appliedAt: '' } })),
  }),
}));

import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import handler from '../../api/_handlers/job-applications-import.js';
import { importTemplateHeaders } from '../../src/lib/applicantImport.js';

function req(method: string, body: Record<string, unknown> | null = null) {
  const token = signAuthToken({ sub: 'u-staff', email: 'staff@example.com', role: 'admin' });
  return { method, headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` }, query: {}, body };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
function xlsxBase64(rows: unknown[][]): string {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'ผู้สมัคร');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}
const H = importTemplateHeaders();
const person = (first: string, phone: string | number) => [first, 'ใจดี', phone, 33, 'ชาย', '', '', '', '', '', '', ''];
const LAST = new Date('2026-09-25T02:00:00Z'); // 25 ก.ย. 2569 ไทย → นำเข้าได้ 9 ต.ค.

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  dbQuery.mockReset().mockResolvedValue({ rows: [] });
  txQuery.mockReset();
  audit.mockClear();
  scoped.mockReset().mockResolvedValue(null);
  deptScope.mockReset().mockResolvedValue({ mode: 'all' });
  enqueue.mockClear();
  jobById.mockReset().mockResolvedValue({ id: 'J1', unit_name: 'ไซต์ ก' });
  facts.mockReset().mockResolvedValue({ loaded: true, monthlyIncome: 12000 });
  dupIds.clear();
});

describe('GET — ไฟล์ตัวอย่าง', () => {
  it('ได้ .xlsx ที่อ่านกลับแล้วหัวคอลัมน์ตรงชุดกลาง + มีชีตค่าที่ใช้ได้', async () => {
    const { res, json } = mockRes();
    await handler(req('GET') as never, res as never);
    const body = json.mock.calls[0][0];
    expect(body.filename).toBe('นำเข้าผู้สมัคร.xlsx');
    const wb = XLSX.read(Buffer.from(body.dataBase64, 'base64'), { type: 'buffer' });
    // + ชีตซ่อน "รายการ" ของ Dropdown ในไฟล์ (12 ต.ค. 2569 · tests/api/importTemplateDropdown2569-10-12.test.ts)
    expect(wb.SheetNames).toEqual(['ผู้สมัคร', 'ค่าที่ใช้ได้', 'รายการ']);
    const [first] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['ผู้สมัคร'], { header: 1 });
    expect(first).toEqual(H);
  });
});

describe('POST — ตัวอย่างก่อนบันทึก / บันทึก', () => {
  it('🔴 dry run: ไม่เขียนอะไร · เบอร์ที่สมัครภายใน 14 วัน = ข้าม + บอกวันที่ได้ · เบอร์ที่ Excel ตัด 0 ถูกเติมคืน', async () => {
    dbQuery.mockImplementation((sql: string, params?: unknown[]) =>
      /max\(created_at\) as last_at[\s\S]*group by phone_e164/i.test(sql)
        ? Promise.resolve({ rows: [{ phone_e164: '+66822222222', last_at: LAST, params }] })
        : /distinct on \(phone_e164\)/i.test(sql)
          ? Promise.resolve({
              rows: [{ phone_e164: '+66822222222', created_at: LAST, status: 'contacted', job: 'คนสวน', n: 2 }],
            })
          : Promise.resolve({ rows: [] }),
    );
    const file = xlsxBase64([H, person('สมชาย', 812345678), person('สมหญิง', '0822222222')]);
    const { res, json } = mockRes();
    await handler(req('POST', { file_base64: file, dry_run: true }) as never, res as never);
    expect(repeatImportReason(LAST)).toBe('สมัครเข้ามาแล้วภายใน 14 วัน (ได้ตั้งแต่ 9/10/2569)');
    expect(json.mock.calls[0][0]).toEqual({
      dryRun: true,
      rows: [
        { row: 2, name: 'สมชาย ใจดี', phone: '0812345678', ok: true, reason: null },
        { row: 3, name: 'สมหญิง ใจดี', phone: '0822222222', ok: false, reason: repeatImportReason(LAST) },
      ],
      ready: 1,
      skipped: 1,
      // รายชื่อซ้ำ (4 ต.ค. 2569) — เบอร์ที่มีในระบบแล้ว: สมัครล่าสุด · สถานะล่าสุด · ข้ามไหม + ไฟล์ให้ดาวน์โหลด
      duplicates: [
        {
          row: 3,
          name: 'สมหญิง ใจดี',
          phone: '0822222222',
          lastAppliedAt: new Date(LAST).toISOString(),
          lastStatus: 'contacted',
          lastJob: 'คนสวน',
          applications: 2,
          skipped: true,
          note: repeatImportReason(LAST),
        },
      ],
      duplicatesFileBase64: expect.any(String),
    });
    const check = dbQuery.mock.calls.find((c) => /group by phone_e164/i.test(String(c[0])));
    expect(String(check?.[0])).toMatch(/at time zone 'Asia\/Bangkok'\)::date - 13\)/);
    expect(check?.[1]).toEqual([['0812345678', '0822222222']]);
    expect(txQuery).not.toHaveBeenCalled();
    expect(dbQuery.mock.calls.some((c) => /^\s*(insert|update|delete)/i.test(String(c[0])))).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });

  it('🔴 บันทึก: ล็อกเบอร์ทีละแถวเรียงตามเบอร์ · มีคนสมัครเข้ามาระหว่างดูตัวอย่าง = ข้ามแถวนั้น ที่เหลือบันทึก · จด log จำนวน', async () => {
    let n = 0;
    txQuery.mockImplementation((sql: string, params?: unknown[]) => {
      if (/pg_advisory_xact_lock/.test(sql)) return Promise.resolve({ rows: [] });
      if (/where phone_e164 = jarvis_phone_e164_thai\(\$1\)/.test(sql)) {
        return Promise.resolve({ rows: [{ last_at: (params as unknown[])[0] === '0822222222' ? LAST : null }] });
      }
      if (/^insert into/i.test(sql)) {
        n += 1;
        return Promise.resolve({ rows: [{ id: `new-${n}` }] });
      }
      return Promise.resolve({ rows: [] });
    });
    // ลำดับในไฟล์ ค → ข → ก แต่ล็อกต้องเรียงเบอร์ (คนนำเข้าพร้อมกันสองไฟล์ไม่ deadlock)
    const file = xlsxBase64([H, person('ค', '0833333333'), person('ข', '0822222222'), person('ก', '0811111111')]);
    const { res, json } = mockRes();
    await handler(req('POST', { file_base64: file, dry_run: false, responsible_name: 'เจ้าหน้าที่ ก', pdpa_consent: true }) as never, res as never);
    const body = json.mock.calls[0][0];
    expect(body.inserted).toBe(2);
    expect(body.rows.map((r: { row: number; reason: string | null }) => [r.row, r.reason])).toEqual([
      [2, null],
      [3, repeatImportReason(LAST)],
      [4, null],
    ]);
    const locks = txQuery.mock.calls
      .filter((c) => /pg_advisory_xact_lock/.test(String(c[0])))
      .map((c) => String((c[1] as unknown[])[0]));
    expect(locks).toEqual(['apply-phone:+66811111111', 'apply-phone:+66822222222', 'apply-phone:+66833333333']);
    const insert = txQuery.mock.calls.find((c) => /^insert into/i.test(String(c[0])));
    expect(String(insert?.[0])).toMatch(/values \(\$1,.*'new',\$18,\$19,\$20,\$21\) returning id/);
    expect((insert?.[1] as unknown[])[20]).toBeNull(); // เห็นทุกแผนก = ไม่ประทับแผนก (เหมือนเดิม)
    expect((insert?.[1] as unknown[])[12]).toBe('เจ้าหน้าที่ ก');
    expect((insert?.[1] as unknown[])[16]).toBe('staff@example.com');
    expect(audit.mock.calls[0][1]).toMatchObject({ action: 'job_application.import', after: { inserted: 2, skipped: 1 } });
    // นำเข้าจากแท็บผู้สมัคร (ไม่มี job_id) — AI ยังไม่โทร ใบไม่ผูกงาน
    expect(enqueue).not.toHaveBeenCalled();
    expect(body.ai).toBeUndefined();
    expect((insert?.[1] as unknown[])[17]).toBeNull();
  });

  it('error อื่นตอนบันทึก ⇒ ไม่บันทึกทั้งไฟล์ (ธุรกรรมล้ม)', async () => {
    txQuery.mockImplementation((sql: string) =>
      /^insert into/i.test(sql) ? Promise.reject(Object.assign(new Error('boom'), { code: '22001' })) : Promise.resolve({ rows: [] }),
    );
    const { res, status } = mockRes();
    await handler(req('POST', { file_base64: xlsxBase64([H, person('ก', '0811111111')]), dry_run: false, pdpa_consent: true }) as never, res as never);
    expect(status).toHaveBeenCalledWith(500);
    expect(audit).not.toHaveBeenCalled();
  });

  it('ขาดคอลัมน์ที่ต้องมี ⇒ 400 บอกชื่อคอลัมน์', async () => {
    const { res, status, json } = mockRes();
    await handler(req('POST', { file_base64: xlsxBase64([['ชื่อ', 'นามสกุล'], ['ก', 'ข']]), dry_run: true }) as never, res as never);
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0][0].message).toBe('ไฟล์ไม่มีคอลัมน์: เบอร์โทร, อายุ, เพศ');
  });

  it('🔴 ผู้ใช้ที่ถูกล็อก BU นำเข้าได้ — ใบจำแผนกของคนนำเข้า (เห็นใบตัวเองผ่าน department_code) · 11 ต.ค. 2569', async () => {
    scoped.mockResolvedValue(new Set(['J1']));
    deptScope.mockResolvedValue({ mode: 'code', code: 'LBD' });
    txQuery.mockImplementation((sql: string) =>
      /^insert into/i.test(sql) ? Promise.resolve({ rows: [{ id: 'new-1' }] }) : Promise.resolve({ rows: [] }),
    );
    const file = xlsxBase64([H, person('ก', '0811111111')]);
    const dry = mockRes();
    await handler(req('POST', { file_base64: file, dry_run: true }) as never, dry.res as never);
    expect(dry.status).toHaveBeenCalledWith(200);
    expect(dry.json.mock.calls[0][0].ready).toBe(1);

    const { res, json } = mockRes();
    await handler(req('POST', { file_base64: file, dry_run: false, pdpa_consent: true }) as never, res as never);
    expect(json.mock.calls[0][0].inserted).toBe(1);
    const insert = txQuery.mock.calls.find((c) => /^insert into/i.test(String(c[0])));
    expect(String(insert?.[0])).toMatch(/department_code\)/);
    expect((insert?.[1] as unknown[])[20]).toBe('LBD');
  });

  it('ล็อกแต่ไม่รู้แผนก ⇒ 403 บอกให้ตั้งแผนก (คีย์แล้วไม่มีใครในแผนกเห็น)', async () => {
    scoped.mockResolvedValue(new Set());
    deptScope.mockResolvedValue({ mode: 'none' });
    const { res, status, json } = mockRes();
    await handler(req('POST', { file_base64: xlsxBase64([H, person('ก', '0811111111')]), dry_run: true }) as never, res as never);
    expect(status).toHaveBeenCalledWith(403);
    expect(json.mock.calls[0][0].message).toMatch(/ยังไม่ได้ตั้งแผนก/);
    expect(txQuery).not.toHaveBeenCalled();
  });
});

describe('POST — นำเข้าตามกล่อง + ส่ง AI โทรเลย (15 ต.ค. 2569)', () => {
  const insertOk = () => {
    let n = 0;
    txQuery.mockImplementation((sql: string) => {
      if (/^insert into/i.test(sql)) {
        n += 1;
        return Promise.resolve({ rows: [{ id: `new-${n}` }] });
      }
      return Promise.resolve({ rows: [] });
    });
  };
  const file = () => xlsxBase64([H, person('ก', '0811111111'), person('ข', '0822222222')]);
  const boxBody = (extra: Record<string, unknown> = {}) => ({
    file_base64: file(),
    dry_run: false,
    pdpa_consent: true,
    job_id: 'J1',
    job_title: 'คนสวน',
    send_ai: true,
    ...extra,
  });

  it('🔴 ทุกแถวผูกใบขอ + ส่งเข้าคิว AI ทันที (push) ด้วยชื่อคนนำเข้า', async () => {
    insertOk();
    const { res, json } = mockRes();
    await handler(req('POST', boxBody()) as never, res as never);
    const body = json.mock.calls[0][0];
    expect(body.inserted).toBe(2);
    const insert = txQuery.mock.calls.find((c) => /^insert into/i.test(String(c[0])));
    expect((insert?.[1] as unknown[]).slice(17, 20)).toEqual(['J1', 'คนสวน', 'ไซต์ ก']);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [jobId, apps, opts] = enqueue.mock.calls[0] as unknown as [string, Array<Record<string, unknown>>, unknown];
    expect(jobId).toBe('J1');
    expect(opts).toEqual({ autoPush: true });
    expect(apps.map((a) => [a.id, a.job_id, a.created_by_name])).toEqual([
      ['new-1', 'J1', 'staff@example.com'],
      ['new-2', 'J1', 'staff@example.com'],
    ]);
    expect(body.ai).toEqual({ queued: 2, skipped: [] });
    expect(audit.mock.calls[0][1]).toMatchObject({ after: { job_id: 'J1', ai_queued: 2, ai_skipped: 0 } });
  });

  it('ซ้ำ iRecruit ภายใน 14 วัน = ไม่ส่ง AI (ให้คนเลือก) · บอกชื่อ + เหตุผล', async () => {
    insertOk();
    dupIds.add('new-2');
    const { res, json } = mockRes();
    await handler(req('POST', boxBody()) as never, res as never);
    const apps = (enqueue.mock.calls[0] as unknown as [string, Array<{ id: string }>])[1];
    expect(apps.map((a) => a.id)).toEqual(['new-1']);
    expect(json.mock.calls[0][0].ai.skipped).toEqual([{ name: 'ข ใจดี', reason: expect.stringMatching(/iRecruit/) }]);
  });

  it('ส่ง AI ล้ม = นำเข้ายังสำเร็จ + บอกให้กดส่งเองจากแท็บผู้สมัคร', async () => {
    insertOk();
    enqueue.mockRejectedValueOnce(new Error('lumos down'));
    const { res, status, json } = mockRes();
    await handler(req('POST', boxBody()) as never, res as never);
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0].inserted).toBe(2);
    expect(json.mock.calls[0][0].ai).toMatchObject({ queued: 0, error: expect.stringMatching(/แท็บผู้สมัคร/) });
  });

  it('ใบขอนอก BU = 403 · ใบปิด/ไม่เจอ = 404 — ไม่บันทึกอะไร', async () => {
    scoped.mockResolvedValue(new Set(['J2']));
    const a = mockRes();
    await handler(req('POST', boxBody()) as never, a.res as never);
    expect(a.status).toHaveBeenCalledWith(403);

    scoped.mockResolvedValue(null);
    jobById.mockResolvedValue(null);
    const b = mockRes();
    await handler(req('POST', boxBody()) as never, b.res as never);
    expect(b.status).toHaveBeenCalledWith(404);
    expect(txQuery).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('dry run บอกล่วงหน้าเมื่อใบยังไม่ตั้งรายได้ (AI ไม่โทร) · ตั้งแล้ว = null · ไม่เขียนอะไร', async () => {
    facts.mockResolvedValue({ loaded: true, monthlyIncome: null });
    const a = mockRes();
    await handler(req('POST', boxBody({ dry_run: true })) as never, a.res as never);
    expect(a.json.mock.calls[0][0].ai_block).toBe('ใบขอยังไม่ตั้งรายได้');

    facts.mockResolvedValue({ loaded: true, monthlyIncome: 15000 });
    const b = mockRes();
    await handler(req('POST', boxBody({ dry_run: true })) as never, b.res as never);
    expect(b.json.mock.calls[0][0].ai_block).toBeNull();
    expect(txQuery).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('ทางเข้าบนการ์ด (15 ต.ค. 2569 · เจ้าของ "แต่ละกล่องไม่เห็นมีให้นำเข้าด้วย excel เลย")', () => {
  it('🔴 ปุ่มบนการ์ดมีคำ "นำเข้า Excel" + ขอบ — ไม่ใช่ไอคอนเปล่า (เคยหาไม่เจอ)', async () => {
    const { readFileSync } = await import('node:fs');
    const card = readFileSync('src/components/jobs/BoardJobCard.tsx', 'utf8');
    const btn = card.slice(card.indexOf('data-testid="board-card-import"') - 200, card.indexOf('data-testid="board-card-import"') + 400);
    expect(btn).toContain('variant="outline"');
    expect(btn).toContain('นำเข้า Excel');
    expect(btn).not.toContain('iconXs');
  });
});

describe('PDPA (15 ต.ค. 2569)', () => {
  it('🔴 บันทึกจริงไม่ติ๊กยินยอม = 400 ไม่บันทึก · ตัวอย่างก่อนบันทึกไม่ต้องติ๊ก', async () => {
    const file = xlsxBase64([H, person('ก', '0811111111')]);
    const a = mockRes();
    await handler(req('POST', { file_base64: file, dry_run: false }) as never, a.res as never);
    expect(a.status).toHaveBeenCalledWith(400);
    expect(a.json.mock.calls[0][0].message).toBe('ติ๊กว่าผู้สมัครยอมรับข้อตกลงก่อน'); // 17 ต.ค. 2569 คำเตือนฝั่งเจ้าหน้าที่
    expect(txQuery).not.toHaveBeenCalled();
    const b = mockRes();
    await handler(req('POST', { file_base64: file, dry_run: true }) as never, b.res as never);
    expect(b.status).toHaveBeenCalledWith(200);
  });

  it('ติ๊กแล้ว = จดยินยอมทุกใบที่บันทึก (ทาง import · คนนำเข้า · ฉบับข้อความ)', async () => {
    txQuery.mockImplementation((sql: string) =>
      /^insert into/i.test(sql) ? Promise.resolve({ rows: [{ id: '11111111-1111-4111-8111-111111111111' }] }) : Promise.resolve({ rows: [] }),
    );
    const { res } = mockRes();
    await handler(req('POST', { file_base64: xlsxBase64([H, person('ก', '0811111111')]), dry_run: false, pdpa_consent: true }) as never, res as never);
    const c = dbQuery.mock.calls.find((x) => /app_application_consents/.test(String(x[0])));
    expect(c?.[1]).toEqual([['11111111-1111-4111-8111-111111111111'], 'import', 'v1-2569-10-17', 'staff@example.com']);
  });
});

