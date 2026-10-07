/**
 * ═══ ดึงรายชื่อ "ส่งคนแทน" จาก iRecruit เข้าแท็บติดตามส่งคนแทน — ตรรกะล้วน (2 ต.ค. 2569) ═══
 *
 * เจ้าของส่ง SQL ของหน้า "จัดเวรติดตาม" (iRecruit) มาเอง: ใบงานส่งคนแทน (`ir_job_header.job_type='2'` สถานะ `WS`)
 * → คนที่ไปแทน = แถว `ir_job_request` ล่าสุดของใบนั้น → ชื่อ/เบอร์จาก `z_hr_recruitment_header` แถวล่าสุด (ตัดสถานะ C)
 * → `want_date` = วันเวลาเข้างาน · และเคาะ Choice 3 ข้อ:
 *   1. **ดึงเองทุกเช้า** (ไม่ต้องมีคนกดดึง) · 2. เวลาโทร **ตั้งได้** (ค่าเริ่ม 18:00 ของวันก่อนเข้างาน) · 3. **AI โทรเลย**
 *
 * วัดจริง (อ่านอย่างเดียว 2 ต.ค. 2569 · ก.ย.–ต.ค.): WS ที่ไม่ใช่ C 865 ใบ · มีเบอร์ 10 หลัก 841 · ไม่มีเบอร์ 24 ·
 * คนเดียวมีหลายใบ (865 ใบ = 239 เบอร์) · `want_date` มีเวลาทุกใบ (05:00 / 07:30 / 08:00 = เวลาเข้างาน)
 *
 * 🔴 กติกาที่ไฟล์นี้คุม (ส่วนที่ "ผิดแล้วโทรหาคนจริงผิดเวลา" — ต้องมีเทสต์ทุกเส้น):
 * - mssql คืน datetime ของ iRecruit (เวลาไทย ไม่มีโซน) มาเป็น Date ที่ถือว่าเป็น UTC ⇒ อ่านด้วย `getUTC*` เป็นนาฬิกาไทย
 * - เวลาโทร = วันเข้างาน + dayOffset (0 / -1 / -2) ที่เวลา HH:MM ไทย · ถ้าเวลานั้นผ่านไปแล้วแต่ยังไม่ถึงเวลาเข้างาน
 *   = โทร **เร็วที่สุด** (อีก 10 นาที) · ถ้าเลยเวลาเข้างานไปแล้ว = ไม่สร้างสาย (โทรไปก็ไม่มีประโยชน์)
 * - หนึ่งใบงาน iRecruit = หนึ่งสาย · กันซ้ำด้วย `source_ref` (`irecruit-replace:<job_id>`) — ดึงซ้ำกี่รอบก็ไม่โทรซ้ำ
 * - ไม่มีเบอร์ 10 หลัก = ไม่สร้าง (บอกจำนวนไว้ ไม่เงียบ)
 * ส่วนที่ต่อฐาน/ต่อ iRecruit/ส่ง Lumos อยู่ `api/_lib/irecruitReplaceSync.ts` · worker ที่เดินทุกเช้าอยู่ `api/_lib/irecruitReplaceSyncWorker.ts`
 */

/** เรื่องของสายที่ดึงมา — คำเดียวกับชื่อแท็บ */
export const REPLACE_FOLLOW_TOPIC = 'ติดตามส่งคนแทน';

/** ชื่อคนสร้างที่ขึ้นในรายการ — ให้รู้ว่าไม่มีใครกรอก ระบบดึงมาเอง */
export const REPLACE_SYNC_ACTOR_NAME = 'ดึงจาก iRecruit';

/**
 * ค่าตั้งของงานดึงส่งคนแทน — เหลือ "AI เริ่มโทรตั้งแต่" ช่องเดียว
 * (กติกาเวลาโทรแบบตั้งได้ `atStart`/`dayOffset`/`time` ถอดแล้ว 5 ต.ค. 2569 — เวลาโทรเป็น 3 สายตาม Journey ของเจ้าของ:
 * `planReplaceCalls`) · ค่าเก่าในฐานถูกอ่านข้ามไปเฉย ๆ
 */
