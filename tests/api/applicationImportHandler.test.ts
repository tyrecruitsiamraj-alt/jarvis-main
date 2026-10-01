// @vitest-environment node
/**
 * เส้น `/api/job-applications-import` (1 ต.ค. 2569)
 * 🔴 ด่าน: ไฟล์ตัวอย่างอ่านกลับได้หัวเดิม · dry run ไม่เขียนอะไร · เบอร์ที่สมัครภายใน 14 วันโชว์ว่าข้าม + วันที่ได้ ·
 *    บันทึกในธุรกรรมเดียว ล็อกเบอร์ทีละแถวเรียงตามเบอร์ (มีคนสมัครเข้ามาระหว่างดูตัวอย่าง = ข้ามแถวนั้น ที่เหลือบันทึก) ·
 *    ผู้ใช้ที่ถูกล็อก BU นำเข้าไม่ได้ · ขาดคอลัมน์ที่ต้องมี = 400 บอกชื่อคอลัมน์ · AI ไม่ถูกเรียก
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { repeatImportReason } from '../../src/lib/applicationRepeat.js';

const dbQuery = vi.fn();
const txQuery = vi.fn();
const audit = vi.fn(async () => undefined);
const scoped = vi.fn(async (): Promise<Set<string> | null> => null);

vi.mock('../../api/_lib/postgres.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/postgres.js')>();
  return {
    ...mod,
    dbQuery: (...a: unknown[]) => dbQuery(...a),
    dbTransaction: async (fn: (c: { query: typeof txQuery }) => Promise<unknown>) => fn({ query: txQuery }),
  };
});
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: (...a: unknown[]) => audit(...(a as [])) }));
vi.mock('../../api/_lib/siamrajUnitRequests.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/siamrajUnitRequests.js')>();
  return { ...mod, loadScopedJobIdSet: () => scoped() };
});
vi.mock('../../api/_lib/lumosDispatch.js', () => {
  throw new Error('นำเข้าห้ามแตะคิว AI');
});

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
});

describe('GET — ไฟล์ตัวอย่าง', () => {
  it('ได้ .xlsx ที่อ่านกลับแล้วหัวคอลัมน์ตรงชุดกลาง + มีชีตค่าที่ใช้ได้', async () => {
    const { res, json } = mockRes();
    await handler(req('GET') as never, res as never);
    const body = json.mock.calls[0][0];
    expect(body.filename).toBe('นำเข้าผู้สมัคร.xlsx');
    const wb = XLSX.read(Buffer.from(body.dataBase64, 'base64'), { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['ผู้สมัคร', 'ค่าที่ใช้ได้']);
    const [first] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['ผู้สมัคร'], { header: 1 });
    expect(first).toEqual(H);
  });
});

describe('POST — ตัวอย่างก่อนบันทึก / บันทึก', () => {
  it('🔴 dry run: ไม่เขียนอะไร · เบอร์ที่สมัครภายใน 14 วัน = ข้าม + บอกวันที่ได้ · เบอร์ที่ Excel ตัด 0 ถูกเติมคืน', async () => {
    dbQuery.mockImplementation((sql: string, params?: unknown[]) =>
      /max\(created_at\) as last_at[\s\S]*group by phone_e164/i.test(sql)
        ? Promise.resolve({ rows: [{ phone_e164: '+66822222222', last_at: LAST, params }] })
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
    await handler(req('POST', { file_base64: file, dry_run: false, responsible_name: 'เจ้าหน้าที่ ก' }) as never, res as never);
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
    expect(String(insert?.[0])).toMatch(/values \(\$1,.*'new',\$18,\$19,\$20\) returning id/);
    expect((insert?.[1] as unknown[])[12]).toBe('เจ้าหน้าที่ ก');
    expect((insert?.[1] as unknown[])[16]).toBe('staff@example.com');
    expect(audit.mock.calls[0][1]).toMatchObject({ action: 'job_application.import', after: { inserted: 2, skipped: 1 } });
  });

  it('error อื่นตอนบันทึก ⇒ ไม่บันทึกทั้งไฟล์ (ธุรกรรมล้ม)', async () => {
    txQuery.mockImplementation((sql: string) =>
      /^insert into/i.test(sql) ? Promise.reject(Object.assign(new Error('boom'), { code: '22001' })) : Promise.resolve({ rows: [] }),
    );
    const { res, status } = mockRes();
    await handler(req('POST', { file_base64: xlsxBase64([H, person('ก', '0811111111')]), dry_run: false }) as never, res as never);
    expect(status).toHaveBeenCalledWith(500);
    expect(audit).not.toHaveBeenCalled();
  });

  it('ขาดคอลัมน์ที่ต้องมี ⇒ 400 บอกชื่อคอลัมน์', async () => {
    const { res, status, json } = mockRes();
    await handler(req('POST', { file_base64: xlsxBase64([['ชื่อ', 'นามสกุล'], ['ก', 'ข']]), dry_run: true }) as never, res as never);
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0][0].message).toBe('ไฟล์ไม่มีคอลัมน์: เบอร์โทร, อายุ, เพศ');
  });

  it('🔴 ผู้ใช้ที่ถูกล็อก BU ⇒ 403 (ใบที่นำเข้าไม่ผูกใบขอ จะมองไม่เห็นใบตัวเอง)', async () => {
    scoped.mockResolvedValue(new Set(['J1']));
    const { res, status } = mockRes();
    await handler(req('POST', { file_base64: xlsxBase64([H, person('ก', '0811111111')]), dry_run: true }) as never, res as never);
    expect(status).toHaveBeenCalledWith(403);
  });
});
