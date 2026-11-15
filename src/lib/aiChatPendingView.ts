/**
 * การ์ด "ทำเลย" ของผู้ช่วย AI ต้องบอกของจริงที่จะยิง ไม่ใช่แค่ประโยคที่ AI เขียนเอง (QA 15 พ.ย. 2569)
 * เดิมโชว์แค่ summary_th — AI เลือกบัญชีผิดคนแล้วเขียนสรุปถูก คนกดยืนยันโดยไม่เห็นว่าจะลบ/แก้ของใคร
 * ⇒ แสดง ทำอะไร (ลบ/แก้/เพิ่ม) · ที่ไหน (เส้นจริง + ค่าท้ายลิงก์) · ค่าที่จะส่ง (ทุกช่องใน body)
 */
export type PendingVerb = 'ลบ' | 'แก้' | 'เพิ่ม';

const VERB: Record<string, PendingVerb> = { DELETE: 'ลบ', PATCH: 'แก้', PUT: 'แก้', POST: 'เพิ่ม' };
const MAX_VALUE = 120;
const MAX_FIELDS = 12;

const show = (v: unknown): string => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE)}…` : s;
};

export function describePending(p: { method: string; path: string; body: unknown }): {
  verb: PendingVerb;
  target: string;
  fields: { key: string; value: string }[];
  more: number;
} {
  const verb = VERB[p.method.toUpperCase()] ?? 'แก้';
  const [pathname, query = ''] = p.path.split('?');
  const fields: { key: string; value: string }[] = [];
  for (const [k, v] of new URLSearchParams(query)) fields.push({ key: k, value: show(v) });
  if (p.body && typeof p.body === 'object' && !Array.isArray(p.body)) {
    for (const [k, v] of Object.entries(p.body as Record<string, unknown>)) fields.push({ key: k, value: show(v) });
  } else if (p.body != null) {
    fields.push({ key: 'ข้อมูล', value: show(p.body) });
  }
  return { verb, target: pathname.replace(/^\/api\//, ''), fields: fields.slice(0, MAX_FIELDS), more: Math.max(0, fields.length - MAX_FIELDS) };
}
