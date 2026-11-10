// @vitest-environment node
/**
 * ตรวจทั้งระบบ 10 พ.ย. 2569 — เจ้าของสั่งแก้ (กลุ่ม A ข้อ 5 · 6)
 * - ปิดบัญชี/ลบ/ลด role แล้วมีผลภายใน 1 นาที ไม่ต้องรอ token หมด 8 ชม.
 * - สั่ง AI โทร (send=1) ต้อง POST · เปิดลิงก์ (GET) ไม่สั่งโทร
 * - AI พูดชื่อจุดทำงานจากใบขอก่อน ไม่ใช่ข้อความที่หน้าสาธารณะส่งมา
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));

import { forgetLiveUser, liveUserOf } from '../../api/_lib/liveUser';
import { withAuth } from '../../api/_lib/http';
import { AUTH_COOKIE_NAME, signAuthToken } from '../../api/_lib/auth';
import { buildApplicationInterviewPayload } from '../../api/_lib/lumosDispatch';

const read = (p: string) => readFileSync(p, 'utf8');
const env = { ...process.env };

function mockRes() {
  const out = { status: 0, body: null as unknown };
  const res = {
    status(c: number) {
      out.status = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return { res, out };
}

beforeEach(() => {
  dbQuery.mockReset();
  forgetLiveUser();
  process.env.AUTH_JWT_SECRET = 'test-secret-test-secret-test-secret';
  process.env.JARVIS_LIVE_USER_CHECK = '1';
});
afterEach(() => {
  process.env = { ...env };
});

describe('บัญชีที่ถูกปิด/เปลี่ยน role มีผลทันที', () => {
  const token = () => signAuthToken({ sub: '11111111-1111-1111-1111-111111111111', email: 'staff@example.com', role: 'admin' });
  const run = async () => {
    let seenRole: string | null = null;
    const h = withAuth(async (req, res) => {
      seenRole = req.user.role;
      (res as unknown as { status: (n: number) => { json: (b: unknown) => void } }).status(200).json({});
    });
    const { res, out } = mockRes();
    await h({ method: 'GET', headers: { cookie: `${AUTH_COOKIE_NAME}=${token()}` } }, res as never);
    return { status: out.status, seenRole };
  };

  it('ปิดบัญชี = 401 · ลบบัญชี = 401 · ยังใช้ได้ = 200', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ is_active: true, role: 'admin' }] });
    expect((await run()).status).toBe(200);
    forgetLiveUser();
    dbQuery.mockResolvedValueOnce({ rows: [{ is_active: false, role: 'admin' }] });
    expect((await run()).status).toBe(401);
    forgetLiveUser();
    dbQuery.mockResolvedValueOnce({ rows: [] });
    expect((await run()).status).toBe(401);
  });
  it('ลด role ในฐาน = ใช้ role ใหม่แม้ token ยังเป็น admin', async () => {
    dbQuery.mockResolvedValueOnce({ rows: [{ is_active: true, role: 'staff' }] });
    expect(await run()).toEqual({ status: 200, seenRole: 'staff' });
  });
  it('ฐานอ่านไม่ได้ = ใช้ token ต่อ (ไม่เด้งทุกคนออก) · จำไว้ 1 นาที', async () => {
    dbQuery.mockRejectedValueOnce(new Error('db down'));
    expect(await liveUserOf('u1', 0)).toBe('unknown');
    dbQuery.mockResolvedValueOnce({ rows: [{ is_active: true, role: 'staff' }] });
    expect(await liveUserOf('u2', 1_000)).toEqual({ active: true, role: 'staff' });
    expect(await liveUserOf('u2', 30_000)).toEqual({ active: true, role: 'staff' });
    expect(dbQuery).toHaveBeenCalledTimes(2);
  });
});

describe('สั่ง AI โทรต้องกดปุ่ม (POST)', () => {
  it('GET ที่มี send=1 = 405 · ส่งจริงจาก POST เท่านั้น · หน้าเว็บส่ง POST', () => {
    for (const f of ['api/_handlers/matching-recruit-lane.ts', 'api/_handlers/matching-selection-recall.ts']) {
      const h = read(f);
      expect(h, f).toContain("if (wantsSend && method !== 'POST') {");
      expect(h, f).not.toContain("getQuery(req, 'send') === '1'\n        ? await");
    }
    expect(read('src/lib/recruitLaneApi.ts').match(/options\?\.send \? \{ method: 'POST' \} : undefined/g)).toHaveLength(2);
  });
});

describe('AI พูดชื่อจุดทำงานจากใบขอ', () => {
  const app = { id: 'a1', full_name: 'ทดสอบ ระบบ', phone: '0812345678', job_id: 'siamraj-sql:OPL6911001', job_title: 'พนักงานขับรถ', unit_name: 'ข้อความที่คนนอกใส่มา' };
  it('ใบขออ่านได้ = ใช้ชื่อจากใบขอ ไม่ใช่ข้อความบนใบสมัคร', () => {
    const p = buildApplicationInterviewPayload(app, new Date('2026-11-10T03:00:00Z'), null, { unitName: 'รพ.สมิติเวช' })!;
    expect(JSON.stringify(p)).toContain('รพ.สมิติเวช');
    expect(JSON.stringify(p)).not.toContain('ข้อความที่คนนอกใส่มา');
  });
});
