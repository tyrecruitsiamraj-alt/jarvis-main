/**
 * แจ้งเจ้าหน้าที่เมื่อผู้สมัครส่งเอกสารสำเร็จ — เนื้อแจ้งเตือน + ลิงก์ที่กดแล้วเปิดชุดนั้นทันที (เจ้าของ 22 พ.ย. 2569)
 *
 * - ผู้รับ = คนสร้างลิงก์ (จดไว้ตอนสร้างจากบัญชีที่ล็อกอิน) · ไม่รับผู้รับจากหน้าสาธารณะ · ไม่กระจายทั้งระบบ
 * - 1 ชุด = 1 แจ้งเตือน (dedupeKey ผูกรหัสชุด) — กดส่งซ้ำ/ลองส่งใหม่ไม่แจ้งเพิ่ม
 * - ลิงก์มีแค่รหัสใบสมัคร + รหัสชุด · ห้ามมีรหัสลิงก์ของผู้สมัคร เลขบัตร เบอร์ หรือลิงก์ไฟล์
 * - ข้อความบอกว่าใครส่ง ใบขอไหน ไม่มีเนื้อหาเอกสาร
 */

export const DOCUMENT_PACKET_NOTIFICATION_TYPE = 'document_packet_submitted';
export const DOCUMENTS_VIEW = 'documents';
export const DOCUMENTS_BOARD_PATH = '/jobs/board';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export function documentsDeepLink(applicationId: string, packetId?: string | null): string {
  const q = new URLSearchParams({ view: DOCUMENTS_VIEW, applicationId });
  if (packetId) q.set('packetId', packetId);
  return `${DOCUMENTS_BOARD_PATH}?${q.toString()}`;
}

/** อ่าน `applicationId` / `packetId` จาก URL — รหัสผิดรูป = ไม่มี (ไม่เอาไปเปิดอะไร) */
export function parseDocumentsDeepLink(search: string | URLSearchParams): { applicationId: string | null; packetId: string | null } {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const applicationId = q.get('applicationId');
  const packetId = q.get('packetId');
  return { applicationId: isUuid(applicationId) ? applicationId : null, packetId: isUuid(packetId) ? packetId : null };
}

export type CommittedPacketEvent = {
  /** ชุดถูกบันทึกลงฐานแล้วเท่านั้นถึงจะแจ้ง — แนบภาพร่าง/เปิดลิงก์เฉย ๆ ไม่แจ้ง */
  committed: boolean;
  packetId: string;
  applicationId: string;
  createdByUserId: string | null;
  applicantName: string;
  requestLabel: string;
};

export type PlannedNotification = {
  recipientUserId: string | null;
  type: string;
  title: string;
  body: string;
  link: string;
  dedupeKey: string;
};

export function planDocumentPacketNotification(e: CommittedPacketEvent): PlannedNotification | null {
  if (!e.committed) return null;
  if (!isUuid(e.packetId)) throw new Error('Invalid packetId');
  if (!isUuid(e.applicationId)) throw new Error('Invalid applicationId');
  const name = e.applicantName.trim().slice(0, 100);
  const request = e.requestLabel.trim().slice(0, 180);
  return {
    // ไม่รู้คนสร้างลิงก์ = null (ตัวส่งจะส่งต่อคิว HR ของ BU) · ไม่ตกไปแจ้งทุกคน
    recipientUserId: isUuid(e.createdByUserId) ? e.createdByUserId : null,
    type: DOCUMENT_PACKET_NOTIFICATION_TYPE,
    title: name ? `${name} ส่งเอกสารแล้ว` : 'มีผู้สมัครส่งเอกสารแล้ว',
    body: request || 'กดเพื่อเปิดชุดเอกสารที่ส่ง',
    link: documentsDeepLink(e.applicationId, e.packetId),
    dedupeKey: `${DOCUMENT_PACKET_NOTIFICATION_TYPE}:${e.packetId}`,
  };
}
