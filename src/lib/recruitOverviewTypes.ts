/**
 * ═══ รูปข้อมูลของหน้า "ภาพรวมงานสรรหา" แบบ iRecruit (แท็บภาพรวมของกล่องงาน · 30 ก.ย. 2569) ═══
 *
 * ใช้ร่วมกันระหว่างเส้น `GET /api/recruit-overview` กับตัวคิดฝั่งหน้าเว็บ (`recruitOverview.ts`)
 * 🔴 ไม่มีชื่อ/เบอร์/ที่อยู่ของผู้สมัคร — ต่อใบมีแต่ข้อเท็จจริงที่ใช้นับ (แพตเทิร์นเดียวกับ `/api/dashboard-trends`)
 * ชื่อเจ้าหน้าที่มีเฉพาะยอดรวมรายคน (เจ้าของอนุญาตบน Dashboard 15 ส.ค. 2569)
 */
import type { CallMicroOutcome } from '@/lib/callMicroOutcome';

export type RecruitSide = 'ai' | 'staff';

export type RecruitAttendance = 'showed' | 'no_show' | 'rescheduled';

/** ข้อเท็จจริงต่อใบสมัคร (ไม่นับ Lead) — นิยามทุกช่องมาจาก `api/_lib/applicantOverviewSql.ts` */
export type RecruitAppFact = {
  /** เวลากรอกใบ (ISO) */
  createdAt: string;
  jobId: string | null;
  /** ช่องทางจากตารางช่องทางของลิงก์ (แม่นกว่า) */
  channelLabel: string | null;
  /** ช่องทางที่ผู้สมัครเลือกเอง (`facebook` · `flyer` …) */
  referralSource: string | null;
  /** ตำแหน่งที่ผู้สมัครพิมพ์เอง (ตัวเดียวกับหัวข้อกรอง "ตำแหน่งที่สนใจ") */
  position: string | null;
  /** เบอร์ใช้กับระบบโทรได้ไหม (`phone_e164`) */
  phoneOk: boolean;
  /** โทรแล้วโดย AI / คน — `CALLED_BY_AI_SQL` / `CALLED_BY_STAFF_SQL` (สองอย่างรวมกัน ≡ `CALLED_SQL`) */
  calledByAi: boolean;
  calledByStaff: boolean;
  /** เวลาได้ผลโทรครั้งแรก ใครโทรก็ได้ — `FIRST_CALLED_AT_SQL` */
  firstCalledAt: string | null;
  /** คำตอบล่าสุดที่ให้ AI (ถังกลาง `classifyCallMicro` คลังคำ "สนใจไหม") + เวลา — ตัวเดียวกับคอลัมน์ "คำตอบกับ AI" */
  aiAnswer: CallMicroOutcome | null;
  aiAnswerAt: string | null;
  /** ผลล่าสุดที่เจ้าหน้าที่ลงเอง (hold) ถังกลาง + เวลา */
  staffAnswer: CallMicroOutcome | null;
  staffAnswerAt: string | null;
  /** เวลาล่าสุดที่เจ้าหน้าที่ลงมือ (ลงผลโทร หรือ บันทึกผลติดต่อ) — `STAFF_LAST_AT_SQL` */
  staffLastAt: string | null;
  /** ผลติดต่อล่าสุด (ศูนย์คุมงานสรรหา) + ใครได้ผลนั้น — `LATEST_CONTACT_LATERAL` */
  contact: 'success' | 'failed' | null;
  contactBy: RecruitSide | null;
  /** บันทึกผลติดต่อล่าสุดของเจ้าหน้าที่ (สำเร็จ/ไม่สำเร็จ + เหตุผล) */
  logOk: boolean | null;
  logReason: string | null;
  logAt: string | null;
  /** วันนัด — `APPOINTMENT_AT_SQL` (มีค่า = นัดได้) */
  appointmentAt: string | null;
  /** ผลมา/ไม่มา ล่าสุด — `LATEST_ATTENDANCE_SQL` */
  attendance: RecruitAttendance | null;
  /** ชื่อขึ้นบอร์ด ERP แล้ว (จับคู่ด้วยเบอร์) — null = อ่านบอร์ดไม่ได้ */
  onBoard: boolean | null;
};

