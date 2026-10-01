/**
 * ═══ แท็บ "ติดตามส่งคนแทน" ของหน้าการติดตาม (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * > *"หน้าการติดตาม ตอนนี้มี 2 แท็บ รายชื่อติดตาม กับ Dashboard ฉันอยากได้หน้า รายชื่อติดตามอีกอัน …
 * >  มันคือ ติดตามคนที่จะไปแทนงาน เลยใช้ชื่อว่า ติดตามส่งคนแทน จะคล้ายๆกับหน้าติดตามแหละ"*
 *
 * 🔴 **ไม่ทำระบบโทรใหม่** — โครง Follow เดิมทั้งชุด (รอบ · ปฏิทิน · AI/คนโทร · ปิดงาน) ต่างกันแค่ `topic`
 *    (แพตเทิร์นเดียวกับ "ดูแลหลังเริ่มงาน" `AFTERCARE_TOPIC`)
 * · บท AI ของการติดตามไม่ได้พูดหัวเรื่อง — ถามว่า "เตรียมตัวไปทำงาน หน่วยงาน X แล้วใช่ไหม" / "ถึงหน่วยงาน X แล้วใช่ไหม"
 *   ⇒ ใช้กับคนที่ไปแทนงานได้ตรง ๆ ไม่ต้องแก้บทโทร
 * · **สองแท็บแยกรายการกัน**: รายชื่อติดตามไม่โชว์ของส่งคนแทน · แท็บนี้โชว์เฉพาะของส่งคนแทน (คนเดียวไม่โผล่สองที่)
 * · หน้าหลัก "ระบบไปกี่ %" ก้อนติดตามยังนับรวมทั้งสองแท็บ (เป็นงานติดตามเหมือนกัน)
 */

/** หัวข้อของรายการส่งคนแทน — ตัวเดียวทั้งระบบ (ชื่อแท็บที่เจ้าของตั้งเอง) */
export const REPLACEMENT_TOPIC = 'ติดตามส่งคนแทน';

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** รายการนี้เป็นของแท็บติดตามส่งคนแทนไหม */
export function isReplacementFollow(entry: { topic?: string | null }): boolean {
  return norm(entry.topic) === REPLACEMENT_TOPIC;
}

export type FollowScope = 'main' | 'replacement';

/** รายการของแท็บนั้น — `main` = รายชื่อติดตาม (ไม่มีของส่งคนแทน) · `replacement` = ติดตามส่งคนแทนเท่านั้น */
export function followScopeEntries<T extends { topic?: string | null }>(items: readonly T[], scope: FollowScope): T[] {
  const wantReplacement = scope === 'replacement';
  return items.filter((e) => isReplacementFollow(e) === wantReplacement);
}
