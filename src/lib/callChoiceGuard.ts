/**
 * วงจร "กันชื่อดอง" — ตรรกะล้วนที่ใช้ร่วมกันทั้ง worker (server) และหน้าจอ (client)
 *
 * เจ้าของเคาะ 22 ส.ค. 2569 เป็นลำดับ:
 *   เก็บชื่อไปแล้วดองเกิน 1 วันไม่ stamp ว่าโทร
 *     → **ถอด claim อัตโนมัติ** + popup เตือนหัวหน้าทันที
 *     → ใบไปกอง **"เลือกวิธีโทร"** ([โทรเอง] / [ส่ง AI โทร])
 *     → ไม่เลือกภายใน 1 วัน → **worker ส่ง AI โทรเอง**
 *
 * 🔴 ทำไมตรรกะอยู่ที่นี่ ไม่ใช่ในไฟล์ worker:
 * เลข 1 วันกับคำบนจอต้องเป็นชุดเดียวกัน — ป้ายนับถอยหลังบนแถวที่คนเห็น ต้องตรงกับ
 * นาทีที่ worker ลงมือจริง ไม่งั้นคนอ่านว่า "เหลือ 3 ชม." แต่ AI โทรไปแล้ว
 *
 * ⚠️ เงื่อนไข SQL ของ "ใครเข้าข่ายโดนถอด" อยู่ที่ `OVERVIEW_BUCKETS.claimed_idle`
 * (api/_lib/applicantOverviewSql.ts) **ที่เดียว** — ไฟล์นี้ไม่นิยามซ้ำ
 * เพราะกล่องบน dashboard, drill-down `?bucket=` และ worker ต้องเห็นชุดเดียวกันเป๊ะ
 */

/** ดองได้นานสุดก่อนถูกถอด claim (เจ้าของเคาะ: 1 วัน) */
export const CLAIM_IDLE_HOURS = 24;
/** เวลาให้เลือกวิธีโทรหลังถูกถอด — หมดแล้ว worker ส่ง AI เอง (เจ้าของเคาะ: 1 วัน) */
export const CALL_CHOICE_HOURS = 24;

/**
 * วิธีโทรที่เลือกได้ — ต้องตรงกับ CHECK constraint ของ migration 104
 *   manual  = คนกด "เก็บไปโทรเอง" (claim + ล็อกเบอร์กัน AI ทับ)
 *   ai      = คนกด "ส่ง AI โทร" เอง
 *   auto_ai = ไม่มีใครเลือกจนครบกำหนด worker ส่งให้เอง
 */
export const CALL_CHOICES = ['manual', 'ai', 'auto_ai'] as const;
export type CallChoice = (typeof CALL_CHOICES)[number];

export function isCallChoice(v: unknown): v is CallChoice {
  return typeof v === 'string' && (CALL_CHOICES as readonly string[]).includes(v);
}

/** คำบนจอของแต่ละวิธี — ⚠️ ต้องบอก "ผลลัพธ์" ไม่ใช่ชื่อระบบ (กติกา Phase 3.4) */
export const CALL_CHOICE_LABEL: Record<CallChoice, string> = {
  manual: 'เก็บไปโทรเอง',
  ai: 'ส่ง AI โทร',
  auto_ai: 'ครบกำหนดแล้ว — AI รับไปโทรเอง',
};

/**
 * นับถอยหลังของใบที่รออยู่ในกอง "เลือกวิธีโทร"
 *
 * คืน `null` เมื่อไม่มีเวลาอ้างอิง (ใบไม่ได้อยู่ในวงจร) — ห้ามเดาเป็น 0 ชม.
 * เพราะ 0 บนจอแปลว่า "กำลังจะส่งเดี๋ยวนี้" ซึ่งคนละเรื่องกับ "ไม่รู้"
 */
export type ChoiceCountdown = {
  /** ชั่วโมงที่เหลือ (ปัดลง) — 0 ได้เมื่อเหลือไม่ถึงชั่วโมง */
  hoursLeft: number;
  /** ครบกำหนดแล้ว (worker รอบถัดไปจะส่ง AI) */
  overdue: boolean;
  /** คำบนป้าย */
  label: string;
};

