// @vitest-environment node
/**
 * ═══ ดึงส่งคนแทนจาก iRecruit → สายในแท็บติดตามส่งคนแทน (เจ้าของเคาะ 2 ต.ค. 2569) ═══
 * 🔴 ด่าน: SQL ของเจ้าของ (WS · job_type 2 · ตัด C) ช่วงวันนี้→+31 วันนาฬิกาไทย · คนเดียวหลายใบ = ชุดเดียว แผนเดียว ·
 *    กันซ้ำด้วย source_ref (ที่ฐาน) · ไม่มีเบอร์/เลยเวลาเข้างาน = ไม่สร้าง · เวลาโทร 18:00 วันก่อนเข้างาน · ผ่านไปแล้ว = โทรเร็วที่สุด ·
 *    ส่ง AI เฉพาะเมื่อสวิตช์ follow_entry เปิด · ฐานยังไม่รัน 133 / iRecruit ปิด = จดเหตุผล ไม่สร้างสาย
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const irecruitSqlQuery = vi.fn();
const unavailable = vi.fn<() => string | null>(() => null);
const dbQuery = vi.fn();
const autoDispatch = vi.fn(async () => true);
const enqueuePlan = vi.fn();

vi.mock('../../api/_lib/irecruitSqlServer.js', () => ({
  irecruitSqlQuery: (...a: unknown[]) => irecruitSqlQuery(...a),
  irecruitUnavailableReason: () => unavailable(),
}));
vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: (e: unknown) => (e as { code?: string })?.code === '42P01',
  isPgUniqueViolation: (e: unknown) => (e as { code?: string })?.code === '23505',
}));
vi.mock('../../api/_lib/lumosDispatchMode.js', () => ({ isAutoDispatchEnabled: () => autoDispatch() }));
const cancelFollow = vi.fn(async () => true);
const cancelPushed = vi.fn(async () => undefined);
let pushConfig: unknown = { baseUrl: 'x' };
vi.mock('../../api/_lib/lumosDispatch.js', () => ({
  enqueueFollowReminderPlan: (...a: unknown[]) => enqueuePlan(...a),
  cancelFollowReminder: (...a: unknown[]) => cancelFollow(...a),
  cancelPushedReminderIgnoringMissing: (...a: unknown[]) => cancelPushed(...a),
}));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({ getLumosPushConfig: () => pushConfig }));
vi.mock('../../api/_lib/followStaffName.js', () => ({ staffNameOfPhone: async () => null }));

import { enforceReplaceAiFrom, MIGRATION_133_NOT_READY, runIrecruitReplaceSync } from '../../api/_lib/irecruitReplaceSync.js';
import { REPLACE_FOLLOW_TOPIC } from '../../src/lib/irecruitReplaceSync.js';

type Call = { sql: string; params: unknown[] };
let calls: Call[] = [];
let existingRefs: string[] = [];
let existingRows: Array<{ id: string; source_ref: string; scheduled_at: string; mode: string; done: boolean }> = [];
let settingsRows: unknown[] = [{ payload: { rule: { atStart: false, dayOffset: -1, time: '18:00' } }, updated_at: null, updated_by_name: null }];
let settingsError: unknown = null;
let sourceRefError: unknown = null;
let insertErrorFor: string | null = null;
let insertSeq = 0;

function fakeDb(sql: string, params: unknown[] = []) {
  calls.push({ sql, params });
  if (/select payload, updated_at, updated_by_name from/.test(sql)) {
    if (settingsError) throw settingsError;
    return { rows: settingsRows };
  }
  if (/where source_ref = any/.test(sql)) {
    if (sourceRefError) throw sourceRefError;
    return {
      rows: [
        ...existingRefs.map((source_ref) => ({ id: `ex-${source_ref}`, source_ref, scheduled_at: '2099-01-01T00:00:00Z', mode: 'ai', done: true })),
        ...existingRows,
      ],
    };
  }
  if (/update .*follow_entries set scheduled_at/.test(sql)) return { rows: [] };
  if (/insert into .*follow_entries/.test(sql)) {
    const ref = String(params[10]);
    if (insertErrorFor && ref === insertErrorFor) throw { code: '23505' };
    insertSeq += 1;
    return { rows: [{ id: `id-${insertSeq}` }] };
  }
  if (/update .*follow_entries set dispatch_state/.test(sql)) return { rows: [] };
  if (/insert into .*app_irecruit_replace_sync/.test(sql)) return { rows: [] };
  throw new Error(`unexpected sql: ${sql.slice(0, 80)}`);
}

// 06:00 ไทย 2 ต.ค. 2569
const NOW = new Date('2026-10-02T06:00:00+07:00');
// mssql คืนนาฬิกาไทยเป็น Date ที่ถือเป็น UTC
const wall = (iso: string) => new Date(iso);
const row = (job_id: string, over: Record<string, unknown> = {}) => ({
  job_id,
  replace_no: 'R1',
  fname: 'ทดสอบ',
  lname: 'ระบบ',
  mobile: '0812345678',
  site_name: 'ไซต์ทดสอบ',
  site_code: 'S001',
  want_date: wall('2026-10-03T07:30:00Z'),
  ...over,
});

beforeEach(() => {
  calls = [];
  existingRefs = [];
  existingRows = [];
  settingsRows = [{ payload: { rule: { atStart: false, dayOffset: -1, time: '18:00' } }, updated_at: null, updated_by_name: null }];
  settingsError = null;
  sourceRefError = null;
  insertErrorFor = null;
  insertSeq = 0;
  dbQuery.mockReset();
  dbQuery.mockImplementation(async (sql: string, params?: unknown[]) => fakeDb(sql, params));
  irecruitSqlQuery.mockReset();
  unavailable.mockReset();
  unavailable.mockReturnValue(null);
  autoDispatch.mockReset();
  autoDispatch.mockResolvedValue(true);
  enqueuePlan.mockReset();
  cancelFollow.mockClear();
  cancelPushed.mockClear();
  pushConfig = { baseUrl: 'x' };
  enqueuePlan.mockImplementation(async (entries: Array<{ id: string }>) => new Map(entries.map((e) => [e.id, 'queued'])));
});

const inserts = () => calls.filter((c) => /insert into .*follow_entries/.test(c.sql));
const persisted = () => calls.filter((c) => /insert into .*app_irecruit_replace_sync/.test(c.sql)).map((c) => JSON.parse(String(c.params[0])));

describe('runIrecruitReplaceSync', () => {
  it('🔴 ครบรอบ: SQL ของเจ้าของ ช่วงวันนี้→+31 วัน · คนเดียวหลายใบ = ชุดเดียว · ตัดซ้ำ/ไม่มีเบอร์/เลยเวลา · เวลาโทร 18:00 วันก่อน · ส่ง AI', async () => {
    existingRefs = ['irecruit-replace:E'];
    irecruitSqlQuery.mockResolvedValue([
      row('A'), // เข้างาน 3 ต.ค. 07:30 → โทร 2 ต.ค. 18:00
      row('B', { want_date: wall('2026-10-04T05:00:00Z') }), // คนเดียวกัน เข้างาน 4 ต.ค. 05:00 → โทร 3 ต.ค. 18:00
      row('C', { mobile: '089-999-9999', fname: 'อีกคน', want_date: wall('2026-10-03T08:00:00Z') }),
      row('D', { mobile: null }),
      row('E'), // เคยดึงแล้ว
      row('F', { want_date: wall('2026-10-01T08:00:00Z') }), // เลยเวลาเข้างาน
      row('G', { mobile: '0870000000', want_date: wall('2026-10-02T09:00:00Z') }), // เข้างานวันนี้ 09:00 → เวลาตามกติกาผ่านแล้ว → โทรเร็วที่สุด
    ]);

    const s = await runIrecruitReplaceSync({ now: NOW });

    expect(s.error).toBeNull();
    expect(s).toMatchObject({ fromYmd: '2026-10-02', toYmd: '2026-11-02', fetched: 7, added: 4, alreadyIn: 1, noPhone: 1, pastDue: 1, asap: 1, queued: 4, notSent: 0 });

    // SQL ของเจ้าของ + ช่วงวันเป็นนาฬิกาไทย (driver ถือเป็น UTC) · to ไม่รวม = วันถัดจาก toYmd
    const [sql, inputs] = irecruitSqlQuery.mock.calls[0] as [string, { from: Date; to: Date }];
    expect(sql).toMatch(/h\.status = 'WS'/);
    expect(sql).toMatch(/h\.job_type = '2'/);
    expect(sql).toMatch(/ISNULL\(z\.status, ''\) <> 'C'/);
    expect(sql).toMatch(/ORDER BY jr\.date_add DESC/);
    expect(inputs.from.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(inputs.to.toISOString()).toBe('2026-11-03T00:00:00.000Z');

    const ins = inserts();
    expect(ins).toHaveLength(4);
    const byRef = Object.fromEntries(ins.map((c) => [String(c.params[10]), c.params]));
    // ทีมส่งคนแทน · เรื่อง · เบอร์ E.164 · หน่วยงาน · โทร 18:00 วันก่อนเข้างาน (11:00Z) · ชื่อคนสร้าง
    expect(byRef['irecruit-replace:A']).toEqual([
      'ทดสอบ ระบบ', '+66812345678', REPLACE_FOLLOW_TOPIC, 'เข้างาน 07:30 น.', '2026-10-02T11:00:00.000Z',
      expect.any(String), 'ไซต์ทดสอบ', 'S001', 'ดึงจาก iRecruit', 'replacement', 'irecruit-replace:A', 'ai',
    ]);
    expect(byRef['irecruit-replace:B']?.[4]).toBe('2026-10-03T11:00:00.000Z');
    // A กับ B คนเดียวกัน = group_id เดียว · C คนละชุด
    expect(byRef['irecruit-replace:A']?.[5]).toBe(byRef['irecruit-replace:B']?.[5]);
    expect(byRef['irecruit-replace:C']?.[5]).not.toBe(byRef['irecruit-replace:A']?.[5]);
    // G โทรเร็วที่สุด = ตอนนี้ + 10 นาที
    expect(byRef['irecruit-replace:G']?.[4]).toBe(new Date(NOW.getTime() + 10 * 60_000).toISOString());
    for (const c of ins) {
      expect(c.sql).toMatch(/1, \$12, null/); // ทุกสายเป็นสายแรก
      expect(c.params[11]).toBe('ai'); // ไม่ได้ตั้ง aiFrom = AI โทร
    }
    expect(ins.some((c) => String(c.params[10]) === 'irecruit-replace:D' || String(c.params[10]) === 'irecruit-replace:E' || String(c.params[10]) === 'irecruit-replace:F')).toBe(false);

    // แผนเดียวต่อชุด: ชุด A+B (เรียงตามเวลา) · ชุด C · ชุด G
    expect(enqueuePlan).toHaveBeenCalledTimes(3);
    const planAB = (enqueuePlan.mock.calls as Array<[Array<{ id: string; scheduled_at: Date; callRound: number; unitName: string | null }>]>).find((c) => c[0].length === 2)?.[0];
    expect(planAB?.map((e) => e.scheduled_at.toISOString())).toEqual(['2026-10-02T11:00:00.000Z', '2026-10-03T11:00:00.000Z']);
    expect(planAB?.every((e) => e.callRound === 1 && e.unitName === 'ไซต์ทดสอบ')).toBe(true);

    // จดสถานะส่ง + ผลรอบล่าสุด
    expect(calls.filter((c) => /set dispatch_state/.test(c.sql)).map((c) => c.params[1])).toEqual(['queued', 'queued', 'queued', 'queued']);
    expect(persisted().at(-1)?.lastRun).toMatchObject({ added: 4, queued: 4 });
  });

  it('สวิตช์ส่งอัตโนมัติปิด = สร้างสายแต่ไม่ส่ง AI (off) · ไม่เรียก Lumos', async () => {
    autoDispatch.mockResolvedValue(false);
    irecruitSqlQuery.mockResolvedValue([row('A')]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(s).toMatchObject({ added: 1, queued: 0, notSent: 1, error: null });
    expect(enqueuePlan).not.toHaveBeenCalled();
    expect(calls.filter((c) => /set dispatch_state/.test(c.sql)).map((c) => c.params[1])).toEqual(['off']);
  });

  it('🔴 สองรอบชนกัน: ฐานตอบ unique violation = นับว่ามีแล้ว ไม่พัง ไม่โทรซ้ำ', async () => {
    insertErrorFor = 'irecruit-replace:A';
    irecruitSqlQuery.mockResolvedValue([row('A'), row('B', { mobile: '0899999999' })]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(s).toMatchObject({ added: 1, alreadyIn: 1, error: null });
    expect(enqueuePlan).toHaveBeenCalledTimes(1);
  });

  it('🔴 ฐานยังไม่รัน 133 (source_ref) = จดเหตุผล ไม่สร้างสาย', async () => {
    sourceRefError = { code: '42703' };
    irecruitSqlQuery.mockResolvedValue([row('A')]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(s.error).toBe(MIGRATION_133_NOT_READY);
    expect(inserts()).toHaveLength(0);
    expect(enqueuePlan).not.toHaveBeenCalled();
  });

  it('ตารางตั้งค่ายังไม่มี = ไม่ถาม iRecruit ไม่สร้างสาย · iRecruit ปิดสวิตช์ = จดเหตุผลเดิมของสวิตช์', async () => {
    settingsError = { code: '42P01' };
    const s1 = await runIrecruitReplaceSync({ now: NOW });
    expect(s1.error).toBe(MIGRATION_133_NOT_READY);
    expect(irecruitSqlQuery).not.toHaveBeenCalled();

    settingsError = null;
    unavailable.mockReturnValue('ปิดการเชื่อม iRecruit ไว้ชั่วคราวตามที่สั่ง');
    const s2 = await runIrecruitReplaceSync({ now: NOW });
    expect(s2.error).toMatch(/ปิดการเชื่อม iRecruit/);
    expect(irecruitSqlQuery).not.toHaveBeenCalled();
    expect(inserts()).toHaveLength(0);
  });

  it('ต่อ iRecruit ไม่ได้กลางทาง = จดเหตุผล ไม่สร้างสาย', async () => {
    irecruitSqlQuery.mockRejectedValue(new Error('ECONNREFUSED'));
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(s.error).toMatch(/ต่อ iRecruit ไม่ได้/);
    expect(inserts()).toHaveLength(0);
    expect(persisted().at(-1)?.lastRun?.error).toMatch(/ต่อ iRecruit ไม่ได้/);
  });
});

describe('🔴 AI เริ่มโทรตั้งแต่ (เจ้าของสั่ง 2 ต.ค. 2569 "ถึงวันจันทร์เปลี่ยนเป็นคนโทรก่อนให้หมด")', () => {
  it('ดึงใหม่: สายที่นัดก่อน aiFrom สร้างเป็นคนโทร ไม่ส่ง Lumos · หลังจากนั้นยัง AI', async () => {
    settingsRows = [{ payload: { rule: { atStart: false, dayOffset: -1, time: '18:00', aiFrom: '2026-10-04' } }, updated_at: null, updated_by_name: null }];
    irecruitSqlQuery.mockResolvedValue([
      row('A'), // โทร 2 ต.ค. 18:00 → คนโทร
      row('B', { mobile: '0899999999', want_date: wall('2026-10-06T08:00:00Z') }), // โทร 5 ต.ค. → AI
    ]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    const byRef = Object.fromEntries(inserts().map((c) => [String(c.params[10]), c.params[11]]));
    expect(byRef).toEqual({ 'irecruit-replace:A': 'manual', 'irecruit-replace:B': 'ai' });
    expect(enqueuePlan).toHaveBeenCalledTimes(1);
    expect((enqueuePlan.mock.calls[0] as [Array<{ id: string }>])[0]).toHaveLength(1);
    expect(s).toMatchObject({ added: 2, queued: 1, notSent: 0 });
  });

  it('สายเดิม: แผนล้วน = ยกเลิกทั้งแผนด้วยรหัสหัวขบวน · แผนที่มีสายหลังวันนั้น = ยกเลิกเฉพาะสาย · แล้วเปลี่ยนเป็นคนโทร', async () => {
    dbQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] });
      if (/select id from .*follow_entries/.test(sql)) return { rows: [{ id: 'a1' }, { id: 'a2' }, { id: 'b1' }] };
      if (/select person_ref, plan_ref from/.test(sql))
        return {
          rows: [
            { person_ref: 'follow-a1', plan_ref: 'follow-a1' },
            { person_ref: 'follow-a2', plan_ref: 'follow-a1' },
            { person_ref: 'follow-b1', plan_ref: 'follow-b1' },
            { person_ref: 'follow-later', plan_ref: 'follow-b1' },
          ],
        };
      if (/update .*lumos_dispatch_queue/.test(sql)) return { rows: [] };
      if (/update .*follow_entries set call_mode = 'manual'/.test(sql)) return { rows: (params?.[0] as string[]).map((id) => ({ id })) };
      throw new Error(`unexpected sql: ${sql.slice(0, 60)}`);
    });
    const r = await enforceReplaceAiFrom('2026-10-06');
    expect(cancelPushed).toHaveBeenCalledWith('follow-a1');
    expect(cancelPushed).toHaveBeenCalledTimes(1);
    expect(cancelFollow).toHaveBeenCalledWith('b1', expect.any(Function));
    expect(cancelFollow).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ converted: 3, plansCancelled: 1, errors: 0 });
    expect(calls.find((c) => /select id from/.test(c.sql))?.params).toEqual(['replacement', '2026-10-05T17:00:00.000Z']);
  });

  it('🔴 ไม่มีคีย์ push = ไม่แตะอะไร (ห้ามเปลี่ยนเป็นคนโทรทั้งที่ Lumos ยังจะโทร) · ไม่ตั้ง aiFrom = ไม่ทำอะไร', async () => {
    pushConfig = null;
    expect(await enforceReplaceAiFrom('2026-10-06')).toEqual({ converted: 0, plansCancelled: 0, errors: 0 });
    pushConfig = { baseUrl: 'x' };
    expect(await enforceReplaceAiFrom(null)).toEqual({ converted: 0, plansCancelled: 0, errors: 0 });
    expect(calls).toHaveLength(0);
  });
});

describe('🔴 เวลาในระบบ = เวลาเข้างาน (เจ้าของ Choice 2 ต.ค. 2569) · สายเดิมย้ายเวลาให้', () => {
  it('ดึงใหม่: นัดตรงเวลาเข้างาน · สายเดิมที่ยังไม่โทร: คนโทร = ย้ายเวลาอย่างเดียว · AI = ยกเลิกแผนเก่าแล้วส่งใหม่', async () => {
    settingsRows = [{ payload: { rule: { atStart: true } }, updated_at: null, updated_by_name: null }];
    existingRows = [
      { id: 'm1', source_ref: 'irecruit-replace:M', scheduled_at: '2026-10-02T11:00:00Z', mode: 'manual', done: false },
      { id: 'a1', source_ref: 'irecruit-replace:A2', scheduled_at: '2026-10-02T11:00:00Z', mode: 'ai', done: false },
      { id: 'd1', source_ref: 'irecruit-replace:D2', scheduled_at: '2026-10-02T11:00:00Z', mode: 'manual', done: true },
    ];
    irecruitSqlQuery.mockResolvedValue([
      row('N', { mobile: '0877777777' }), // ใหม่ เข้างาน 3 ต.ค. 07:30
      row('M', { want_date: wall('2026-10-03T08:00:00Z') }),
      row('A2', { mobile: '0866666666', want_date: wall('2026-10-03T08:00:00Z') }),
      row('D2', { mobile: '0855555555', want_date: wall('2026-10-03T08:00:00Z') }),
    ]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(inserts()[0]?.params[4]).toBe('2026-10-03T00:30:00.000Z'); // 07:30 ไทย
    const moved = calls.filter((c) => /update .*follow_entries set scheduled_at/.test(c.sql)).map((c) => [c.params[0], c.params[1], c.params[2]]);
    expect(moved).toEqual([
      ['m1', '2026-10-03T01:00:00.000Z', 'เข้างาน 08:00 น.'],
      ['a1', '2026-10-03T01:00:00.000Z', 'เข้างาน 08:00 น.'],
    ]);
    expect(cancelFollow).toHaveBeenCalledWith('a1', expect.any(Function));
    expect(cancelFollow).toHaveBeenCalledTimes(1);
    expect(s.realigned).toBe(2);
  });
});
