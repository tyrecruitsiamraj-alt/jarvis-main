/**
 * ตรรกะดึงส่งคนแทนจาก iRecruit (เจ้าของเคาะ 2 ต.ค. 2569: ดึงเองทุกเช้า · เวลาโทรตั้งได้ · AI โทรเลย)
 * 🔴 ด่าน: นาฬิกาไทยจาก mssql อ่านถูก · เวลาโทรตามกติกา · ผ่านไปแล้วแต่ยังไม่เข้างาน = โทรเร็วที่สุด · เลยเวลาเข้างาน = ไม่สร้าง ·
 *    กติกาที่อ่านไม่ออกถอยไปค่าเริ่มต้น · คีย์กันซ้ำผูกใบงาน · env ว่าง = ค่าเริ่มต้น (ไม่ใช่ 0)
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPLACE_CALL_RULE,
  normalizeReplaceCallRule,
  parseReplaceRef,
  planReplaceCalls,
  reconcileReplaceCalls,
  replaceModeForType,
  readReplaceSyncConfig,
  REPLACE_ASAP_MINUTES,
  REPLACE_SYNC_DEFAULTS,
  replaceCallNote,
  replaceCallModeFor,
  replaceSlotNote,
  replaceSlotRef,
  replaceSourceRef,
  wantInstant,
  wantWallFromSqlDate,
} from '@/lib/irecruitReplaceSync';

describe('นาฬิกาไทยจาก mssql', () => {
  it('05:00Z ที่ driver คืนมา = เข้างาน 05:00 น. วันนั้น (ไม่เลื่อน 7 ชม.)', () => {
    expect(wantWallFromSqlDate(new Date('2026-10-05T05:00:00.000Z'))).toEqual({ ymd: '2026-10-05', hhmm: '05:00' });
    expect(wantWallFromSqlDate(new Date('2026-10-05T07:30:00.000Z'))).toEqual({ ymd: '2026-10-05', hhmm: '07:30' });
  });

  it('เวลาเข้างานเป็น instant ไทย +07:00', () => {
    expect(wantInstant({ ymd: '2026-10-05', hhmm: '07:30' }).toISOString()).toBe('2026-10-05T00:30:00.000Z');
  });
});

// 7 ต.ค. 2569: เวลาโทรกลับมาตั้งได้ผ่านจอ (`confirmTime` / `leadMinutes` — เจ้าของ "ต้องปรับผ่าน ui") · ค่าเก่ารูปแบบเดิมยังข้าม
describe('ค่าตั้ง (aiFrom · aiPaused · เวลาโทร)', () => {
  it('ค่าเริ่ม = ไม่ตั้ง · อ่านวันที่ถูกต้อง · เพี้ยน/ค่าเก่าในฐาน = ข้าม ไม่ throw', () => {
    expect(DEFAULT_REPLACE_CALL_RULE).toEqual({ aiFrom: null, aiPaused: false, confirmTime: '16:00', leadMinutes: [60, 15] });
    expect(normalizeReplaceCallRule({ atStart: false, dayOffset: -1, time: '18:00', aiFrom: '2026-10-06' })).toEqual({
      aiFrom: '2026-10-06',
      aiPaused: false,
      confirmTime: '16:00', leadMinutes: [60, 15],
    });
    expect(normalizeReplaceCallRule({ aiFrom: '6/10/2026' })).toEqual({ aiFrom: null, aiPaused: false, confirmTime: '16:00', leadMinutes: [60, 15] });
    expect(normalizeReplaceCallRule({ aiFrom: '2026-10-06', aiPaused: true })).toEqual({ aiFrom: '2026-10-06', aiPaused: true, confirmTime: '16:00', leadMinutes: [60, 15] });
    expect(normalizeReplaceCallRule({ aiPaused: 'yes' }).aiPaused).toBe(false);
    expect(normalizeReplaceCallRule(null)).toEqual(DEFAULT_REPLACE_CALL_RULE);
    expect(normalizeReplaceCallRule('x')).toEqual(DEFAULT_REPLACE_CALL_RULE);
  });
});

describe('AI เริ่มโทรตั้งแต่ (aiFrom)', () => {
  it('🔴 สายที่นัดก่อนเที่ยงคืนไทยของวัน aiFrom = คนโทร · ตั้งแต่วันนั้น = AI · ไม่ตั้ง = AI ทุกสาย', () => {
    expect(replaceCallModeFor(new Date('2026-10-05T18:00:00+07:00'), '2026-10-06')).toBe('manual');
    expect(replaceCallModeFor(new Date('2026-10-05T23:59:00+07:00'), '2026-10-06')).toBe('manual');
    expect(replaceCallModeFor(new Date('2026-10-06T00:00:00+07:00'), '2026-10-06')).toBe('ai');
    expect(replaceCallModeFor(new Date('2026-10-02T18:00:00+07:00'), null)).toBe('ai');
  });
});

describe('คีย์กันซ้ำ · หมายเหตุ', () => {
  it('หนึ่งใบงาน = หนึ่งคีย์ · หมายเหตุบอกแค่เวลาเข้างาน', () => {
    expect(replaceSourceRef(' 123456789012345678901234567890 ')).toBe('irecruit-replace:123456789012345678901234567890');
    expect(replaceSourceRef(42)).toBe('irecruit-replace:42');
    expect(replaceCallNote({ ymd: '2026-10-05', hhmm: '07:30' })).toBe('เข้างาน 07:30 น.');
  });
});

describe('ค่าตั้งของ worker', () => {
  it('env ว่าง = ค่าเริ่มต้น (เปิด · ทุก 5 นาที · 31 วัน) ไม่ใช่ 0', () => {
    expect(readReplaceSyncConfig({})).toEqual(REPLACE_SYNC_DEFAULTS);
    expect(readReplaceSyncConfig({ IRECRUIT_REPLACE_SYNC_TICK_MS: '' }).tickMs).toBe(5 * 60_000);
  });

  it('ปิดได้ · ตั้งระยะล่วงหน้าได้ในขอบเขต (เลิกรอบ 06:00 แล้ว — ดึงทุก 5 นาที)', () => {
    const c = readReplaceSyncConfig({ IRECRUIT_REPLACE_SYNC_ENABLED: 'false', IRECRUIT_REPLACE_SYNC_HORIZON_DAYS: '7' });
    expect(c.enabled).toBe(false);
    expect('hour' in c).toBe(false);
    expect(c.horizonDays).toBe(7);
  });

});

describe('Journey ส่งคนแทน 3 สาย (เจ้าของสั่ง 5 ต.ค. 2569)', () => {
  const wall = { ymd: '2026-10-07', hhmm: '05:00' };
  const at = (iso: string) => new Date(iso);

  it('ปกติ: คอนเฟิร์ม 16:00 วันก่อน · ก่อนเข้างาน 1 ชม. · 15 นาที (สาย 1/2/3)', () => {
    const p = planReplaceCalls(wall, at('2026-10-05T10:00:00+07:00'));
    expect(p.map((x) => [x.slot, x.round, x.at.toISOString(), x.asap])).toEqual([
      ['confirm', 1, '2026-10-06T09:00:00.000Z', false],
      ['lead60', 2, '2026-10-06T21:00:00.000Z', false],
      ['lead15', 3, '2026-10-06T21:45:00.000Z', false],
    ]);
  });

  it('เพิ่มหลัง 16:00 = คอนเฟิร์มตามคิว (อีก 10 นาที) · ก่อนเข้างานตามเดิม', () => {
    const now = at('2026-10-06T19:30:00+07:00');
    const p = planReplaceCalls(wall, now);
    expect(p[0]).toMatchObject({ slot: 'confirm', asap: true });
    expect(p[0].at.getTime()).toBe(now.getTime() + REPLACE_ASAP_MINUTES * 60_000);
    expect(p.map((x) => x.slot)).toEqual(['confirm', 'lead60', 'lead15']);
  });

  it('ใกล้เวลาเข้างาน: คิวคอนเฟิร์มช้ากว่าสายก่อนเข้างาน = ไม่คอนเฟิร์มแยก · สายที่เลยแล้วไม่สร้าง · เลยเวลาเข้างาน = ไม่มีสาย', () => {
    expect(planReplaceCalls(wall, at('2026-10-07T03:55:00+07:00')).map((x) => x.slot)).toEqual(['lead60', 'lead15']);
    expect(planReplaceCalls(wall, at('2026-10-07T04:20:00+07:00')).map((x) => x.slot)).toEqual(['confirm', 'lead15']);
    expect(planReplaceCalls(wall, at('2026-10-07T04:50:00+07:00')).map((x) => x.slot)).toEqual([]);
    expect(planReplaceCalls(wall, at('2026-10-07T05:00:00+07:00'))).toEqual([]);
  });

  it('คีย์ต่อสาย: ใบ + สาย + คน · อ่านคีย์รุ่นเก่าได้', () => {
    expect(replaceSlotRef('J1', 'lead15', 'abc')).toBe('irecruit-replace:J1:lead15:abc');
    expect(parseReplaceRef('irecruit-replace:J1:lead15:abc')).toEqual({ jobId: 'J1', slot: 'lead15', personKey: 'abc' });
    expect(parseReplaceRef('irecruit-replace:J1')).toEqual({ jobId: 'J1', slot: null, personKey: null });
    expect(parseReplaceRef('something-else')).toBeNull();
    expect(replaceSlotNote('confirm', wall)).toBe('ยืนยันเวลาเข้างาน 7/10 05:00 น.');
    expect(replaceSlotNote('lead60', wall)).toBe('เข้างาน 05:00 น.');
  });

  describe('reconcileReplaceCalls', () => {
    const d = (job: string, slot: 'confirm' | 'lead60' | 'lead15', iso: string, person = 'p1', asap = false) => ({
      ref: replaceSlotRef(job, slot, person), jobId: job, slot, at: at(iso), asap,
    });
    const e = (ref: string, iso: string, state: 'pending' | 'locked' = 'pending', id = ref) => ({ id, ref, scheduledAt: at(iso), state });

    it('ใบใหม่ = สร้างครบ · มีอยู่แล้ว (สถานะไหนก็ได้) = ไม่สร้างซ้ำ', () => {
      const want = [d('J1', 'confirm', '2026-10-06T09:00:00Z'), d('J1', 'lead60', '2026-10-06T21:00:00Z')];
      expect(reconcileReplaceCalls(want, [], { safeToCancel: true }).create).toHaveLength(2);
      const r = reconcileReplaceCalls(want, [e(want[0].ref, '2026-10-06T09:00:00Z', 'locked')], { safeToCancel: true });
      expect(r.create.map((x) => x.slot)).toEqual(['lead60']);
    });

    it('iRecruit แก้เวลา = ย้ายเวลาสายที่ยังไม่ถึง · คอนเฟิร์มตามคิวไม่ย้าย · สายที่ล็อกแล้วไม่ย้าย', () => {
      const want = [d('J1', 'lead60', '2026-10-06T22:00:00Z'), d('J1', 'confirm', '2026-10-06T12:10:00Z', 'p1', true)];
      const r = reconcileReplaceCalls(
        want,
        [e(want[0].ref, '2026-10-06T21:00:00Z'), e(want[1].ref, '2026-10-06T12:00:00Z')],
        { safeToCancel: true },
      );
      expect(r.reschedule.map((x) => x.desired.slot)).toEqual(['lead60']);
      expect(r.cancel).toEqual([]);
    });

    it('iRecruit ยกเลิกใบ/เปลี่ยนคน = ยกเลิกสายที่ยังไม่ถึงของคนเดิม (+ สร้างของคนใหม่) · ไม่ปลอดภัย = ไม่ยกเลิก', () => {
      const old = e(replaceSlotRef('J1', 'lead60', 'p1'), '2026-10-06T21:00:00Z');
      const locked = e(replaceSlotRef('J1', 'confirm', 'p1'), '2026-10-06T09:00:00Z', 'locked');
      const want = [d('J1', 'lead60', '2026-10-06T21:00:00Z', 'p2')];
      const r = reconcileReplaceCalls(want, [old, locked], { safeToCancel: true });
      expect(r.cancel).toEqual([old]);
      expect(r.create.map((x) => x.ref)).toEqual([want[0].ref]);
      expect(reconcileReplaceCalls([], [old], { safeToCancel: false }).cancel).toEqual([]);
    });

    it('สายรุ่นเก่า: ยังรอโทร = ยกเลิกแล้วสร้าง 3 สายแทน · คนจัดการไปแล้ว = ไม่สร้างใหม่ · ยกเลิกไม่ได้ = ยังไม่สร้าง (กันโทรซ้อน)', () => {
      const want = [d('J1', 'lead60', '2026-10-06T21:00:00Z'), d('J2', 'lead60', '2026-10-06T21:00:00Z')];
      const legacyPending = e('irecruit-replace:J1', '2026-10-06T22:00:00Z');
      const legacyDone = e('irecruit-replace:J2', '2026-10-06T22:00:00Z', 'locked');
      const r = reconcileReplaceCalls(want, [legacyPending, legacyDone], { safeToCancel: true });
      expect(r.cancel).toEqual([legacyPending]);
      expect(r.create.map((x) => x.jobId)).toEqual(['J1']);
      expect(reconcileReplaceCalls(want, [legacyPending], { safeToCancel: false }).create.map((x) => x.jobId)).toEqual(['J2']);
    });
  });
});

describe('replaceModeForType (5 ต.ค. 2569)', () => {
  it('EX = AI · คนใน/อื่น ๆ = คนโทร · ก่อน aiFrom = คนโทรเสมอ', () => {
    expect(replaceModeForType('EX', 'ai')).toBe('ai');
    expect(replaceModeForType(' ex ', 'ai')).toBe('ai');
    expect(replaceModeForType('IN', 'ai')).toBe('manual');
    // 7 ต.ค. 2569: ไม่ใช่ WL (IN) = AI — ไม่ระบุ/ER ด้วย
    expect(replaceModeForType(null, 'ai')).toBe('ai');
    expect(replaceModeForType('ER', 'ai')).toBe('ai');
    expect(replaceModeForType('EX', 'manual')).toBe('manual');
  });
});

/**
 * 🔴 พัก AI (เจ้าของสั่ง 6 ต.ค. 2569 ค่ำ: "ติดตามส่งคนแทน อย่าพึ่งส่งให้ Ai โทร" → Choice "หยุดสายที่ยังไม่โทร + ของใหม่" ·
 * "จนกว่าจะสั่งเปิด")
 */
