/**
 * ═══ ด่านของผู้ช่วย AI ที่ "โค้ดเป็นคนตัดสิน" ไม่ใช่ prompt (บทเรียน KNOWA 12 พ.ย. 2569: กติกาใน prompt อย่างเดียว AI ยังแต่งเอง/ข้ามขั้น) ═══
 *
 * 1. ข้อมูลส่วนตัวที่ผู้ใช้พิมพ์ (เบอร์ · อีเมล · เลข 13 หลัก) → แทนด้วยป้ายมีเลข `[เบอร์#1]` ก่อนถึง OpenAI
 *    ตอนขึ้นการ์ด โค้ดเปลี่ยนป้ายกลับเป็นค่าจริงที่ผู้ใช้พิมพ์ (`restorePersonal`) ⇒ สั่ง "เพิ่มเบอร์ 08…" ได้โดย OpenAI ไม่เห็นเบอร์
 *    ป้ายไม่มีเลข (`[เบอร์]` จากข้อมูลที่อ่านจากระบบ) คืนค่าไม่ได้ ⇒ ไม่ขึ้นการ์ด
 * 2. ข้อความในคำสั่งเขียน (ชื่อ · หมายเหตุ · ข้อความ) ต้องมาจากที่ผู้ใช้พิมพ์ หรือข้อมูลที่อ่านจากระบบ (`inventedValue`)
 *    ไม่เจอ = ไม่ขึ้นการ์ด ถามผู้ใช้แทน · ค่าสั้นแบบรหัส (สถานะ · id · วันที่ · ตัวเลข) ไม่ตรวจ
 */
import type { ChatMessage } from './openai.js';

const PERSONAL: { kind: string; re: RegExp }[] = [
  { kind: 'อีเมล', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'เลข 13 หลัก', re: /(?<![\d-])\d-?\d{4}-?\d{5}-?\d{2}-?\d(?![\d-])/g },
  { kind: 'เบอร์', re: /(?<![\d-])(?:\+?66[\s-]?|0)(?:[689]\d(?:[\s-]?\d){7}|[2-7](?:[\s-]?\d){7})(?![\d-])/g },
];

/** ค่าจริงของป้ายแต่ละอัน — ไล่ข้อความผู้ใช้ตามลำดับทุกครั้ง (ประวัติส่งมาทั้งก้อน ⇒ เลขป้ายเสถียรทุกรอบ) */
export type PersonalVault = Map<string, string>;

export function maskUserMessages(messages: ChatMessage[]): { messages: ChatMessage[]; vault: PersonalVault } {
  const vault: PersonalVault = new Map();
  const tokenOf = new Map<string, string>();
  const out = messages.map((m) => {
    if (m.role !== 'user') return m;
    let text = m.content;
    for (const { kind, re } of PERSONAL) {
      text = text.replace(re, (raw) => {
        const key = `${kind}:${raw.replace(/[\s-]/g, '')}`;
        let token = tokenOf.get(key);
        if (!token) {
          token = `[${kind}#${[...tokenOf.keys()].filter((k) => k.startsWith(`${kind}:`)).length + 1}]`;
          tokenOf.set(key, token);
          vault.set(token, raw.trim());
        }
        return token;
      });
    }
    return { ...m, content: text };
  });
  return { messages: out, vault };
}

/** เปลี่ยนป้ายมีเลขกลับเป็นค่าจริงในคำสั่ง · เหลือป้ายที่คืนไม่ได้ = คืน null (ห้ามส่ง "[เบอร์]" ลงฐาน) */
export function restorePersonal(body: unknown, vault: PersonalVault): { body: unknown; unresolved: boolean } {
  let unresolved = false;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const s = v.replace(/\[(อีเมล|เลข 13 หลัก|เบอร์)#\d+\]/g, (t) => vault.get(t) ?? t);
      if (/\[(อีเมล|เลข 13 หลัก|เบอร์)(#\d+)?\]/.test(s)) unresolved = true;
      return s;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return { body: walk(body), unresolved };
}

/** ข้อความแบบ "เนื้อหา" (มีภาษาไทย หรือหลายคำ) — รหัสสั้น/สถานะ/id/วันที่ ไม่นับ */
function isContent(s: string): boolean {
  const t = s.trim();
  return t.length >= 2 && (/[฀-๿]/.test(t) || (/\s/.test(t) && t.length >= 8));
}
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * ข้อความในคำสั่งเขียนที่ไม่ได้มาจากผู้ใช้หรือจากข้อมูลที่อ่านจากระบบ (= AI แต่งเอง) — ตัวแรกที่เจอ · ไม่มี = null
 * เทียบกับข้อความผู้ใช้ (หลังปิดข้อมูลส่วนตัว) + ผลเครื่องมือทั้งหมด · ไม่เทียบกับข้อความของผู้ช่วยเอง
 */
export function inventedValue(body: unknown, history: ChatMessage[]): string | null {
  const sources = norm(
    history
      .filter((m) => m.role === 'user' || m.role === 'tool')
      .map((m) => (m.role === 'user' || m.role === 'tool' ? m.content : ''))
      .join('\n')
      // ผลอ่านเป็น JSON — ถอด escape ของ unicode/ขึ้นบรรทัด ให้เทียบกับข้อความธรรมดาได้
      .replace(/\\n/g, ' ')
      .replace(/\\"/g, '"'),
  );
  let found: string | null = null;
  const walk = (v: unknown) => {
    if (found) return;
    if (typeof v === 'string') {
      const plain = v.replace(/\[(อีเมล|เลข 13 หลัก|เบอร์)#\d+\]/g, ' ');
      if (isContent(plain) && !sources.includes(norm(v))) found = v;
      return;
    }
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(body);
  return found;
}
