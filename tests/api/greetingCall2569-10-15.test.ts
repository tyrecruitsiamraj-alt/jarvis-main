// @vitest-environment node
/**
 * บท AI ทักทายทั่วไป — คนที่ยังไม่รู้ใบขอ (เจ้าของ 15 ต.ค. 2569 · ร่างที่เจ้าของเลือก "เอาตามร่าง")
 *
 * 🔴 ด่าน:
 * - บทตามร่าง: ยังหางานไหม → งานที่เคยสนใจ (บอกของเดิม) → จังหวัด (ถามยืนยันของเดิม) → อายุ → จบ · ไม่มีคำถามอื่น
 * - คำตอบไม่เขียนทับใบ — อ่านจากบทสนทนาขึ้นป้าย "บอก AI" · อ่านไม่ออก = ไม่ขึ้น (ห้ามเดา)
 * - ส่งจากป๊อปส่ง AI ตัวเดิม (`greeting: true`) เฉพาะใบที่ไม่ผูกใบขอ · ใบที่ผูกแล้วส่งบทใบขอตามเดิม
 * - ตอบไม่สนใจ (= ไม่หางานแล้ว) = พักเบอร์ทุกใบขอ
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GREETING_JOB_REF,
  ageInText,
  greetingHeardText,
  parseGreetingAnswers,
  provinceInText,
} from '../../src/lib/greetingCall.js';
import {
  EDITABLE_SCRIPT_DEFAULTS,
  buildGreetingQuestions,
  speakablePositionInterest,
  speakableProvince,
} from '../../api/_lib/lumosCallScript.js';
import { EDITABLE_SCRIPT_KEYS } from '../../api/_lib/callScriptStore.js';

describe('บท — ตามร่างที่เจ้าของเลือก', () => {
  it('บอกงานเดิม + ถามยืนยันจังหวัดเดิม · ชื่องาน iRecruit ยาวเอาแค่คำแรก', () => {
    const q = buildGreetingQuestions({
      candidateName: 'สมชาย ใจดี',
      positionInterest: 'ขับรถส่วนกลาง เอ็มจี เซลส์ (ประเทศไทย) บ้านบึง',
      province: 'ชลบุรี',
    });
    expect(q).toHaveLength(6);
    expect(q[0]).toMatch(/ตอนนี้ยังหางานอยู่ไหมคะ$/);
    expect(q[1]).toBe('เห็นว่าเคยสนใจงานขับรถส่วนกลาง ตอนนี้ยังสนใจงานแบบนี้อยู่ไหม หรืออยากทำงานแบบไหนคะ');
    expect(q[2]).toBe('ตอนนี้ยังอยู่จังหวัดชลบุรีไหมคะ ถ้าไม่ใช่ ตอนนี้อยู่จังหวัดไหนคะ');
    expect(q[3]).toBe('ตอนนี้อายุเท่าไหร่คะ');
    expect(q[4]).toMatch(/เจ้าหน้าที่จะโทรกลับไปนะคะ$/);
    expect(q[5]).toMatch(/ถ้าไม่ได้หางานแล้ว/);
  });

  it('ไม่มีข้อมูลเดิม = ถามเปล่า · กรุงเทพไม่พูด "จังหวัดกรุงเทพมหานคร"', () => {
    const q = buildGreetingQuestions({ candidateName: 'ก', positionInterest: null, province: null });
    expect(q).toContain('สนใจงานแบบไหนคะ');
    expect(q).toContain('ตอนนี้อยู่จังหวัดไหนคะ');
    expect(q.some((l) => /เคยสนใจงาน|ยังอยู่/.test(l))).toBe(false);
    expect(speakableProvince('กรุงเทพมหานคร')).toBe('กรุงเทพ');
    expect(speakablePositionInterest('พนักงานขับรถ')).toBe('พนักงานขับรถ');
  });

  it('แก้ได้จากหน้าตั้งค่า (คีย์ greet อยู่ในลิสต์)', () => {
    expect(EDITABLE_SCRIPT_KEYS).toContain('greet');
    expect(EDITABLE_SCRIPT_DEFAULTS.greet.length).toBe(8);
  });
});

describe('อ่านคำตอบจากบทสนทนา — ป้าย "บอก AI"', () => {
  const tr = (pairs: Array<[string, string]>) =>
    pairs.flatMap(([a, c]) => [
      { role: 'agent', text: a },
      { role: 'candidate', text: c },
    ]);

  it('ย้ายจังหวัด · อายุ · งานใหม่ — อ่านตามที่พูด', () => {
    const h = parseGreetingAnswers(
      tr([
        ['สวัสดีค่ะ … ตอนนี้ยังหางานอยู่ไหมคะ', 'ยังหาอยู่ครับ'],
        ['เห็นว่าเคยสนใจงานขับรถ ตอนนี้ยังสนใจงานแบบนี้อยู่ไหม หรืออยากทำงานแบบไหนคะ', 'อยากทำ รปภ. ครับ'],
        ['ตอนนี้ยังอยู่จังหวัดชลบุรีไหมคะ', 'ย้ายไปอยู่ระยองแล้วครับ'],
        ['ตอนนี้อายุเท่าไหร่คะ', '38 ปีครับ'],
      ]),
      { province: 'ชลบุรี', positionInterest: 'ขับรถ' },
    );
    expect(h).toEqual({ province: 'ระยอง', age: 38, job: 'อยากทำ รปภ.' });
    expect(greetingHeardText(h)).toBe('ระยอง · 38 ปี · อยากทำ รปภ.');
  });

  it('ตอบรับเฉย ๆ = ค่าเดิมที่ AI ถามยืนยัน', () => {
    const h = parseGreetingAnswers(
      tr([
        ['เห็นว่าเคยสนใจงานขับรถ ตอนนี้ยังสนใจงานแบบนี้อยู่ไหม หรืออยากทำงานแบบไหนคะ', 'ยังสนใจครับ'],
        ['ตอนนี้ยังอยู่จังหวัดชลบุรีไหมคะ', 'ใช่ครับ'],
      ]),
      { province: 'ชลบุรี', positionInterest: 'ขับรถ' },
    );
    expect(h).toEqual({ province: 'ชลบุรี', age: null, job: 'ขับรถ' });
  });

  it('🔴 อ่านไม่ออก = ไม่ขึ้น (ห้ามเดา) — อายุเป็นคำ · ไม่มีชื่อจังหวัด · ไม่มีบทสนทนา', () => {
    const h = parseGreetingAnswers(
      tr([
        ['ตอนนี้อยู่จังหวัดไหนคะ', 'แถวบ้านแม่ครับ'],
        ['ตอนนี้อายุเท่าไหร่คะ', 'สามสิบแปดครับ'],
      ]),
    );
    expect(h).toEqual({ province: null, age: null, job: null });
    expect(greetingHeardText(h)).toBeNull();
    expect(parseGreetingAnswers(null)).toEqual({ province: null, age: null, job: null });
    expect(ageInText('๒๕ ปี')).toBe(25);
    expect(ageInText('120')).toBeNull();
    expect(provinceInText('อยู่โคราชครับ')).toBe('นครราชสีมา');
    expect(provinceInText('อยู่ กทม ครับ')).toBe('กรุงเทพมหานคร');
  });
});

// ── API: ส่งบททักทายจากป๊อปส่ง AI ──────────────────────────────────────────
const dbQuery = vi.fn();
const enqueueJob = vi.fn();
const enqueueGreet = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: () => false,
  isPgUniqueViolation: () => false,
}));
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: vi.fn(async () => undefined) }));
vi.mock('../../api/_lib/applicationScope.js', () => ({ isApplicationInWriteScope: vi.fn(async () => true) }));
vi.mock('../../api/_lib/candidateCallHolds.js', () => ({ acquireCallHold: vi.fn(), releaseApplicationCallHolds: vi.fn() }));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  enqueueLumosInterviewForApplications: (...a: unknown[]) => enqueueJob(...a),
  enqueueLumosGreetingForApplications: (...a: unknown[]) => enqueueGreet(...a),
}));
vi.mock('../../api/_lib/siamrajUnitRequests.js', () => ({
  loadScopedJobIdSet: async () => null,
  getSiamrajUnitRequestById: async () => null,
}));

const { signAuthToken, AUTH_COOKIE_NAME } = await import('../../api/_lib/auth.js');
const { default: handler } = await import('../../api/_handlers/application-call-choice.js');

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
  position_interest: 'ขับรถ',
  province: 'ชลบุรี',
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

describe('API — ส่งบททักทาย (greeting: true)', () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;
    dbQuery.mockReset().mockImplementation((sql: string) =>
      Promise.resolve({ rows: /^\s*select/i.test(sql) ? [row(FREE, null), row(BOUND, 'J1')] : [] }),
    );
    enqueueJob.mockReset().mockImplementation(async (_j: string, apps: unknown[]) => ({ queued: apps.length, duplicated: [], skipped: [] }));
    enqueueGreet.mockReset().mockImplementation(async (apps: unknown[]) => ({ queued: apps.length, duplicated: [], skipped: [] }));
  });

  it('🔴 ใบไม่ผูกใบขอ = บททักทาย (ไม่ผูกใบขอ ไม่แก้ใบ) · ใบที่ผูกแล้ว = บทใบขอตามเดิม', async () => {
    const { res, json } = mockRes();
    await handler(req({ ids: [FREE, BOUND], choice: 'ai', greeting: true }) as never, res as never);
    const greeted = (enqueueGreet.mock.calls[0][0] as Array<{ id: string; province: string }>).map((a) => [a.id, a.province]);
    expect(greeted).toEqual([[FREE, 'ชลบุรี']]);
    expect(enqueueGreet.mock.calls[0][1]).toEqual({ autoPush: true });
    expect(enqueueJob.mock.calls.map((c) => c[0])).toEqual(['J1']);
    expect(dbQuery.mock.calls.some((c) => /set job_id = \$2/.test(String(c[0])))).toBe(false);
    expect(json.mock.calls[0][0]).toMatchObject({ done: 2, skipped: [] });
  });

  it('ไม่ส่ง greeting = เหมือนเดิม (ใบไม่ผูกข้ามพร้อมเหตุผล)', async () => {
    const { res, json } = mockRes();
    await handler(req({ ids: [FREE], choice: 'ai' }) as never, res as never);
    expect(enqueueGreet).not.toHaveBeenCalled();
    expect(json.mock.calls[0][0].skipped[0].reason).toMatch(/ใบไม่ผูกใบขอ/);
  });
});

describe('ต่อสายจริง — ด่านที่อยู่ในไฟล์อื่น', () => {
  it('ตอบไม่สนใจในสายทักทาย = พักเบอร์ทุกใบขอ · แจ้งเตือนไม่พูด "ใบขอ greet"', () => {
    const src = readFileSync('api/_lib/callFollowup.ts', 'utf8');
    expect(src).toContain("declinedScope: input.declinedScope ?? (row.job_ref === GREETING_JOB_REF ? 'all' : null)");
    expect(src).toContain("'AI ทักทาย (ยังไม่ผูกใบขอ)'");
    expect(GREETING_JOB_REF).toBe('greet');
  });

  it('สายทักทายติดป้ายบท greet · ป๊อปส่ง AI มีตัวเลือก "ให้ AI ทักทายถามก่อน" · แถวขึ้นป้าย "บอก AI"', () => {
    expect(readFileSync('api/_lib/lumosDispatch.ts', 'utf8')).toContain(
      "if (channel === 'interview') return jobRef === GREETING_JOB_REF ? 'greet' : 'interview';",
    );
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toContain("label: 'ให้ AI ทักทายถามก่อน ไม่ระบุงาน'");
    expect(ws).toMatch(/bindJobId === GREET_OPTION\s*\?\s*'greet'/);
    expect(readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8')).toContain('บอก AI: {heard}');
  });
});
