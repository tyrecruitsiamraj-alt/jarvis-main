/**
 * ═══ ตัวกรองสุดท้ายก่อนข้อมูลใบขอออกสู่ "หน้าสาธารณะ" ═══
 *
 * 🔴 **ทำไมต้องมีไฟล์นี้ (วัดเจอจริง 29 ส.ค. 2569):**
 * ยิงเส้น `/api/public/jobs` แบบ**ไม่ล็อกอิน** ได้ 200 พร้อมข้อมูลครบ 121 ประกาศ
 * ในนั้นมี **ชื่อ-นามสกุลพนักงานจริง 102 ชื่อ** (คนที่ลาออก/ย้าย) ·
 * **ชื่อ + เบอร์มือถือคนของลูกค้า 32 ใบ** (บางใบมีอีเมลด้วย) · **ทะเบียนรถ 20 ใบ** ·
 * รหัสภายใน (WF number · OC Code · รหัสสาขา) — ทั้งหมดมาจากช่อง "สถานที่ปฏิบัติงาน"
 * ที่ยกมาจากระบบงานหลักทั้งดุ้น กับช่อง "ชื่อคนที่ออก"
 *
 * 🔴 **กติกาของไฟล์นี้: whitelist เท่านั้น ห้าม blacklist**
 * เราไม่ "ลบของไม่ดีออกจากข้อความดิบ" (ตัวกรองแบบนั้นพลาดเมื่อไหร่ = ข้อมูลคนหลุด)
 * แต่ **สร้างข้อความขึ้นใหม่จากชิ้นส่วนที่อนุญาตเท่านั้น** — จังหวัด / อำเภอ / ตำบล
 * อะไรที่ไม่เข้าสามช่องนี้จะไม่มีทางออกไปได้เลย ไม่ว่าระบบงานหลักจะคีย์อะไรมา
 *
 * ลำดับการเลือก:
 *   1. ช่องที่เจ้าหน้าที่กรอกเองตอนทำประกาศ (`override_*`) — แม่นสุด คนพิมพ์เอง
 *   2. ถอดจังหวัด/อำเภอ/ตำบลออกจากที่อยู่ดิบ
 *   3. ไม่รู้ = **คืนค่าว่าง** ห้ามถอยไปใช้ที่อยู่ดิบเด็ดขาด
 *      (หน้าประกาศมีข้อความ "ไม่ได้ระบุจังหวัด" รออยู่แล้ว)
 */
import { parseThaiAddressParts, type ThaiAddressParts } from './parseThaiJobAddress';

/** ของเท่าที่ตัวกรองต้องใช้ — รับ object อะไรก็ได้ที่มีช่องพวกนี้ */
export type PublicLocationSource = {
  location_address?: string | null;
  override_province?: string | null;
  override_district?: string | null;
  override_subdistrict?: string | null;
};

function clean(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t ? t : null;
}

/**
 * ชิ้นส่วนที่อนุญาตให้ออกหน้าสาธารณะ — **สามช่องนี้เท่านั้น**
 * เพิ่มช่องใหม่เมื่อไหร่ ต้องคิดก่อนว่าคนนอกเห็นแล้วเสียหายไหม
 */
export function publicSafeAddressParts(src: PublicLocationSource): ThaiAddressParts {
  const province = clean(src.override_province);
  const district = clean(src.override_district);
  const subdistrict = clean(src.override_subdistrict);
  if (province || district || subdistrict) return { province, district, subdistrict };

  const raw = clean(src.location_address);
  if (!raw) return { province: null, district: null, subdistrict: null };
  const parsed = parseThaiAddressParts(raw);
  // ประกอบใหม่จากผลถอด — ห้ามส่ง object เดิมต่อเผื่อวันหน้ามีช่องอื่นงอกมา
  return {
    province: clean(parsed.province),
    district: clean(parsed.district),
    subdistrict: clean(parsed.subdistrict),
  };
}

/**
 * ข้อความ "สถานที่" ที่ปลอดภัยพอจะขึ้นหน้าสาธารณะ
 * คืน `''` เมื่อไม่รู้ — **ห้ามคืนที่อยู่ดิบไม่ว่ากรณีใด**
 */
