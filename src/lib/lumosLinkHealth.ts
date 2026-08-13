import type { ToneKey } from '@/lib/designTokens';
import { CALL_OUTCOME_LABEL, CALL_OUTCOME_TONE } from '@/lib/callOutcomeTone';
import { CALL_OUTCOMES, type CallOutcome } from '@/lib/callFollowupPolicy';

/**
 * "สายกับ Lumos ยังเดินอยู่ไหม" — แปลตัวเลขดิบเป็นคำตอบที่เจ้าหน้าที่ใช้ตัดสินใจได้ทันที
 *
 * เจ้าของสั่ง 13 ส.ค. 2569: "หน้าหลักมี visual ที่รับผลจากโทรของ lumos ให้หน่อย
 * ดูว่าเขาส่งผลลัพมาไหม ส่งไปกี่คน โทรไปกี่คน ผลเป็นยังไง"
 *
 * ⚠️ ช่องว่างที่ใหญ่ที่สุดคือข้อแรก — เดิม **ไม่มีที่ไหนในระบบบอกว่า Lumos ส่งผลกลับ
 * มาล่าสุดเมื่อไหร่** ทั้งหน้าจอและ API · ระบบเงียบเพราะ "ไม่มีงานให้โทร" กับเงียบเพราะ
 * "สายขาด" หน้าตาเหมือนกันเป๊ะ ซึ่งอย่างหลังคืองานหยุดเดินโดยไม่มีใครรู้
 */

/** เกินเท่านี้ถือว่าเงียบผิดปกติ — ตรงกับเกณฑ์ stale ที่ใช้อยู่แล้วทั้งระบบ (2 วัน) */
export const LUMOS_QUIET_HOURS = 48;
/** เงียบไม่นาน แต่มีของรออยู่ = ยังไม่ต้องตกใจ แค่จับตา */
export const LUMOS_WATCH_HOURS = 6;

export type LumosLinkLevel = 'flowing' | 'watch' | 'stalled' | 'idle' | 'unknown';

export type LumosLinkStatus = {
  level: LumosLinkLevel;
  /** ข้อความสั้นบนแถบ — อ่านแล้วรู้ทันทีว่าต้องทำอะไรไหม */
  label: string;
  /** บรรทัดขยายความ (ทำไมถึงเป็นสถานะนี้) */
  detail: string;
  tone: ToneKey;
  /** ชั่วโมงนับจากผลกลับล่าสุด — null = ยังไม่เคยมีผลเลย */
  hoursSinceResult: number | null;
};

function hoursBetween(fromIso: string | null | undefined, nowMs: number): number | null {
  if (!fromIso) return null;
  const t = Date.parse(fromIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (nowMs - t) / 3_600_000);
}

