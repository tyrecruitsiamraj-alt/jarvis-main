/**
 * ติดตามส่งคนแทน: สายแรกคอนเฟิร์ม · สาย 2–3 ก่อนเข้างาน (เจ้าของสั่ง 8 ต.ค. 2569)
 * > *"ลองเพิ่มแล้วมันโทรสายแรกเป็น ถึงหรือยังไรงี้ … เพิ่มมาตอนไหนก็ช่างสายแรกต้องโทรคอนเฟิร์ม
 * >  ประมาณว่า พรุ่งนี้พี่มีไปทำงาน เวลา... พี่คอนเฟิร์มไหมครับ"*
 */
import { describe, expect, it } from 'vitest';
import { buildFollowReminderPayload } from '../../api/_lib/lumosDispatch';
import { replaceDayWord, EDITABLE_SCRIPT_DEFAULTS } from '../../api/_lib/lumosCallScript';
import { EDITABLE_SCRIPT_KEYS } from '../../api/_lib/callScriptStore';
import { REPLACE_FOLLOW_TOPIC, replaceScriptOf, replaceSlotNote } from '../../src/lib/irecruitReplaceSync';

const wall = { ymd: '2026-10-09', hhmm: '08:00' };
const entry = (note: string, at: string, callRound: number) => ({
  id: 'x1',
  recipient_name: 'นายสมชาย ใจดี',
  recipient_phone: '+66812345678',
  topic: REPLACE_FOLLOW_TOPIC,
  note,
  staffName: 'น้องเอ',
  unitName: 'krungsri',
  scheduled_at: new Date(at),
  callRound,
});

describe('บทติดตามส่งคนแทน', () => {
  it('สาย 1 คอนเฟิร์ม 16:00 วันก่อน = "พรุ่งนี้ … เวลา 8:00 น. คอนเฟิร์มไหมคะ"', () => {
    const p = buildFollowReminderPayload(entry(replaceSlotNote('confirm', wall), '2026-10-08T16:00:00+07:00', 1));
    expect(p.steps).toHaveLength(1);
    const msg = p.steps[0].message;
    expect(msg).toContain('คุณสมชาย ใจดี พรุ่งนี้มีไปทำงานที่ krungsri เวลา 8:00 น. คอนเฟิร์มไหมคะ');
    expect(msg).not.toContain('ถึงหน่วยงาน');
  });

  it('คอนเฟิร์มที่เพิ่มวันเข้างาน (โทรตามคิว) = "วันนี้"', () => {
    const p = buildFollowReminderPayload(entry(replaceSlotNote('confirm', wall), '2026-10-09T06:10:00+07:00', 1));
    expect(p.steps[0].message).toContain('คุณสมชาย ใจดี วันนี้มีไปทำงานที่ krungsri เวลา 8:00 น. คอนเฟิร์มไหมคะ');
  });

  it('สาย 2 และ 3 ใช้บทก่อนเข้างานเดียวกัน', () => {
    for (const [slot, at, round] of [['lead60', '2026-10-09T07:00:00+07:00', 2], ['lead15', '2026-10-09T07:45:00+07:00', 3]] as const) {
      const msg = buildFollowReminderPayload(entry(replaceSlotNote(slot, wall), at, round)).steps[0].message;
      expect(msg).toContain('คุณสมชาย ใจดี วันนี้เข้างานที่ krungsri เวลา 8:00 น. ออกเดินทางแล้วใช่ไหมคะ');
      expect(msg).not.toContain('คอนเฟิร์ม');
    }
  });

  it('งานติดตามหน้าหลักยังพูดบทเดิม', () => {
    const p = buildFollowReminderPayload({ ...entry('', '2026-10-09T07:00:00+07:00', 1), topic: 'ติดตามเริ่มงาน' });
    expect(p.steps[0].message).toContain('เตรียมตัวไปทำงาน');
  });

  it('คำบอกวัน + ตัวอ่านหมายเหตุ', () => {
    expect(replaceDayWord('2026-10-08', '2026-10-09')).toBe('พรุ่งนี้');
    expect(replaceDayWord('2026-10-09', '2026-10-09')).toBe('วันนี้');
    expect(replaceDayWord('2026-10-07', '2026-10-09')).toBe('วันที่ 9 ตุลาคม');
    // ข้ามปี: โทร 31 ธ.ค. เข้างาน 1/1
    expect(replaceScriptOf({ topic: REPLACE_FOLLOW_TOPIC, note: 'ยืนยันเวลาเข้างาน 1/1 07:30 น.', callRound: 1, callAtMs: Date.parse('2026-12-31T16:00:00+07:00') }))
      .toEqual({ kind: 'confirm', workYmd: '2027-01-01', startTime: '7:30 น.' });
    // หมายเหตุถูกแก้จนอ่านไม่ออก = ดูสายที่
    expect(replaceScriptOf({ topic: REPLACE_FOLLOW_TOPIC, note: 'โทรได้', callRound: 2, callAtMs: 0 })?.kind).toBe('before');
    expect(replaceScriptOf({ topic: 'อื่น', note: 'เข้างาน 08:00 น.', callRound: 2, callAtMs: 0 })).toBeNull();
  });

  it('บทใหม่แก้ได้จากหน้าตั้งค่า', () => {
    expect(EDITABLE_SCRIPT_KEYS).toEqual(expect.arrayContaining(['replace_confirm', 'replace_before']));
    expect(EDITABLE_SCRIPT_DEFAULTS.replace_confirm.join(' ')).toContain('{วัน}');
  });
});
