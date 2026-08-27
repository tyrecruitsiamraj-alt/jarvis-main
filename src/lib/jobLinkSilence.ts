/**
 * "ลิงก์ที่ปล่อยแล้วยังไม่มีใบสมัคร" — **ตรรกะล้วน** (21 ส.ค. 2569)
 *
 * ที่มา: เจ้าของสั่งออกแบบหน้าบอร์ดใหม่ · panel ออกแบบ 4 ทิศทางลงมติว่าไอเดียที่แข็งสุด
 * คือกองนี้ เพราะ **มันเล็กจริงโดยธรรมชาติ** — ทั้งระบบปล่อยลิงก์ผูกใบขอแค่ 12 ใบจาก 283
 * (วัดจริง 21 ส.ค. 2569: เข้าเงื่อนไข 4 ใบ — คลิก 0 สองใบ · คลิกแล้วไม่มีใครกรอกสองใบ)
 *
 * 🔴 **บทเรียนที่ห้ามลืม**: เคยทำกลับกัน (กล่องส้ม "ยังไม่ปล่อยลิงก์ 277/283") แล้วเจ้าของตีตก
 * เพราะมันคือเกือบทั้งบอร์ด → **ของน้อยคือสัญญาณ ของเยอะคือพื้นหลัง**
 * ห้ามขยายเงื่อนไขไปครอบใบที่ยังไม่ปล่อยลิงก์ และห้ามพิมพ์เลข 271/277 ที่ไหนบนจอ
 *
 * 🔴 นี่คือ "ของที่ลงแรงไปแล้วแต่ยังไม่ได้ผล" — **ไม่ใช่คำเตือน** จึงไม่ใช้สีแดง/ส้ม
 * และเหตุผลต้องมาจากเลขจริง ไม่ใช่คนเดา:
 *   คลิกรวม 0  → ยังไม่มีใครเห็นลิงก์ → เพิ่มช่องทาง
 *   คลิก > 0 แต่ใบสมัคร 0 → เห็นแล้วไม่กรอก → แก้ประกาศ
 */
import type { JobRequest } from '@/types';
import { countFor, type JobKeyReader } from '@/lib/jobKeyIndex';

/** เหตุผลที่เงียบ — มาจากยอดคลิกจริง ไม่ใช่การเดา */
export type SilenceReason = 'no_views' | 'viewed_no_apply';

export type SilentLinkRow = {
  job: JobRequest;
  /** ปล่อยลิงก์มาแล้วกี่วัน (นับจากประกาศล่าสุดของใบนั้น) */
  daysSincePosted: number;
  /** คลิกรวมทุกช่องทางของใบนั้น */
  clicks: number;
  reason: SilenceReason;
};

/**
 * ทุกช่องเป็น **ตัวอ่านแบบเทียบสองคีย์** (`jobKeyIndex.buildJobKeyIndex`) ไม่ใช่ Map ดิบ
 *
 * 🔴 เหตุผล: ของฝั่งเรา (ประกาศ · ยอดผู้สมัคร) คีย์ด้วย `siamraj-sql:XXX` แต่ใบ**ล่วงหน้า**
 * ที่ feed ส่งมาเป็น `siamraj-pre:XXX` → เทียบ id เต็มตรง ๆ ทำให้ใบล่วงหน้า
 * **หลุดออกจากแถบนี้ 100%** โดยไม่มีสัญญาณอะไรเลย (บั๊กที่แก้ 23 ส.ค. 2569)
 * ⚠️ สัญญาเหมือน `Map.get` โดยเจตนา — ผู้เรียกที่ส่ง `Map` มาก็ยังใช้ได้ (เทสต์เดิมใช้อยู่)
 */
