/**
 * รายงาน "ตัวย้ายใบสมัครอัตโนมัติ" — ตรรกะล้วน (อ่านค่า env + ประกอบข้อความให้คนอ่าน)
 *
 * ⚠️ ตัวย้ายนี้แตะใบสมัครของคนจริง เจ้าของจึงสั่งไว้ว่า **ต้องบอกได้ว่าย้ายใครไปไหน**
 * ค่าเริ่มต้นทุกตัวจึงเอียงไปทาง "ไม่ทำอะไร": ปิดอยู่ และถึงเปิดก็เป็นโหมดลองดูก่อน
 */

/** ผลรายคนของรอบหนึ่ง — ตรงกับ `AutoMoveResult.details` ฝั่งเซิร์ฟเวอร์ */
export type AutoMoveDetail = {
  applicationId: string;
  /** ชื่อผู้สมัคร (อาจว่างถ้าแถวเก่าไม่มีชื่อ) */
  applicant?: string | null;
  from: string;
  to: string;
  reason: string;
};

/** สภาพรอบล่าสุดที่หน้าเว็บเอาไปแสดง */
export type AutoMoveRunState = {
  /** เวลาที่รอบล่าสุดจบ (ISO) — null = ยังไม่เคยเดินสักรอบ */
  at: string | null;
  /** true = รอบนั้นเป็นการลองดู ไม่ได้เขียนจริง */
  dryRun: boolean;
  scanned: number;
  moved: number;
  skipped: number;
  openJobs: number;
  reasons: Record<string, number>;
  details: AutoMoveDetail[];
  /** ข้อความผิดพลาดของรอบล่าสุด (ถ้ามี) */
  error?: string | null;
};

export type AutoMoveWorkerConfig = {
  /** เปิดตัวตั้งเวลาไหม — ค่าเริ่มต้น **ปิด** */
  enabled: boolean;
  /** ย้ายจริงไหม — ค่าเริ่มต้น **ไม่ย้าย** (ลองดูอย่างเดียว) */
  apply: boolean;
  intervalMs: number;
  startupDelayMs: number;
  limit: number;
};

export const AUTO_MOVE_DEFAULTS = {
  intervalMs: 900_000, // 15 นาที
  startupDelayMs: 30_000,
  limit: 200,
} as const;

const MIN_INTERVAL_MS = 60_000;

function truthy(raw: string | undefined): boolean {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

/**
 * อ่านตัวเลขจาก env
 * ⚠️ ว่าง = ไม่ได้ตั้ง → ใช้ค่าเริ่มต้น ห้ามปล่อยไป `Number('')` ซึ่งได้ 0 (finite!)
 * (บทเรียนเดียวกับ `parseIntEnv` ของ match precompute — เคยทำ scan ถี่ผิดจนงานทะลัก)
 */
export function autoMoveIntEnv(raw: string | undefined, def: number, min: number): number {
  const s = String(raw ?? '').trim();
  if (!s) return def;
  const n = Number(s);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.floor(n));
}

/** อ่านค่าตั้งของ worker จาก env — ทุกค่าที่ไม่ได้ตั้ง ถอยไปทาง "ไม่ทำอะไร" */
export function readAutoMoveWorkerConfig(env: Record<string, string | undefined>): AutoMoveWorkerConfig {
  return {
    enabled: truthy(env.APPLICATION_AUTO_MOVE_ENABLED),
    apply: truthy(env.APPLICATION_AUTO_MOVE_APPLY),
    intervalMs: autoMoveIntEnv(
      env.APPLICATION_AUTO_MOVE_INTERVAL_MS,
      AUTO_MOVE_DEFAULTS.intervalMs,
      MIN_INTERVAL_MS,
    ),
    startupDelayMs: autoMoveIntEnv(
      env.APPLICATION_AUTO_MOVE_STARTUP_DELAY_MS,
      AUTO_MOVE_DEFAULTS.startupDelayMs,
      0,
    ),
    limit: autoMoveIntEnv(env.APPLICATION_AUTO_MOVE_LIMIT, AUTO_MOVE_DEFAULTS.limit, 1),
  };
}

/**
 * เลขที่ใบขอจากคีย์เต็ม — `siamraj-sql:OPL6901006` → `OPL6901006`
 * ⚠️ คีย์ที่ระบบใช้ต้องเป็น id เต็มเสมอ ตัวนี้ใช้ **แสดงผลอย่างเดียว**
 * (เลขที่ใบซ้ำกันได้ระหว่างใบปกติกับใบล่วงหน้า จึงติดป้าย "ล่วงหน้า" กำกับให้ด้วย)
 */
export function autoMoveJobLabel(jobId: string): string {
  const s = String(jobId ?? '').trim();
  if (!s) return '—';
  const i = s.indexOf(':');
  if (i < 0) return s;
  const prefix = s.slice(0, i);
  const no = s.slice(i + 1) || s;
  return prefix === 'siamraj-pre' ? `${no} (ล่วงหน้า)` : no;
}

/** บรรทัดเดียวต่อคน — "สมชาย ใจดี · OPL6901006 → LBM6908002" */
export function autoMoveDetailLine(d: AutoMoveDetail): string {
  const who = String(d.applicant ?? '').trim() || 'ไม่ทราบชื่อ';
  return `${who} · ${autoMoveJobLabel(d.from)} → ${autoMoveJobLabel(d.to)}`;
}

/** สรุปรอบล่าสุดเป็นประโยคเดียว — ขึ้นหัวการ์ดบนหน้าตั้งค่า */
export function autoMoveRunSummary(state: AutoMoveRunState | null): string {
  if (!state || !state.at) return 'ยังไม่เคยเดินสักรอบ';
  if (state.error) return `รอบล่าสุดล้มเหลว — ${state.error}`;
  const verb = state.dryRun ? 'จะย้าย' : 'ย้ายแล้ว';
  if (state.moved === 0) {
    return state.scanned === 0
      ? 'รอบล่าสุดไม่มีใบสมัครค้างที่ต้องย้าย'
      : `รอบล่าสุดดู ${state.scanned.toLocaleString('th-TH')} ใบ — ไม่มีใบไหนย้ายได้`;
  }
  return `รอบล่าสุด ${verb} ${state.moved.toLocaleString('th-TH')} ใบ (จากที่ค้างอยู่ ${state.scanned.toLocaleString('th-TH')} ใบ)`;
}

/** ป้ายโหมดที่กำลังทำงานอยู่ — คนอ่านต้องรู้ทันทีว่าของจริงหรือลองดู */
export function autoMoveModeLabel(cfg: Pick<AutoMoveWorkerConfig, 'enabled' | 'apply'>): string {
  if (!cfg.enabled) return 'ปิดอยู่ — ตัวตั้งเวลาไม่ทำงาน';
  return cfg.apply ? 'เปิดอยู่ · ย้ายจริง' : 'เปิดอยู่ · ลองดูอย่างเดียว (ยังไม่ย้ายจริง)';
}

/** เหตุผลที่ไม่ย้าย เรียงจากที่เจอบ่อยสุด — ตอบคำถาม "ทำไมไม่ย้ายสักคน" */
export function autoMoveTopReasons(
  reasons: Record<string, number>,
  top = 5,
): Array<{ reason: string; count: number }> {
  return Object.entries(reasons)
    .map(([reason, count]) => ({ reason, count: Number(count) || 0 }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'th'))
    .slice(0, Math.max(1, top));
}
