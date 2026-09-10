/**
 * กฎเดียวของ **ล่วงหน้า / ฉุกเฉิน / ฉุกเฉิน-ย้อนหลัง**
 *
 * แยกออกมาเป็นไฟล์เล็ก ๆ เพราะตอนนี้มีสองฝั่งที่ต้องตัดสินเรื่องเดียวกัน:
 *   · หน้าเว็บ (`jobUrgency.ts`) — ใช้กับใบขอเต็มใบที่มีวันที่ครบ
 *   · ฝั่ง API (`siamrajSqlServerThroughput.ts`) — ติดป้ายให้ drill-down ของ Dashboard
 * ถ้าปล่อยให้ต่างคนต่างเขียน `< 7` เอง วันหนึ่งจะเพี้ยนกันโดยไม่มีใครรู้
 *
 * 🔴 **นับเป็นวันตามปฏิทิน ไม่ใช่ชั่วโมง** — ผู้เรียกต้องส่ง `leadDays` ที่คิดจาก
 * วันที่ (YYYY-MM-DD) ตามปฏิทินกรุงเทพมาแล้ว ไม่ใช่เอา timestamp มาลบกัน
 */

import type { ToneKey } from './designTokens';

export const URGENCY_LEAD_DAYS = 7;

/** ล่วงหน้า = ขอไว้ล่วงหน้า ≥ 7 วัน · ฉุกเฉิน = ขอกระชั้น < 7 วัน · ย้อนหลัง = วันที่ต้องการอยู่ก่อนวันที่กรอก */
export type RequestLeadKind = 'retroactive' | 'urgent' | 'advance';

/* ═══════════════════ เกณฑ์ความเร่ง: ค่ากลาง + ค่าเฉพาะใบ ═══════════════════
 *
 * เจ้าของสั่ง 10 ก.ย. 2569: *"หลักเกณฑ์ ฉุกเฉิน / ฉุกเฉิน-ย้อนหลัง / ล่วงหน้า
 * ทำให้ Set เป็นใบไว้หน่อย เพราะบางใบใช้คำนวณไม่เหมือนกัน แต่ถ้าไม่ Set ก็เอาของเดิม
 * เป็น Default แก้ก็แก้ที่หน้าใบขอ"*
 *
 * มี **4 ตัวเลข** ที่ตั้งทับได้ต่อใบ — เก็บที่ `siamraj_unit_notes.field_overrides.lead_rules`
 * (ผูกด้วยเลขที่ใบขอดิบ) แล้วแนบกลับมาบนใบขอเป็น `job.lead_rules`
 *
 * 🔴 **ค่ากลางอยู่ที่นี่ที่เดียว** — ห้ามหน้าไหน/ฝั่ง API ไหนเขียน `7` หรือ `15` เอง
 * (กติกา "หนึ่งเมตริกหนึ่งนิยาม" · เขียนซ้ำเมื่อไหร่คือรอวันเลขสองหน้าไม่ตรงกัน)
 */

/** ค่าที่ตั้งทับได้ต่อใบ — คีย์ไหนไม่มี/เป็น null = ใช้ค่ากลางของคีย์นั้น */
export type RequestLeadRulesOverride = {
  /** เส้นแบ่ง ฉุกเฉิน ↔ ล่วงหน้า (วัน) */
  urgent_threshold_days?: number | null;
  /** จำนวนวันที่ให้หาคน แยกตามประเภท */
  sla_days?: Partial<Record<RequestLeadKind, number | null>> | null;
};

export type RequestLeadRules = {
  urgentThresholdDays: number;
  slaDays: Record<RequestLeadKind, number>;
};

/**
 * ค่ากลางของทั้งระบบ (ของเดิมก่อน 10 ก.ย. 2569 — ห้ามเปลี่ยนโดยไม่ได้สั่ง)
 * ตรงกับ `04-sla-rules.md`: ย้อนหลัง 7 วันนับจากวันที่ยื่น · ฉุกเฉิน/ล่วงหน้า 15 วันนับจากวันที่ต้องการ
 */
export const DEFAULT_REQUEST_LEAD_RULES: RequestLeadRules = {
  urgentThresholdDays: URGENCY_LEAD_DAYS,
  slaDays: { retroactive: 7, urgent: 15, advance: 15 },
};

