/**
 * ═══ สมัครซ้ำต้องรอ 14 วัน — เบอร์เดิม (ทุกทางเข้า) + IP เดิม (หน้าสมัคร) (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"เรื่องเบอร์ซ้ำอะบล็อคไว้ที่ 14 วันได้ไหม ส่วน Ip ก็กันไว้เผื่อเขาเปลี่ยนมีหลายเบอร์ จะได้บล็อคไว้
 * บอกว่าต้องรอ 14 วัน"* · Choice: **IP ละ 1 ใบใน 14 วัน** (รับรู้แล้วว่าคนที่ใช้เน็ตเดียวกันโดนด้วย)
 * · ขอบเขตเบอร์ = "เบอร์เดิม ไม่ว่างานไหน" · ใช้กับหน้าสมัคร · ปุ่มเพิ่มผู้สมัคร · นำเข้า Excel · แก้เบอร์
 *
 * นับเป็น **วันตามปฏิทินไทย**: สมัครวันที่ 1 → สมัครใหม่ได้ตั้งแต่วันที่ 15 (ทั้งวัน) — ข้อความบนจอบอกวันนั้นตรง ๆ
 * 🔴 ที่ตัดสินจริงคือ API ในธุรกรรมที่ล็อกเบอร์/IP ไว้ (`api/_lib/applicationRepeatGuard.ts`) ไม่ใช่หน้าเว็บ
 * ตรรกะล้วน — ใช้ได้ทั้ง API และเทสต์
 */
import { formatYmdDmyBe } from './dateTh';

export const REPEAT_BLOCK_DAYS = 14;

/** 🔴 `Intl` ระดับโมดูลเท่านั้น */
const BKK_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** วันที่ (ไทย) ที่สมัครใหม่ได้ = วันของใบล่าสุด + 14 วัน · YYYY-MM-DD */
export function repeatAllowedFromYmd(lastAt: Date | string): string {
  const ymd = BKK_YMD.format(new Date(lastAt));
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + REPEAT_BLOCK_DAYS)).toISOString().slice(0, 10);
}

const allowed = (lastAt: Date | string) => formatYmdDmyBe(repeatAllowedFromYmd(lastAt));

/** ข้อความถึงผู้สมัครบนหน้าสมัคร (ไม่บอกรายละเอียดใบเดิม — หน้าสาธารณะ ใครพิมพ์เบอร์ใครก็ได้) */
export function repeatPublicMessage(kind: 'phone' | 'ip', lastAt: Date | string): string {
  const who = kind === 'phone' ? 'เบอร์นี้สมัครกับเราไปแล้ว' : 'มีการสมัครจากเครือข่ายนี้ไปแล้ว';
  return `${who} ต้องรอ ${REPEAT_BLOCK_DAYS} วัน สมัครใหม่ได้ตั้งแต่วันที่ ${allowed(lastAt)}`;
}

/** ข้อความถึงเจ้าหน้าที่ (เพิ่มผู้สมัคร · แก้เบอร์) */
export function repeatStaffMessage(lastAt: Date | string): string {
  return `เบอร์นี้สมัครเข้ามาแล้วเมื่อ ${formatYmdDmyBe(BKK_YMD.format(new Date(lastAt)))} — ต้องรอ ${REPEAT_BLOCK_DAYS} วัน เพิ่มใหม่ได้ตั้งแต่ ${allowed(lastAt)}`;
}

/** เหตุผลบนแถวที่ข้ามตอนนำเข้า Excel */
export function repeatImportReason(lastAt: Date | string): string {
  return `สมัครเข้ามาแล้วภายใน ${REPEAT_BLOCK_DAYS} วัน (ได้ตั้งแต่ ${allowed(lastAt)})`;
}

/**
 * เงื่อนไข SQL "มีใบภายใน 14 วันตามปฏิทินไทย" ของคอลัมน์เวลา `col`
 * (สมัครวันที่ 1 ⇒ วันที่ 1–14 ยังติด · วันที่ 15 สมัครได้)
 */
export function repeatWindowSql(col = 'created_at'): string {
  return `(${col} at time zone 'Asia/Bangkok')::date >= ((now() at time zone 'Asia/Bangkok')::date - ${REPEAT_BLOCK_DAYS - 1})`;
}
