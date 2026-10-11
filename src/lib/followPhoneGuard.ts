/**
 * ═══ กันใส่เบอร์เจ้าหน้าที่เป็นเบอร์ผู้สมัคร (เจ้าของสั่ง 4 ต.ค. 2569) ═══
 *
 * เคสจริง: ลงแผนติดตาม 10 สาย ช่องเบอร์ผู้สมัครเป็นเบอร์เดียวกับเบอร์เจ้าหน้าที่ ⇒ AI จะโทรหาเจ้าหน้าที่แทนผู้สมัคร
 * แล้วต้องไล่แก้ทีละแถว หลุดไป 1 สาย · เตือนก่อนบันทึก (กดบันทึกซ้ำ = ยืนยันว่าตั้งใจ)
 */

/** เหลือแต่ตัวเลข แบบเบอร์ไทยขึ้นต้น 0 (+66 / 66 → 0) */
export function localPhoneDigits(p: string | null | undefined): string {
  const d = (p ?? '').replace(/\D/g, '');
  return d.startsWith('66') && d.length === 11 ? `0${d.slice(2)}` : d;
}

/** เบอร์ผู้สมัครตรงกับเบอร์เจ้าหน้าที่สักเบอร์ไหม — ช่องว่าง/เบอร์สั้นไม่นับ */
export function staffPhoneMatchesApplicant(
  applicantPhone: string | null | undefined,
  staffPhones: ReadonlyArray<string | null | undefined>,
): boolean {
  const a = localPhoneDigits(applicantPhone);
  if (a.length < 9) return false;
  return staffPhones.some((s) => localPhoneDigits(s) === a);
}

export const STAFF_PHONE_SAME_WARNING =
  'เบอร์ผู้สมัครตรงกับเบอร์เจ้าหน้าที่ — AI จะโทรหาเจ้าหน้าที่แทนผู้สมัคร · ตรวจเบอร์อีกครั้ง ถ้าถูกแล้วกดบันทึกอีกครั้ง';

/** คีย์ยืนยัน — เปลี่ยนเบอร์แล้วต้องเตือนใหม่ ไม่ใช้การยืนยันของรอบก่อน */
export function staffPhoneAckKey(
  applicantPhone: string | null | undefined,
  staffPhones: ReadonlyArray<string | null | undefined>,
): string {
  return [localPhoneDigits(applicantPhone), ...staffPhones.map(localPhoneDigits)].join('|');
}

/**
 * ═══ เบอร์ตัวอย่าง 0812345678 ห้ามใช้เป็นเบอร์จริง (QA รอบ 3 ข้อ 4 · 11 ต.ค. 2569 · เจ้าของ Choice "ล้างออก + กันไม่ให้ลงอีก") ═══
 *
 * เจอเป็นเบอร์ฉุกเฉิน (`admin_phone` = เบอร์ที่ AI โทรหาเมื่อติดต่อผู้รับไม่ได้) 1,049 สาย — มาจากค่าทดสอบ
 * `LUMOS_ADMIN_PHONE_OVERRIDE` (ค่าตัวอย่างใน .env.example) ที่ค้างบนเซิร์ฟเวอร์ · ช่องกรอกยังมี placeholder เป็นเบอร์นี้
 * ⇒ ฝั่งส่ง: เจอเบอร์นี้ = ไม่ส่งเบอร์ (ไม่ถอยไปสุ่มเบอร์คนจริง) · ฝั่งรับ: ช่องเบอร์เจ้าหน้าที่ปฏิเสธเบอร์นี้
 */
export function isPlaceholderPhone(p: string | null | undefined): boolean {
  return localPhoneDigits(p) === '0812345678';
}

export const PLACEHOLDER_PHONE_ERROR = 'เบอร์นี้เป็นเบอร์ตัวอย่าง ใส่เบอร์จริงของเจ้าหน้าที่';
