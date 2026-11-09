/**
 * วันเวลาแบบสั้นเวลาไทย "9 พ.ย. 14:24" — ตัวเดียวของงาน So Scraping / กลุ่ม Facebook / แถวผู้สมัคร
 * (review 9 พ.ย. 2569: เดิมประกาศซ้ำ 3 ที่ ตั้งค่าเหมือนกันทุกตัว) · ประกาศระดับโมดูล (`new Intl.*` ในลูปเคยทำ API ช้า)
 */
const BKK_DAY_TIME = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** อ่านเวลาไม่ได้/ไม่มี = null */
export const bkkWhen = (iso: string | null | undefined): string | null => (iso && Number.isFinite(Date.parse(iso)) ? BKK_DAY_TIME.format(new Date(iso)) : null);
