/**
 * ═══ แท็บของกระดิ่ง (เจ้าของ 20 ต.ค. 2569: "ให้กระดิ่งแยกแจ้งเตือน So Scraping ไม่ให้ตกหาย") ═══
 * แจ้งเตือน "AI ยังไม่โทร" เด้งทีละหลายสิบ ⇒ ของ So Scraping (โพสต์แล้ว / เสร็จ / ไม่รับงาน) ตกจาก 30 อันล่าสุดในไม่กี่นาที
 * ⇒ ชนิดที่ "ปักไว้" ดึงแยกจาก server (14 วัน) · ไม่โดนตัดตอนรวมรายการ · มีแท็บของตัวเองบนแผง
 */
export const SO_NOTIFICATION_TYPE = 'so_scraping_status';
/** ชนิดที่ห้ามตกจากกระดิ่ง — server ใช้ตัวเดียวกัน (`listMyNotifications`) */
export const PINNED_NOTIFICATION_TYPES: readonly string[] = [SO_NOTIFICATION_TYPE];

export type NotificationTab = 'all' | 'so';
export const NOTIFICATION_TAB_LABEL: Record<NotificationTab, string> = {
  all: 'ทั้งหมด',
  so: 'สั่งโพสต์ · Scrap',
};

export const isPinnedNotification = (n: { type: string }) => PINNED_NOTIFICATION_TYPES.includes(n.type);

export function notificationsOfTab<T extends { type: string }>(list: readonly T[], tab: NotificationTab): T[] {
  return tab === 'so' ? list.filter((n) => n.type === SO_NOTIFICATION_TYPE) : [...list];
}

/** ตัดรายการให้เหลือ `max` โดยไม่ทิ้งชนิดที่ปักไว้ (เรียงใหม่→เก่าเหมือนเดิม) */
export function capKeepingPinned<T extends { type: string; timestamp: string }>(list: readonly T[], max: number): T[] {
  const sorted = [...list].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const others = sorted.filter((n) => !isPinnedNotification(n)).slice(0, max);
  const keep = new Set([...others, ...sorted.filter(isPinnedNotification)]);
  return sorted.filter((n) => keep.has(n));
}
