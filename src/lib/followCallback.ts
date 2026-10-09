/**
 * ═══ ตอบ AI ว่า "ขอให้โทรกลับ" → ระบบตั้งสายโทรกลับเอง (เจ้าของ 9 ต.ค. 2569 "ตั้งสายโทรกลับเองเลย") ═══
 *
 * เคสจริง 9 ต.ค. 2569 (ศักดิ์ชาย): สาย 06:30 ตอบว่า "ขอให้ติดต่อกลับช่วงเวลาประมาณ 13:00 น."
 * Lumos ส่งผล `reschedule_requested` แต่ **ไม่ส่งเวลาเป็นช่อง** (`next_action.due_at` = null) แล้วสายที่เหลือของแผนก็ไม่โทร
 * ฝั่งเราไม่มีอะไรรองรับ ⇒ คนนั้นหลุดจากการติดตามเงียบ ๆ
 *
 * ไฟล์นี้ pure (ไม่แตะฐาน/เวลาจริง) — ตัดสินเวลาโทรกลับ + กันวนไม่จบ · ตัวสร้างสายอยู่ `api/_lib/followCallback.ts`
 * ลำดับเวลาที่ใช้: ① ช่องเวลาที่ Lumos ส่งมา (ถ้ามี) ② `next_action.due_at` ③ อ่านจากข้อความสรุป
 *   ④ ไม่บอกเวลา = อีก N ชม. ตามนโยบาย "ขอเลื่อนไม่บอกเวลา" ตัวเดียวกับใบสมัคร (`rescheduleDefaultHours` ตั้งได้จากหน้าตั้งค่า)
 */

/** โทรกลับต่อกันได้กี่ครั้ง (ขอเลื่อนซ้ำเกินนี้ = จบที่ผลขอเลื่อน ให้คนเห็นบนจอ) */
export const CALLBACK_MAX_CHAIN = 2;
/** เวลาโทรกลับต้องห่างจากตอนนี้อย่างน้อยเท่านี้ (ส่งให้ Lumos ทันเวลา) */
export const CALLBACK_MIN_LEAD_MINUTES = 5;

const CALLBACK_PREFIX = 'callback:';

/**
 * รหัสต้นทาง (`source_ref`) ของสายโทรกลับ — `callback:<สายแรกสุด>:<ครั้งที่>`
 * ใช้ทั้งกันสร้างซ้ำ (unique index ของ source_ref · Lumos ยิงผลเดิมซ้ำได้) และนับครั้ง · เกินเพดาน = `null`
 */
export function nextCallbackRef(source: { id: string; source_ref?: string | null }): { ref: string; depth: number } | null {
  const m = /^callback:([^:]+):(\d+)$/.exec(source.source_ref ?? '');
  const root = m ? m[1] : source.id;
  const depth = m ? Number(m[2]) + 1 : 1;
  if (depth > CALLBACK_MAX_CHAIN) return null;
  return { ref: `${CALLBACK_PREFIX}${root}:${depth}`, depth };
}

export function isFollowCallbackRef(ref: string | null | undefined): boolean {
  return (ref ?? '').startsWith(CALLBACK_PREFIX);
}

const BKK_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });

/** เวลา HH:MM ของวันนี้ (ไทย) — ผ่านไปแล้ว = วันพรุ่งนี้เวลาเดียวกัน */
function nextBangkokClock(hh: number, mm: number, now: Date): Date {
  const ymd = BKK_YMD.format(now);
  const at = new Date(`${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`);
  return at.getTime() > now.getTime() ? at : new Date(at.getTime() + 86_400_000);
}

/**
 * อ่านเวลาที่ขอให้โทรกลับจากข้อความสรุปของ Lumos (ภาษาไทย) — ไม่แน่ใจ = `null` (ไปใช้ค่าตามนโยบาย)
 * รับ: "13:00" · "13.00 น." · "อีก 30 นาที" · "อีก 2 ชั่วโมง/ชม." · "บ่าย 2 โมง" · "8 โมงเช้า" · "เที่ยง"
 */
export function parseCallbackTimeText(text: string | null | undefined, now: Date): Date | null {
  const s = (text ?? '').replace(/\s+/g, ' ');
  if (!s) return null;
  const rel = /อีก\s*(\d{1,3})\s*(นาที|ชั่วโมง|ชม)/.exec(s);
  if (rel) {
    const n = Number(rel[1]);
    const ms = rel[2] === 'นาที' ? n * 60_000 : n * 3_600_000;
    if (n > 0 && ms <= 48 * 3_600_000) return new Date(now.getTime() + ms);
  }
  // HH:MM (โคลอน) หรือ HH.MM ตามด้วย น./นาฬิกา (จุดเฉย ๆ อาจเป็นทศนิยม/วันที่)
  const clock = /(?:^|[^\d/])([01]?\d|2[0-3])(?::([0-5]\d)|\.([0-5]\d)\s*(?:น|นาฬิกา))/.exec(s);
  if (clock) return nextBangkokClock(Number(clock[1]), Number(clock[2] ?? clock[3]), now);
  const afternoon = /บ่าย\s*(\d)\s*โมง/.exec(s);
  if (afternoon && Number(afternoon[1]) >= 1 && Number(afternoon[1]) <= 5) return nextBangkokClock(12 + Number(afternoon[1]), 0, now);
  const morning = /(\d{1,2})\s*โมงเช้า/.exec(s);
  if (morning && Number(morning[1]) >= 5 && Number(morning[1]) <= 11) return nextBangkokClock(Number(morning[1]), 0, now);
  if (/เที่ยง(?!คืน)/.test(s)) return nextBangkokClock(12, 0, now);
  return null;
}

export type CallbackTimeSource = 'explicit' | 'due_at' | 'text' | 'default';

/** ตัดสินเวลาโทรกลับ — อันแรกที่ใช้ได้และเป็นอนาคต · ใกล้เกินไปดันออกไปให้ทันส่ง */
export function resolveCallbackAt(input: {
  explicit?: string | null;
  dueAt?: string | null;
  text?: string | null;
  now: Date;
  defaultHours: number;
}): { at: Date; source: CallbackTimeSource } {
  const { now } = input;
  const minAt = now.getTime() + CALLBACK_MIN_LEAD_MINUTES * 60_000;
  const valid = (d: Date | null) => d != null && !Number.isNaN(d.getTime()) && d.getTime() > now.getTime();
  const clamp = (d: Date) => new Date(Math.max(d.getTime(), minAt));
  const fromIso = (v: string | null | undefined) => (v ? new Date(v) : null);

  const explicit = fromIso(input.explicit);
  if (valid(explicit)) return { at: clamp(explicit as Date), source: 'explicit' };
  const due = fromIso(input.dueAt);
  if (valid(due)) return { at: clamp(due as Date), source: 'due_at' };
  const fromText = parseCallbackTimeText(input.text, now);
  if (valid(fromText)) return { at: clamp(fromText as Date), source: 'text' };
  return { at: clamp(new Date(now.getTime() + input.defaultHours * 3_600_000)), source: 'default' };
}
