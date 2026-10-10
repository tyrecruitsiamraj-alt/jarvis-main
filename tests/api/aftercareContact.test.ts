// @vitest-environment node
/**
 * ═══ ดูแลหลังเริ่มงาน: กดโทรแล้วลงผลบนหน้าเดียว (เจ้าของ 10 ต.ค. 2569) ═══
 * Choice: ผล 4 แบบ ทำงานปกติ · มีปัญหา · ลาออก · ติดต่อไม่ได้ + หมายเหตุ · เก็บประวัติทุกครั้ง
 * 🔴 ด่าน: ผลต้องอยู่ใน 4 แบบ · คนที่ไม่อยู่ในรายการดูแลลงผลไม่ได้ · ทุกครั้งเป็นแถวใหม่ (ไม่ทับ) ·
 *    ไม่ปิดการดูแลเอง · ยังไม่ migrate 142 = หน้าเดิมยังเปิดได้
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
let undefinedTable = false;
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: () => undefinedTable,
}));
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: vi.fn(async () => undefined) }));

import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import aftercareHandler from '../../api/_handlers/aftercare.js';
import { AFTERCARE_RESULT_LABEL } from '../../src/lib/aftercareContact.js';

const PHONE = '+66812345678';
function req(method: string, body: Record<string, unknown> | null, query: Record<string, string> = {}) {
  const token = signAuthToken({ sub: '11111111-1111-4111-8111-111111111111', email: 'staff@example.com', role: 'admin' });
  return { method, headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` }, query, body };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
const call = async (r: ReturnType<typeof req>) => {
  const m = mockRes();
  await aftercareHandler(r as never, m.res as never);
  return { code: m.status.mock.calls[0]?.[0], body: m.json.mock.calls[0]?.[0] };
};

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  undefinedTable = false;
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) => {
    if (/select count\(\*\)::int as n from .*aftercare_people/i.test(sql)) return Promise.resolve({ rows: [{ n: 1 }] });
    if (/insert into .*aftercare_contacts/i.test(sql)) {
      return Promise.resolve({ rows: [{ id: '7', phone_e164: PHONE, result: 'issue', note: 'ไม่ได้รับชุด', created_by_name: 'staff@example.com', created_at: '2026-10-10T03:00:00Z' }] });
    }
    return Promise.resolve({ rows: [] });
  });
});

describe('POST action=contact', () => {
  it('ลงผล "มีปัญหา" + หมายเหตุ ⇒ เพิ่มแถวใหม่ (ไม่ update) · ไม่แตะ closed_at', async () => {
    const out = await call(req('POST', { action: 'contact', phone: '0812345678', result: 'issue', note: ' ไม่ได้รับชุด ' }));
    expect(out.code).toBe(200);
    expect(out.body.item).toMatchObject({ result: 'issue', note: 'ไม่ได้รับชุด' });
    const sqls = dbQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((q) => /insert into .*aftercare_contacts/i.test(q))).toBe(true);
    expect(sqls.some((q) => /update .*aftercare_people/i.test(q))).toBe(false);
    const insert = dbQuery.mock.calls.find((c) => /insert into .*aftercare_contacts/i.test(String(c[0])));
    expect(insert?.[1]?.slice(0, 3)).toEqual([PHONE, 'issue', 'ไม่ได้รับชุด']);
  });

  it('🔴 ผลนอก 4 แบบ ⇒ 400', async () => {
    const out = await call(req('POST', { action: 'contact', phone: '0812345678', result: 'maybe' }));
    expect(out.code).toBe(400);
  });

  it('🔴 คนที่ไม่อยู่ในรายการดูแล ⇒ 404', async () => {
    dbQuery.mockImplementation(() => Promise.resolve({ rows: [{ n: 0 }] }));
    const out = await call(req('POST', { action: 'contact', phone: '0812345678', result: 'working' }));
    expect(out.code).toBe(404);
  });

  it('ป้าย 4 แบบตามที่เจ้าของเลือก', () => {
    expect(Object.values(AFTERCARE_RESULT_LABEL)).toEqual(['ทำงานปกติ', 'มีปัญหา', 'ลาออก', 'ติดต่อไม่ได้']);
  });
});

describe('GET', () => {
  it('รายชื่อแนบผลล่าสุด + จำนวนครั้ง', async () => {
    dbQuery.mockImplementation((sql: string) => {
      if (/from .*aftercare_people/i.test(sql) && /select phone_e164/i.test(sql)) {
        return Promise.resolve({ rows: [{ phone_e164: PHONE, full_name: 'ก', unit_name: null, site_code: null, start_date: null, source: 'manual', from_follow_id: null, note: null, moved_by_name: null, closed_at: null, closed_reason: null, created_at: '2026-10-01T00:00:00Z' }] });
      }
      if (/distinct on \(phone_e164\)/i.test(sql)) {
        return Promise.resolve({ rows: [{ id: '9', phone_e164: PHONE, result: 'working', note: null, created_by_name: 'x', created_at: '2026-10-10T01:00:00Z', n: 3 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const out = await call(req('GET', null));
    expect(out.body.items[0]).toMatchObject({ contact_count: 3, last_contact: { result: 'working' } });
  });

  it('ยังไม่ migrate 142 ⇒ ประวัติว่าง ไม่พัง', async () => {
    undefinedTable = true;
    dbQuery.mockImplementation(() => Promise.reject(new Error('relation does not exist')));
    const out = await call(req('GET', null, { history: '0812345678' }));
    expect(out.code).toBe(200);
    expect(out.body).toMatchObject({ items: [], migrated: false });
  });
});
