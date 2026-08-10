// @vitest-environment node
/**
 * PATCH /api/role-permissions — บั๊กจริงที่เจอตอนกวาด type error ของ tsconfig.api.json (10 ส.ค. 2569)
 *
 * เดิม handler ส่ง audit ด้วย field ผิดชื่อ (`entity_type`/`entity_id`/`metadata`
 * แทน `entityType`/`entityId`/`after`) → ตัวเขียน audit ได้ undefined ไป insert
 * ลงคอลัมน์ `entity_type` ที่เป็น NOT NULL → insert ล้ม → ถูกกลืนตาม design ของ audit
 * = **การเปิด/ปิดสิทธิ์ role ไม่เคยถูกบันทึก audit เลย** โดยไม่มีสัญญาณอะไรบอก
 *
 * และ `upsertGrant(..., req.user?.id)` อ้าง field `id` ที่ไม่มีใน JwtUserPayload
 * (มีแต่ `sub`) → `updated_by` เป็น null เสมอ — ไม่รู้ว่าใครแก้สิทธิ์
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn() }));
vi.mock('../../api/_lib/http.js', async (orig) => {
  const actual = await orig<typeof import('../../api/_lib/http.js')>();
  return { ...actual, withRbac: (h: unknown) => h };
});

import { dbQuery } from '../../api/_lib/postgres.js';
import handler from '../../api/_handlers/role-permissions.js';

const ADMIN_UUID = '22222222-2222-4222-8222-222222222222';

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}

function patchReq(sub: string, body: Record<string, unknown>) {
  return {
    method: 'PATCH',
    headers: {},
    query: {},
    body,
    user: { sub, email: 'admin@siamraj.com', role: 'admin' },
  };
}

function callsMatching(pattern: RegExp) {
  return vi.mocked(dbQuery).mock.calls.filter((c) => pattern.test(String(c[0])));
}

beforeEach(() => {
  vi.mocked(dbQuery).mockReset();
  vi.mocked(dbQuery).mockResolvedValue({ rows: [] } as never);
});

describe('role-permissions PATCH — audit ต้องถูกเขียนจริง ไม่ใช่ล้มเงียบ', () => {
  it('แถว audit มี entity_type/entity_id/new_value ครบ (เดิม undefined → NOT NULL violation → หายเงียบ)', async () => {
    const { res, status } = mockRes();
    await handler(
      patchReq(ADMIN_UUID, { role: 'staff', functionId: 'jobs_edit', enabled: true }) as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(200);

    const auditCalls = callsMatching(/insert into .*audit_logs/i);
    expect(auditCalls.length).toBe(1);
    const params = auditCalls[0][1] as unknown[];
    // ลำดับคอลัมน์: user_id, user_name, action, entity_type, entity_id, old_value, new_value, ...
    expect(params[2]).toBe('role_permission.update');
    expect(params[3]).toBe('role_function_grant');
    expect(params[4]).toBe('staff:jobs_edit');
    expect(String(params[6])).toContain('"enabled":true');
    expect(params).not.toContain(undefined);
  });

  it('updated_by ของ grant = sub ของคนกด (เดิมอ้าง req.user.id ที่ไม่มีจริง → null เสมอ)', async () => {
    const { res } = mockRes();
    await handler(
      patchReq(ADMIN_UUID, { role: 'staff', functionId: 'jobs_edit', enabled: true }) as never,
      res as never,
    );

    const grantCalls = callsMatching(/insert into .*role_function_grants/i);
    expect(grantCalls.length).toBe(1);
    expect(grantCalls[0][1]).toContain(ADMIN_UUID);
  });

  it('sub ที่ไม่ใช่ uuid (token ฝั่ง dev) → updated_by เป็น null ไม่ใช่สตริงพัง FK', async () => {
    const { res, status } = mockRes();
    await handler(
      patchReq('dev-admin', { role: 'staff', functionId: 'jobs_edit', enabled: true }) as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(200);

    const grantCalls = callsMatching(/insert into .*role_function_grants/i);
    expect(grantCalls.length).toBe(1);
    const params = grantCalls[0][1] as unknown[];
    expect(params).toContain(null);
    expect(params).not.toContain('dev-admin');
  });
});
