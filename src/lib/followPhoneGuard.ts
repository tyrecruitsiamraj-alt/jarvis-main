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
