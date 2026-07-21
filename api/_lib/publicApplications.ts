/**
 * Validation สำหรับใบสมัครงานหน้า /apply (public — ไม่มี auth)
 * แยกจาก handler เพื่อให้ unit test ได้ตรงๆ
 */

export type PublicApplicationInput = {
  fullName: string;
  phone: string;
  jobId: string | null;
  jobTitle: string | null;
  unitName: string | null;
  positionInterest: string | null;
  note: string | null;
};

export type PublicApplicationValidation =
  | { ok: true; value: PublicApplicationInput }
  | { ok: false; message: string };

/** รับ 0XXXXXXXXX (9–10 หลัก) หรือรูปแบบ +66 / 66 แล้ว normalize เป็นเลขล้วนขึ้นต้น 0 */
export function normalizeThaiPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('66')) return `0${digits.slice(2)}`;
  if ((digits.length === 9 || digits.length === 10) && digits.startsWith('0')) return digits;
  return null;
}

function optionalText(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, maxLen);
}

export function validatePublicApplication(raw: unknown): PublicApplicationValidation {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, message: 'Invalid JSON body' };
  }
  const b = raw as Record<string, unknown>;

  const fullName = typeof b.full_name === 'string' ? b.full_name.trim() : '';
  if (fullName.length < 2) {
    return { ok: false, message: 'กรุณากรอกชื่อ-นามสกุล' };
  }
  if (fullName.length > 200) {
    return { ok: false, message: 'ชื่อยาวเกินไป' };
  }

  const phone = normalizeThaiPhone(b.phone);
  if (!phone) {
    return { ok: false, message: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (เช่น 0812345678)' };
  }

  return {
    ok: true,
    value: {
      fullName,
      phone,
      jobId: optionalText(b.job_id, 100),
      jobTitle: optionalText(b.job_title, 300),
      unitName: optionalText(b.unit_name, 300),
      positionInterest: optionalText(b.position_interest, 200),
      note: optionalText(b.note, 2000),
    },
  };
}
