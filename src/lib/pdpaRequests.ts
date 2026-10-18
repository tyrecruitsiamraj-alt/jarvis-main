/**
 * ═══ คำขอใช้สิทธิ์ข้อมูลส่วนบุคคล (PDPA) — ตรรกะล้วน ที่เดียวของทั้งระบบ (เจ้าของเลือกทำ 18 ต.ค. 2569) ═══
 * สิทธิ์ 4 ข้อตามข้อตกลงของบริษัท (`PDPA_POLICY` หัวข้อ 4) · ตาราง `app_pdpa_requests` (migration 152)
 * ขั้นตอนตาม Choice 17 ต.ค. 2569:
 *   1. ยื่นคำขอ (ฟอร์มสาธารณะ /privacy-request หรือเจ้าหน้าที่ลงแทน) — ขอลบ/คัดค้าน = หยุดโทรทันที
 *   2. เจ้าหน้าที่โทรกลับเบอร์ที่สมัคร คุยกับเจ้าตัวแล้วกด "ยืนยันตัวตนแล้ว"
 *   3. ทำตามคำขอ: ขอดู = เปิดดู/คัดลอกข้อมูลส่งให้ · ขอลบ = ล้างชื่อ/เบอร์/ที่อยู่ · ขอแก้/คัดค้าน = ปิดคำขอพร้อมบันทึก
 * ทุกคำขอมีกำหนด 30 วันนับจากวันยื่น
 */

export const PDPA_REQUEST_KINDS = ['access', 'correct', 'delete', 'object'] as const;
export type PdpaRequestKind = (typeof PDPA_REQUEST_KINDS)[number];

export const PDPA_REQUEST_KIND_LABEL: Record<PdpaRequestKind, string> = {
  access: 'ขอดูข้อมูล',
  correct: 'ขอแก้ข้อมูล',
  delete: 'ขอลบข้อมูล',
  object: 'ขอให้หยุดติดต่อ',
};

export const PDPA_REQUEST_STATUSES = ['received', 'verified', 'done', 'rejected'] as const;
export type PdpaRequestStatus = (typeof PDPA_REQUEST_STATUSES)[number];

export const PDPA_REQUEST_STATUS_LABEL: Record<PdpaRequestStatus, string> = {
  received: 'รอยืนยันตัวตน',
  verified: 'ยืนยันตัวตนแล้ว',
  done: 'เสร็จแล้ว',
  rejected: 'ไม่ดำเนินการ',
};

export type PdpaRequestSource = 'public' | 'staff';

/** คำขอแบบนี้ต้องหยุดโทรทันทีที่ได้รับ (ก่อนยืนยันตัวตน) */
export function pdpaStopsCalls(kind: PdpaRequestKind): boolean {
  return kind === 'delete' || kind === 'object';
}

export function isPdpaRequestKind(v: unknown): v is PdpaRequestKind {
  return typeof v === 'string' && (PDPA_REQUEST_KINDS as readonly string[]).includes(v);
}

/** ชื่อที่ใช้แทนข้อมูลที่ลบแล้ว — จอที่เคยโชว์ชื่อคนนี้จะเห็นคำนี้แทน */
export const PDPA_ERASED_NAME = 'ลบตามคำขอ PDPA';

export type PdpaRequestInput = { kind: PdpaRequestKind; fullName: string; phone: string; detail: string | null };

/** ตรวจฟอร์มคำขอ — ใช้ทั้งหน้าเว็บและเซิร์ฟเวอร์ (ข้อความเดียวกัน) */
export function validatePdpaRequest(raw: unknown): { ok: true; value: PdpaRequestInput } | { ok: false; message: string } {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  if (!isPdpaRequestKind(o.kind)) return { ok: false, message: 'เลือกเรื่องที่ต้องการ' };
  const fullName = typeof o.fullName === 'string' ? o.fullName.trim().replace(/\s+/g, ' ') : '';
  if (fullName.length < 2) return { ok: false, message: 'กรอกชื่อ-นามสกุล' };
  if (fullName.length > 120) return { ok: false, message: 'ชื่อยาวเกินไป' };
  const phone = typeof o.phone === 'string' ? o.phone.replace(/[\s-]/g, '') : '';
  if (!/^0\d{9}$/.test(phone)) return { ok: false, message: 'กรอกเบอร์มือถือที่ใช้สมัคร 10 หลัก' };
  const detail = typeof o.detail === 'string' ? o.detail.trim().slice(0, 1000) : '';
  if (o.kind === 'correct' && !detail) return { ok: false, message: 'บอกว่าข้อมูลไหนผิด และที่ถูกคืออะไร' };
  return { ok: true, value: { kind: o.kind, fullName, phone, detail: detail || null } };
}

/** เหลืออีกกี่วันถึงกำหนด (ปัดขึ้น) · ติดลบ = เลยกำหนด */
export function pdpaDaysLeft(dueAt: string | Date, now: Date = new Date()): number {
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

export function pdpaDueText(dueAt: string | Date, now: Date = new Date()): string {
  const d = pdpaDaysLeft(dueAt, now);
  if (d < 0) return `เลยกำหนด ${-d} วัน`;
  if (d === 0) return 'ครบกำหนดวันนี้';
  return `เหลือ ${d} วัน`;
}

/** ปุ่มที่ทำได้ตามสถานะ — เรียงตามที่โชว์บนแถว */
export type PdpaAction = 'verify' | 'view' | 'erase' | 'close' | 'reject';

export function pdpaActions(kind: PdpaRequestKind, status: PdpaRequestStatus): PdpaAction[] {
  if (status === 'received') return ['verify', 'reject'];
  if (status !== 'verified') return [];
  if (kind === 'access') return ['view', 'close'];
  if (kind === 'delete') return ['erase', 'reject'];
  return ['view', 'close'];
}

export const PDPA_ACTION_LABEL: Record<PdpaAction, string> = {
  verify: 'ยืนยันตัวตนแล้ว',
  view: 'ดูข้อมูล',
  erase: 'ลบข้อมูล',
  close: 'ปิดคำขอ',
  reject: 'ไม่ดำเนินการ',
};
