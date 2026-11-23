/**
 * ═══ แท็บของกระดิ่ง (เจ้าของ 20 ต.ค. 2569: "ให้กระดิ่งแยกแจ้งเตือน So Scraping ไม่ให้ตกหาย") ═══
 * แจ้งเตือน "AI ยังไม่โทร" เด้งทีละหลายสิบ ⇒ ของ So Scraping (โพสต์แล้ว / เสร็จ / ไม่สำเร็จ) ตกจาก 30 อันล่าสุดในไม่กี่นาที
 * ⇒ ชนิดที่ "ปักไว้" ดึงแยกจาก server (14 วัน) · ไม่โดนตัดตอนรวมรายการ · มีแท็บของตัวเองบนแผง
 */
export const SO_NOTIFICATION_TYPE = 'so_scraping_status';
/** ผู้สมัครส่งเอกสารแล้ว (22 พ.ย. 2569) — ชื่อชนิดเดียวกับ `DOCUMENT_PACKET_NOTIFICATION_TYPE` ใน lib/documents (มีเทสต์เทียบ) */
export const DOCUMENT_NOTIFICATION_TYPE = 'document_packet_submitted';
/** ชนิดที่ห้ามตกจากกระดิ่ง — server ใช้ตัวเดียวกัน (`listMyNotifications`) */
export const PINNED_NOTIFICATION_TYPES: readonly string[] = [SO_NOTIFICATION_TYPE, DOCUMENT_NOTIFICATION_TYPE];
/** ชนิดที่ยังไม่อ่านต้องอยู่ครบเสมอ ไม่ว่าเก่าแค่ไหน — server ดึงแยกอีกชุด */
export const KEEP_UNREAD_NOTIFICATION_TYPES: readonly string[] = [DOCUMENT_NOTIFICATION_TYPE];

export type NotificationTab = 'all' | 'so' | 'docs';
export const NOTIFICATION_TABS: readonly NotificationTab[] = ['all', 'so', 'docs'];
export const NOTIFICATION_TAB_LABEL: Record<NotificationTab, string> = {
  all: 'ทั้งหมด',
  so: 'สั่งโพสต์ · Scrap',
  docs: 'เอกสาร',
};
const TAB_TYPE: Record<Exclude<NotificationTab, 'all'>, string> = { so: SO_NOTIFICATION_TYPE, docs: DOCUMENT_NOTIFICATION_TYPE };

export const isPinnedNotification = (n: { type: string }) => PINNED_NOTIFICATION_TYPES.includes(n.type);

export function notificationsOfTab<T extends { type: string }>(list: readonly T[], tab: NotificationTab): T[] {
  return tab === 'all' ? [...list] : list.filter((n) => n.type === TAB_TYPE[tab]);
}

/** ตัดรายการให้เหลือ `max` โดยไม่ทิ้งชนิดที่ปักไว้ (เรียงใหม่→เก่าเหมือนเดิม) */
export function capKeepingPinned<T extends { type: string; timestamp: string }>(list: readonly T[], max: number): T[] {
  const sorted = [...list].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const others = sorted.filter((n) => !isPinnedNotification(n)).slice(0, max);
  const keep = new Set([...others, ...sorted.filter(isPinnedNotification)]);
  return sorted.filter((n) => keep.has(n));
}

/** รอบถามกระดิ่ง (22 พ.ย. 2569) — ปกตินาทีละครั้ง · มีผู้สมัครเปิดลิงก์ส่งเอกสารของฉันค้างอยู่ (`fastUntil` จากเซิร์ฟเวอร์) = 10 วินาที
 *  เฉพาะคนที่รอเอกสารอยู่ ไม่ลดรอบของทั้งระบบ · แท็บซ่อนไม่ถามเลย (ตัวเรียกเช็กเอง) */
export const NOTIFICATION_POLL_MS = 60_000;
export const NOTIFICATION_FAST_POLL_MS = 10_000;
export function nextNotificationPoll(fastUntil: string | null | undefined, now: number): number {
  const until = fastUntil ? Date.parse(fastUntil) : NaN;
  return Number.isFinite(until) && until > now ? NOTIFICATION_FAST_POLL_MS : NOTIFICATION_POLL_MS;
}

/** แจ้งเตือนเอกสารที่เพิ่งเข้ามาหลังเปิดหน้า (ยังไม่อ่าน และไม่เคยเห็น) — ใช้เด้ง toast ครั้งเดียวต่อแถว */
export function freshDocumentNotifications<T extends { id: string; type: string; read: boolean }>(list: readonly T[], seen: ReadonlySet<string>): T[] {
  return list.filter((n) => n.type === DOCUMENT_NOTIFICATION_TYPE && !n.read && !seen.has(n.id));
}

