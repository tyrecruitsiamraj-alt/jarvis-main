// @vitest-environment node
/**
 * ═══ ดึงส่งคนแทนจาก iRecruit → สายในแท็บติดตามส่งคนแทน ═══
 * Journey 5 ต.ค. 2569 (เจ้าของ): 3 สายต่อใบ — คอนเฟิร์ม 16:00 วันก่อนเข้างาน · ก่อนเข้างาน 1 ชม. · ก่อน 15 นาที ·
 * เพิ่มหลัง 16:00 = คอนเฟิร์มตามคิว · ดึงทุก 5 นาที · แก้เวลาใน iRecruit = ย้ายเวลา · ยกเลิกใบ/เปลี่ยนคน = ยกเลิกสายให้เอง
 * 🔴 ด่าน: SQL ของเจ้าของ (WS · job_type 2 · ตัด C) · กันซ้ำด้วย source_ref · ส่ง AI เฉพาะสวิตช์ follow_entry เปิด · แผนละคน+วัน ·
 *    ดึงพัง/ได้ 0 ใบทั้งที่มีสายรอ = ไม่ยกเลิกอะไร
 */
import { readFileSync } from 'node:fs';
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

import { cancelFlaggedFollowRowsAtLumos, enforceReplaceAiFrom, MIGRATION_133_NOT_READY, runIrecruitReplaceSync } from '../../api/_lib/irecruitReplaceSync.js';
import { REPLACE_FOLLOW_TOPIC } from '../../src/lib/irecruitReplaceSync.js';
import { createHash } from 'node:crypto';

type Call = { sql: string; params: unknown[] };
let calls: Call[] = [];
type Existing = { id: string; source_ref: string; scheduled_at: string; mode: string; group_id: string | null; recipient_phone: string | null; pending: boolean; before_type_rule?: boolean };
let existingRows: Existing[] = [];
let settingsRows: unknown[] = [];
let settingsError: unknown = null;
let existingError: unknown = null;
let insertErrorFor: string | null = null;
let insertSeq = 0;

function fakeDb(sql: string, params: unknown[] = []) {
  calls.push({ sql, params });
  if (/select payload, updated_at, updated_by_name from/.test(sql)) {
    if (settingsError) throw settingsError;
    return { rows: settingsRows };
  }
  if (/where source_ref like 'irecruit-replace:%'/.test(sql)) {
    if (existingError) throw existingError;
    return { rows: existingRows };
  }
  // ยกเลิกทีเดียวทั้งรอบ (6 ต.ค. 2569) — params[0] = รายการ id
  if (/set cancelled_at = now\(\)/.test(sql)) return { rows: (params[0] as string[]).map((id) => ({ id })) };
  // หาแผนที่ Lumos ของแถวที่ยกเลิก — ในเทสต์ไม่มีแผน ⇒ ยกเลิกทีละแถวด้วย cancelFollowReminder
  if (/select person_ref, plan_ref from/.test(sql)) return { rows: [] };
  // ขั้น 3.5 เก็บประเภทจาก iRecruit (136)
  if (/set replace_type = d\.t/.test(sql)) return { rows: [] };
  if (/update .*follow_entries set scheduled_at/.test(sql)) return { rows: [] };
  if (/insert into .*follow_entries/.test(sql)) {
    const ref = String(params[12]);
    if (insertErrorFor && ref.startsWith(insertErrorFor)) throw { code: '23505' };
    insertSeq += 1;
    return { rows: [{ id: `id-${insertSeq}` }] };
  }
  if (/update .*follow_entries set dispatch_state/.test(sql)) return { rows: [] };
  if (/insert into .*app_irecruit_replace_sync/.test(sql)) return { rows: [] };
  throw new Error(`unexpected sql: ${sql.slice(0, 80)}`);
}

/** คีย์คนไปแทน = sha1(เบอร์ E.164) 10 ตัว — ตัวเดียวกับ server */
const pk = (e164: string) => createHash('sha1').update(e164).digest('hex').slice(0, 10);
const P1 = '+66812345678';

// 10:00 ไทย 5 ต.ค. 2569 (ก่อน 16:00)
const NOW = new Date('2026-10-05T10:00:00+07:00');
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
  want_date: wall('2026-10-06T07:30:00Z'),
  replace_type: 'EX',
  ...over,
});