/** เพดานกันคนกรอกเลขเพี้ยน — 0 วันได้ (แปลว่าไม่มีช่วงล่วงหน้าเลย) แต่ติดลบ/เกินปีไม่ได้ */
const MIN_RULE_DAYS = 0;
const MAX_RULE_DAYS = 365;

function cleanRuleDays(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < MIN_RULE_DAYS || i > MAX_RULE_DAYS) return null;
  return i;
}

/**
 * sanitize ค่าที่รับจาก client — คืน `null` เมื่อไม่เหลืออะไรที่ตั้งจริง
 *
 * ⚠️ **คืน null ดีกว่าเก็บ object ว่าง** เพราะฝั่งอ่านใช้ "มีคีย์ = ตั้งไว้" เป็นสัญญาณ
 * ว่าใบนี้ไม่ใช้ค่ากลาง (แดชบอร์ดดึงเฉพาะใบที่มีคีย์นี้มาคำนวณทับ)
 */
export function cleanRequestLeadRulesOverride(raw: unknown): RequestLeadRulesOverride | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: RequestLeadRulesOverride = {};

  const threshold = cleanRuleDays(o.urgent_threshold_days);
  if (threshold != null) out.urgent_threshold_days = threshold;

  const src = o.sla_days;
  if (src && typeof src === 'object') {
    const s = src as Record<string, unknown>;
    const slaDays: Partial<Record<RequestLeadKind, number>> = {};
    for (const kind of ['retroactive', 'urgent', 'advance'] as const) {
      const n = cleanRuleDays(s[kind]);
      // ให้เวลาหาคน 0 วันไม่มีความหมาย (ครบกำหนดตั้งแต่วันแรก) — ถือว่าไม่ได้ตั้ง
      if (n != null && n > 0) slaDays[kind] = n;
    }
    if (Object.keys(slaDays).length > 0) out.sla_days = slaDays;
  }

  return Object.keys(out).length > 0 ? out : null;
}

/** รวมค่าเฉพาะใบเข้ากับค่ากลาง — คีย์ที่ไม่ได้ตั้งใช้ค่ากลาง */
export function resolveRequestLeadRules(
  override?: RequestLeadRulesOverride | null,
): RequestLeadRules {
  const clean = cleanRequestLeadRulesOverride(override);
  if (!clean) return DEFAULT_REQUEST_LEAD_RULES;
  return {
    urgentThresholdDays: clean.urgent_threshold_days ?? DEFAULT_REQUEST_LEAD_RULES.urgentThresholdDays,
    slaDays: {
      retroactive: clean.sla_days?.retroactive ?? DEFAULT_REQUEST_LEAD_RULES.slaDays.retroactive,
      urgent: clean.sla_days?.urgent ?? DEFAULT_REQUEST_LEAD_RULES.slaDays.urgent,
      advance: clean.sla_days?.advance ?? DEFAULT_REQUEST_LEAD_RULES.slaDays.advance,
    },
  };
}

/** ใบนี้ตั้งเกณฑ์เองไหม (ใช้ขึ้นป้ายบอกว่าเลขไม่ได้มาจากค่ากลาง) */
export function hasCustomLeadRules(override?: RequestLeadRulesOverride | null): boolean {
  return cleanRequestLeadRulesOverride(override) != null;
}

/** จำนวนวันที่ให้หาคนของใบหนึ่ง — **ที่เดียวทั้งระบบ** (หน้าเว็บ + ฝั่ง API ใช้ตัวนี้) */
export function slaDaysForLeadKind(
  kind: RequestLeadKind | 'unknown',
  rules: RequestLeadRules = DEFAULT_REQUEST_LEAD_RULES,
): number {
  // ไม่รู้ประเภท (วันที่ไม่ครบ) ⇒ ใช้เกณฑ์เดียวกับล่วงหน้า ตรงกับพฤติกรรมเดิม
  if (kind === 'unknown') return rules.slaDays.advance;
  return rules.slaDays[kind];
}

export const REQUEST_LEAD_KIND_LABEL: Record<RequestLeadKind, string> = {
  retroactive: 'ฉุกเฉิน/ย้อนหลัง',
  urgent: 'ฉุกเฉิน',
  advance: 'ล่วงหน้า',
};

