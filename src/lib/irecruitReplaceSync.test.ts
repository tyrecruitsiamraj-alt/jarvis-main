/**
 * ตรรกะดึงส่งคนแทนจาก iRecruit (เจ้าของเคาะ 2 ต.ค. 2569: ดึงเองทุกเช้า · เวลาโทรตั้งได้ · AI โทรเลย)
 * 🔴 ด่าน: นาฬิกาไทยจาก mssql อ่านถูก · เวลาโทรตามกติกา · ผ่านไปแล้วแต่ยังไม่เข้างาน = โทรเร็วที่สุด · เลยเวลาเข้างาน = ไม่สร้าง ·
 *    กติกาที่อ่านไม่ออกถอยไปค่าเริ่มต้น · คีย์กันซ้ำผูกใบงาน · env ว่าง = ค่าเริ่มต้น (ไม่ใช่ 0)
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPLACE_CALL_RULE,
  normalizeReplaceCallRule,
  planReplaceCall,
  readReplaceSyncConfig,
  REPLACE_ASAP_MINUTES,
  REPLACE_SYNC_DEFAULTS,
  replaceCallNote,
  replaceCallRuleText,
  replaceCallModeFor,
  replaceSourceRef,
  replaceSyncDueNow,
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

describe('กติกาเวลาโทร', () => {
  it('ค่าเริ่มต้น 18:00 ของวันก่อนเข้างาน · คำบนจอ', () => {
    expect(DEFAULT_REPLACE_CALL_RULE).toEqual({ dayOffset: -1, time: '18:00', aiFrom: null });
    expect(replaceCallRuleText(DEFAULT_REPLACE_CALL_RULE)).toBe('18:00 ของวันก่อนเข้างาน');
    expect(replaceCallRuleText({ dayOffset: 0, time: '06:00' })).toBe('06:00 ของวันเข้างาน');
    expect(replaceCallRuleText({ dayOffset: -2, time: '09:30' })).toBe('09:30 ของสองวันก่อนเข้างาน');
  });

  it('อ่านค่าที่เก็บ: ถูกต้องผ่าน · เพี้ยนถอยไปค่าเริ่มต้นทีละช่อง · ไม่ throw', () => {
    expect(normalizeReplaceCallRule({ dayOffset: 0, time: '7:05' })).toEqual({ dayOffset: 0, time: '07:05', aiFrom: null });
    expect(normalizeReplaceCallRule({ dayOffset: -2, time: '23:59', aiFrom: '2026-10-06' })).toEqual({ dayOffset: -2, time: '23:59', aiFrom: '2026-10-06' });
    expect(normalizeReplaceCallRule({ aiFrom: '6/10/2026' }).aiFrom).toBeNull();
    expect(normalizeReplaceCallRule({ dayOffset: -5, time: '25:00' })).toEqual(DEFAULT_REPLACE_CALL_RULE);
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

describe('planReplaceCall — โทรเมื่อไหร่', () => {
  const wall = { ymd: '2026-10-05', hhmm: '07:30' }; // เข้างาน 5 ต.ค. 07:30 ไทย = 00:30Z

  it('ตามกติกา: 18:00 วันก่อน = 4 ต.ค. 18:00 ไทย (11:00Z)', () => {
    const now = new Date('2026-10-02T06:00:00+07:00');
    expect(planReplaceCall(wall, DEFAULT_REPLACE_CALL_RULE, now)).toEqual({ at: new Date('2026-10-04T11:00:00.000Z'), asap: false });
    expect(planReplaceCall(wall, { dayOffset: 0, time: '06:00' }, now)).toEqual({ at: new Date('2026-10-04T23:00:00.000Z'), asap: false });
  });

  it('🔴 เวลาตามกติกาผ่านไปแล้ว แต่ยังไม่ถึงเวลาเข้างาน = โทรเร็วที่สุด (+10 นาที)', () => {
    const now = new Date('2026-10-05T06:00:00+07:00'); // เช้าวันเข้างาน ก่อน 07:30
    const plan = planReplaceCall(wall, DEFAULT_REPLACE_CALL_RULE, now);
    expect(plan?.asap).toBe(true);
    expect(plan?.at.getTime()).toBe(now.getTime() + REPLACE_ASAP_MINUTES * 60_000);
  });

  it('🔴 เลยเวลาเข้างานไปแล้ว = ไม่สร้างสาย', () => {
    expect(planReplaceCall(wall, DEFAULT_REPLACE_CALL_RULE, new Date('2026-10-05T07:30:00+07:00'))).toBeNull();
    expect(planReplaceCall(wall, DEFAULT_REPLACE_CALL_RULE, new Date('2026-10-06T00:00:00+07:00'))).toBeNull();
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
  it('env ว่าง = ค่าเริ่มต้น (เปิด · 06:00 · 31 วัน) ไม่ใช่ 0', () => {
    expect(readReplaceSyncConfig({})).toEqual(REPLACE_SYNC_DEFAULTS);
    expect(readReplaceSyncConfig({ IRECRUIT_REPLACE_SYNC_HOUR: '' }).hour).toBe(6);
  });

  it('ปิดได้ · ตั้งชั่วโมง/ระยะล่วงหน้าได้ในขอบเขต', () => {
    const c = readReplaceSyncConfig({ IRECRUIT_REPLACE_SYNC_ENABLED: 'false', IRECRUIT_REPLACE_SYNC_HOUR: '30', IRECRUIT_REPLACE_SYNC_HORIZON_DAYS: '7' });
    expect(c.enabled).toBe(false);
    expect(c.hour).toBe(23);
    expect(c.horizonDays).toBe(7);
  });

  it('ถึงเวลาเมื่อถึงชั่วโมงที่ตั้งและวันนี้ยังไม่ได้ดึง · ดึงแล้ววันนี้ไม่ซ้ำ · เซิร์ฟเวอร์กลับมาสายก็ยังดึง', () => {
    expect(replaceSyncDueNow('2026-10-02', 5, null, 6)).toBe(false);
    expect(replaceSyncDueNow('2026-10-02', 6, null, 6)).toBe(true);
    expect(replaceSyncDueNow('2026-10-02', 14, '2026-10-01', 6)).toBe(true);
    expect(replaceSyncDueNow('2026-10-02', 14, '2026-10-02', 6)).toBe(false);
  });
});
