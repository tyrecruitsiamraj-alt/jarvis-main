/**
 * ═══ สถานะใน iRecruit ของรายชื่อที่ดึงมา (เจ้าของ 21 ต.ค. 2569 "ข้อ 2 ทำ") ═══
 * รายชื่อที่ดึงจาก iRecruit ให้คนโทร (AI ไม่โทรเอง) — ทีมทำงานใน iRecruit ⇒ ใช้สถานะของ iRecruit ไม่ใช่การกดโทรใน Jarvis
 * (วัด 21 ต.ค.: 300 คนไม่มีใครกดโทรจาก Jarvis แต่ iRecruit ทำไปแล้ว 210) ·
 * `process_status`: W = รอดำเนินการ · A = สำเร็จ · อื่น ๆ = ไม่สำเร็จ (ตัวเดียวกับ `recruitRegisterSql`)
 * ค้าง = ยังรอดำเนินการ และลงทะเบียนมาเกิน `IRECRUIT_LATE_HOURS` (เกณฑ์ "ช้า = เกิน 24 ชม." ของทั้งระบบ)
 */
export const IRECRUIT_LATE_HOURS = 24;

export type IrecruitPullState = 'waiting' | 'done' | 'failed';

export function irecruitPullState(status: string | null | undefined): IrecruitPullState | null {
  const s = (status ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'W') return 'waiting';
  if (s === 'A') return 'done';
  return 'failed';
}

export const IRECRUIT_PULL_STATE_LABEL: Record<IrecruitPullState, string> = {
  waiting: 'iRecruit รอดำเนินการ',
  done: 'iRecruit สำเร็จ',
  failed: 'iRecruit ไม่สำเร็จ',
};

/** ค้างนานกี่ชั่วโมง (เฉพาะที่ยังรอ) · ไม่ค้าง = null */
export function irecruitLateHours(status: string | null | undefined, createdAt: string | null | undefined, nowMs = Date.now()): number | null {
  if (irecruitPullState(status) !== 'waiting') return null;
  const at = Date.parse(createdAt ?? '');
  if (!Number.isFinite(at)) return null;
  const h = Math.floor((nowMs - at) / 3_600_000);
  return h >= IRECRUIT_LATE_HOURS ? h : null;
}

/** "ค้าง 30 ชม." · "ค้าง 3 วัน" */
export function lateText(hours: number): string {
  return hours < 48 ? `ค้าง ${hours} ชม.` : `ค้าง ${Math.floor(hours / 24)} วัน`;
}