export const REQUEST_LEAD_KIND_HINT: Record<RequestLeadKind, string> = {
  retroactive: 'วันที่ต้องการอยู่ก่อนวันที่กรอกใบขอ (ขอคนย้อนหลัง)',
  urgent: `วันที่กรอกถึงวันที่ต้องการน้อยกว่า ${URGENCY_LEAD_DAYS} วัน`,
  advance: `วันที่กรอกถึงวันที่ต้องการ ${URGENCY_LEAD_DAYS} วันขึ้นไป`,
};

/**
 * `leadDays` = วันที่ต้องการ − วันที่กรอก (ติดลบ = ขอย้อนหลัง)
 *
 * ⚠️ ไม่รู้วันใดวันหนึ่ง (null/NaN) ให้ตอบ `advance` — ตรงกับพฤติกรรมเดิมของ
 * `computeJobUrgency` ที่ถือว่า "ไม่มีข้อมูล = ยังไม่เร่ง" · **ห้ามเดาเป็นฉุกเฉิน**
 * ไม่งั้นใบที่ ERP กรอกวันไม่ครบจะไปโป่งอยู่ในถังฉุกเฉินทั้งกอง
 */
/**
 * สีประจำชนิดใบขอตามระยะเวลา — **ที่เดียวทั้งระบบ**
 *
 * 🔴 เจ้าของสั่ง 19 ส.ค. 2569: *"ถ้าอันไหนมันคือ Logic เดียวกันก็ไปทางเดียวกัน
 * ป้องกัน user งง"* (หลังเจอคำว่า "ล่วงหน้า" หลายสีในระบบเดียว)
 * → **`advance` = `success` (เขียว) เสมอ** ห้ามหน้าไหนเขียนสีเองกับคำว่า "ล่วงหน้า"
 */
export const REQUEST_LEAD_KIND_TONE: Record<RequestLeadKind, ToneKey> = {
  retroactive: 'danger',
  urgent: 'warn',
  advance: 'success',
};

export function requestLeadKindFromDays(
  leadDays: number | null | undefined,
  rules: RequestLeadRules = DEFAULT_REQUEST_LEAD_RULES,
): RequestLeadKind {
  if (leadDays == null || !Number.isFinite(leadDays)) return 'advance';
  if (leadDays < 0) return 'retroactive';
  if (leadDays < rules.urgentThresholdDays) return 'urgent';
  return 'advance';
}

/** จำนวนวันระหว่างสอง YMD (to − from) — คืน null ถ้ารูปแบบไม่ใช่ YYYY-MM-DD */
export function leadDaysBetweenYmd(fromYmd?: string | null, toYmd?: string | null): number | null {
  const a = parseYmdUtc(fromYmd);
  const b = parseYmdUtc(toYmd);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86_400_000);
}

/** YYYY-MM-DD → epoch ms ที่เที่ยงคืน UTC (ใช้ลบกันเป็นจำนวนวันเท่านั้น ไม่ใช่เวลาจริง) */
function parseYmdUtc(ymd?: string | null): number | null {
  if (!ymd || typeof ymd !== 'string') return null;
  const t = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const ms = Date.parse(`${t}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** ทางลัดที่ฝั่ง API ใช้: มีแค่สอง YMD ก็ตัดสินได้เลย */
export function requestLeadKindFromYmd(
  requestYmd?: string | null,
  requiredYmd?: string | null,
  rules: RequestLeadRules = DEFAULT_REQUEST_LEAD_RULES,
): RequestLeadKind {
  return requestLeadKindFromDays(leadDaysBetweenYmd(requestYmd, requiredYmd), rules);
}

/** คำอธิบายเกณฑ์ของใบหนึ่ง — ต้องพูดเลขของ**ใบนั้น** ไม่ใช่เลขกลางเสมอไป */
export function requestLeadKindHint(
  kind: RequestLeadKind,
  rules: RequestLeadRules = DEFAULT_REQUEST_LEAD_RULES,
): string {
  switch (kind) {
    case 'retroactive':
      return 'วันที่ต้องการอยู่ก่อนวันที่กรอกใบขอ (ขอคนย้อนหลัง)';
    case 'urgent':
      return `วันที่กรอกถึงวันที่ต้องการน้อยกว่า ${rules.urgentThresholdDays} วัน`;
    case 'advance':
      return `วันที่กรอกถึงวันที่ต้องการ ${rules.urgentThresholdDays} วันขึ้นไป`;
    default:
      return '';
  }
}