export function publicSafeAddress(src: PublicLocationSource): string {
  const p = publicSafeAddressParts(src);
  /**
   * 🔴 ตัดป้ายเดิมก่อนเติมป้ายของเรา (แก้ 1 ต.ค. 2569) — ตัวถอดที่อยู่คืน "ตำบลมาบข่า"/"แขวงยานนาวา"/"เขตสาทร" มาเลย
   * เดิมเติม "ต."/"อ." ซ้อนเป็น "ต.ตำบลมาบข่า" "อ.เขตสาทร" (ใบเปิดอยู่ 71 ใบ) · กรุงเทพฯ ใช้ แขวง/เขต ตามที่คนเขียนจริง
   */
  const bkk = p.province === 'กรุงเทพมหานคร';
  const sub = p.subdistrict?.replace(/^(?:ตำบล|ต\.|แขวง)\s*/u, '').trim();
  const dist = p.district?.replace(/^(?:อำเภอ|อ\.|เขต)\s*/u, '').trim();
  const bits: string[] = [];
  if (sub) bits.push(`${bkk ? 'แขวง' : 'ต.'}${sub}`);
  if (dist) bits.push(`${bkk ? 'เขต' : 'อ.'}${dist}`);
  if (p.province) bits.push(bkk ? p.province : `จ.${p.province}`);
  return bits.join(' ');
}

/**
 * ช่องที่ **ห้ามหลุดออกหน้าสาธารณะเด็ดขาด** — ไม่มีสวิตช์ให้เปิด
 * (หน้าตรวจก่อนปล่อยประกาศเลือกได้เฉพาะช่องที่ไม่อยู่ในลิสต์นี้)
 * มีเทสต์สแกนคำตอบของเส้นสาธารณะคุมอยู่ที่ `tests/api/publicJobPrivacy.test.ts`
 */
export const PUBLIC_FORBIDDEN_FIELDS: readonly string[] = [
  'resigned_employee_name',
  'recruiter_name',
  'screener_name',
  'contact_name',
  'mobile_phone',
  'requester_name',
  'penalty_per_day',
  'total_penalty',
  'days_without_worker',
];

/**
 * ═══ วันเวลาทำงานที่ผู้สมัครเห็น — ตัดคำสั่งงานภายในออก (QA 17 ต.ค. 2569) ═══
 * ช่อง `work_schedule` ของ ERP มีคำสั่งถึงทีมปนอยู่ 36 ใบ เช่น
 * "( หรือปฏิบัติงานตามตารางนาย โดย OPL จะเป็นผู้สรุป )" · "ขอให้แผนก OPL ทำการแจ้งตารางกะให้กับผู้ที่เกี่ยวข้องด้วย"
 * เดิมขึ้นบนการ์ดหน้าสมัครสาธารณะตรง ๆ ⇒ ตัด (1) วงเล็บที่พูดถึง OPL / ผู้ที่เกี่ยวข้อง / ขอให้ (2) ประโยค "ขอให้แผนก…" จนจบท่อน
 * ⚠️ ห้ามจับคำว่า "แผนก" เดี่ยว ๆ — "แผนการจดหน่วย" มีตัวอักษร แผนก ซ้อนอยู่
 */
export function publicWorkSchedule(raw: string | null | undefined): string {
  let s = String(raw ?? '');
  s = s.replace(/\([^()]*(?:OPL|ผู้ที่เกี่ยวข้อง|ขอให้)[^()]*\)/g, ' ');
  s = s.replace(/ขอให้\s*เ?แผนก[^•;\n]*/g, ' ');
  // ท่อนที่เอ่ยชื่อทีมภายใน เช่น "หรือตามตารางกะที่ OPL จัดตามหน้างาน" — ตัดทั้งท่อน (ไม่ข้ามจุลภาค/•)
  // ถ้ามี "หรือ…"/"โดย…" นำหน้า ตัดแค่ตั้งแต่คำนั้น (เก็บ "กะที่ 2 เวลา 12.00 - 21.00 น" ไว้) · ไม่มีค่อยตัดทั้งท่อน
  s = s.replace(/\s*(?:หรือ|โดย)[^,•;()]*\bOPL\b[^,•;()]*/g, ' ');
  s = s.replace(/[^,•;()]*\bOPL\b[^,•;()]*/g, ' ');
  return s
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*•\s*(?:•\s*)+/g, ' • ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/^[\s•,]+|[\s•,]+$/g, '')
    .trim();
}
