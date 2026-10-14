// @vitest-environment node
/**
 * 🔴 กัน AI ไม่โทรแบบเงียบ ๆ (เจ้าของ 8 ต.ค. 2569 "ครบหมดเมื่อวานก็ครบหมด แต่ไม่โทรแล้วมันจะเกิดอีกไหม" → Choice "ทำทั้งสองชั้น")
 * ชั้น 1: ถาม Lumos ว่าแผนเข้าระบบจริงไหม · ล้ม = ส่งใหม่ 1 ครั้ง · ยังไม่ผ่าน = ขึ้นจอ + แจ้งเตือน · ถามไม่ได้ ≠ ล้ม
 * ชั้น 2: สาย AI เลยเวลา 15 นาทีไม่มีผล = แจ้งทีมครั้งเดียว · ไม่สลับเป็นคนโทร
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { followDispatchLabel } from '../../src/lib/followDispatchState';

const dbQuery = vi.fn();
const getEventStatus = vi.fn();
const resync = vi.fn();
const notifyUsers = vi.fn();
const notifyRoles = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  getLumosPushConfig: () => ({ url: 'x' }),
  getEventStatus: (...a: unknown[]) => getEventStatus(...a),
}));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({ resyncFollowPlanWithLumos: (...a: unknown[]) => resync(...a) }));
vi.mock('../../api/_lib/followStaffName.js', () => ({ staffNameOfPhone: vi.fn() }));
vi.mock('../../api/_lib/appNotifications.js', () => ({
  notifyUsers: (...a: unknown[]) => notifyUsers(...a),
  notifyRoles: (...a: unknown[]) => notifyRoles(...a),
}));

const mod = await import('../../api/_lib/followLumosWatch');

const plan = (over: Record<string, unknown> = {}) => ({
  qid: '1',
  entry_id: 'e1',
  plan: 'follow-e1',
  event_id: 'follow-e1:v1',
  retries: 0,
  stuck: false,
  ...over,
});

function db(plans: unknown[], extra: (sql: string) => unknown = () => ({ rows: [] })) {
  dbQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('as event_id')) return { rows: plans };
    if (sql.includes("dispatch_state = 'not_imported'") && sql.includes('returning'))
      return { rows: [{ id: 'e1', created_by: 'u1', name: 'นายทดสอบ', at: '2026-10-09T00:00:00Z' }] };
    if (sql.includes('select person_ref')) return { rows: [{ person_ref: 'follow-e1' }, { person_ref: 'follow-e2' }] };
    return extra(sql);
  });
}

beforeEach(() => {
  dbQuery.mockReset();
  getEventStatus.mockReset();
  resync.mockReset();
  notifyUsers.mockReset();
  notifyRoles.mockReset();
});

describe('ชั้น 1 — แผนเข้า Lumos จริงไหม', () => {
  it('ถามเฉพาะหัวขบวนที่รอโทร ส่งไปแล้ว ≥ 2 นาที ยังไม่รู้ผล', () => {
    const sql = mod.pendingImportSql();
    expect(sql).toContain('q.person_ref = coalesce(q.plan_ref, q.person_ref)');
    expect(sql).toContain("q.status = 'pending'");
    expect(sql).toContain("coalesce(q.lumos_import_status, 'pending') in ('pending', 'processing')");
    expect(sql).toContain("interval '2 minutes'");
  });

  it('🔴 ส่งแผนใหม่แล้ว ผลนำเข้าของ event เก่าใช้ไม่ได้ (14 ต.ค. 2569: อภิชาติ 13 ต.ค. + แผนรอโทร 44 แผน)', async () => {
    // ตัวถาม: ผลที่ถามไว้ก่อนส่งรอบล่าสุด = ถามใหม่
    expect(mod.pendingImportSql()).toContain('q.lumos_import_checked_at < q.push_accepted_at');
    // ตอนส่ง: จด event ใหม่พร้อมล้างผลนำเข้าเดิม
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../api/_lib/lumosDispatch.ts', import.meta.url), 'utf8');
    const ack = src.slice(src.indexOf('async function recordPushAck'), src.indexOf('async function recordPushAck') + 900);
    expect(ack).toMatch(/push_event_id = \$2, push_accepted_at = now\(\),\s*lumos_import_status = null/);
  });

  it('imported = จดไว้ ไม่ทำอะไรต่อ', async () => {
    db([plan()]);
    getEventStatus.mockResolvedValue({ status: 'imported', error: null });
    const r = await mod.checkFollowPlanImports();
    expect(r).toMatchObject({ checked: 1, imported: 1, resent: 0, notImported: 0 });
    expect(resync).not.toHaveBeenCalled();
  });

  it('🔴 ถามไม่ได้ (404/เน็ต) ≠ ล้ม — ไม่ส่งใหม่ ไม่แจ้งเตือน', async () => {
    db([plan()]);
    getEventStatus.mockRejectedValue(new Error('ดูสถานะ event ล้มเหลว: 404'));
    const r = await mod.checkFollowPlanImports();
    expect(r).toMatchObject({ checked: 0, resent: 0, notImported: 0 });
    expect(resync).not.toHaveBeenCalled();
    expect(notifyRoles).not.toHaveBeenCalled();
  });

  it('failed ครั้งแรก = ส่งแผนใหม่ 1 ครั้ง แล้วถามใหม่ตั้งแต่ต้น (ทุกสายในแผน)', async () => {
    db([plan()]);
    getEventStatus.mockResolvedValue({ status: 'failed', error: 'duplicate contact' });
    resync.mockResolvedValue({ pushed: true, rounds: 2 });
    const r = await mod.checkFollowPlanImports();
    expect(resync).toHaveBeenCalledWith('e1', expect.anything());
    expect(r).toMatchObject({ resent: 1, notImported: 0 });
    const reset = dbQuery.mock.calls.find((c) => String(c[0]).includes('lumos_import_status = null'));
    expect(reset?.[1]).toEqual([['follow-e1', 'follow-e2']]);
    expect(dbQuery.mock.calls.some((c) => String(c[0]).includes('lumos_import_retries = lumos_import_retries + 1'))).toBe(true);
  });

  it('ส่งใหม่แล้วยังล้ม = ขึ้น "Lumos ไม่รับแผน" + แจ้งคนเพิ่มและหัวหน้า · ไม่ส่งซ้ำอีก', async () => {
    db([plan({ retries: 1 })]);
    getEventStatus.mockResolvedValue({ status: 'discarded', error: null });
    const r = await mod.checkFollowPlanImports();
    expect(resync).not.toHaveBeenCalled();
    expect(r.notImported).toBe(1);
    expect(notifyUsers).toHaveBeenCalledWith(['u1'], expect.objectContaining({ type: 'follow_not_imported' }));
    expect(notifyRoles).toHaveBeenCalledWith(
      ['admin', 'supervisor'],
      expect.objectContaining({ dedupeKey: 'follow_not_imported:follow-e1' }),
    );
  });

  it('🔴 pending ค้างเกิน 30 นาที = จด log อย่างเดียว ไม่ส่งใหม่ ไม่ขึ้นจอ (กันเตือนทั้งระบบรอบแรก)', async () => {
    db([plan({ stuck: true })]);
    getEventStatus.mockResolvedValue({ status: 'processing', error: null });
    const r = await mod.checkFollowPlanImports();
    expect(resync).not.toHaveBeenCalled();
    expect(r).toMatchObject({ notImported: 0, stuck: 1 });
    expect(notifyRoles).not.toHaveBeenCalled();
  });

  it(`ส่งใหม่ไม่เกิน ${mod.MAX_RESYNC_PER_RUN} แผนต่อรอบ`, async () => {
    db(Array.from({ length: 15 }, (_, i) => plan({ qid: String(i), plan: `follow-p${i}`, entry_id: `e${i}` })));
    getEventStatus.mockResolvedValue({ status: 'failed', error: null });
    resync.mockResolvedValue({ pushed: true, rounds: 1 });
    await mod.checkFollowPlanImports();
    expect(resync).toHaveBeenCalledTimes(mod.MAX_RESYNC_PER_RUN);
  });
});

describe('ชั้น 2 — สาย AI เลยเวลาไม่มีผล', () => {
  it('AI · ยังไม่มีผล · เลยเวลา 15 นาที · ไม่เกิน 3 ชม. · ยังไม่เคยเตือน · ไม่ซ้ำกับ Lumos ไม่รับแผน', () => {
    const sql = mod.overdueAiSql();
    expect(sql).toContain("coalesce(f.call_mode, 'ai') = 'ai'");
    expect(sql).toContain("interval '15 minutes'");
    expect(sql).toContain("interval '3 hours'");
    expect(sql).toContain('q.overdue_alerted_at is null');
    expect(sql).toContain("<> 'not_imported'");
  });

  it('แจ้งครั้งเดียวต่อสาย (จดก่อนแจ้ง) · 🔴 ไม่สลับเป็นคนโทร', async () => {
    dbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('as qid')) return { rows: [{ qid: '9', created_by: 'u2', name: 'นายทดสอบ', at: '2026-10-08T23:50:00Z' }] };
      if (sql.includes('set overdue_alerted_at')) return { rows: [{ id: '9' }] };
      return { rows: [] };
    });
    const r = await mod.alertOverdueAiFollow();
    expect(r.alerted).toBe(1);
    expect(notifyUsers).toHaveBeenCalledWith(
      ['u2'],
      expect.objectContaining({ type: 'follow_ai_overdue', title: expect.stringContaining('06:50') }),
    );
    expect(dbQuery.mock.calls.some((c) => String(c[0]).includes("call_mode = 'manual'"))).toBe(false);
  });
});

describe('ผูกเข้าตัวเดินทุกนาที + จอ', () => {
  it('ตัวส่งซ้ำงานติดตามเรียกทั้งสองชั้น', () => {
    const w = readFileSync(new URL('../../api/_lib/followPushRetryWorker.ts', import.meta.url), 'utf8');
    expect(w).toContain('await checkFollowPlanImports();');
    expect(w).toContain('await alertOverdueAiFollow();');
  });

  it('"Lumos ไม่รับแผน" ชนะ "ส่งให้ AI แล้ว" ตอนคิวยังรอ', () => {
    expect(followDispatchLabel({ state: 'not_imported', callStatus: 'pending' }).label).toBe('Lumos ไม่รับแผน');
    expect(followDispatchLabel({ state: 'not_imported', callStatus: 'completed' }).label).toBe('AI โทรจบแล้ว');
  });
});

/**
 * ชั้น 3 (เจ้าของ 13 ต.ค. 2569 "อะไรที่จะไม่โทร และมีโอกาสจะไม่โทร จะกันให้หมด"):
 * สรุป "สายที่จะไม่ถูกโทร" ชั่วโมงละครั้งต่อแท็บ — คนยังไม่โทร + AI ส่งไม่ได้ · ไม่มี = ไม่แจ้ง
 */