/** ระยะเวลาเปล่า ๆ ("9 วัน") — ใช้ต่อท้ายคำอย่าง "เงียบมา" */
function speakSpan(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} นาที`;
  if (h < 48) return `${Math.round(h)} ชั่วโมง`;
  return `${Math.round(h / 24)} วัน`;
}

/** จุดเวลาในอดีต ("9 วันที่แล้ว") — ใช้กับ "ผลกลับล่าสุด …" */
function speakAgo(h: number): string {
  return `${speakSpan(h)}ที่แล้ว`;
}

/**
 * ⚠️ **"ไม่มีผลกลับ" ตีความได้สองแบบ ห้ามยุบเป็นอันเดียว**
 * — ไม่มีใครรออยู่เลย = ปกติ (idle) · มีคนรออยู่แล้วเงียบ = สายขาด (stalled)
 * ตัวที่สองคือเคสที่ต้องมีคนโทรถามทีม Lumos ซึ่งเดิมไม่มีสัญญาณอะไรบอกเลย
 */
export function lumosLinkStatus(input: {
  lastResultAt?: string | null;
  lastSentAt?: string | null;
  /** จำนวนที่ส่งไปแล้วยังไม่มีผลกลับ (รอโทร + Lumos รับไปแล้ว) */
  waiting: number;
  /** เวลาปัจจุบันเป็น ms — รับเข้ามาเพื่อให้เทสต์คุมเวลาได้ */
  nowMs: number;
}): LumosLinkStatus {
  const { lastResultAt, lastSentAt, waiting, nowMs } = input;
  const hoursSinceResult = hoursBetween(lastResultAt, nowMs);
  const hoursSinceSent = hoursBetween(lastSentAt, nowMs);
  const pending = Math.max(0, waiting);

  if (hoursSinceResult === null) {
    // ยังไม่เคยมีผลกลับเลยสักครั้ง
    if (pending === 0) {
      return {
        level: 'idle',
        label: 'ยังไม่มีสายในระบบ',
        detail: 'ยังไม่ได้ส่งใครให้ AI โทร — เลือกคนจากหน้า Matching แล้วกดส่งได้เลย',
        tone: 'neutral',
        hoursSinceResult: null,
      };
    }
    if (hoursSinceSent !== null && hoursSinceSent >= LUMOS_QUIET_HOURS) {
      return {
        level: 'stalled',
        label: 'ส่งแล้วแต่ยังไม่เคยมีผลกลับเลย',
        detail: `รออยู่ ${pending.toLocaleString('th-TH')} สาย · เข้าคิวล่าสุด ${speakAgo(hoursSinceSent)} — ควรเช็คกับทีม Lumos ว่ารับคิวไปหรือยัง`,
        tone: 'danger',
        hoursSinceResult: null,
      };
    }
    return {
      level: 'watch',
      label: 'รอผลกลับครั้งแรก',
      detail: `ส่งไปแล้ว ${pending.toLocaleString('th-TH')} สาย ยังไม่มีผลกลับ — ปกติใช้เวลาสักพัก`,
      tone: 'warn',
      hoursSinceResult: null,
    };
  }

  const since = speakAgo(hoursSinceResult);
  if (hoursSinceResult >= LUMOS_QUIET_HOURS && pending > 0) {
    return {
      level: 'stalled',
      label: `เงียบมา ${speakSpan(hoursSinceResult)}`,
      detail: `ยังมี ${pending.toLocaleString('th-TH')} สายรออยู่แต่ไม่มีผลกลับเลย — ควรเช็คกับทีม Lumos`,
      tone: 'danger',
      hoursSinceResult,
    };
  }
  if (hoursSinceResult >= LUMOS_WATCH_HOURS && pending > 0) {
    return {
      level: 'watch',
      label: `ผลกลับล่าสุด ${since}`,
      detail: `ยังมี ${pending.toLocaleString('th-TH')} สายรออยู่ — จับตาไว้ ถ้าเงียบเกิน ${LUMOS_QUIET_HOURS} ชั่วโมงถือว่าผิดปกติ`,
      tone: 'warn',
      hoursSinceResult,
    };
  }
  if (pending === 0) {
    return {
      level: 'idle',
      label: `ผลกลับล่าสุด ${since}`,
      detail: 'ไม่มีสายค้างในคิว — งานที่ส่งไปได้ผลกลับครบแล้ว',
      tone: 'neutral',
      hoursSinceResult,
    };
  }
  return {
    level: 'flowing',
    label: `ผลกลับล่าสุด ${since}`,
    detail: `สายยังเดินปกติ · รออยู่อีก ${pending.toLocaleString('th-TH')} สาย`,
    tone: 'success',
    hoursSinceResult,
  };
}

export type LumosOutcomeSlice = {
  outcome: CallOutcome;
  label: string;
  value: number;
  tone: ToneKey;
  /** สัดส่วนของผลทั้งหมด (0–100) — ไว้ทำแถบสัดส่วน */
  percent: number;
};

/**
 * แจกแจงผลโทรทุกแบบที่ **มีค่าจริง** เรียงมากไปน้อย
 *
 * ⚠️ เดิมหน้าหลักโชว์แค่ 3 แบบ (สนใจ/ไม่สนใจ/ไม่รับ) แต่เลขใหญ่รวมทุกแบบ
 * → เลขย่อยบวกกันไม่เท่าเลขใหญ่ ซึ่งเป็นอาการที่เจ้าของจับได้บ่อย
 * ตอนนี้แจกแจงครบทุกแบบที่มีค่า จะบวกได้เท่ากันเสมอ
 * ⚠️ ค่าที่ไม่ใช่ outcome จริง (ข้อมูลเก่าเพี้ยน เช่น 'completed') ถูกกรองทิ้ง
 * — ตัวกรองนี้มีมาก่อนแล้วในหน้า Follow ห้ามถอด
 */
export function lumosOutcomeSlices(outcomes: Record<string, number>): LumosOutcomeSlice[] {
  const known = CALL_OUTCOMES.filter((o) => (outcomes[o] ?? 0) > 0);
  const total = known.reduce((sum, o) => sum + (outcomes[o] ?? 0), 0);
  return known
    .map((o) => {
      const value = outcomes[o] ?? 0;
      return {
        outcome: o,
        label: CALL_OUTCOME_LABEL[o],
        value,
        tone: CALL_OUTCOME_TONE[o],
        percent: total > 0 ? Math.round((value / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.value - a.value || a.outcome.localeCompare(b.outcome));
}

/** ผลรวมของผลโทรที่นับได้จริง (ไม่รวมค่าที่ไม่ใช่ outcome) */
export function lumosOutcomeTotal(outcomes: Record<string, number>): number {
  return CALL_OUTCOMES.reduce((sum, o) => sum + (outcomes[o] ?? 0), 0);
}

/**
 * อัตรา "โทรติด" — ติดต่อได้จริงกี่ % ของผลที่กลับมา
 * ติด = ได้คุยกับคน (สนใจ/รับทราบ/ไม่สนใจ/ขอเลื่อน) · ไม่ติด = ไม่รับ/ไม่ว่าง/ไม่ตอบ/ล้มเหลว
 * ⚠️ เบอร์ผิดนับเป็น "ไม่ติด" — คุยไม่ได้เหมือนกัน แต่แยกถังปลายทางไปหาคนตาม
 */
const CONNECTED: CallOutcome[] = ['confirmed', 'acknowledged', 'declined', 'reschedule_requested'];

export function lumosConnectRate(outcomes: Record<string, number>): {
  connected: number;
  unreached: number;
  total: number;
  percent: number | null;
} {
  const connected = CONNECTED.reduce((sum, o) => sum + (outcomes[o] ?? 0), 0);
  const total = lumosOutcomeTotal(outcomes);
  const unreached = Math.max(0, total - connected);
  return {
    connected,
    unreached,
    total,
    // ไม่มีผลเลย = ไม่มีอัตรา (null) ไม่ใช่ 0% — 0% แปลว่าโทรแล้วไม่ติดสักสาย ซึ่งคนละเรื่อง
    percent: total > 0 ? Math.round((connected / total) * 100) : null,
  };
}
