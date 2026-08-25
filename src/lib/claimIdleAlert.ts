/**
 * "เด้งเตือนหัวหน้าทันทีที่มีคนถูกถอด" (Phase 5.8 · เจ้าของเคาะ 22 ส.ค. 2569)
 *
 * 🔴 ทำไมไม่ยิง API ใหม่ตอนเปิดแอป: worker เขียน `app_notifications` ไว้แล้ว
 * (type `claim_idle_released`) และ `NotificationContext` poll กล่องขาเข้าอยู่ทุก 1 นาที
 * → เอาของที่มีอยู่มาเด้งเป็นป๊อป **ไม่เพิ่ม query หนักบนทุกหน้า**
 *
 * 🔴 กติกาเด้ง: **เฉพาะที่ยังไม่อ่าน** และเด้งครั้งเดียว (กดปิด = mark อ่านแล้ว)
 * ไม่งั้นกลายเป็นป๊อปที่เด้งทุกครั้งที่เปลี่ยนหน้า ซึ่งคนจะปิดทิ้งโดยไม่อ่าน
 */

/** ชนิดแจ้งเตือนที่ worker กันชื่อดองสร้าง — ต้องตรงกับ callChoiceWorker.ts */
export const CLAIM_IDLE_NOTIFICATION_TYPE = 'claim_idle_released';

/** role ที่ควรเห็นป๊อปนี้ — เจ้าของสั่งว่าเป็นเรื่องของ "หัวหน้า" */
const ALERT_ROLES = ['admin', 'supervisor'] as const;

export function shouldSeeClaimIdleAlert(role: string | null | undefined): boolean {
  return typeof role === 'string' && (ALERT_ROLES as readonly string[]).includes(role);
}

export type AlertCandidate = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
};

/**
 * เลือกใบที่จะเด้ง — ใบ **ที่ยังไม่อ่าน** ใบแรกของชนิดนี้ (ลิสต์เรียงใหม่สุดมาก่อนแล้ว)
 * ไม่มี = null (ไม่เด้ง)
 */
export function pickClaimIdleAlert<T extends AlertCandidate>(items: T[]): T | null {
  return items.find((n) => n.type === CLAIM_IDLE_NOTIFICATION_TYPE && !n.read) ?? null;
}