describe('พัก AI (aiPaused)', () => {
  it('พัก = สายใหม่เป็นคนโทรทุกสาย แม้ EX · ไม่พัก = กติกาเดิม', () => {
    const at = new Date('2026-10-08T07:30:00+07:00');
    expect(replaceCallModeFor(at, '2026-10-06', true)).toBe('manual');
    expect(replaceModeForType('EX', replaceCallModeFor(at, '2026-10-06', true))).toBe('manual');
    expect(replaceModeForType('EX', replaceCallModeFor(at, '2026-10-06', false))).toBe('ai');
    expect(replaceCallModeFor(at, null, true)).toBe('manual');
  });
  it('server: สาย AI ที่ยังไม่ถึงเวลาเท่านั้น → คนโทร + ยกเลิกแผน · worker บังคับทุกรอบ · PATCH หัวหน้างานขึ้นไป', async () => {
    const { readFileSync } = await import('node:fs');
    const lib = readFileSync(`${process.cwd()}/api/_lib/irecruitReplaceSync.ts`, 'utf8');
    expect(lib).toContain("and coalesce(call_mode, 'ai') = 'ai' and scheduled_at > $2`");
    expect(lib).toContain('replaceCallModeFor(p.at, settings.rule.aiFrom, settings.rule.aiPaused)');
    const worker = readFileSync(`${process.cwd()}/api/_lib/irecruitReplaceSyncWorker.ts`, 'utf8');
    expect(worker).toContain('if (settings.rule.aiPaused) {');
    const handler = readFileSync(`${process.cwd()}/api/_handlers/irecruit-replace-sync.ts`, 'utf8');
    expect(handler).toContain("if (method === 'PATCH') {");
    expect(handler).toContain('const enforced = hasPause && body.aiPaused ? await enforceReplaceAiPaused() : null;');
    const page = readFileSync(`${process.cwd()}/src/pages/follow/FollowPage.tsx`, 'utf8');
    expect(page).toContain('data-testid="replace-ai-switch"');
  });
});
