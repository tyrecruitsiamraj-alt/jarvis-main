/**
 * สถานะงานเอกสารของผู้สมัคร 1 คน — นิยามเดียว ใช้ทั้งรายการ ตัวกรอง และป้ายบนจอ (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 *
 * เปิดลิงก์ ≠ ส่งเอกสาร · ส่งเอกสาร ≠ นำเข้า iRecruit — เป็นคนละเหตุการณ์ ห้ามยุบเป็นสถานะเดียว
 * ลิงก์ใหม่ที่ออกหลังชุดล่าสุดและยังใช้ได้ = รอบใหม่ ขึ้นสถานะของลิงก์นั้น (ชุดเก่าอยู่ในประวัติ ไม่สวมเป็นรอบใหม่)
 * 🔴 ตัวกรองฝั่งฐานข้อมูล (`DOCUMENT_STATUS_SQL` ใน api/_lib/documents/packets.ts) ต้องให้ผลเท่ากับ `documentStatusOf` — มีเทสต์เทียบ
 */

export const DOCUMENT_STATUSES = ['not_opened', 'opened', 'needs_fix', 'ready', 'imported', 'link_expired', 'link_revoked'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  not_opened: 'ยังไม่มีผู้เปิดลิงก์นี้',
  opened: 'เปิดลิงก์แล้ว ยังไม่ส่งเอกสาร',
  needs_fix: 'มีข้อมูลต้องแก้ไข',
  ready: 'พร้อมนำเข้า iRecruit',
  imported: 'นำเข้าแล้ว',
  link_expired: 'ลิงก์หมดอายุ',
  link_revoked: 'ยกเลิกลิงก์แล้ว',
};

/** สถานะที่แปลว่า "ส่งเอกสารแล้ว" */
export const SUBMITTED_STATUSES: readonly DocumentStatus[] = ['needs_fix', 'ready', 'imported'];
export const isDocumentStatus = (v: unknown): v is DocumentStatus =>
  typeof v === 'string' && (DOCUMENT_STATUSES as readonly string[]).includes(v);

export type StatusLink = {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  firstOpenedAt: string | null;
};
export type StatusPacket = {
  invitationId: string;
  submittedAt: string;
  attentionCount: number;
  /** HR รับทราบเรื่องที่ต้องดูแล้ว */
  attentionAcked: boolean;
  reviewFlag: boolean;
  imported: boolean;
};

const linkStatus = (link: StatusLink, now: number): DocumentStatus => {
  if (link.revokedAt) return 'link_revoked';
  if (Date.parse(link.expiresAt) <= now) return 'link_expired';
  return link.firstOpenedAt ? 'opened' : 'not_opened';
};

/** `link` = ลิงก์ล่าสุดของใบสมัคร · `packet` = ชุดล่าสุดที่ส่งแล้ว (ไม่มี = null) */
export function documentStatusOf(link: StatusLink, packet: StatusPacket | null, now = Date.now()): DocumentStatus {
  if (packet) {
    const newerLiveLink =
      link.id !== packet.invitationId &&
      Date.parse(link.createdAt) > Date.parse(packet.submittedAt) &&
      !link.revokedAt &&
      Date.parse(link.expiresAt) > now;
    if (!newerLiveLink) {
      if (packet.imported) return 'imported';
      return packet.reviewFlag || (packet.attentionCount > 0 && !packet.attentionAcked) ? 'needs_fix' : 'ready';
    }
  }
  return linkStatus(link, now);
}

/** สถานะของลิงก์เดี่ยว ๆ (ประวัติลิงก์ในหน้ารายละเอียด) — ลิงก์ที่ส่งชุดแล้ว = ส่งเอกสารแล้ว */
export function invitationStateLabel(link: StatusLink & { submittedAt?: string | null }, now = Date.now()): string {
  if (link.submittedAt) return 'ส่งเอกสารแล้ว';
  return DOCUMENT_STATUS_LABEL[linkStatus(link, now)];
}
