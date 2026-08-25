/**
 * รอบโทร "ถามความเป็นอยู่" หลังเริ่มงาน (Phase 7.4) — ตรรกะล้วน
 *
 * เจ้าของสั่ง: *ตั้งรอบโทรถามความเป็นอยู่ + **preset วันที่ 3/7/30 หลังเริ่มงาน***
 *
 * 🔴 **ไม่ทำระบบโทรใหม่** — ใช้โครง Follow เดิมทั้งชุด (group_id/call_times/staff_phone)
 * ต่างกันแค่ `topic` ⇒ ผลโทร ตารางเดือน แผงรอบ ทุกอย่างของ Follow ใช้ได้ฟรี
 * ⚠️ ไม่รู้วันเริ่มงาน = **คำนวณ preset ไม่ได้** → คืน [] แล้วให้จอบอกว่า "ยังไม่ระบุวันเริ่มงาน"
 * (ห้ามเดาเอาวันที่ย้ายเข้ามาเป็นวันเริ่มงาน — เลขบนจอจะโกหก)
 */

/** หัวข้อของรอบโทรหลังเริ่มงาน — ตัวเดียวทั้งระบบ (ใส่ในตาราง follow_topics ได้ด้วย) */
export const AFTERCARE_TOPIC = 'ถามความเป็นอยู่หลังเริ่มงาน';

/** จำนวนวันหลังเริ่มงานที่เจ้าของสั่ง */
export const AFTERCARE_PRESET_DAYS = [3, 7, 30] as const;
export type AftercarePresetDay = (typeof AFTERCARE_PRESET_DAYS)[number];

export type AftercareRound = {
  days: AftercarePresetDay;
  /** `YYYY-MM-DD` วันที่ควรโทร */
  date: string;
  label: string;
  /** เลยวันนั้นมาแล้ว (ยังไม่ได้ตั้ง = ตกรอบ) */
  overdue: boolean;
};

/** บวกวันแบบปฏิทิน (ไม่ใช่ +ms) — กันเพี้ยนตอนข้ามเดือน/ปี */
function addDays(ymd: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** วันนี้ตามปฏิทินกรุงเทพ — เทียบ "เลยวันไหม" ต้องเทียบวันที่คนเห็น */
function todayBangkok(now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

/**
 * รอบที่ควรตั้งของคนคนนี้ — ว่าง = ยังไม่รู้วันเริ่มงาน (จอต้องบอกให้ไปกรอกก่อน)
 */
export function buildAftercareRounds(
  startDate: string | null | undefined,
  now: Date = new Date(),
): AftercareRound[] {
  if (!startDate) return [];
  const today = todayBangkok(now);
  const out: AftercareRound[] = [];
  for (const days of AFTERCARE_PRESET_DAYS) {
    const date = addDays(startDate, days);
    if (!date) return [];
    out.push({
      days,
      date,
      label: `หลังเริ่มงาน ${days} วัน`,
      overdue: date < today,
    });
  }
  return out;
}

/** สรุปสั้น ๆ ของคนหนึ่งคน — ใช้ใต้ชื่อบนรายการ */
export function aftercareRoundsSummary(rounds: AftercareRound[]): string {
  if (rounds.length === 0) return 'ยังไม่ระบุวันเริ่มงาน — กรอกก่อนจึงตั้งรอบโทรได้';
  const overdue = rounds.filter((r) => r.overdue).length;
  const parts = [`รอบโทร ${rounds.map((r) => r.days).join('/')} วัน`];
  if (overdue > 0) parts.push(`เลยกำหนดแล้ว ${overdue} รอบ`);
  return parts.join(' · ');
}