export type ReplaceCallRule = {
  /**
   * AI เริ่มโทรตั้งแต่วันไหน (YYYY-MM-DD ไทย) — สายที่นัด **ก่อน** วันนี้ = คนโทร · `null` = AI โทรทุกสาย
   * เจ้าของสั่ง 2 ต.ค. 2569: *"ของวันนี้ ไปจนถึงวันจันทร์ เปลี่ยนเป็นคนโทรก่อนให้หมดเลย เพราะจะเริ่มใช้จริงวันจันทร์"*
   * 🔴 server บังคับทุก 5 นาที (`enforceReplaceAiFrom`) — สาย AI ที่นัดก่อนวันนี้ถูกเปลี่ยนเป็นคนโทร + ยกเลิกแผนที่ Lumos
   */
  aiFrom: string | null;
  /**
   * 🔴 พัก AI (เจ้าของสั่ง 6 ต.ค. 2569 ค่ำ: *"ติดตามส่งคนแทน อย่าพึ่งส่งให้ Ai โทร"* → Choice "หยุดสายที่ยังไม่โทร + ของใหม่" ·
   * "จนกว่าจะสั่งเปิด") — `true` = สายใหม่จาก iRecruit เป็นคนโทรหมด · server เปลี่ยนสาย AI ที่ยังไม่ถึงเวลาเป็นคนโทร
   * + ยกเลิกแผนที่ Lumos (`enforceReplaceAiPaused`) · สายที่ AI โทรไปแล้วคงเป็นผลของ AI · เปิดกลับ = สายที่เปลี่ยนไปแล้วยังเป็นคนโทร
   */
  aiPaused: boolean;
  /**
   * 🔴 เวลาโทรตั้งผ่านจอได้ (เจ้าของ 7 ต.ค. 2569: *"ขอหน้าตั้งเวลาในการโทร ทีตอนนี้มันตั้งไว้ว่าเป็น 16.00 แต่ถ้าจะปรับ
   * ต้องปรับผ่าน ui"*) — สาย 1 คอนเฟิร์มกี่โมงของวันก่อนเข้างาน · สาย 2/3 โทรก่อนเข้างานกี่นาที
   * เปลี่ยนแล้วรอบดึงย้ายสายของ iRecruit ที่ยังไม่ถึงเวลาตามเอง (แถวที่เจ้าหน้าที่แก้เองไม่ทับ)
   */
  confirmTime: string;
  leadMinutes: [number, number];
};

export const DEFAULT_REPLACE_CALL_RULE: ReplaceCallRule = { aiFrom: null, aiPaused: false, confirmTime: '16:00', leadMinutes: [60, 15] };

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** สายที่นัดเวลานี้ใครโทร — ก่อนวัน `aiFrom` (เที่ยงคืนไทย) = คนโทร */
export function replaceCallModeFor(at: Date, aiFrom: string | null, aiPaused = false): 'ai' | 'manual' {
  if (aiPaused) return 'manual';
  if (!aiFrom) return 'ai';
  return at.getTime() < new Date(`${aiFrom}T00:00:00+07:00`).getTime() ? 'manual' : 'ai';
}

/** อ่านค่าตั้งจากที่เก็บ — ค่าที่อ่านไม่ออก = ไม่ตั้ง (ไม่ throw) */
export function normalizeReplaceCallRule(raw: unknown): ReplaceCallRule {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const af = typeof r.aiFrom === 'string' ? r.aiFrom.trim() : '';
  const aiFrom = YMD_RE.test(af) && !Number.isNaN(new Date(`${af}T00:00:00+07:00`).getTime()) ? af : null;
  const ct = typeof r.confirmTime === 'string' ? r.confirmTime.trim() : '';
  const confirmTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(ct) ? ct : DEFAULT_REPLACE_CALL_RULE.confirmTime;
  const lm = Array.isArray(r.leadMinutes) ? r.leadMinutes.map(Number) : [];
  const okLead = (n: number) => Number.isInteger(n) && n >= 5 && n <= 600;
  const leadMinutes: [number, number] =
    lm.length === 2 && okLead(lm[0]) && okLead(lm[1]) && lm[0] > lm[1] ? [lm[0], lm[1]] : [...DEFAULT_REPLACE_CALL_RULE.leadMinutes];
  return { aiFrom, aiPaused: r.aiPaused === true, confirmTime, leadMinutes };
}

/** เวลาโทรของใบงาน — ส่วนของกติกาที่ `planReplaceCalls` ใช้ */
export type ReplaceTiming = Pick<ReplaceCallRule, 'confirmTime' | 'leadMinutes'>;

