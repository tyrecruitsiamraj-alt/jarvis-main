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

export type ReplaceCallRule = {
  /** โทรก่อนวันเข้างานกี่วัน — 0 = วันเข้างาน · -1 = วันก่อนเข้างาน · -2 = สองวันก่อน */
  dayOffset: 0 | -1 | -2;
  /** เวลาไทย HH:MM */
  time: string;
};

export const DEFAULT_REPLACE_CALL_RULE: ReplaceCallRule = { dayOffset: -1, time: '18:00' };

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** อ่านกติกาเวลาโทรจากที่เก็บ/จากฟอร์ม — ค่าที่อ่านไม่ออกถอยไปค่าเริ่มต้นทีละช่อง (ไม่ throw) */
export function normalizeReplaceCallRule(raw: unknown): ReplaceCallRule {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const off = Number(r.dayOffset);
  const dayOffset: ReplaceCallRule['dayOffset'] = off === 0 || off === -1 || off === -2 ? off : DEFAULT_REPLACE_CALL_RULE.dayOffset;
  const t = typeof r.time === 'string' ? r.time.trim() : '';
  const m = HHMM_RE.exec(t);
  const time = m ? `${String(Number(m[1])).padStart(2, '0')}:${m[2]}` : DEFAULT_REPLACE_CALL_RULE.time;
  return { dayOffset, time };
}

/** "18:00 ของวันก่อนเข้างาน" — คำบนจอ ที่เดียว */
export function replaceCallRuleText(rule: ReplaceCallRule): string {
  const when = rule.dayOffset === 0 ? 'วันเข้างาน' : rule.dayOffset === -1 ? 'วันก่อนเข้างาน' : 'สองวันก่อนเข้างาน';
  return `${rule.time} ของ${when}`;
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

export type ReplaceCallPlan = {
  /** เวลาที่จะโทร (ISO instant) */
  at: Date;
  /** เวลาตามกติกาผ่านไปแล้ว แต่ยังไม่ถึงเวลาเข้างาน ⇒ โทรเร็วที่สุด */
  asap: boolean;
};

/** โทรเร็วที่สุด = อีกกี่นาทีจากตอนนี้ (ให้แผนไปถึง Lumos ทัน) */
export const REPLACE_ASAP_MINUTES = 10;

/**
 * สายของใบงานนี้ควรโทรเมื่อไหร่ — `null` = ไม่ต้องสร้าง (เลยเวลาเข้างานไปแล้ว)
 * ⚠️ ไม่มีช่วงห้ามโทรแล้ว (เจ้าของยกเลิก 28 ก.ย. 2569) — เวลาที่ตั้งคือเวลาที่โทร
 */
export function planReplaceCall(wall: ReplaceWantWall, rule: ReplaceCallRule, now: Date): ReplaceCallPlan | null {
  const start = wantInstant(wall);
  if (Number.isNaN(start.getTime()) || start.getTime() <= now.getTime()) return null;
  const at = new Date(`${shiftYmd(wall.ymd, rule.dayOffset)}T${rule.time}:00+07:00`);
  if (at.getTime() > now.getTime()) return { at, asap: false };
  return { at: new Date(now.getTime() + REPLACE_ASAP_MINUTES * 60_000), asap: true };
}

/** คีย์กันซ้ำของสายที่ดึงมา — หนึ่งใบงาน iRecruit = หนึ่งสาย */
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
  /** ดึงไม่ได้ทั้งรอบ — เหตุผลไทย · null = ปกติ */
  error: string | null;
};

export type ReplaceSyncConfig = {
  /** ปิดได้ด้วย `IRECRUIT_REPLACE_SYNC_ENABLED=false` — **ค่าเริ่มต้นคือเปิด** (เจ้าของเคาะ "ดึงเองทุกเช้า") */
  enabled: boolean;
  /** เดินรอบประจำวันตั้งแต่กี่โมง (เวลาไทย 0–23) */
  hour: number;
  /** ดึงใบที่เข้างานล่วงหน้ากี่วัน */
  horizonDays: number;
  /** เช็กทุกกี่มิลลิวินาทีว่าถึงเวลาหรือยัง */
  tickMs: number;
  startupDelayMs: number;
};

export const REPLACE_SYNC_DEFAULTS: ReplaceSyncConfig = {
  enabled: true,
  hour: 6,
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
    hour: intEnv(env.IRECRUIT_REPLACE_SYNC_HOUR, REPLACE_SYNC_DEFAULTS.hour, 0, 23),
    horizonDays: intEnv(env.IRECRUIT_REPLACE_SYNC_HORIZON_DAYS, REPLACE_SYNC_DEFAULTS.horizonDays, 1, 92),
    tickMs: intEnv(env.IRECRUIT_REPLACE_SYNC_TICK_MS, REPLACE_SYNC_DEFAULTS.tickMs, 10_000, 3_600_000),
    startupDelayMs: intEnv(env.IRECRUIT_REPLACE_SYNC_STARTUP_DELAY_MS, REPLACE_SYNC_DEFAULTS.startupDelayMs, 0, 600_000),
  };
}

/**
 * รอบประจำวันถึงเวลาหรือยัง — ถึงชั่วโมงที่ตั้ง (เวลาไทย) และวันนี้ยังไม่ได้ดึง
 * (เซิร์ฟเวอร์ดับตอน 06:00 ⇒ เดินรอบทันทีที่กลับมาในวันเดียวกัน · ไม่เดินซ้ำวันเดียวกัน)
 */
export function replaceSyncDueNow(bangkokYmd: string, bangkokHour: number, lastRunYmd: string | null, hour: number): boolean {
  if (lastRunYmd === bangkokYmd) return false;
  return bangkokHour >= hour;
}