export type SilentLinkInput = {
  /** ใบขอที่กำลังแสดงอยู่ (ผ่านตัวกรองแล้ว) */
  jobs: readonly JobRequest[];
  /** jobId → เวลาสร้างประกาศล่าสุด (ISO) */
  latestPostedAt: JobKeyReader<string>;
  /** jobId → ยอดคลิกรวมทุกช่องทาง */
  clicksByJob: JobKeyReader<number>;
  /** jobId → จำนวนผู้สมัคร */
  applicantCounts: JobKeyReader<number>;
  /** jobId → จำนวน Lead (ใบที่ปัดเข้าคลัง — ยังถือว่ามีคนเข้ามาแล้ว) */
  leadCounts: JobKeyReader<number>;
};

/** เงียบกี่วันถึงนับ — ต่ำกว่านี้ยังเร็วเกินจะสรุปว่าไม่ได้ผล */
export const SILENT_AFTER_DAYS = 3;

/** เพดานแถวที่โชว์ตอนยังไม่กด "ดูอีก N ใบ" */
export const SILENT_PREVIEW_ROWS = 2;

function dayDiff(fromIso: string, today: Date): number | null {
  const t = Date.parse(fromIso);
  if (!Number.isFinite(t)) return null;
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(t);
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((a - b) / 86_400_000);
}

/**
 * เลือกใบที่ "ปล่อยลิงก์แล้วแต่ยังไม่มีใบสมัคร ≥ 3 วัน"
 * เรียง **ปล่อยมานานสุดขึ้นก่อน** (ไม่ใช่อายุใบ — คำบนจอต้องตรงกับเลขที่ใช้เรียง)
 */
export function selectSilentLinkRows(input: SilentLinkInput, today = new Date()): SilentLinkRow[] {
  const { jobs, latestPostedAt, clicksByJob, applicantCounts, leadCounts } = input;
  const rows: SilentLinkRow[] = [];

  for (const job of jobs) {
    const postedAt = latestPostedAt.get(job.id);
    if (!postedAt) continue;
    if (countFor(applicantCounts, job.id) > 0) continue;
    if (countFor(leadCounts, job.id) > 0) continue;

    const days = dayDiff(postedAt, today);
    if (days == null || days < SILENT_AFTER_DAYS) continue;

    const clicks = countFor(clicksByJob, job.id);
    rows.push({
      job,
      daysSincePosted: days,
      clicks,
      reason: clicks === 0 ? 'no_views' : 'viewed_no_apply',
    });
  }

  return rows.sort((a, b) => b.daysSincePosted - a.daysSincePosted);
}

/** คำอธิบาย "ทำอะไรไปแล้ว" ของแถว — ทุกคำมีเลขรองรับ */
export function silentRowFactLine(row: SilentLinkRow): string {
  const base = `ปล่อยลิงก์ ${row.daysSincePosted.toLocaleString('th-TH')} วันก่อน`;
  return row.reason === 'no_views'
    ? `${base} · ยังไม่มีใครเห็นลิงก์ (คลิก 0)`
    : `${base} · มีคนกดดู ${row.clicks.toLocaleString('th-TH')} ครั้ง แต่ยังไม่มีใครกรอก`;
}

/**
 * ปุ่มขั้นถัดไป — เลขสั่งงาน ไม่ใช่คนเดา
 *
 * 🔴 `action` เคยชื่อ `popupTab` ตอนที่ยังเด้งป๊อป 3 ขั้น (เปลี่ยน 27 ส.ค. 2569)
 * ทั้งสองงานย้ายไปอยู่หน้าเดียวกันแล้ว (แท็บ "ประกาศ / ลิงก์สมัคร" ของใบขอ)
 * ค่านี้จึงเหลือหน้าที่เดียว: เลือก**คำบนปุ่มกับไอคอน** ไม่ได้เลือกปลายทางอีก
 */
export function silentRowNextStep(row: SilentLinkRow): {
  label: string;
  action: 'edit' | 'genlink';
} {
  return row.reason === 'no_views'
    ? { label: 'เพิ่มช่องทาง', action: 'genlink' }
    : { label: 'แก้ประกาศ', action: 'edit' };
}