/** "ก่อน 1 ชม." / "ก่อน 15 นาที" / "ก่อน 1 ชม. 30 นาที" */
export function leadText(min: number): string {
  if (min % 60 === 0) return `ก่อน ${min / 60} ชม.`;
  if (min > 60) return `ก่อน ${Math.floor(min / 60)} ชม. ${min % 60} นาที`;
  return `ก่อน ${min} นาที`;
}

/** คำบนจอของกติกาเวลาโทร — ที่เดียว (ตามค่าที่ตั้ง) */
export function replaceScheduleText(t: ReplaceTiming): string {
  return `คอนเฟิร์ม ${t.confirmTime} วันก่อนเข้างาน · ${leadText(t.leadMinutes[0])} · ${leadText(t.leadMinutes[1])}`;
}

/** นาฬิกาไทยของ `want_date` — วัน + เวลาเข้างาน */
export type ReplaceWantWall = { ymd: string; hhmm: string };

/**
 * mssql คืน datetime (ไม่มีโซน) เป็น Date ที่ถือค่าในฐานเป็น UTC — ค่าในฐาน iRecruit เป็นเวลาไทย
 * ⇒ ส่วน UTC ของ Date คือนาฬิกาไทยตรง ๆ (05:00Z = เข้างาน 05:00 น.)
 */
export function wantWallFromSqlDate(d: Date): ReplaceWantWall {
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    ymd: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    hhmm: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}

/** เวลาเข้างานเป็นเวลาจริง (instant) — นาฬิกาไทย +07:00 */
export function wantInstant(wall: ReplaceWantWall): Date {
  return new Date(`${wall.ymd}T${wall.hhmm}:00+07:00`);
}

function shiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** โทรเร็วที่สุด = อีกกี่นาทีจากตอนนี้ (ให้แผนไปถึง Lumos ทัน) — สายคอนเฟิร์มที่เพิ่มหลัง 16:00 */
export const REPLACE_ASAP_MINUTES = 10;

/** คีย์ของใบงาน (ส่วนหน้าของคีย์ต่อสาย `replaceSlotRef` · คีย์รุ่นเก่าก่อน 5 ต.ค. 2569 = คีย์นี้ตรง ๆ) */
export function replaceSourceRef(jobId: string | number): string {
  return `irecruit-replace:${String(jobId).trim()}`;
}

/** หมายเหตุบนสาย (AI พูดด้วย) — บอกเวลาเข้างาน ไม่ใส่ของภายใน */
export function replaceCallNote(wall: ReplaceWantWall): string {
  return `เข้างาน ${wall.hhmm} น.`;
}

/** ผลของการดึงหนึ่งรอบ — เก็บไว้ให้แท็บบอกได้ว่าดึงล่าสุดเมื่อไหร่ ได้อะไรมา */
export type ReplaceSyncSummary = {
  at: string;
  /** ช่วงวันเข้างานที่ดึง (ปฏิทินไทย) */
  fromYmd: string;
  toYmd: string;
  /** ใบ WS ที่ iRecruit ตอบมาทั้งหมดในช่วง */
  fetched: number;
  /** สร้างสายใหม่ */
  added: number;
  /** มีอยู่แล้ว (เคยดึงไปแล้ว) */
  alreadyIn: number;
  /** ไม่มีเบอร์มือถือ 10 หลัก */
  noPhone: number;
  /** เลยเวลาเข้างานไปแล้ว */
  pastDue: number;
  /** สายที่ต้องโทรเร็วที่สุด (เวลาตามกติกาผ่านไปแล้ว) */
  asap: number;
  /** สายที่เข้าคิว AI ได้ · สายที่ไม่ได้ส่ง (ปิดส่งอัตโนมัติ / ส่งไม่ถึง) */
  queued: number;
  notSent: number;
  /** สายเดิมที่ย้ายเวลาตาม iRecruit (แก้เวลาเข้างาน) */
  realigned?: number;
  /** สายที่ยกเลิกให้เอง — iRecruit ยกเลิกใบ/เปลี่ยนคน/รุ่นเก่าที่ย้ายมาเป็น 3 สาย (5 ต.ค. 2569) */
  cancelled?: number;
  /** สาย AI ของคนในที่เปลี่ยนเป็นคนโทร (5 ต.ค. 2569) */
  toManual?: number;
  /** ดึงไม่ได้ทั้งรอบ — เหตุผลไทย · null = ปกติ */
  error: string | null;
};

