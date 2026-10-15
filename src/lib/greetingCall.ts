/**
 * ═══ สายทักทายทั่วไป — คนที่ยังไม่รู้ใบขอ (เจ้าของ 15 ต.ค. 2569) ═══
 * บทอยู่ `api/_lib/lumosCallScript.templates.ts` (ทักทายทั่วไป) · ส่งจากป๊อปส่ง AI → "ให้ AI ทักทายถามก่อน"
 *
 * 🔴 คำตอบ **ไม่เขียนทับใบ** — เจ้าของ: "เอาป้ายบอกว่า เขาอยู่จังหวัดนี้ๆๆ ไม่แก้เอง ไม่ยืนยันเสียเวลาคน"
 *    ⇒ อ่านจากบทสนทนา (Lumos ไม่ส่งคำตอบแยกช่องมา มีแค่ outcome · summary · transcript) แล้วขึ้นป้าย "บอก AI" บนแถว
 * 🔴 อ่านไม่ออก = ไม่ขึ้นช่องนั้น (ห้ามเดา) · อายุอ่านเฉพาะตัวเลข 15–80 · จังหวัดต้องเป็นชื่อจังหวัดจริง
 */
import { THAI_PROVINCE_NAMES, canonProvinceName } from './thaiProvinces';

/** job_ref ของสายทักทาย — ไม่ใช่ใบขอ (แพตเทิร์นเดียวกับ `'follow'`) */
export const GREETING_JOB_REF = 'greet';

export type GreetingHeard = {
  /** จังหวัดที่บอก AI (ชื่อทางการ) */
  province: string | null;
  age: number | null;
  /** งานที่บอกว่าสนใจ (คำพูดของเขา ตัดสั้น) */
  job: string | null;
};

type Turn = { role?: unknown; text?: unknown };

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const toArabic = (s: string) => s.replace(/[๐-๙]/gu, (d) => String(THAI_DIGITS.indexOf(d)));
const POLITE_TAIL = /\s*(ครับผม|ครับ|ค่ะ|คะ|นะครับ|นะคะ|จ้า|จ้ะ|ค่า)\s*$/u;
/** ตอบรับเฉย ๆ ไม่มีเนื้อ — "ใช่ครับ" "ครับ" "ยังสนใจครับ" "ยังอยู่ครับ" */
const BARE_YES = /^(ใช่|ครับ|ค่ะ|คะ|ค่า|ยัง|ยังสนใจ|สนใจ|ยังอยู่|อยู่|ถูกต้อง|ใช่แล้ว|แบบนี้|เหมือนเดิม|ได้)+(ครับ|ค่ะ|คะ|ค่า|ผม)*$/u;

const ALIASES: ReadonlyArray<[string, string]> = [
  ['กรุงเทพ', 'กรุงเทพมหานคร'],
  ['กทม', 'กรุงเทพมหานคร'],
  ['โคราช', 'นครราชสีมา'],
  ['อยุธยา', 'พระนครศรีอยุธยา'],
];

/** จังหวัดแรกที่เจอในข้อความ — ชื่อยาวก่อน (กัน "นครปฐม" ไปเจอ "นคร…" อื่น) */
export function provinceInText(text: string): string | null {
  const t = text.replace(/\s+/gu, '');
  const names = [...THAI_PROVINCE_NAMES].sort((a, b) => b.length - a.length);
  let best: { name: string; at: number } | null = null;
  for (const n of names) {
    const at = t.indexOf(n);
    if (at >= 0 && (!best || at < best.at)) best = { name: n, at };
  }
  for (const [alias, canon] of ALIASES) {
    const at = t.indexOf(alias);
    if (at >= 0 && (!best || at < best.at)) best = { name: canon, at };
  }
  return best ? (canonProvinceName(best.name) ?? best.name) : null;
}

/** อายุจากคำตอบ — ตัวเลขตัวแรก 15–80 · ไม่มีตัวเลข (พูดเป็นคำ) = ไม่รู้ */
export function ageInText(text: string): number | null {
  const m = toArabic(text).match(/\d{1,3}/u);
  const n = m ? Number(m[0]) : NaN;
  return Number.isInteger(n) && n >= 15 && n <= 80 ? n : null;
}

const textOf = (t: Turn) => (typeof t.text === 'string' ? t.text.trim() : '');
const isAgent = (t: Turn) => t.role === 'agent' || t.role === 'assistant';

/** คำตอบของผู้รับสายต่อคำถามที่ตรงกับ `ask` (คำถามล่าสุดที่ตรง) — รวมทุกท่อนจนถึงคำถามถัดไป */
function replyTo(transcript: readonly Turn[], ask: RegExp): { question: string; reply: string } | null {
  let found: { question: string; reply: string } | null = null;
  for (let i = 0; i < transcript.length; i += 1) {
    const t = transcript[i];
    if (!isAgent(t) || !ask.test(textOf(t))) continue;
    const parts: string[] = [];
    for (let j = i + 1; j < transcript.length && !isAgent(transcript[j]); j += 1) parts.push(textOf(transcript[j]));
    const reply = parts.filter(Boolean).join(' ');
    if (reply) found = { question: textOf(t), reply };
  }
  return found;
}

/**
 * อ่านคำตอบจากบทสนทนาสายทักทาย — `asked` = ค่าเดิมในใบที่ AI ถามยืนยัน (ตอบรับเฉย ๆ = ค่าเดิม)
 */
export function parseGreetingAnswers(
  transcript: unknown,
  asked: { province?: string | null; positionInterest?: string | null } = {},
): GreetingHeard {
  const turns = Array.isArray(transcript) ? (transcript as Turn[]) : [];
  const out: GreetingHeard = { province: null, age: null, job: null };

  const prov = replyTo(turns, /จังหวัด|กรุงเทพ/u);
  if (prov) {
    out.province =
      provinceInText(prov.reply) ??
      (BARE_YES.test(prov.reply.replace(/\s+/gu, '')) ? provinceInText(prov.question) : null);
  }

  const age = replyTo(turns, /อายุ/u);
  if (age) out.age = ageInText(age.reply);

  const job = replyTo(turns, /งานแบบไหน|แบบไหนครับ|แบบไหนคะ|สนใจงาน/u);
  if (job) {
    const said = job.reply.replace(POLITE_TAIL, '').trim();
    if (BARE_YES.test(said.replace(/\s+/gu, ''))) out.job = asked.positionInterest?.trim() || null;
    else if (said) out.job = said.length > 40 ? `${said.slice(0, 40)}…` : said;
  }
  return out;
}

/** ป้ายบนแถว — "ระยอง · 38 ปี · ขับรถ" · ไม่มีอะไรเลย = null */
export function greetingHeardText(h: GreetingHeard | null | undefined): string | null {
  if (!h) return null;
  const parts = [h.province, h.age != null ? `${h.age} ปี` : null, h.job].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
