/**
 * ═══ Lumos ลงผล "รับทราบ/ตอบว่าไป" แต่ผู้รับสายบอกว่าลา (เจ้าของสั่ง 14 ต.ค. 2569 "ทำข้อ 3 ป้ายแดง ลา ด้วย") ═══
 *
 * เคสจริง 14 ต.ค.: นายเชตฐ์ศักดิ์ สาย 07:25 สรุปว่า "วันนี้ลากิจ 1 วัน … ยังไม่ได้ไปที่หน่วยงาน" แต่ผลเป็น acknowledged
 * ⇒ Lumos ไม่โทรเบอร์ฉุกเฉิน · ทีมรู้ตอนสาย 2 (08:25)
 * - ไม่เปลี่ยนผลของ Lumos (สายยังเป็นของ AI · กติกา "AI ก็คือ AI") — แค่ขึ้นป้ายแดง "ลา" + แจ้งทีมทันที
 * - ใช้คำลาที่ชัด ห้ามจับ "ลา" เดี่ยว ๆ (เวลา · ศาลา · ลาดพร้าว) · "ไม่ได้ลา/ไม่หยุด" ไม่นับ
 * - ใช้ทั้งจอ (`FollowPlanningCalendar` · `FollowCallQueue`) และตัวแจ้งเตือน (`followLumosWatch.ts` `alertFollowLeaveMismatch`)
 */
const LEAVE_RE = /(ลากิจ|ลาป่วย|ลางาน|ลาพัก|ลาหยุด|ลาครึ่งวัน|ขอลา|แจ้งลา|ได้ลา|หยุดงาน|วันนี้หยุด|ขอหยุด|หยุดวันนี้)/u;
/** ปฏิเสธการลา — ตัดทิ้งก่อนหา ("ไม่ได้ลา" · "ไม่ได้หยุดงาน" · "ไม่หยุด") */
const NEGATED_RE = /ไม่(?:ได้)?\s*(?:ขอ|แจ้ง)?\s*(?:ลา|หยุด)\S*/gu;
/**
 * คำที่มี "ลา" ซ่อนอยู่ — ตัดทิ้งก่อนหา · วัดจริง 14 ต.ค. 2569: "เวลางาน" มี "ลางาน" ข้างใน จับผิด 2 จาก 1,405 สาย
 */
const NOT_LEAVE_WORDS_RE = /เวลา|ศาลา|ปลา|ลาดพร้าว|ลาดกระบัง|ลาดหลุมแก้ว/gu;

/** ข้อความนี้บอกว่าลา/หยุดงานไหม */
export function followLeaveMentioned(text: string | null | undefined): boolean {
  const t = (text ?? '').replace(NOT_LEAVE_WORDS_RE, ' ').replace(NEGATED_RE, ' ');
  return LEAVE_RE.test(t);
}

/** ผลที่ Lumos ตีว่าจบดี — ถ้าคำพูดบอกลา = ผลกับคำพูดขัดกัน */
export const FOLLOW_LEAVE_CHECK_OUTCOMES: readonly string[] = ['acknowledged', 'confirmed'];

/** สายนี้ Lumos ลงผลรับทราบ/ไป แต่สรุปหรือคำพูดบอกว่าลา */
export function isFollowLeaveMismatch(e: {
  call_outcome?: string | null;
  call_summary?: string | null;
  call_reply?: string | null;
}): boolean {
  if (!FOLLOW_LEAVE_CHECK_OUTCOMES.includes((e.call_outcome ?? '').trim())) return false;
  return followLeaveMentioned(e.call_summary) || followLeaveMentioned(e.call_reply);
}