export type ReplaceSyncConfig = {
  /** ปิดได้ด้วย `IRECRUIT_REPLACE_SYNC_ENABLED=false` — **ค่าเริ่มต้นคือเปิด** */
  enabled: boolean;
  /** ดึงใบที่เข้างานล่วงหน้ากี่วัน */
  horizonDays: number;
  /** ดึงทุกกี่มิลลิวินาที — ค่าเริ่ม 5 นาที (เจ้าของ Choice 5 ต.ค. 2569 · เลิกรอบ 06:00) */
  tickMs: number;
  startupDelayMs: number;
};

export const REPLACE_SYNC_DEFAULTS: ReplaceSyncConfig = {
  enabled: true,
  horizonDays: 31,
  tickMs: 5 * 60_000,
  startupDelayMs: 30_000,
};

function boolEnv(raw: string | undefined, fallback: boolean): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '') return fallback;
  if (['false', '0', 'off', 'no'].includes(v)) return false;
  if (['true', '1', 'on', 'yes'].includes(v)) return true;
  return fallback;
}

function intEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const t = (raw ?? '').trim();
  // 🔴 เช็กว่างก่อน — `Number('') === 0` (บทเรียน 12 ก.ย. 2569 ของตัวส่งซ้ำ)
  if (t === '') return fallback;
  const n = Number(t);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export function readReplaceSyncConfig(env: Record<string, string | undefined>): ReplaceSyncConfig {
  return {
    enabled: boolEnv(env.IRECRUIT_REPLACE_SYNC_ENABLED, REPLACE_SYNC_DEFAULTS.enabled),
    horizonDays: intEnv(env.IRECRUIT_REPLACE_SYNC_HORIZON_DAYS, REPLACE_SYNC_DEFAULTS.horizonDays, 1, 92),
    tickMs: intEnv(env.IRECRUIT_REPLACE_SYNC_TICK_MS, REPLACE_SYNC_DEFAULTS.tickMs, 10_000, 3_600_000),
    startupDelayMs: intEnv(env.IRECRUIT_REPLACE_SYNC_STARTUP_DELAY_MS, REPLACE_SYNC_DEFAULTS.startupDelayMs, 0, 600_000),
  };
}


/* ═══════════════════════════════════════════════════════════════════════════════════════════════
 * Journey ใหม่ของงานติดตามส่งคนแทน (เจ้าของสั่ง 5 ต.ค. 2569)
 * > 1. WL ไม่ต้องโทรติดตาม · 2. ติดตามแค่ Ex กับสแปร์ไซต์ (Choice: Ex = replace_type EX · สแปร์ = ไซต์ SPARE —
 * >    ยังหาทางจับคู่คนกับไซต์ไม่ได้ ⇒ ส่วนแยกประเภทรอเจ้าของ ตอนนี้ยังตามทุกประเภทเหมือนเดิม)
 * > 3. มีอัปเดตที่ iRecruit แล้วขึ้นเลย (Choice: เช็กทุก 5 นาที) · 5. แก้บน iRecruit แล้ว So Recruit ต้องเปลี่ยน
 * > 4/7. สาย 1 = โทรคอนเฟิร์มเวลา · สาย 2 = ก่อนเข้างาน 1 ชม. · สาย 3 = ก่อนเข้างาน 15 นาที
 * > 6. คอนเฟิร์มเริ่มโทร 16:00 (Choice: ของวันก่อนเข้างาน) · 8. เพิ่มหลัง 16:00 = โทรคอนเฟิร์มตามคิวต่อไปเรื่อย ๆ
 * > (Choice: ใบที่ iRecruit ยกเลิก/เปลี่ยนคน/ไม่ต้องตามแล้ว = ยกเลิกสายให้เอง)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════ */

