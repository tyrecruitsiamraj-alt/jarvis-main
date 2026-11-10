// @vitest-environment node
/**
 * แท็บการติดต่อปุ่ม "ของฉัน / ทุกคน" + ลิสต์ผู้สมัครเร็วขึ้น (เจ้าของ 10 พ.ย. 2569)
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();

vi.mock('../../api/_lib/postgres.js', async (orig) => ({
  ...(await orig<typeof import('../../api/_lib/postgres.js')>()),
  dbQuery: (...a: unknown[]) => dbQuery(...a),
}));
vi.mock('../../api/_lib/siamrajUnitRequests.js', async (orig) => ({
  ...(await orig<typeof import('../../api/_lib/siamrajUnitRequests.js')>()),
  loadScopedJobIdSet: vi.fn(async () => null),
}));
vi.mock('../../api/_lib/departmentScope.js', async (orig) => ({
  ...(await orig<typeof import('../../api/_lib/departmentScope.js')>()),
  loadUserDepartmentScope: vi.fn(async () => ({ mode: 'all' })),
}));
vi.mock('../../api/_lib/applicationBoardLink.js', () => ({ loadBoardPhoneSet: vi.fn(async () => null) }));

import { signAuthToken, AUTH_COOKIE_NAME, type UserRole } from '../../api/_lib/auth.js';
import handler, { buildApplicationsListQuery, wantsEveryoneContact } from '../../api/_handlers/job-applications.js';
import { claimerOf, filterApplications } from '../../src/lib/recruitRm.js';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi.js';

function req(role: UserRole, query: Record<string, string>) {
  const token = signAuthToken({ sub: 'u-viewer', email: 'viewer@example.com', role });
  return {
    method: 'GET',
    headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` },
    query,
  };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
/** คิวรีลิสต์ที่ยิงจริง (ตัวแรกที่อ่านจากตารางใบสมัครแล้ว limit ราวกันตก · เลิกตัด 500 แล้ว 15 ต.ค. 2569) */
const listCall = () => dbQuery.mock.calls.find((c) => /order by created_at desc limit 20000/.test(String(c[0])));

async function get(role: UserRole, query: Record<string, string>) {
  const { res, status } = mockRes();
  await handler(req(role, query) as never, res as never);
  expect(status).toHaveBeenCalledWith(200);
  const call = listCall();
  expect(call, 'ต้องยิงคิวรีลิสต์').toBeTruthy();
  return { sql: String(call![0]), params: (call![1] ?? []) as unknown[] };
}

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  dbQuery.mockReset().mockResolvedValue({ rows: [] });
});


describe('แท็บการติดต่อปุ่ม "ทุกคน" (เจ้าของ 10 พ.ย. 2569 "ใครเก็บไปแล้วยังไม่โทรบ้าง")', () => {
  it('ค่าเริ่ม = ของใครของมันเหมือนเดิม · scope=all ได้เฉพาะใบที่มีคนเก็บ', async () => {
    expect(wantsEveryoneContact({ view: 'contact', scope: 'all' }, 'staff')).toBe(true);
    expect(wantsEveryoneContact({ view: 'contact', scope: 'all', job_id: 'siamraj-sql:LBM6911001' }, 'admin')).toBe(false);
    expect(wantsEveryoneContact({ view: 'contact' }, 'admin')).toBe(false);
    const mine = await get('staff', {});
    expect(mine.sql).toContain('claimed_by is null or claimed_by::text');
    dbQuery.mockClear();
    const all = await get('staff', { view: 'contact', scope: 'all' });
    expect(all.sql).toContain('(claimed_by is not null or coalesce(is_lead, false))');
    expect(all.sql).not.toContain('claimed_by is null or claimed_by::text');
    const q = buildApplicationsListQuery({ viewerId: 'u-viewer', everyoneContact: true });
    expect(q.params.length).toBe(0);
  });
  it('ชื่อคนเก็บส่งเฉพาะปุ่ม "ทุกคน" · ลิสต์ปกติยังซ่อน', async () => {
    const row = { id: 'a1', full_name: 'สมชาย ใจดี', phone: '0812345678', status: 'new', created_at: '2026-11-09T03:00:00Z', claimed_by: 'u-other', claimed_by_name: 'ตั้ม', is_lead: false };
    dbQuery.mockImplementation(async (sql: string) => ({ rows: /order by created_at desc limit 20000/.test(String(sql)) ? [row] : [] }));
    const call = async (query: Record<string, string>) => {
      const { res, json } = mockRes();
      await handler(req('staff', query) as never, res as never);
      return (json.mock.calls[0][0] as { items: Array<Record<string, unknown>> }).items[0];
    };
    expect((await call({})).claimed_by_name).toBeUndefined();
    expect((await call({ view: 'contact', scope: 'all' })).claimed_by_name).toBe('ตั้ม');
  });
  it('หน้าเว็บ: ทุกคน = ใครเก็บก็อยู่แท็บการติดต่อ · ป้าย "เก็บโดย" ไม่ขึ้นกับของฉัน', () => {
    const other = { id: 'a1', full_name: 'สมชาย ใจดี', phone: '0812345678', status: 'new', created_at: '2026-11-09T03:00:00Z', claimed: true, claimed_by_me: false, claimed_by_name: 'ตั้ม' } as PublicApplication;
    const mine = { ...other, id: 'a2', claimed_by_me: true, claimed_by_name: 'ฉัน' } as PublicApplication;
    const filters = { statuses: [], channels: [], provinces: [], dateFrom: null, dateTo: null } as never;
    expect(filterApplications([other, mine], 'contact', filters, '').map((r) => r.id)).toEqual(['a2']);
    expect(filterApplications([other, mine], 'contact', filters, '', true).map((r) => r.id)).toEqual(['a1', 'a2']);
    expect(claimerOf(other)).toBe('ตั้ม');
    expect(claimerOf(mine)).toBeNull();
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toContain('aria-label="การติดต่อของใคร"');
    expect(ws).toContain("useState<RmAppointmentScope>(() => (searchParams.get('scope') === 'all' ? 'all' : 'mine'))");
  });
});

describe('ลิสต์ผู้สมัครอ่านขั้นจากตารางกลางคิวรีเดียว (10 พ.ย. 2569 หน้าช้า)', () => {
  it('ไม่วนยิงทีละใบขอแล้ว', () => {
    const h = readFileSync('api/_handlers/job-applications.ts', 'utf8');
    expect(h).toContain('loadProgressByJobs(');
    expect(h).not.toMatch(/await loadProgressByJob\(/);
  });
});
