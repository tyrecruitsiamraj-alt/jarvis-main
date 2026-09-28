/**
 * ═══ BU จากรหัสไซต์ ฝั่ง SQL — ตัวเดียวของทุกเส้น ═══
 *
 * BU = ตัวอักษร 3 ตัวหลังเลขปี 2 หลักของรหัสไซต์ (`65LBDL0143` → LBD · `66LML0011` → LML)
 * 🔴 ต้องตรงกับ `buFromSiteCode` ใน `src/lib/homeBu.ts` เป๊ะ (มีเทสต์คุมที่ `tests/api/siteBuSql.test.ts`)
 * 🔴 BU ไม่ได้อยู่ใน prefix เลขที่ใบขอ (prefix = ชนิดใบขอ) — ห้ามแปลจากเลขที่ใบขอ
 * อ่านไม่ออก = NULL (ไม่รู้ ≠ BU อื่น · ห้ามยัดลงถังไหน)
 *
 * เดิมแต่ละเส้นเขียนนิพจน์นี้เอง (home-kpis · dashboard-trends) — ยกมาไว้ที่เดียว 28 ก.ย. 2569
 * ตอนบอร์ดทีมหน้าแรกต้องใช้เป็นเส้นที่สาม
 */
export function siteBuSql(col: string): string {
  return `case when ${col} ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(${col} from 3 for 3)) end`;
}
