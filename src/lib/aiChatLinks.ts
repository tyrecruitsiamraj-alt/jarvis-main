/**
 * ลิงก์หน้าในระบบที่ผู้ช่วย AI ตอบมา (13 พ.ย. 2569) — แสดงเป็นคำ ไม่โชว์ id (บทเรียน KNOWA) · pure ไว้เทสต์
 * จับเฉพาะหน้าที่ prompt บอกให้ใช้: /jobs/… · /follow · /settings · หน้าแรก `/` ไม่จับ (เส้นทับคำธรรมดา)
 */
export const AI_CHAT_LINK_RE = /(\/(?:jobs|follow|settings)(?:[/?][^\s)、,。"'“”]*)?)/g;

export function aiChatLinkLabel(path: string): string {
  if (/^\/jobs\/siamraj\/[^/?]+\/actions/.test(path)) return 'เปิดแท็บ Autopost / Scrap / โพสต์เอง ของใบขอ';
  if (/^\/jobs\/siamraj\/[^/?]+\/applicants/.test(path)) return 'เปิดผู้สมัครของใบขอ';
  if (/^\/jobs\/siamraj\/[^/?]+/.test(path)) return 'เปิดหน้าใบขอ';
  if (/^\/jobs\/board\?view=dashboard/.test(path)) return 'หน้าภาพรวม';
  if (/^\/jobs\/board/.test(path)) return 'หน้าโพสต์ประกาศ';
  if (/^\/follow/.test(path)) return 'หน้าติดตาม';
  if (/^\/settings/.test(path)) return 'หน้าตั้งค่า';
  return 'เปิดหน้านี้';
}