/** สายของใบงานหนึ่งใบ — คอนเฟิร์ม · ก่อนเข้างาน 1 ชม. · ก่อนเข้างาน 15 นาที */
export type ReplaceSlot = 'confirm' | 'lead60' | 'lead15';
export const REPLACE_SLOTS: readonly ReplaceSlot[] = ['confirm', 'lead60', 'lead15'];
/** สายที่เท่าไหร่ของใบงาน (call_round) — สาย 1 คอนเฟิร์ม · 2–3 ก่อนเข้างาน */
export const REPLACE_SLOT_ROUND: Record<ReplaceSlot, 1 | 2 | 3> = { confirm: 1, lead60: 2, lead15: 3 };
/** โทรคอนเฟิร์มกี่โมง (นาฬิกาไทย) ของวันก่อนเข้างาน */
export const REPLACE_CONFIRM_TIME = '16:00';
/** สาย 2–3 โทรก่อนเวลาเข้างานกี่นาที */
export const REPLACE_LEAD_MINUTES: Record<Exclude<ReplaceSlot, 'confirm'>, number> = { lead60: 60, lead15: 15 };
/** คำบนจอของกติกาเวลาโทร — ที่เดียว */
export const REPLACE_SCHEDULE_TEXT = 'คอนเฟิร์ม 16:00 วันก่อนเข้างาน · ก่อนเข้างาน 1 ชม. · ก่อน 15 นาที';

export type ReplaceSlotPlan = { slot: ReplaceSlot; round: 1 | 2 | 3; at: Date; asap: boolean };

/**
 * สายที่ 1/2/3 ตาม Journey ของแถวที่ดึงจาก iRecruit — อ่านจาก `source_ref` (`irecruit-replace:<ใบ>:<ช่อง>:<คน>`)
 * null = ไม่ใช่แถวจาก iRecruit รุ่น 3 สาย (คีย์เอง / รุ่นเก่าหนึ่งใบหนึ่งสาย)
 * (เจ้าของ 6 ต.ค. 2569: Journey สาย 1 คอนเฟิร์ม 16:00 · สาย 2 ก่อน 1 ชม. · สาย 3 ก่อน 15 นาที)
 */
export function replaceSlotRoundOfRef(ref: string | null | undefined): 1 | 2 | 3 | null {
  // `manual-replace:` = เจ้าหน้าที่คีย์เองในแท็บส่งคนแทน (7 ต.ค. 2569) — 3 สายแบบเดียวกัน แต่รอบดึง iRecruit ไม่แตะ
  const m = /^(?:irecruit|manual)-replace:[^:]+:(confirm|lead60|lead15)(?::|$)/.exec(ref ?? '');
  return m ? REPLACE_SLOT_ROUND[m[1] as ReplaceSlot] : null;
}

/**
 * เวลาเข้างานของสาย 2/3 — หมายเหตุ "เข้างาน HH:MM น." = ครั้งแรกของเวลานั้นที่ไม่ก่อนเวลาโทร (ms) · อ่านไม่ออก = null
 * (ตั้งเวลาโทรผ่านจอได้แล้ว 7 ต.ค. 2569 ⇒ ห้ามเดาจากค่าคงที่ 60/15 นาที)
 */
export function replaceLeadStart(callAtMs: number, note: string | null | undefined): number | null {
  const m = /เข้างาน\s+(\d{1,2}):(\d{2})/.exec(note ?? '');
  if (!m || !Number.isFinite(callAtMs)) return null;
  const ymd = BKK_YMD_FMT.format(new Date(callAtMs));
  const hhmm = `${m[1].padStart(2, '0')}:${m[2]}`;
  let t = Date.parse(`${ymd}T${hhmm}:00+07:00`);
  if (!Number.isFinite(t)) return null;
  if (t < callAtMs) t += 86_400_000;
  return t;
}

/** 🔴 `Intl` ระดับโมดูลเท่านั้น */
const BKK_YMD_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });

/**
 * ═══ วันเข้างานของสายส่งคนแทน (เจ้าของ 7 ต.ค. 2569 Choice "วันเข้างาน") ═══
 * *"ในหน้า ติดตามส่งคนแทนงาน ต้องมี 3 สายนะทุกคนเลย"* — สาย 1 (คอนเฟิร์ม 16:00) อยู่วันก่อนเข้างาน
 * ตารางรายวันเดิมวางสายตามวันที่โทร ⇒ วันเข้างานเห็นแค่สาย 2–3 · ⇒ ทั้ง 3 สายของใบงานอยู่ที่ **วันเข้างาน**
 * - สาย 2/3 = เวลาโทร + 60/15 นาที (= เวลาเข้างาน)
 * - สาย 1 = วันในหมายเหตุ "ยืนยันเวลาเข้างาน d/m HH:MM น." (`replaceSlotNote`) · อ่านไม่ออก = วันถัดจากวันที่โทร
 * null = ไม่ใช่แถวรุ่น 3 สายจาก iRecruit (คีย์เอง ⇒ วางตามวันที่โทรเหมือนเดิม)
 */