describe('สรุปสายที่จะไม่ถูกโทร (ชั้น 3)', () => {
  it('แจ้งแท็บที่มีของ · แท็บที่เป็น 0 ไม่แจ้ง · คีย์กันซ้ำรายชั่วโมงต่อแท็บ', async () => {
    dbQuery.mockReset().mockResolvedValue({
      rows: [
        { team: 'replacement', staff_late: 12, ai_not_sent: 1 },
        { team: 'main', staff_late: 0, ai_not_sent: 0 },
      ],
    });
    notifyRoles.mockReset();
    const r = await mod.alertFollowAtRiskDigest(new Date('2026-10-13T03:20:00Z')); // 10:20 ไทย
    expect(r.alerted).toBe(1);
    expect(notifyRoles).toHaveBeenCalledTimes(1);
    const [roles, input] = notifyRoles.mock.calls[0];
    expect(roles).toEqual(['admin', 'supervisor']);
    expect(input).toMatchObject({
      type: 'follow_at_risk',
      title: 'สายที่จะไม่ถูกโทร · ติดตามส่งคนแทน',
      body: 'คนยังไม่โทร 12 สาย · AI ส่งไม่ได้ 1 สาย (ใน 1 ชม.)',
      link: '/follow?view=replace',
      dedupeKey: 'follow_at_risk:replacement:2026101310',
    });
    // ชุดสถานะ "ส่งไม่ได้" ตัวเดียวกับป้ายบนจอ
    expect(dbQuery.mock.calls[0][1]).toEqual([['held', 'suppressed', 'guarded', 'no_phone', 'off', 'push_failed', 'not_imported']]);
  });

  it('ตัวทำงานทุกนาทีเรียกชั้น 3 ต่อจากชั้น 2', () => {
    const src = readFileSync(new URL('../../api/_lib/followPushRetryWorker.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/await alertOverdueAiFollow\(\);[\s\S]*await alertFollowAtRiskDigest\(\);/);
  });
});

describe('ชั้น 4 — AI ลงผลรับทราบ/ไป แต่เขาบอกว่าลา (เจ้าของสั่ง 14 ต.ค. 2569 "ป้ายแดง ลา")', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    qid: '77',
    created_by: 'u1',
    name: 'นายทดสอบ',
    unit: 'หน่วยงานทดสอบ',
    team: null,
    call_outcome: 'acknowledged',
    call_summary: 'ผู้รับสายแจ้งว่าวันนี้ลากิจ 1 วัน จึงยังไม่ได้ไปที่หน่วยงาน',
    call_reply: null,
    ...over,
  });

  it('ดูเฉพาะผลรับทราบ/ไป ที่กลับมาใน 3 ชม. ของงานติดตามที่ไม่ถูกยกเลิก', () => {
    const sql = mod.followLeaveMismatchSql();
    expect(sql).toContain("q.result->>'outcome' = any($1::text[])");
    expect(sql).toContain("interval '3 hours'");
    expect(sql).toContain('f.cancelled_at is null');
  });

  it('บอกลา ⇒ แจ้งคนเพิ่ม + หัวหน้า ครั้งเดียวต่อสาย · ไม่ลา/คำว่าเวลางาน ⇒ ไม่แจ้ง · ไม่เขียนฐาน', async () => {
    dbQuery.mockResolvedValue({
      rows: [row(), row({ qid: '78', call_summary: 'ถึงหน่วยงานแล้ว แจ้งเรื่องเวลางาน 16:00' })],
    });
    const r = await mod.alertFollowLeaveMismatch();
    expect(r.alerted).toBe(1);
    expect(notifyUsers).toHaveBeenCalledWith(['u1'], expect.objectContaining({ type: 'follow_leave', dedupeKey: 'follow_leave:77' }));
    expect(notifyRoles).toHaveBeenCalledWith(['admin', 'supervisor'], expect.objectContaining({ title: 'นายทดสอบ บอกว่าลา แต่ AI ลงผลว่ารับทราบ' }));
    expect(dbQuery.mock.calls.every((c) => !/update|insert|delete/i.test(String(c[0])))).toBe(true);
  });
});
