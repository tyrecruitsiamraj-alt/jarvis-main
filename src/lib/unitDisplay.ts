import type { JobRequest } from '@/types';

/**
 * ชื่อหน่วยงานบนจอ — **จุดทำงานนำ · คู่สัญญาตาม**
 *
 * 🔴 เจ้าของสั่งแก้ทั้งระบบ 3 ก.ย. 2569 หลังเจอใบขอไซต์ `69LBDL0044` ขึ้นจอว่า
 * *"บริษัท สมิติเวช ศรีราชา จำกัด (สำนักงานใหญ่)"* ทั้งที่คนต้องไปทำงานที่
 * **สมิติเวช ชลบุรี** (โรงพยาบาลชลบุรีจดทะเบียนใต้บริษัทศรีราชา)
 *
 * กติกา:
 * 1. บรรทัดแรก = **จุดทำงาน** (`work_site_name`) เพราะคำถามแรกของทุกคนคือ *ไปที่ไหน*
 * 2. บรรทัดสอง = **คู่สัญญา** (`unit_name`) เพราะ 240 จาก 414 ไซต์ตั้งชื่อจุดทำงาน
 *    เป็นชื่อย่ออังกฤษ (`krungsri` `SCB` `MEGA`) — ทิ้งชื่อบริษัทไปคนนอกอ่านไม่รู้เรื่อง
 * 3. ไม่มีจุดทำงาน (ใบขอล่วงหน้าไม่มีไซต์) หรือชื่อซ้ำกัน ⇒ เหลือบรรทัดเดียว
 *
 * 🔴 **ห้ามเอาฟังก์ชันพวกนี้ไปทำกุญแจแมตช์/จัดกลุ่ม** — `unit_name` เป็นตัวที่
 * `jobPenalty` แมตช์กับ `client_name` ของ WL ที่บันทึกไว้แล้ว ต้องใช้ค่าดิบเสมอ
 */
type UnitSource = Pick<JobRequest, 'unit_name'> & { work_site_name?: string | null };

/** บรรทัดแรก — จุดทำงานถ้ามี ไม่มีก็ชื่อคู่สัญญา */
export function unitLabel(job: UnitSource): string {
  const site = (job.work_site_name ?? '').trim();
  if (site) return site;
  return (job.unit_name ?? '').trim() || '—';
}

/** บรรทัดสอง — ชื่อคู่สัญญา · `null` เมื่อบรรทัดแรกเป็นชื่อนั้นอยู่แล้ว */
export function unitSubLabel(job: UnitSource): string | null {
  const site = (job.work_site_name ?? '').trim();
  if (!site) return null;
  const unit = (job.unit_name ?? '').trim();
  if (!unit || unit === site) return null;
  return unit;
}

/** ที่ที่ใส่ได้บรรทัดเดียว (ตารางแคบ · CSV · tooltip · แจ้งเตือน) */
export function unitOneLine(job: UnitSource): string {
  const label = unitLabel(job);
  const sub = unitSubLabel(job);
  return sub ? `${label} · ${sub}` : label;
}

/** คำอธิบายเต็มสำหรับ `title=` — บอกด้วยว่าบรรทัดไหนคืออะไร */
export function unitTitleText(job: UnitSource): string {
  const sub = unitSubLabel(job);
  if (!sub) return unitLabel(job);
  return `จุดทำงาน: ${unitLabel(job)} · คู่สัญญา: ${sub}`;
}
