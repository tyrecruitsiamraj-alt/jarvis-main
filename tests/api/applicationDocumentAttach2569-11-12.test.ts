// @vitest-environment node
/**
 * แนบไฟล์ข้างชื่อหลังนำเข้า Excel (เจ้าของ 12 พ.ย. 2569: "พอนำเข้า excel เสร็จขึ้นมาข้างๆชื่อให้ Chose ไฟล์")
 * POST /api/job-application-document — ชนิด/ขนาดเดียวกับหน้าสมัคร · จำกัด BU เหมือนตอนเปิดดู · จด log
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const audit = vi.fn(async () => undefined);
const inScope = vi.fn(async () => true);
vi.mock('../../api/_lib/postgres.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/postgres.js')>();
  return { ...mod, dbQuery: (...a: unknown[]) => dbQuery(...a) };
});
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: (...a: unknown[]) => audit(...(a as [])) }));
vi.mock('../../api/_lib/applicationScope.js', () => ({ isApplicationInWriteScope: () => inScope() }));

import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import handler from '../../api/_handlers/job-application-document.js';

const ID = '7b0f3c52-1d2e-4a5b-9c8d-0e1f2a3b4c5d';
const PDF = Buffer.from('%PDF-1.4 test').toString('base64');

function req(role: string, body: Record<string, unknown>) {
  const token = signAuthToken({ sub: 'u-staff', email: 'staff@example.com', role: role as never });
  return { method: 'POST', headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` }, query: {}, body };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
const writes = () => dbQuery.mock.calls.filter((c) => /^\s*update/i.test(String(c[0])));

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  dbQuery.mockReset().mockImplementation((sql: string) =>
    Promise.resolve(/^select/i.test(sql) ? { rows: [{ job_id: 'opl:1', department_code: 'LBD' }] } : { rows: [] }),
  );
  audit.mockClear();
  inScope.mockReset().mockResolvedValue(true);
});

describe('แนบไฟล์ให้ใบที่นำเข้าแล้ว', () => {
  it('PDF ผ่าน → เขียน 4 ช่องของไฟล์ในใบนั้น + จด log', async () => {
    const { res, status, json } = mockRes();
    await handler(req('staff', { id: ID, document: { base64: PDF, filename: 'ประวัติ.pdf', mime: 'application/pdf' } }) as never, res as never);
    expect(status).toHaveBeenCalledWith(200);
    expect(json.mock.calls[0][0]).toEqual({ ok: true, filename: 'ประวัติ.pdf' });
    const w = writes();
    expect(w).toHaveLength(1);
    expect(String(w[0][0])).toMatch(/set document_filename = \$2, document_mime = \$3, document_size = \$4, document_bytes = \$5 where id = \$1/);
    expect((w[0][1] as unknown[]).slice(0, 3)).toEqual([ID, 'ประวัติ.pdf', 'application/pdf']);
    expect(Buffer.isBuffer((w[0][1] as unknown[])[4])).toBe(true);
    expect(audit.mock.calls[0][1]).toMatchObject({ action: 'job_application.document_attach', entityId: ID });
  });
  it('ชนิดไฟล์อื่น = 400 ไม่เขียน', async () => {
    const { res, status } = mockRes();
    await handler(req('staff', { id: ID, document: { base64: PDF, filename: 'a.docx', mime: 'application/msword' } }) as never, res as never);
    expect(status).toHaveBeenCalledWith(400);
    expect(writes()).toHaveLength(0);
  });
  it('ใบแผนกอื่น = 403 ไม่เขียน · ไม่มีใบ = 404', async () => {
    inScope.mockResolvedValue(false);
    const a = mockRes();
    await handler(req('staff', { id: ID, document: { base64: PDF, filename: 'a.pdf', mime: 'application/pdf' } }) as never, a.res as never);
    expect(a.status).toHaveBeenCalledWith(403);
    dbQuery.mockReset().mockResolvedValue({ rows: [] });
    const b = mockRes();
    await handler(req('staff', { id: ID, document: { base64: PDF, filename: 'a.pdf', mime: 'application/pdf' } }) as never, b.res as never);
    expect(b.status).toHaveBeenCalledWith(404);
    expect(writes()).toHaveLength(0);
  });
  it('role อ่านอย่างเดียว (opl) แนบไม่ได้', async () => {
    const { res, status } = mockRes();
    await handler(req('opl', { id: ID, document: { base64: PDF, filename: 'a.pdf', mime: 'application/pdf' } }) as never, res as never);
    expect(status).toHaveBeenCalledWith(403);
    expect(writes()).toHaveLength(0);
  });
});
