/**
 * **สายงานของคนในระบบ** (migration 114) — สรรหา / คัดสรร / OPL / Online
 *
 * เจ้าของสั่ง 1 ก.ย. 2569: *"เอาตำแหน่งพวกนี้มาเพิ่มพร้อมเบอร์โทรในหน้าผู้ใช้งาน
 * จะได้กำหนดทั้ง Role คัดสรร ฯลฯ ชื่อเล่น และเบอร์โทรทีเดียว"*
 *
 * 🔴 **คนละเรื่องกับ `role`** — `role` = สิทธิ์ในระบบ (admin/supervisor/staff/opl)
 * ส่วนสายงาน = งานที่คนนั้นทำ · คนหนึ่งอยู่ได้หลายสาย และ `opl` โผล่ทั้งสองฝั่งโดยบังเอิญ
 * (มีสิทธิ์ opl ไม่ได้แปลว่าอยู่สาย opl และกลับกัน)
 *
 * ⚠️ **ยังไม่ใช่แหล่งของ dropdown ทั้งระบบ** — ตอนนี้ dropdown ยังอ่านจาก
 * `job_staff_roster` (หน้า "ทีมสรรหา/คัดสรร/OPL/Online") เหมือนเดิม เพราะใบขอที่ใช้งานอยู่
 * อ้างชื่อจากตารางนั้น · ชุดนี้ให้คนทยอยกรอกไว้ก่อน แล้วค่อยย้ายมาอ้างทีหลัง (เจ้าของเคาะเอง)
 */
export const JOB_LANES = ['recruiter', 'screener', 'opl', 'online'] as const;
export type JobLane = (typeof JOB_LANES)[number];

export const JOB_LANE_LABEL: Record<JobLane, string> = {
  recruiter: 'สรรหา',
  screener: 'คัดสรร',
  opl: 'OPL',
  online: 'Online',
};

export function isJobLane(v: unknown): v is JobLane {
  return typeof v === 'string' && (JOB_LANES as readonly string[]).includes(v);
}

/** คำอ่านของสายงานที่คนนี้อยู่ — ว่าง = ยังไม่ได้ตั้ง (ห้ามเขียนว่า "ไม่มีสายงาน") */
export function jobLanesText(lanes: readonly string[] | undefined | null): string {
  const list = (lanes ?? []).filter(isJobLane);
  return list.length === 0 ? 'ยังไม่ตั้ง' : list.map((l) => JOB_LANE_LABEL[l]).join(' · ');
}