/** ใบที่ปล่อยขึ้นหน้ารวมงาน (วันไทยที่ปล่อย) + ผู้สมัครของใบ (ไม่นับ Lead) — เจ้าของเลือก 30 ก.ย. 2569 ไม่ใช่ Gen link */
export type RecruitRelease = { ymd: string; applicants: number };

/** งานค้างตอนนี้ — สถานะวันนี้ ไม่ขึ้นกับเดือนที่เลือก · อายุนับเป็นวันเต็ม (ครบ 24 ชม. = 1 วัน) */
export type RecruitBacklog = {
  /** ยังไม่มีใครโทร — แยกอายุใบ · ในนั้นรอ AI โทรอยู่ / เบอร์ใช้โทรไม่ได้ */
  uncalled: { total: number; d0_3: number; d4_7: number; over7: number; inQueue: number; badPhone: number };
  /** ตอบ AI ว่าสนใจ แต่ยังไม่มีเจ้าหน้าที่โทรต่อ — อายุนับจากเวลาที่ AI ได้คำตอบ */
  waitingStaff: { total: number; d0: number; d1_3: number; over3: number };
  /** นัดที่รอบันทึกผลมา/ไม่มา — null = ตารางผลนัดยังไม่พร้อม */
  appointments: { overdue: number; next7: number } | null;
};

/** ผลงานรายคนในเดือนที่เลือก (นับรายชื่อไม่ซ้ำต่อคน) */
export type RecruitStaffRow = {
  name: string;
  /** เก็บไปโทรเอง (เวลาเก็บอยู่ในเดือน) */
  claimed: number;
  /** ลงผลโทรหรือบันทึกผลติดต่อ */
  called: number;
  /** ผลที่ติดต่อถึงตัว (บันทึกสำเร็จ / ผลโทรที่คุยถึงตัว) */
  reached: number;
  /** นัดได้ */
  appointed: number;
  /** ในรายชื่อที่คนนี้นัด มีผล "มา" ที่บันทึกในเดือน */
  showed: number;
};

/** แถว AI ของตารางผลงาน — ผลโทรของ AI ที่ได้ในเดือนที่เลือก */
export type RecruitAiRow = { called: number; reached: number; saidYes: number };

export type RecruitOverviewWindow = {
  /** 'YYYY-MM' */
  month: string;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /** เดือนนี้ยังไม่จบ (ปลายช่วง = วันนี้ · เทียบเดือนก่อนถึงวันที่เดียวกัน) */
  isCurrent: boolean;
};

export type RecruitOverviewResponse = {
  version: 1;
  generatedAt: string;
  /** วันนี้ (ไทย) */
  today: string;
  window: RecruitOverviewWindow;
  /** BU ที่ถูกล็อก (ผู้ใช้ผูกแผนก) · null = ทุก BU */
  bu: string | null;
  /** วันแรก (ไทย) ที่มีใบสมัครในขอบเขต — ปุ่มถอยเดือนหยุดที่เดือนนี้ · ช่วงเทียบที่ข้อมูลเริ่มกลางช่วงต้องบอก · null = ยังไม่มีเลย */
  firstDay: string | null;
  /** ข้อเท็จจริงต่อใบของทั้งสองช่วง (เดือนที่เลือก + ช่วงที่เทียบ) */
  apps: RecruitAppFact[] | null;
  releases: RecruitRelease[] | null;
  backlog: RecruitBacklog | null;
  staff: RecruitStaffRow[] | null;
  ai: RecruitAiRow | null;
  /** เคยมีใครบันทึกผลมา/ไม่มาไหม — ยังไม่เคย = ขั้นมาตามนัดขึ้น "—" (ห้ามโชว์ 0 ที่แปลว่ายังไม่เคยบันทึก) */
  attendanceEverRecorded: boolean;
  /** ก้อนที่อ่านไม่ได้ + เหตุ (ก้อนล้มแยกกัน — ห้ามโชว์ 0 แทน) */
  errors: Partial<Record<'apps' | 'releases' | 'backlog' | 'staff' | 'board', string>>;
};