export function replaceWorkYmd(e: {
  source_ref?: string | null;
  scheduled_at?: string | null;
  note?: string | null;
}): string | null {
  const m = /^(?:irecruit|manual)-replace:[^:]+:(confirm|lead60|lead15)(?::|$)/.exec(e.source_ref ?? '');
  if (!m) return null;
  const at = Date.parse(e.scheduled_at ?? '');
  if (!Number.isFinite(at)) return null;
  const slot = m[1] as ReplaceSlot;
  if (slot !== 'confirm') {
    const start = replaceLeadStart(at, e.note);
    return BKK_YMD_FMT.format(new Date(start ?? at + REPLACE_LEAD_MINUTES[slot] * 60_000));
  }
  const n = /(\d{1,2})\/(\d{1,2})\s+\d{1,2}:\d{2}/.exec(e.note ?? '');
  if (n) {
    const [y, mo] = BKK_YMD_FMT.format(new Date(at)).split('-').map(Number);
    const d = Number(n[1]);
    const mm = Number(n[2]);
    if (mm >= 1 && mm <= 12 && d >= 1 && d <= 31) {
      const year = mm < mo ? y + 1 : y;
      return `${year}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return BKK_YMD_FMT.format(new Date(at + 86_400_000));
}

/**
 * สายที่ใบงานนี้ต้องมี ณ ตอนนี้ — เฉพาะสายที่ยังไม่ถึงเวลา (เลยแล้ว = ไม่สร้าง)
 * - คอนเฟิร์ม 16:00 วันก่อนเข้างาน · เลย 16:00 แล้ว (เพิ่มใบทีหลัง) = โทรตามคิว (อีก `REPLACE_ASAP_MINUTES` นาที)
 *   แต่ถ้าคิวนั้นช้ากว่าสายก่อนเข้างานที่ยังมาไม่ถึง = ไม่ต้องคอนเฟิร์มแยก (สายก่อนเข้างานโทรอยู่แล้ว)
 * - ก่อนเข้างาน 1 ชม. / 15 นาที — เลยแล้วไม่สร้าง
 * - เลยเวลาเข้างานแล้ว = ไม่มีสาย
 */
export function planReplaceCalls(
  wall: ReplaceWantWall,
  now: Date,
  timing: ReplaceTiming = DEFAULT_REPLACE_CALL_RULE,
): ReplaceSlotPlan[] {
  const start = wantInstant(wall);
  if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) return [];
  const leadOf = { lead60: timing.leadMinutes[0], lead15: timing.leadMinutes[1] } as const;
  const leads = (['lead60', 'lead15'] as const)
    .map((slot) => ({ slot, round: REPLACE_SLOT_ROUND[slot], at: new Date(start.getTime() - leadOf[slot] * 60_000), asap: false }))
    .filter((p) => p.at.getTime() > now.getTime());
  const confirmAt = new Date(`${shiftYmd(wall.ymd, -1)}T${timing.confirmTime}:00+07:00`);
  const confirm: ReplaceSlotPlan =
    confirmAt.getTime() > now.getTime()
      ? { slot: 'confirm', round: 1, at: confirmAt, asap: false }
      : { slot: 'confirm', round: 1, at: new Date(now.getTime() + REPLACE_ASAP_MINUTES * 60_000), asap: true };
  const nextBoundary = leads[0]?.at ?? start;
  return confirm.at.getTime() < nextBoundary.getTime() ? [confirm, ...leads] : leads;
}

export type ReplaceSlotPlanFull = ReplaceSlotPlan & { past: boolean };

/**
 * ═══ 3 สายครบทุกใบ (เจ้าของ 7 ต.ค. 2569: *"ต้องมี 3 สายนะทุกคนเลย"* · ลงย้อนหลัง = *"ขึ้น แต่ไม่โทร"*) ═══
 * สายที่ยังโทรได้ = ตาม `planReplaceCalls` (รวมคอนเฟิร์มต่อคิว) · สายที่เลยเวลาไปแล้ว = `past: true` เวลาตามกติกา
 * (คอนเฟิร์ม = วันก่อนเข้างานเวลาที่ตั้ง · สาย 2/3 = ก่อนเข้างาน) ⇒ ผู้เรียกต้องตั้งเป็นคนโทร (AI ไม่โทรย้อนหลัง)
 */
export function planReplaceCallsFull(
  wall: ReplaceWantWall,
  now: Date,
  timing: ReplaceTiming = DEFAULT_REPLACE_CALL_RULE,
): ReplaceSlotPlanFull[] {
  const start = wantInstant(wall);
  if (Number.isNaN(start.getTime())) return [];
  const live = planReplaceCalls(wall, now, timing);
  const fixedAt: Record<ReplaceSlot, Date> = {
    confirm: new Date(`${shiftYmd(wall.ymd, -1)}T${timing.confirmTime}:00+07:00`),
    lead60: new Date(start.getTime() - timing.leadMinutes[0] * 60_000),
    lead15: new Date(start.getTime() - timing.leadMinutes[1] * 60_000),
  };
  return REPLACE_SLOTS.map((slot) => {
    const l = live.find((p) => p.slot === slot);
    return l
      ? { ...l, past: false }
      : { slot, round: REPLACE_SLOT_ROUND[slot], at: fixedAt[slot], asap: false, past: true };
  });
}

/** คีย์กันซ้ำต่อสาย: ใบงาน + สาย + คนไปแทน (เปลี่ยนคน = คีย์ใหม่ ⇒ ของคนเดิมถูกยกเลิก ของคนใหม่ถูกสร้าง) */
export function replaceSlotRef(jobId: string | number, slot: ReplaceSlot, personKey: string): string {
  return `${replaceSourceRef(jobId)}:${slot}:${personKey}`;
}

/** แยกคีย์กลับ — คีย์รุ่นเก่า (หนึ่งใบหนึ่งสาย ก่อน 5 ต.ค. 2569) ไม่มี slot */
export function parseReplaceRef(ref: string): { jobId: string; slot: ReplaceSlot | null; personKey: string | null } | null {
  const m = /^irecruit-replace:([^:]+)(?::(confirm|lead60|lead15):([^:]+))?$/.exec(ref.trim());
  if (!m) return null;
  return { jobId: m[1], slot: (m[2] as ReplaceSlot | undefined) ?? null, personKey: m[3] ?? null };
}

/** หมายเหตุบนสาย (AI พูดด้วย) — สายคอนเฟิร์มบอกวันด้วย */
export function replaceSlotNote(slot: ReplaceSlot, wall: ReplaceWantWall): string {
  if (slot !== 'confirm') return replaceCallNote(wall);
  const [, m, d] = wall.ymd.split('-').map(Number);
  return `ยืนยันเวลาเข้างาน ${d}/${m} ${wall.hhmm} น.`;
}

export type ReplaceDesiredCall = { ref: string; jobId: string; slot: ReplaceSlot; at: Date; asap: boolean };

/**
 * แก้ล่าสุดชนะ (7 ต.ค. 2569) — แถวที่เจ้าหน้าที่แก้บนระบบแล้ว ย้ายเวลาตาม iRecruit **เฉพาะเมื่อ iRecruit เปลี่ยนทีหลัง**
 * `syncedNote` = หมายเหตุในแถว (เวลาเข้างานของ iRecruit ตอนดึงล่าสุด) · `irecruitNote` = ของ iRecruit ตอนนี้
 * ตรงกัน = iRecruit ไม่ได้เปลี่ยน ⇒ ไม่ทับ (false) · ต่างกัน = iRecruit เปลี่ยน ⇒ ย้ายตาม (true)
 */
export function irecruitChangedSinceSync(syncedNote: string | null | undefined, irecruitNote: string): boolean {
  return (syncedNote ?? '').trim() !== irecruitNote.trim();
}
export type ReplaceExistingCall = {
  id: string;
  ref: string;
  scheduledAt: Date;
  /** pending = ยังไม่ถึงเวลา (เกินตอนนี้ + ระยะกันชน) ไม่ยกเลิก ไม่ปิด ไม่มีผลคนลง · locked = อย่างอื่นทั้งหมด (แตะไม่ได้) */
  state: 'pending' | 'locked';
};
export type ReplaceReconcile = {
  create: ReplaceDesiredCall[];
  reschedule: Array<{ existing: ReplaceExistingCall; desired: ReplaceDesiredCall }>;
  cancel: ReplaceExistingCall[];
};

/**
 * เทียบของที่ iRecruit ต้องการ (`desired`) กับสายที่มีอยู่ (`existing`) — ตรรกะล้วน มีเทสต์
 * - คีย์ที่มีอยู่แล้ว (สถานะไหนก็ได้) = ไม่สร้างซ้ำ (คนยกเลิกเอง/โทรไปแล้ว ห้ามคืนชีพ)
 * - มีอยู่ + ยังไม่ถึงเวลา + เวลาไม่ตรง (เกิน 1 นาที) = ย้ายเวลา · สายคอนเฟิร์มแบบ "ตามคิว" ไม่ย้าย (เวลาคิวขยับทุกรอบ)
 * - สายที่ยังไม่ถึงเวลาแต่ iRecruit ไม่ต้องการแล้ว (ยกเลิก/เปลี่ยนคน/เลยเวลา) = ยกเลิก — **เฉพาะเมื่อ `safeToCancel`**
 *   (ดึงจาก iRecruit ได้ครบ) ไม่งั้นดึงพังรอบเดียวยกเลิกทั้งระบบ
 * - สายรุ่นเก่า (ไม่มี slot) ที่ยังไม่ถึงเวลา = ยกเลิก (ย้ายมาเป็น 3 สาย) · รุ่นเก่าที่ปิด/ยกเลิกไปแล้ว = ใบนั้นคนจัดการแล้ว ไม่สร้างใหม่
 */
export function reconcileReplaceCalls(
  desired: readonly ReplaceDesiredCall[],
  existing: readonly ReplaceExistingCall[],
  opts: { safeToCancel: boolean },
): ReplaceReconcile {
  const out: ReplaceReconcile = { create: [], reschedule: [], cancel: [] };
  const byRef = new Map(existing.map((e) => [e.ref, e]));
  const desiredRefs = new Set(desired.map((d) => d.ref));
  /** ใบที่มีสายรุ่นเก่าที่คนจัดการไปแล้ว — ไม่สร้างสายรุ่นใหม่ให้ใบนี้ */
  const handledLegacyJobs = new Set<string>();
  /** ใบที่สายรุ่นเก่ายังรอโทรอยู่ — สร้างรุ่นใหม่ได้ก็ต่อเมื่อยกเลิกของเก่าได้ในรอบเดียวกัน (กันโทรซ้อน) */
  const pendingLegacyJobs = new Set<string>();
  for (const e of existing) {
    const p = parseReplaceRef(e.ref);
    if (!p || p.slot) continue;
    if (e.state === 'locked') handledLegacyJobs.add(p.jobId);
    else pendingLegacyJobs.add(p.jobId);
  }
  for (const d of desired) {
    const ex = byRef.get(d.ref);
    if (!ex) {
      if (handledLegacyJobs.has(d.jobId)) continue;
      if (!opts.safeToCancel && pendingLegacyJobs.has(d.jobId)) continue;
      out.create.push(d);
      continue;
    }
    if (ex.state === 'pending' && !d.asap && Math.abs(ex.scheduledAt.getTime() - d.at.getTime()) > 60_000) {
      out.reschedule.push({ existing: ex, desired: d });
    }
  }
  if (opts.safeToCancel) {
    for (const e of existing) {
      if (e.state !== 'pending' || desiredRefs.has(e.ref)) continue;
      if (!parseReplaceRef(e.ref)) continue; // ไม่ใช่สายที่ดึงมา — ไม่ยุ่ง
      out.cancel.push(e);
    }
  }
  return out;
}

/**
 * ใครโทรตามประเภทคนไปแทน (เจ้าของ Choice 5 ต.ค. 2569 ระหว่างที่ยังแยก WL/สแปร์ไซต์ไม่ได้):
 * **Ex (`replace_type = EX`) ให้ AI โทร · คนใน/อื่น ๆ ให้คนโทรเอง** — WL จะไม่โดน AI โทรแน่นอน · สแปร์ไซต์ยังมีคนตาม
 * `byDate` = ผลของ aiFrom (ก่อนวันนั้นคนโทรอยู่แล้ว)
 */
export function replaceModeForType(replaceType: string | null | undefined, byDate: 'ai' | 'manual'): 'ai' | 'manual' {
  if (byDate === 'manual') return 'manual';
  return (replaceType ?? '').trim().toUpperCase() === 'EX' ? 'ai' : 'manual';
}