export function choiceCountdown(
  unclaimedAt: string | Date | null | undefined,
  now: Date = new Date(),
): ChoiceCountdown | null {
  if (!unclaimedAt) return null;
  const at = unclaimedAt instanceof Date ? unclaimedAt : new Date(unclaimedAt);
  if (Number.isNaN(at.getTime())) return null;
  const deadline = at.getTime() + CALL_CHOICE_HOURS * 3_600_000;
  const msLeft = deadline - now.getTime();
  if (msLeft <= 0) {
    return { hoursLeft: 0, overdue: true, label: 'ครบกำหนดแล้ว — AI จะรับไปโทรรอบถัดไป' };
  }
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  return {
    hoursLeft,
    overdue: false,
    label:
      hoursLeft >= 1
        ? `เหลือ ${hoursLeft} ชม. ก่อน AI รับไปโทรเอง`
        : `เหลือไม่ถึง 1 ชม. ก่อน AI รับไปโทรเอง`,
  };
}

/** จำนวนวันเต็มที่ถูกดองไว้ — ใช้เขียนข้อความเตือนหัวหน้า */
export function idleDays(claimedAt: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!claimedAt) return null;
  const at = claimedAt instanceof Date ? claimedAt : new Date(claimedAt);
  if (Number.isNaN(at.getTime())) return null;
  const ms = now.getTime() - at.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

export type UnclaimedItem = {
  /** ชื่อผู้สมัครที่ถูกดองไว้ */
  applicantName: string;
  /** ชื่อคนที่เก็บไว้แล้วไม่โทร (null = ฐานไม่ได้เก็บชื่อ) */
  heldByName: string | null;
  /** ดองไว้กี่วัน (null = คำนวณไม่ได้) */
  days: number | null;
};

export type UnclaimNotice = { title: string; body: string };

/**
 * ข้อความเตือนหัวหน้า — เจ้าของสั่งให้ "เด้งเตือนทันที" จึงต้องอ่านจบในบรรทัดเดียว
 *
 * 🔴 ต้องบอก **ใครดอง** ไม่ใช่แค่จำนวนใบ — ประเด็นของเจ้าของคือคนเก็บแล้วไม่โทร
 * (ต่างจาก `claimed_by_name` ในลิสต์ที่ซ่อนชื่อไว้ให้เจ้าตัว: การโดนถอดคือเรื่องที่
 * หัวหน้าต้องเห็น ไม่ใช่ความลับของคนเก็บ)
 * ⚠️ ไม่มีใบ = คืน null (ห้ามส่งแจ้งเตือน "0 ใบ" — ป้ายที่ขึ้นทุกวันคือขยะ)
 */
export function buildUnclaimNotice(items: UnclaimedItem[], now: Date = new Date()): UnclaimNotice | null {
  if (items.length === 0) return null;
  const byName = new Map<string, number>();
  for (const it of items) {
    const key = it.heldByName?.trim() || 'ไม่ทราบชื่อ';
    byName.set(key, (byName.get(key) ?? 0) + 1);
  }
  const who = [...byName.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'))
    .slice(0, 3)
    .map(([name, n]) => `${name} ${n} ใบ`)
    .join(' · ');
  const more = byName.size > 3 ? ` และอีก ${byName.size - 3} คน` : '';
  const oldest = items.reduce<number>((max, it) => Math.max(max, it.days ?? 0), 0);
  const agePart = oldest > 0 ? ` · ค้างนานสุด ${oldest} วัน` : '';
  // now รับไว้เพื่อให้ผู้เรียกคุมเวลาได้ (เทสต์/worker ใช้หมุดเดียวกัน) — ข้อความไม่พิมพ์เวลา
  void now;
  return {
    title: `ถอดชื่อที่เก็บไว้แล้วไม่โทร ${items.length} ใบ`,
    body: `${who}${more}${agePart} — ใบเหล่านี้ไปอยู่กอง "เลือกวิธีโทร" ไม่เลือกภายใน 1 วัน AI จะรับไปโทรเอง`,
  };
}

/** คีย์กันแจ้งเตือนซ้ำ — เตือนได้วันละครั้งต่อรอบวัน (ไม่ใช่ทุกรอบ worker ทุก 15 นาที) */
export function unclaimDedupeKey(now: Date = new Date()): string {
  return `claim-idle:${now.toISOString().slice(0, 10)}`;
}
