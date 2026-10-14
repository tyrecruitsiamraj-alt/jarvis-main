import { describe, expect, it } from 'vitest';
import { followLeaveMentioned, isFollowLeaveMismatch } from '@/lib/followLeave';

/** ป้ายแดง "ลา" (เจ้าของสั่ง 14 ต.ค. 2569) — ประโยคจริงจากสรุปของ Lumos */
describe('followLeaveMentioned', () => {
  it('จับคำลา/หยุดงานที่ชัด', () => {
    for (const t of [
      'ผู้รับสายแจ้งว่าวันนี้ลากิจ 1 วัน เพื่อไปทำทะเบียนที่ขนส่ง จึงยังไม่ได้ไปที่หน่วยงาน',
      'ผู้รับสายแจ้งว่าวันนี้หยุด ไม่ได้ไปปฏิบัติงานที่หน่วยงาน',
      'ผู้รับสายแจ้งว่าวันนี้ร้านป่วย (ลาป่วย) จึงยังไม่ได้ไปถึงหน่วยงาน',
      'ขอลางานวันนี้ครับ',
    ]) expect(followLeaveMentioned(t)).toBe(true);
  });

  it('🔴 ไม่จับคำที่มี "ลา" ซ่อนอยู่ และการปฏิเสธการลา', () => {
    for (const t of [
      'ผู้รับสายยืนยันชื่อและแจ้งเรื่องเวลางาน 16:00 น.', // เวลางาน มี "ลางาน" ข้างใน (เคยจับผิดจริง)
      'กำลังเดินทางไปลาดพร้าว',
      'ถึงหน่วยงานแล้ว ไม่ได้ลา',
      'วันนี้ไม่หยุดครับ ไปทำงานปกติ',
      'ถึงหน่วยงานเรียบร้อยแล้ว',
      '',
    ]) expect(followLeaveMentioned(t)).toBe(false);
    expect(followLeaveMentioned(null)).toBe(false);
  });
});

describe('isFollowLeaveMismatch', () => {
  it('ผลรับทราบ/ไป + บอกลา = ขัดกัน · ผลไม่ไป = ไม่ต้องขึ้นป้าย (ผลถูกอยู่แล้ว)', () => {
    const leave = 'ผู้รับสายแจ้งว่าวันนี้ลากิจ 1 วัน';
    expect(isFollowLeaveMismatch({ call_outcome: 'acknowledged', call_summary: leave })).toBe(true);
    expect(isFollowLeaveMismatch({ call_outcome: 'confirmed', call_reply: 'วันนี้ขอลาครับ' })).toBe(true);
    expect(isFollowLeaveMismatch({ call_outcome: 'declined', call_summary: leave })).toBe(false);
    expect(isFollowLeaveMismatch({ call_outcome: 'acknowledged', call_summary: 'ถึงหน่วยงานแล้ว' })).toBe(false);
  });
});