beforeEach(() => {
  calls = [];
  existingRows = [];
  settingsRows = [{ payload: { rule: {} }, updated_at: null, updated_by_name: null }];
  settingsError = null;
  existingError = null;
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
const insRef = (c: Call) => String(c.params[12]);
const persisted = () => calls.filter((c) => /insert into .*app_irecruit_replace_sync/.test(c.sql)).map((c) => JSON.parse(String(c.params[0])));

describe('runIrecruitReplaceSync — 3 สายต่อใบ', () => {
  it('🔴 ครบรอบ: คอนเฟิร์ม 16:00 วันก่อน · ก่อน 1 ชม. · ก่อน 15 นาที · คนเดียวหลายใบ = ชุดเดียว · แผนละคน+วัน · ตัดไม่มีเบอร์/เลยเวลา', async () => {
    irecruitSqlQuery.mockResolvedValue([
      row('A'), // เข้างาน 6 ต.ค. 07:30
      row('B', { want_date: wall('2026-10-07T05:00:00Z') }), // คนเดียวกัน เข้างาน 7 ต.ค. 05:00
      row('C', { mobile: '089-999-9999', fname: 'อีกคน', want_date: wall('2026-10-06T08:00:00Z') }),
      row('D', { mobile: null }),
      row('F', { want_date: wall('2026-10-04T08:00:00Z') }), // เลยเวลาเข้างาน
    ]);

    const s = await runIrecruitReplaceSync({ now: NOW });

    expect(s.error).toBeNull();
    // 🔴 7 ต.ค. 2569: ใบที่เลยเวลาเข้างาน (F) ก็ลง 3 สาย แต่เป็นคนโทร ("ขึ้น แต่ไม่โทร") ⇒ added 9 + 3 · queued ยัง 9
    expect(s).toMatchObject({ fromYmd: '2026-10-05', toYmd: '2026-11-05', fetched: 5, added: 12, alreadyIn: 0, noPhone: 1, pastDue: 1, asap: 0, queued: 9, notSent: 0, cancelled: 0 });
    expect(inserts().filter((c) => insRef(c).startsWith('irecruit-replace:F:')).map((c) => c.params[9])).toEqual(['manual', 'manual', 'manual']);

    const [sql] = irecruitSqlQuery.mock.calls[0] as [string];
    // 7 ต.ค. 2569 เจ้าของ Choice "ตามด้วย" — ใบ "รอดำเนินการ" (W) ด้วย
    expect(sql).toMatch(/h\.status IN \('W', 'WS'\)/);
    expect(sql).toMatch(/h\.job_type = '2'/);
    expect(sql).toMatch(/ISNULL\(z\.status, ''\) <> 'C'/);

    const byRef = Object.fromEntries(inserts().map((c) => [insRef(c), c.params]));
    // A: คอนเฟิร์ม 5 ต.ค. 16:00 (09:00Z) · ก่อน 1 ชม. 06:30 (5 ต.ค. 23:30Z) · ก่อน 15 นาที 07:15 (6 ต.ค. 00:15Z)
    expect(byRef[`irecruit-replace:A:confirm:${pk(P1)}`]).toEqual([
      'ทดสอบ ระบบ', P1, REPLACE_FOLLOW_TOPIC, 'ยืนยันเวลาเข้างาน 6/10 07:30 น.', '2026-10-05T09:00:00.000Z',
      expect.any(String), 'ไซต์ทดสอบ', 'S001', 1, 'ai', 'ดึงจาก iRecruit', 'replacement', `irecruit-replace:A:confirm:${pk(P1)}`,
    ]);
    expect(byRef[`irecruit-replace:A:lead60:${pk(P1)}`]?.slice(3, 5)).toEqual(['เข้างาน 07:30 น.', '2026-10-05T23:30:00.000Z']);
    expect(byRef[`irecruit-replace:A:lead15:${pk(P1)}`]?.[4]).toBe('2026-10-06T00:15:00.000Z');
    expect(byRef[`irecruit-replace:A:lead60:${pk(P1)}`]?.[8]).toBe(2);
    expect(byRef[`irecruit-replace:A:lead15:${pk(P1)}`]?.[8]).toBe(3);
    // A กับ B คนเดียวกัน = ชุดเดียว · C คนละชุด
    expect(byRef[`irecruit-replace:A:confirm:${pk(P1)}`]?.[5]).toBe(byRef[`irecruit-replace:B:lead15:${pk(P1)}`]?.[5]);
    expect(byRef[`irecruit-replace:C:confirm:${pk('+66899999999')}`]?.[5]).not.toBe(byRef[`irecruit-replace:A:confirm:${pk(P1)}`]?.[5]);

    // แผนละคน+วัน: คน 1 = 5 ต.ค. (A คอนเฟิร์ม) · 6 ต.ค. (A ก่อนเข้างาน 2 + B คอนเฟิร์ม 16:00) · 7 ต.ค. (B ก่อนเข้างาน 2) · C = 5 ต.ค. · 6 ต.ค.
    expect(enqueuePlan).toHaveBeenCalledTimes(5);
    const sizes = (enqueuePlan.mock.calls as Array<[unknown[]]>).map((c) => c[0].length).sort();
    expect(sizes).toEqual([1, 1, 2, 2, 3]);
    expect(persisted().at(-1)?.lastRun).toMatchObject({ added: 12, queued: 9 });
  });

  it('🔴 เพิ่มหลัง 16:00 = คอนเฟิร์มตามคิว (อีก 10 นาที) · ก่อนเข้างานตามเดิม', async () => {
    const late = new Date('2026-10-05T19:00:00+07:00');
    irecruitSqlQuery.mockResolvedValue([row('A')]);
    const s = await runIrecruitReplaceSync({ now: late });
    expect(s).toMatchObject({ added: 3, asap: 1 });
    expect(inserts().find((c) => insRef(c).includes(':confirm:'))?.params[4]).toBe(new Date(late.getTime() + 10 * 60_000).toISOString());
  });

  it('สวิตช์ส่งอัตโนมัติปิด = สร้างสายแต่ไม่ส่ง AI (off) · ไม่เรียก Lumos', async () => {
    autoDispatch.mockResolvedValue(false);
    irecruitSqlQuery.mockResolvedValue([row('A')]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(s).toMatchObject({ added: 3, queued: 0, error: null });
    expect(enqueuePlan).not.toHaveBeenCalled();
    expect(calls.filter((c) => /set dispatch_state/.test(c.sql)).map((c) => c.params[1])).toEqual(['off', 'off', 'off']);
  });

  it('🔴 สองรอบชนกัน: ฐานตอบ unique violation = นับว่ามีแล้ว ไม่พัง ไม่โทรซ้ำ', async () => {
    insertErrorFor = 'irecruit-replace:A:';
    irecruitSqlQuery.mockResolvedValue([row('A'), row('B', { mobile: '0899999999' })]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(s).toMatchObject({ added: 3, alreadyIn: 3, error: null });
  });

  it('🔴 aiFrom: สายที่นัดก่อนวันนั้น = คนโทร (ไม่ส่ง Lumos) · ตั้งแต่วันนั้น = AI', async () => {
    settingsRows = [{ payload: { rule: { aiFrom: '2026-10-06' } }, updated_at: null, updated_by_name: null }];
    irecruitSqlQuery.mockResolvedValue([row('A')]);
    await runIrecruitReplaceSync({ now: NOW });
    const modes = Object.fromEntries(inserts().map((c) => [insRef(c).split(':')[2], c.params[9]]));
    expect(modes).toEqual({ confirm: 'manual', lead60: 'ai', lead15: 'ai' }); // คอนเฟิร์ม 5 ต.ค. = คนโทร · 6 ต.ค. = AI
  });

  it('🔴 ฐานยังไม่รัน 133 (source_ref) = จดเหตุผล ไม่สร้างสาย', async () => {
    existingError = { code: '42703' };
    irecruitSqlQuery.mockResolvedValue([row('A')]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(s.error).toBe(MIGRATION_133_NOT_READY);
    expect(inserts()).toHaveLength(0);
    expect(enqueuePlan).not.toHaveBeenCalled();
  });

  it('ตารางตั้งค่ายังไม่มี = ไม่ถาม iRecruit · iRecruit ปิดสวิตช์ = จดเหตุผลเดิม · ต่อ iRecruit ไม่ได้ = ไม่สร้าง ไม่ยกเลิก', async () => {
    settingsError = { code: '42P01' };
    expect((await runIrecruitReplaceSync({ now: NOW })).error).toBe(MIGRATION_133_NOT_READY);
    expect(irecruitSqlQuery).not.toHaveBeenCalled();
    settingsError = null;
    unavailable.mockReturnValue('ปิดการเชื่อม iRecruit ไว้ชั่วคราวตามที่สั่ง');
    expect((await runIrecruitReplaceSync({ now: NOW })).error).toMatch(/ปิดการเชื่อม iRecruit/);
    unavailable.mockReturnValue(null);
    irecruitSqlQuery.mockRejectedValue(new Error('ECONNREFUSED'));
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(s.error).toMatch(/ต่อ iRecruit ไม่ได้/);
    expect(inserts()).toHaveLength(0);
    expect(calls.some((c) => /set cancelled_at/.test(c.sql))).toBe(false);
  });
});

describe('🔴 ใครโทรตามประเภทคนไปแทน (เจ้าของ Choice 5 ต.ค. 2569: Ex ให้ AI · คนในให้คนโทร)', () => {
  it('คนใน (IN/ER/ไม่ระบุ) = สร้าง 3 สายเป็นคนโทร ไม่ส่ง Lumos · Ex = AI', async () => {
    irecruitSqlQuery.mockResolvedValue([
      row('I', { replace_type: 'IN' }),
      row('N', { mobile: '0877777777', replace_type: null }),
      row('E', { mobile: '0866666666' }),
    ]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    const modeByJob = new Map<string, Set<unknown>>();
    for (const c of inserts()) {
      const job = String(c.params[12]).split(':')[1];
      modeByJob.set(job, new Set([...(modeByJob.get(job) ?? []), c.params[9]]));
    }
    expect([...(modeByJob.get('I') ?? [])]).toEqual(['manual']);
    expect([...(modeByJob.get('N') ?? [])]).toEqual(['manual']);
    expect([...(modeByJob.get('E') ?? [])]).toEqual(['ai']);
    expect((enqueuePlan.mock.calls as Array<[Array<{ recipient_phone: string }>]>).every((c) => c[0].every((e) => e.recipient_phone === '+66866666666'))).toBe(true);
    expect(s).toMatchObject({ added: 9, queued: 3 });
  });

  it('สาย AI เดิมของคนใน = เปลี่ยนเป็นคนโทร + ถอนแผนที่ Lumos (ไม่ทำกลับทาง)', async () => {
    existingRows = [
      // แถวที่สร้างก่อนกติกา EX/คนใน (before_type_rule) — แถวใหม่ที่เป็น AI = เจ้าหน้าที่สลับเอง ห้ามสลับกลับ (6 ต.ค. 2569)
      { id: 'x1', source_ref: `irecruit-replace:I:lead60:${pk(P1)}`, scheduled_at: '2026-10-05T23:30:00Z', mode: 'ai', group_id: 'g', recipient_phone: P1, pending: true, before_type_rule: true },
    ];
    irecruitSqlQuery.mockResolvedValue([row('I', { replace_type: 'IN' })]);
    dbQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (/set call_mode = 'manual'/.test(sql)) {
        calls.push({ sql, params: params ?? [] });
        return { rows: [] };
      }
      return fakeDb(sql, params);
    });
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(cancelFollow).toHaveBeenCalledWith('x1', expect.any(Function));
    expect(calls.some((c) => /set call_mode = 'manual'/.test(c.sql) && c.params[0] === 'x1')).toBe(true);
    expect(s.toManual).toBe(1);
  });
});

describe('เจ้าหน้าที่สลับคนในเป็น AI เอง = รอบดึงไม่สลับกลับ (6 ต.ค. 2569)', () => {
  it('แถวที่สร้างหลังกติกา (before_type_rule = false) เป็น AI = ไม่แตะ', async () => {
    existingRows = [
      { id: 'x2', source_ref: `irecruit-replace:I:lead60:${pk(P1)}`, scheduled_at: '2026-10-05T23:30:00Z', mode: 'ai', group_id: 'g', recipient_phone: P1, pending: true, before_type_rule: false },
    ];
    irecruitSqlQuery.mockResolvedValue([row('I', { replace_type: 'IN' })]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(cancelFollow).not.toHaveBeenCalledWith('x2', expect.any(Function));
    expect(calls.some((c) => /set call_mode = 'manual'/.test(c.sql))).toBe(false);
    expect(s.toManual ?? 0).toBe(0);
  });

  it('ทุกรอบเติมประเภทจาก iRecruit ลงแถว (EX / คนใน) ตาม source_ref', async () => {
    existingRows = [];
    irecruitSqlQuery.mockResolvedValue([row('E', { replace_type: 'EX' })]);
    await runIrecruitReplaceSync({ now: NOW });
    const upd = calls.find((c) => /set replace_type = d\.t/.test(c.sql));
    expect(upd).toBeTruthy();
    expect((upd?.params[1] as string[]).every((t) => t === 'EX')).toBe(true);
  });
});

describe('runIrecruitReplaceSync — แก้บน iRecruit แล้ว So Recruit เปลี่ยนตาม (5 ต.ค. 2569)', () => {
  const ex = (id: string, ref: string, iso: string, over: Partial<Existing> = {}): Existing => ({
    id, source_ref: ref, scheduled_at: iso, mode: 'ai', group_id: 'g1', recipient_phone: P1, pending: true, ...over,
  });

  it('🔴 แก้เวลาเข้างาน = ย้ายเวลาสายที่ยังไม่ถึง (AI: ยกเลิกแผนเก่าแล้วส่งใหม่) · สายใหม่ใช้ชุดเดิมของคนนั้น', async () => {
    existingRows = [
      ex('c1', `irecruit-replace:A:confirm:${pk(P1)}`, '2026-10-05T09:00:00Z'),
      ex('l1', `irecruit-replace:A:lead60:${pk(P1)}`, '2026-10-05T23:30:00Z'),
    ];
    irecruitSqlQuery.mockResolvedValue([row('A', { want_date: wall('2026-10-06T08:00:00Z') })]); // 07:30 → 08:00
    const s = await runIrecruitReplaceSync({ now: NOW });
    const moved = calls.filter((c) => /set scheduled_at/.test(c.sql)).map((c) => [c.params[0], c.params[1]]);
    expect(moved).toEqual([['l1', '2026-10-06T00:00:00.000Z']]);
    expect(cancelFollow).toHaveBeenCalledWith('l1', expect.any(Function));
    // คอนเฟิร์ม 16:00 ไม่เปลี่ยน · lead15 ยังไม่มี = สร้าง (ชุดเดิม g1)
    expect(inserts().map(insRef)).toEqual([`irecruit-replace:A:lead15:${pk(P1)}`]);
    expect(inserts()[0].params[5]).toBe('g1');
    expect(s).toMatchObject({ realigned: 1, added: 1, cancelled: 0 });
  });

  it('🔴 เปลี่ยนคนไปแทน = ยกเลิกสายที่ยังไม่ถึงของคนเดิม + สร้างของคนใหม่ · ใบหายจาก iRecruit = ยกเลิก · สายที่ล็อกแล้วไม่แตะ', async () => {
    existingRows = [
      ex('a1', `irecruit-replace:A:lead60:${pk(P1)}`, '2026-10-05T23:30:00Z'),
      ex('a2', `irecruit-replace:A:confirm:${pk(P1)}`, '2026-10-05T02:00:00Z', { pending: false }), // โทรไปแล้ว
      ex('y1', `irecruit-replace:Y:lead60:${pk(P1)}`, '2026-10-06T01:00:00Z', { mode: 'manual' }),
    ];
    irecruitSqlQuery.mockResolvedValue([row('A', { mobile: '0877777777' })]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    const cancelledIds = calls.filter((c) => /set cancelled_at/.test(c.sql)).flatMap((c) => c.params[0] as string[]);
    expect(cancelledIds).toEqual(['a1', 'y1']);
    // 🔴 ติดธงทั้งรอบในคำสั่งเดียว (ไม่ใช่ทีละแถว) — แผนใหม่ที่ส่งไป Lumos จะได้ไม่ดึงพี่น้องที่กำลังจะยกเลิกกลับเข้าไป
    expect(calls.filter((c) => /set cancelled_at/.test(c.sql))).toHaveLength(1);
    expect(cancelFollow).toHaveBeenCalledWith('a1', expect.any(Function)); // AI = ถอนแผนที่ Lumos ด้วย
    expect(cancelFollow).not.toHaveBeenCalledWith('y1', expect.any(Function)); // คนโทร = ไม่มีแผน
    expect(inserts().map(insRef).every((r) => r.endsWith(pk('+66877777777')))).toBe(true);
    expect(inserts()).toHaveLength(3);
    expect(s.cancelled).toBe(2);
  });

  it('🔴 สายรุ่นเก่า (หนึ่งใบหนึ่งสาย) ที่ยังไม่ถึง = ยกเลิกแล้วสร้าง 3 สาย · รุ่นเก่าที่คนจัดการแล้ว = ไม่สร้างใหม่', async () => {
    existingRows = [
      ex('old', 'irecruit-replace:A', '2026-10-06T00:30:00Z'),
      ex('done', 'irecruit-replace:B', '2026-10-04T00:30:00Z', { pending: false }),
    ];
    irecruitSqlQuery.mockResolvedValue([row('A'), row('B', { want_date: wall('2026-10-07T05:00:00Z') })]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(calls.filter((c) => /set cancelled_at/.test(c.sql)).flatMap((c) => c.params[0] as string[])).toEqual(['old']);
    expect(inserts().map((c) => insRef(c).split(':')[1])).toEqual(['A', 'A', 'A']);
    expect(s).toMatchObject({ cancelled: 1, added: 3 });
  });

  it('🔴 iRecruit ตอบ 0 ใบทั้งที่มีสายรอโทร = ไม่ยกเลิกอะไรเลย (ห้ามล้างทั้งระบบเพราะรอบเดียวพัง)', async () => {
    existingRows = [ex('a1', `irecruit-replace:A:lead60:${pk(P1)}`, '2026-10-05T23:30:00Z')];
    irecruitSqlQuery.mockResolvedValue([]);
    const s = await runIrecruitReplaceSync({ now: NOW });
    expect(calls.some((c) => /set cancelled_at/.test(c.sql))).toBe(false);
    expect(s.cancelled).toBe(0);
  });
});

describe('🔴 AI เริ่มโทรตั้งแต่ — enforceReplaceAiFrom (เจ้าของสั่ง 2 ต.ค. 2569)', () => {
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


describe('🔴 ยกเลิกแล้วต้องถึง Lumos — ทีละแผน แผนละครั้ง (6 ต.ค. 2569: สายที่ยกเลิก 5 ต.ค. ถูกโทรเช้า 6 ต.ค.)', () => {
  it('แผนที่ทุกสายถูกยกเลิก = ลบที่ Lumos ด้วยรหัสหัวขบวนครั้งเดียว · ไม่ส่งแผนใหม่ทีละแถว', async () => {
    cancelFollow.mockClear();
    cancelPushed.mockClear();
    dbQuery.mockImplementation(async (sql: string) => {
      if (/select person_ref, plan_ref from/.test(sql)) {
        return { rows: [{ person_ref: 'follow-l60', plan_ref: 'follow-l60' }, { person_ref: 'follow-l15', plan_ref: 'follow-l60' }] };
      }
      return { rows: [] };
    });
    const out = await cancelFlaggedFollowRowsAtLumos(['l60', 'l15'], async () => null);
    expect(cancelPushed).toHaveBeenCalledTimes(1);
    expect(cancelPushed).toHaveBeenCalledWith('follow-l60');
    expect(cancelFollow).not.toHaveBeenCalled();
    expect(out).toMatchObject({ plansCancelled: 1, plansResent: 0, errors: 0 });
  });

  it('แผนที่ยังมีสายอื่นเหลือ = ส่งแผนใหม่ครั้งเดียว (ไม่ใช่ทีละแถว)', async () => {
    cancelFollow.mockClear();
    cancelPushed.mockClear();
    dbQuery.mockImplementation(async (sql: string) => {
      if (/select person_ref, plan_ref from/.test(sql)) {
        return {
          rows: [
            { person_ref: 'follow-a', plan_ref: 'follow-a' },
            { person_ref: 'follow-b', plan_ref: 'follow-a' },
            { person_ref: 'follow-keep', plan_ref: 'follow-a' },
          ],
        };
      }
      return { rows: [] };
    });
    const out = await cancelFlaggedFollowRowsAtLumos(['a', 'b'], async () => null);
    expect(cancelFollow).toHaveBeenCalledTimes(1);
    expect(cancelPushed).not.toHaveBeenCalled();
    expect(out).toMatchObject({ plansCancelled: 0, plansResent: 1 });
  });
});

describe('แก้ล่าสุดชนะ (เจ้าของ 7 ต.ค. 2569 "อันไหนแก้ล่าสุดใช้อันนั้น")', () => {
  it('หมายเหตุยังตรงกับ iRecruit = iRecruit ไม่ได้เปลี่ยน ⇒ ไม่ทับเวลาที่เจ้าหน้าที่แก้ · ไม่ตรง = ย้ายตาม iRecruit', async () => {
    const { irecruitChangedSinceSync, replaceSlotNote } = await import('../../src/lib/irecruitReplaceSync');
    const wall = { ymd: '2026-10-08', hhmm: '08:00' } as never;
    const note = replaceSlotNote('confirm' as never, wall);
    expect(irecruitChangedSinceSync(note, note)).toBe(false);
    expect(irecruitChangedSinceSync(note, replaceSlotNote('confirm' as never, { ymd: '2026-10-08', hhmm: '09:00' } as never))).toBe(true);
    expect(irecruitChangedSinceSync(null, note)).toBe(true);
  });
  it('🔴 รอบดึงกรองการย้ายเวลาของแถวที่เจ้าหน้าที่แก้ · คงโหมด AI ที่เขาเลือก (ยกเว้นพัก AI)', () => {
    const src = readFileSync(new URL('../../api/_lib/irecruitReplaceSync.ts', import.meta.url), 'utf8');
    expect(src).toContain('(updated_by is not null) as staff_edited, note');
    expect(src).toContain('return irecruitChangedSinceSync(row.note, replaceSlotNote(meta.slot, meta.wall));');
    expect(src).toContain("row?.staff_edited && !settings.rule.aiPaused ? 'ai' : meta.mode");
  });
  it('🔴 พัก AI อยู่ = สายที่เพิ่มเองในแท็บส่งคนแทนเป็นคนโทรตั้งแต่สร้าง · แก้ตารางเป็น AI ไม่ได้', () => {
    const h = readFileSync(new URL('../../api/_handlers/follow.ts', import.meta.url), 'utf8');
    expect(h).toContain("base = { ...inputBase, callMode: 'manual' };");
    expect(h).toContain('ส่งคนแทนพัก AI อยู่');
  });
});

describe('🔴 ส่งคนแทน: 3 สายอยู่วันเข้างาน (เจ้าของ 7 ต.ค. 2569 "ต้องมี 3 สายนะทุกคนเลย" · Choice "วันเข้างาน")', () => {
  it('สาย 2/3 = เวลาโทร + 60/15 นาที · สาย 1 = วันในหมายเหตุ · ข้ามปี · คีย์เอง = null', async () => {
    const { replaceWorkYmd } = await import('../../src/lib/irecruitReplaceSync');
    expect(replaceWorkYmd({ source_ref: 'irecruit-replace:J1:confirm:p', scheduled_at: '2026-10-07T09:00:00.000Z', note: 'ยืนยันเวลาเข้างาน 8/10 06:00 น.' })).toBe('2026-10-08');
    expect(replaceWorkYmd({ source_ref: 'irecruit-replace:J1:lead60:p', scheduled_at: '2026-10-07T22:00:00.000Z' })).toBe('2026-10-08');
    expect(replaceWorkYmd({ source_ref: 'irecruit-replace:J1:lead15:p', scheduled_at: '2026-10-07T22:45:00.000Z' })).toBe('2026-10-08');
    // เข้างาน 00:30 → สาย 2 โทร 23:30 วันก่อน แต่ยังอยู่วันเข้างาน
    expect(replaceWorkYmd({ source_ref: 'irecruit-replace:J1:lead60:p', scheduled_at: '2026-10-08T16:30:00.000Z' })).toBe('2026-10-09');
    expect(replaceWorkYmd({ source_ref: 'irecruit-replace:J1:confirm:p', scheduled_at: '2026-12-31T09:00:00.000Z', note: 'ยืนยันเวลาเข้างาน 1/1 08:00 น.' })).toBe('2027-01-01');
    expect(replaceWorkYmd({ source_ref: null, scheduled_at: '2026-10-07T09:00:00.000Z' })).toBeNull();
  });
  it('ตาราง/แผง/ตัวกรองวัน/ผลที่คนกด ใช้วันเดียวกัน', async () => {
    const { followEntryYmd } = await import('../../src/lib/followPlanning');
    expect(followEntryYmd({ source_ref: 'irecruit-replace:J1:confirm:p', scheduled_at: '2026-10-07T09:00:00.000Z', note: 'ยืนยันเวลาเข้างาน 8/10 06:00 น.' })).toBe('2026-10-08');
    expect(followEntryYmd({ scheduled_at: '2026-10-07T09:00:00.000Z' })).toBe('2026-10-07');
    const page = readFileSync(new URL('../../src/pages/follow/FollowPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('const ymd = followEntryYmd(e);');
    expect(readFileSync(new URL('../../src/lib/followListFilter.ts', import.meta.url), 'utf8')).toContain('(replaceWorkYmd(e) ?? bangkokDay(e.scheduled_at)) !== f.date');
    const cal = readFileSync(new URL('../../src/components/follow/FollowPlanningCalendar.tsx', import.meta.url), 'utf8');
    expect(cal).toContain("replaceSlot === 1 ? 'คอนเฟิร์ม' : lead != null && lead > 0 ? leadText(lead) : 'ก่อนเข้างาน'");
  });
});

describe('🔴 ส่งคนแทนคีย์เอง = 3 สายจากวันเวลาเข้างาน (7 ต.ค. 2569)', () => {
  it('คีย์ manual-replace อ่านเลขสาย/วันเข้างานได้เหมือนของ iRecruit', async () => {
    const { replaceSlotRoundOfRef, replaceWorkYmd } = await import('../../src/lib/irecruitReplaceSync');
    expect(replaceSlotRoundOfRef('manual-replace:202610080800-ab:lead15:m')).toBe(3);
    expect(replaceWorkYmd({ source_ref: 'manual-replace:202610080800-ab:lead60:m', scheduled_at: '2026-10-08T00:00:00.000Z' })).toBe('2026-10-08');
  });
  it('server: replace_start → planReplaceCalls ตัวเดียวกับรอบดึง · หมายเหตุ/คีย์รายสาย · รอบดึงไม่แตะ (กรองแค่ irecruit-replace)', async () => {
    const { parseReplaceStart } = await import('../../api/_handlers/follow');
    expect(parseReplaceStart({ ymd: '2026-10-08', hhmm: '08:00' })).toEqual({ ymd: '2026-10-08', hhmm: '08:00' });
    expect(parseReplaceStart({ ymd: '8/10', hhmm: '8:00' })).toBeNull();
    const h = readFileSync(new URL('../../api/_handlers/follow.ts', import.meta.url), 'utf8');
    expect(h).toContain('const plans = planReplaceCallsFull(replaceStart, new Date(), replaceRule);');
    expect(h).toContain("callMode: p.past ? ('manual' as const) : modeOfSlot(p.slot),");
    expect(h).toContain('sourceRef: `manual-replace:${jobKey}:${p.slot}:m`');
    const sync = readFileSync(new URL('../../api/_lib/irecruitReplaceSync.ts', import.meta.url), 'utf8');
    expect(sync).toContain("where source_ref like 'irecruit-replace:%'");
  });
  it('จอ: แท็บส่งคนแทนขั้นตั้งเวลา = วันเวลาเข้างาน + พรีวิว 3 สาย', () => {
    const page = readFileSync(new URL('../../src/pages/follow/FollowPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('step === 3 && replaceView ? (');
    expect(page).toContain('replace_start: start,');
  });
});

describe('🔴 ส่งคนแทน 7 ต.ค. 2569 รอบบ่าย (เจ้าของ 6 ข้อ)', () => {
  it('3 สายครบเสมอ · สายที่เลยเวลา = past (คนโทร) · ลงย้อนหลังทั้งใบก็ยังลง', async () => {
    const { planReplaceCallsFull } = await import('../../src/lib/irecruitReplaceSync');
    const wall = { ymd: '2026-10-07', hhmm: '07:00' };
    const after = planReplaceCallsFull(wall, new Date('2026-10-07T01:00:00Z')); // 08:00 ไทย = ลงหลังเข้างาน
    expect(after.map((p) => [p.slot, p.past])).toEqual([['confirm', true], ['lead60', true], ['lead15', true]]);
    const before = planReplaceCallsFull(wall, new Date('2026-10-06T00:00:00Z'));
    expect(before.every((p) => !p.past)).toBe(true);
  });
  it('เวลาโทรตั้งได้ · ค่าเพี้ยน = ค่าเริ่ม · สาย 2 ต้องก่อนสาย 3', async () => {
    const { normalizeReplaceCallRule, planReplaceCalls, replaceScheduleText } = await import('../../src/lib/irecruitReplaceSync');
    const r = normalizeReplaceCallRule({ confirmTime: '17:30', leadMinutes: [90, 20] });
    expect(r).toMatchObject({ confirmTime: '17:30', leadMinutes: [90, 20] });
    expect(normalizeReplaceCallRule({ confirmTime: '25:00', leadMinutes: [10, 20] })).toMatchObject({ confirmTime: '16:00', leadMinutes: [60, 15] });
    const p = planReplaceCalls({ ymd: '2026-10-09', hhmm: '08:00' }, new Date('2026-10-07T00:00:00Z'), r);
    expect(p.map((x) => x.at.toISOString())).toEqual(['2026-10-08T10:30:00.000Z', '2026-10-08T23:30:00.000Z', '2026-10-09T00:40:00.000Z']);
    expect(replaceScheduleText(r)).toBe('คอนเฟิร์ม 17:30 วันก่อนเข้างาน · ก่อน 1 ชม. 30 นาที · ก่อน 20 นาที');
  });
  it('วันเข้างานของสาย 2/3 อ่านจากหมายเหตุ (ไม่ผูก 60/15 นาที)', async () => {
    const { replaceLeadStart } = await import('../../src/lib/irecruitReplaceSync');
    expect(replaceLeadStart(Date.parse('2026-10-08T16:30:00Z'), 'เข้างาน 01:00 น.')).toBe(Date.parse('2026-10-08T18:00:00Z'));
    expect(replaceLeadStart(Date.parse('2026-10-08T16:30:00Z'), null)).toBeNull();
  });
  it('เพิ่มโดย = อีเมลคนเพิ่มใบใน iRecruit → ชื่อ → null · เติมให้แถวเดิมที่ยังเป็นป้ายรอบดึง', async () => {
    const { replaceAdderLabel } = await import('../../api/_lib/irecruitReplaceSync');
    expect(replaceAdderLabel({ adder_email: ' a@siamraj.com ', adder_name: 'x' })).toBe('a@siamraj.com');
    expect(replaceAdderLabel({ adder_email: null, adder_name: ' สมชาย ใจดี ' })).toBe('สมชาย ใจดี');
    expect(replaceAdderLabel({ adder_email: '', adder_name: '' })).toBeNull();
    const src = readFileSync(new URL('../../api/_lib/irecruitReplaceSync.ts', import.meta.url), 'utf8');
    expect(src).toContain("where f.source_ref = v.ref and f.created_by_name like 'ดึงจาก iRecruit%'");
  });
  it('แก้เวลาสายคอนเฟิร์มที่โทรแล้ว ไม่ส่งโทรใหม่ · ตั้งเวลาโทรผ่าน API ค่าเพี้ยน = 400', () => {
    const h = readFileSync(new URL('../../api/_handlers/follow.ts', import.meta.url), 'utf8');
    expect(h).toContain('if (movedToFuture && !calledConfirm && ');
    const api = readFileSync(new URL('../../api/_handlers/irecruit-replace-sync.ts', import.meta.url), 'utf8');
    expect(api).toContain("'เวลาคอนเฟิร์มต้องเป็น HH:MM'");
  });
});
