/**
 * ═══ "สายที่เหลือของวันนั้น" — ตัวตัดสินเดียว (เจ้าของ Choice 28 ต.ค. 2569 "แก้ครบ 6 ข้อ") ═══
 *
 * ใช้ตอน ได้ ไป/ไม่ไป (AI หรือคนลง) · ปิดงานแบบวันนั้น · วันหยุด/ลางาน
 *   - คนเริ่มงาน = วันเดียวกัน (เวลาไทย)
 *   - คนแทน (`irecruit-replace:` / `manual-replace:`) = **ใบงานเดียวกัน** ไม่ใช่วันเดียวกัน
 *     สายคอนเฟิร์ม 16:00 อยู่วันก่อนเข้างาน ⇒ ตอบตอนคอนเฟิร์ม สายก่อนเข้างานวันรุ่งขึ้นของใบเดียวกันต้องหยุดด้วย
 *     🔴 คนเดียวทำต่อหลายวัน = หลายใบในชุดเดียว (30 วันก่อน 28 ต.ค. มี 344 คน) — เดิมนับ "วันเดียวกัน" ด้วย
 *        ⇒ ตอบสายเช้าของใบวันนี้ แล้วสายคอนเฟิร์ม 16:00 ของใบพรุ่งนี้ (วันเดียวกัน) ถูกยกเลิกไปด้วย
 *     คนแทนคีย์เอง (`manual-replace:<ใบ>:<สาย>:m`) ใช้กติกาเดียวกัน — เดิมใช้แค่ใบจาก iRecruit
 *
 * `f` = แถวที่จะยกเลิก · `meRef` / `meAt` = source_ref / scheduled_at ของสายที่ตอบ (นิพจน์ SQL)
 */
export const REPLACE_REF_RE_SQL = `'^(irecruit|manual)-replace:'`;

export function followSameStopUnitSql(f: string, meRef: string, meAt: string): string {
  return `(case when coalesce(${meRef}, '') ~ ${REPLACE_REF_RE_SQL}
      then split_part(coalesce(${f}.source_ref, ''), ':', 1) = split_part(${meRef}, ':', 1)
       and split_part(coalesce(${f}.source_ref, ''), ':', 2) = split_part(${meRef}, ':', 2)
      else (${f}.scheduled_at at time zone 'Asia/Bangkok')::date = (${meAt} at time zone 'Asia/Bangkok')::date
    end)`;
}
