/**
 * สัญญาณว่าเมนูถูกจัดใหม่ — หน้าตั้งค่ายิง แล้ว AppLayout โหลดค่าใหม่ทันที
 * แยกไฟล์เพราะทั้งสองฝั่ง import กัน แล้ววง import จะพันกัน (แพตเทิร์นเดียวกับ
 * JOB_STAFF_ROSTER_CHANGED_EVENT)
 */
export const NAV_PREFERENCES_CHANGED_EVENT = 'jarvis:nav-preferences-changed';
