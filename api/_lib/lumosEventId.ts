// แยกจาก lumosPushClient เพราะเทสต์หลายไฟล์ mock ตัว client ทั้งโมดูล — ตัวช่วยอ่านค่าล้วน ๆ ต้องไม่หายไปกับ mock
/** `event_id` ตัวแรกในคำตอบ 202 — ใช้ถามต่อว่า Lumos นำเข้าสำเร็จไหม (`getEventStatus`) · อ่านไม่ได้ = null */
export function firstEventIdOf(ack: unknown): string | null {
  if (typeof ack !== 'object' || ack === null) return null;
  const list = (ack as { results?: unknown }).results;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (typeof first !== 'object' || first === null) return null;
  const id = (first as { event_id?: unknown }).event_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}
