// @vitest-environment node
/**
 * ส่ง AI ใบที่ยังไม่ผูกใบขอ — เลือกใบขอในป๊อปยืนยัน (เจ้าของ 15 ต.ค. 2569)
 * > *"งานที่ไม่ได้ผูกใบขอ … ก็เลือกผูกใบขอได้ด้วยดิ่ตอนส่ง Ai"*
 *
 * 🔴 ด่าน:
 * - `job_id` ผูกเฉพาะใบที่ยังไม่ผูก (`job_id is null` ใน WHERE) — ใบที่ผูกแล้วไม่ถูกย้าย
 * - ใบขอนอก BU = 403 · ใบปิด/ไม่เจอ = 404 — ไม่ผูก ไม่ส่ง
 * - ผูกแล้วส่งเข้าคิวด้วยใบขอนั้น (เส้นเดิม `enqueueLumosInterviewForApplications`)
 * - ไม่ส่ง `job_id` = เหมือนเดิม: ใบไม่ผูก = ข้ามพร้อมเหตุผล
 * - ป๊อปยืนยันมีช่องเลือกใบขอ + ปุ่มส่งกดไม่ได้จนกว่าจะเลือก · 3 กลุ่ม: ตรงทั้งคู่ · ตรงจังหวัด · ใบขออื่น (ตรงตำแหน่งขึ้นก่อน)
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobRequest } from '../../src/types/index.js';
import { bindJobOptions } from '../../src/lib/bindJobPicker.js';

const dbQuery = vi.fn();
const enqueue = vi.fn();
const scoped = vi.fn(async (): Promise<Set<string> | null> => null);
const jobById = vi.fn(async (): Promise<Record<string, unknown> | null> => ({ id: 'J9', unit_name: 'ไซต์ เก้า' }));

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: () => false,
  isPgUniqueViolation: () => false,
}));
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: vi.fn(async () => undefined) }));
vi.mock('../../api/_lib/applicationScope.js', () => ({ isApplicationInWriteScope: vi.fn(async () => true) }));
vi.mock('../../api/_lib/candidateCallHolds.js', () => ({ acquireCallHold: vi.fn(), releaseApplicationCallHolds: vi.fn() }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  enqueueLumosInterviewForApplications: (...a: unknown[]) => enqueue(...a),
}));
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({
  loadScopedJobIdSet: () => scoped(),
  getSiamrajUnitRequestById: () => jobById(),
}));

import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import handler from '../../api/_handlers/application-call-choice.js';

const FREE = '11111111-1111-4111-8111-111111111111';
const BOUND = '22222222-2222-4222-8222-222222222222';
const row = (id: string, jobId: string | null) => ({
  id,
  full_name: id === FREE ? 'คนจาก iRecruit' : 'คนมีใบขอ',
  phone: '0812345678',
  job_id: jobId,
  department_code: null,
  job_title: null,
  unit_name: null,
  position_interest: null,
  claimed_by: null,
  claimed_by_name: null,
  age: 30,
  created_by_name: 'iRecruit',
});

function req(body: Record<string, unknown>) {
  const token = signAuthToken({ sub: 'u-me', email: 'me@example.com', role: 'admin' });
  return { method: 'POST', headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` }, query: {}, body };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
const bindCalls = () => dbQuery.mock.calls.filter((c) => /set job_id = \$2/.test(String(c[0])));

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  scoped.mockReset().mockResolvedValue(null);
  jobById.mockReset().mockResolvedValue({ id: 'J9', unit_name: 'ไซต์ เก้า' });
  enqueue.mockReset().mockImplementation(async (_j: string, apps: unknown[]) => ({ queued: apps.length, duplicated: [], skipped: [] }));
  dbQuery.mockReset().mockImplementation((sql: string) => {
    if (/^\s*select/i.test(sql)) return Promise.resolve({ rows: [row(FREE, null), row(BOUND, 'J1')] });
    if (/set job_id = \$2/.test(sql)) return Promise.resolve({ rows: [{ id: FREE }] });
    return Promise.resolve({ rows: [] });
  });
});

describe('API — ผูกใบขอตอนส่ง AI', () => {
  it('🔴 ผูกเฉพาะใบที่ยังไม่ผูก แล้วส่งตามใบขอของแต่ละใบ (ใบที่ผูกแล้วไม่ย้าย)', async () => {
    const { res, json } = mockRes();
    await handler(req({ ids: [FREE, BOUND], choice: 'ai', job_id: 'J9', job_title: 'รปภ.' }) as never, res as never);
    const [sql, params] = bindCalls()[0] as [string, unknown[]];
    expect(sql).toMatch(/and job_id is null/);
    expect(params).toEqual([[FREE], 'J9', 'รปภ.', 'ไซต์ เก้า']);
    const sent = enqueue.mock.calls.map((c) => [c[0], (c[1] as Array<{ id: string }>).map((a) => a.id)]);
    expect(sent).toEqual(
      expect.arrayContaining([
        ['J9', [FREE]],
        ['J1', [BOUND]],
      ]),
    );
    expect(json.mock.calls[0][0]).toMatchObject({ choice: 'ai', done: 2, skipped: [] });
  });

  it('ไม่ส่ง job_id = เหมือนเดิม: ใบไม่ผูกข้ามพร้อมเหตุผล ไม่มีการผูก', async () => {
    const { res, json } = mockRes();
    await handler(req({ ids: [FREE, BOUND], choice: 'ai' }) as never, res as never);
    expect(bindCalls()).toHaveLength(0);
    expect(json.mock.calls[0][0].skipped).toEqual([{ name: 'คนจาก iRecruit', reason: 'ใบไม่ผูกใบขอ — ส่งเข้าคิวโทรไม่ได้' }]);
  });

  it('ใบขอนอก BU = 403 · ใบปิด/ไม่เจอ = 404 — ไม่ผูก ไม่ส่ง', async () => {
    scoped.mockResolvedValue(new Set(['J1']));
    const a = mockRes();
    await handler(req({ ids: [FREE], choice: 'ai', job_id: 'J9' }) as never, a.res as never);
    expect(a.status).toHaveBeenCalledWith(403);

    scoped.mockResolvedValue(null);
    jobById.mockResolvedValue(null);
    const b = mockRes();
    await handler(req({ ids: [FREE], choice: 'ai', job_id: 'J9' }) as never, b.res as never);
    expect(b.status).toHaveBeenCalledWith(404);
    expect(bindCalls()).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('job_id กับปุ่มอื่น (เก็บไปโทรเอง) ไม่ผูกอะไร', async () => {
    const { res } = mockRes();
    await handler(req({ ids: [FREE], choice: 'manual', job_id: 'J9' }) as never, res as never);
    expect(bindCalls()).toHaveLength(0);
  });
});

describe('รายการใบขอในป๊อป — ตรงทั้งคู่ · ตรงจังหวัด · ใบขออื่น', () => {
  const job = (id: string, province: string, position: string) =>
    ({ id, override_province: province, job_description_code_1: position, unit_name: id, job_type: 'other' }) as unknown as JobRequest;

  it('🔴 ตรงตำแหน่งอย่างเดียวไม่นับว่าตรง (อยู่ใบขออื่น แต่ขึ้นก่อน) · ในกลุ่มคงลำดับฟีด', () => {
    const jobs = [
      job('none', 'เชียงใหม่', 'แม่บ้าน'),
      job('pos', 'ระยอง', 'รปภ.ชาย'),
      job('prov', 'ชลบุรี', 'แม่บ้าน'),
      job('both', 'ชลบุรี', 'รปภ.'),
      job('none2', 'ภูเก็ต', 'คนสวน'),
    ];
    const { both, province, others } = bindJobOptions(jobs, [{ province: 'ชลบุรี', position_interest: 'รปภ.' }]);
    expect(both.map((o) => o.value)).toEqual(['both']);
    expect(province.map((o) => o.value)).toEqual(['prov']);
    expect(others.map((o) => o.value)).toEqual(['pos', 'none', 'none2']);
    expect(both[0].label).toContain('ชลบุรี');
  });

  it('ผู้สมัครไม่มีจังหวัด/ตำแหน่ง = ทุกใบอยู่ "ใบขออื่น" · ใบไม่รู้จังหวัดไม่มีคำแปลกในป้าย', () => {
    const r = bindJobOptions([job('a', 'ชลบุรี', 'รปภ.'), job('b', '', 'รปภ.')], [{ province: null, position_interest: '' }]);
    expect(r.both).toHaveLength(0);
    expect(r.province).toHaveLength(0);
    expect(r.others).toHaveLength(2);
    expect(r.others[1].label).not.toMatch(/__|ไม่ระบุ/);
  });
});

describe('หน้าจอ — ป๊อปยืนยันส่ง AI', () => {
  const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
  it('มีช่องเลือกใบขอเมื่อมีใบไม่ผูก + ปุ่มส่งกดไม่ได้จนกว่าจะเลือก', () => {
    expect(ws).toMatch(/data-testid="ai-bind-job"/);
    expect(ws).toMatch(/confirmDisabled=\{aiUnbound\.length > 0 && !bindJobId\}/);
    expect(ws).toMatch(/chooseApplicationCall\(\s*aiConfirmIds,\s*'ai',\s*bindJob/);
  });
});
