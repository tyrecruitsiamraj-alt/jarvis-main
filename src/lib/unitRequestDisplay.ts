import type { JobRequest } from '@/types';
import { unitLabel } from '@/lib/unitDisplay';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { unitSectorLabel } from '@/lib/unitSector';

/** ชื่อหน่วยงานที่ติ๊กส่งคนแทน — ใช้ใน WL assignment */
export function unitNamesForSendReplacement(jobs: JobRequest[]): string[] {
  return Array.from(
    new Set(
      jobs
        .filter((j) => j.send_replacement === true)
        .map((j) => j.unit_name?.trim() ?? '')
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'th'));
}

export function unitRequestCardTitle(job: JobRequest): string {
  return job.request_no?.trim() || job.unit_name || '—';
}

/**
 * ป้าย "สาเหตุที่ขอ: <ค่า ERP>" — **helper กลางที่เดียว** สำหรับทุกจอที่โชว์
 * `request_action_name` (เจ้าของเคาะ 5 ก.ย. 2569 — ค่าจริงจาก ERP เช่น ลาออก/เปิดไซต์/
 * พ้นสภาพ ห้ามแปลงค่า เติมได้แค่คำนำหน้า) ห้ามพิมพ์คำนำหน้านี้ซ้ำเองที่จอ ให้เรียก
 * ฟังก์ชันนี้ (หรือ `requestActionOrTypeLabel` ถ้าต้องการ fallback) เสมอ
 * คืน `null` เมื่อไม่มีค่า ERP จริง — ผู้เรียกเลือกเองว่าจะไม่แสดง หรือถอยไปโชว์อย่างอื่น
 */
export function requestActionLabel(job: JobRequest): string | null {
  return job.request_action_name ? `สาเหตุที่ขอ: ${job.request_action_name}` : null;
}

/**
 * เหมือน `requestActionLabel` แต่ไม่มีค่า ERP จริงจึงถอยไปใช้ `JOB_TYPE_LABELS`
 * (เป็น**ประเภทงาน** ไม่ใช่สาเหตุ ⇒ ไม่ติดคำนำหน้า "สาเหตุที่ขอ: ")
 */
export function requestActionOrTypeLabel(job: JobRequest): string {
  return requestActionLabel(job) ?? JOB_TYPE_LABELS[job.job_type];
}

/** หัวข้อการ์ดบอร์ดรับสมัคร — โชว์ชื่อหน่วยงานก่อน */
export function jobBoardCardTitle(job: JobRequest): string {
  /**
   * 🔴 **จุดทำงานนำ** (เจ้าของสั่งแก้ทั้งระบบ 3 ก.ย. 2569) — ก่อนหน้านี้ใช้ชื่อ
   * นิติบุคคลคู่สัญญา ทำให้ไซต์ `69LBDL0044` ขึ้นว่า "สมิติเวช ศรีราชา" ทั้งที่คน
   * ต้องไปทำงานที่ **สมิติเวช ชลบุรี** (สาขาชลบุรีจดทะเบียนใต้บริษัทศรีราชา)
   *
   * ⚠️ หัวข้อนี้เป็นตัวที่ **ตัวเลือกหน่วยงานของงานติดตาม** หยิบไปเก็บเป็น
   * `follow_entries.unit_name` แล้ว AI พูดออกเสียงตอนโทรว่า *"ไปทำงาน หน่วยงาน …"*
   * ⇒ พูดชื่อจุดทำงานถูกกว่าพูดชื่อบริษัทแม่
   */
  const label = unitLabel(job);
  if (label && label !== '—') return label;
  return job.request_no?.trim() || '—';
}

/** บรรทัดรองใต้หัวข้อ */
export function unitRequestCardSubtitle(job: JobRequest): string {
  const parts: string[] = [];
  const action = requestActionOrTypeLabel(job);
  if (action) parts.push(action);
  if (job.job_description_code_1) parts.push(job.job_description_code_1);
  if (job.job_description_code_2) parts.push(job.job_description_code_2);
  if (job.resigned_employee_name) parts.push(job.resigned_employee_name);
  return parts.join(' • ');
}

/**
 * บรรทัดรองบนการ์ด**บอร์ด** — เหมือน `unitRequestCardSubtitle` แต่**ตัดตำแหน่ง
 * (`job_description_code_1`) ออก** เพราะการ์ดบอร์ดพิมพ์ตำแหน่งเป็นบรรทัดไฮไลต์
 * สีน้ำเงินอยู่แล้ว (publicJobPositionLabel = ฟิลด์เดียวกัน) → เดิมพิมพ์ซ้ำสองรอบทุกใบ
 * ⚠️ **ห้ามแก้ตัวเดิม** — `unitRequestCardSubtitle` ถูกใช้ที่ MatchingPage/PreCheck
 * ที่ไม่มีบรรทัดตำแหน่งแยก (21 ส.ค. 2569)
 */
export function jobBoardCardSubtitle(job: JobRequest): string {
  const parts: string[] = [];
  const action = requestActionOrTypeLabel(job);
  if (action) parts.push(action);
  if (job.job_description_code_2) parts.push(job.job_description_code_2);
  if (job.resigned_employee_name) parts.push(job.resigned_employee_name);
  return parts.join(' • ');
}

/** ป้ายเลือกใน dropdown */
export function unitRequestSelectLabel(job: JobRequest): string {
  const unit = job.unit_name || '—';
  const no = job.request_no?.trim();
  const action = job.request_action_name || JOB_TYPE_LABELS[job.job_type];
  if (no) return `${unit} · ${no}${action ? ` · ${action}` : ''}`;
  return action ? `${unit} · ${action}` : unit;
}

/** ป้ายตำแหน่งบนบอร์ดประกาศสาธารณะ */
export function publicJobPositionLabel(job: JobRequest): string {
  return job.job_description_code_1?.trim() || JOB_TYPE_LABELS[job.job_type] || 'อื่นๆ';
}

/**
 * ป้าย "ราชการ / เอกชน" ของแถวหนึ่ง — **ที่เดียวที่ตัดสินว่าจะเชื่อค่าไหน**
 *
 * 🔴 ใบขอจาก ERP ไม่เคยมี `job_category` จริง — feed ทั้งสี่เส้นฮาร์ดโค้ด `'private'`
 * ทุกใบตั้งแต่วันแรก ⇒ เดิมช่องค้นหาหน้าหน่วยงานพิมพ์ "เอกชน" แล้ว **เจอทุกใบ**
 * รวมใบที่ทีมระบุไว้ว่าเป็นราชการ (แก้ 25 ส.ค. 2569 · รอบสี่สิบเอ็ด)
 *
 * ตัวแยก: มี property `unit_sector` (feed แปะให้ทุกใบ ERP แม้ยังไม่ระบุ = `null`)
 * ⇒ ใช้ค่านั้น · ไม่มี property = งานในตาราง `jobs` ของเราเอง ⇒ `job_category` เชื่อได้
 */
export function jobSectorLabel(job: JobRequest): string {
  return job.unit_sector !== undefined
    ? unitSectorLabel(job.unit_sector)
    : JOB_CATEGORY_LABELS[job.job_category];
}

/** คำค้นหาแบบรวมฟิลด์หลัก */
export function unitRequestSearchBlob(job: JobRequest): string {
  return [
    job.unit_name,
    job.request_no,
    job.request_action_name,
    job.location_address,
    job.job_description_code_1,
    job.job_description_code_2,
    JOB_TYPE_LABELS[job.job_type],
    jobSectorLabel(job),
    job.resigned_employee_name,
    job.work_schedule,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
