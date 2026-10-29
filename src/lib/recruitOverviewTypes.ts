/**
 * ═══ รูปข้อมูลของหน้า "ภาพรวมงานสรรหา" แบบ iRecruit (แท็บภาพรวมของกล่องงาน · 30 ก.ย. 2569) ═══
 *
 * ใช้ร่วมกันระหว่างเส้น `GET /api/recruit-overview` กับตัวคิดฝั่งหน้าเว็บ (`recruitOverview.ts`)
 * 🔴 ไม่มีชื่อ/เบอร์/ที่อยู่ของผู้สมัคร — ต่อใบมีแต่ข้อเท็จจริงที่ใช้นับ (แพตเทิร์นเดียวกับ `/api/dashboard-trends`)
 * ชื่อเจ้าหน้าที่มีเฉพาะยอดรวมรายคน (เจ้าของอนุญาตบน Dashboard 15 ส.ค. 2569)
 */
import type { RegionCount } from '@/lib/bkkRegion';
import type { CallMicroOutcome } from '@/lib/callMicroOutcome';

export type RecruitSide = 'ai' | 'staff';

export type RecruitAttendance = 'showed' | 'no_show' | 'rescheduled';

/** ข้อเท็จจริงต่อใบสมัคร (ไม่นับ Lead) — นิยามทุกช่องมาจาก `api/_lib/applicantOverviewSql.ts` */
export type RecruitAppFact = {
  /** id ใบ (ไม่ใช่ชื่อ/เบอร์) — ใช้เปิดรายชื่อตอนกดเลข (18 ต.ค. 2569) */
  id?: string;
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
  /** อยู่ในคิว AI รอโทร (ยังไม่มีผล) — `IN_QUEUE_SQL` (18 ต.ค. 2569 Journey) */
  aiQueued?: boolean;
  /** บันทึกติดต่อสำเร็จแต่นัดไม่ได้ (ok + เหตุผล + ไม่มีวันนัด) */
  appointmentFailed?: boolean;
  /** ผ่าน/ไม่ผ่าน หลังมาตามนัด (151) */
  screening?: 'passed' | 'not_passed' | null;
  /** อายุ 58 ปีขึ้นไป — ระบบไม่ส่งให้ AI (`isOverAge` · 19 ต.ค. 2569) */
  overAge?: boolean;
  /** คำตอบกับ AI บอกว่าอยู่ไกล/เดินทางไม่สะดวก (`isOutOfAreaAnswer` · เจ้าของ 19 ต.ค. 2569 "AI ตอนถามที่อยู่") */
  aiOutOfArea?: boolean;
  /** เบอร์นี้มีใบแจ้งเข้า ERP ที่ไม่ยกเลิกตั้งแต่วันกรอกใบ (19 ต.ค. 2569 "จับได้ถึงแจ้งเข้า") · null = อ่าน ERP ไม่ได้ */
  informed?: boolean | null;
  /** ใบที่ดึงจาก iRecruit: ช่องทางที่ลงทะเบียนใน iRecruit (`mainChannelOf`) · null = หาไม่เจอ/ไม่ใช่ใบ iRecruit */
  sourceChannel?: string | null;
  /** ชื่อกลุ่ม/เพจย่อยที่ลงทะเบียนใน iRecruit (Facebook กลุ่มไหน) · null = ไม่รู้ (25 ต.ค. 2569) */
  sourceSub?: string | null;
  /** วันแรกที่เบอร์นี้เป็นผู้สมัครใน iRecruit ตั้งแต่วันกรอก (YYYY-MM-DD · 20 ต.ค. 2569) · null = ไม่เจอ · undefined = อ่านไม่ได้ */
  irecruitAt?: string | null;
  /** วันแจ้งเข้า ERP แรกตั้งแต่วันกรอก (YYYY-MM-DD) · null = ไม่เจอ · undefined = อ่านไม่ได้ */
  informedAt?: string | null;
};

/**
 * ใบขอที่เข้ามาในช่วง (เจ้าของ 19 ต.ค. 2569 ภาพรวมข้อ 1) — ฐานเดียวกับ "ใบขอเข้ามา · ประกาศแล้ว" ของหน้าหลัก
 * (`loadOnlineRequestRows`) · ไม่กรองตามวันในสัปดาห์
 */
export type RecruitRequestSummary = {
  total: number;
  released: number;
  notReleased: number;
  /** ยังไม่ประกาศ แยกใบยังเปิด / ปิดไปแล้ว (27 ต.ค. 2569 · ตัวแบ่ง `onlineRequestStateOf`) — รวมกัน = notReleased */
  notReleasedOpen: number;
  notReleasedClosed: number;
  /** ประกาศแล้วมีคนสมัคร (นับใบสมัครที่ไม่ได้ยกเลิกข้อมูล ทุกช่วงเวลา) */
  releasedWithApps: number;
  releasedNoApps: number;
  /** คนที่กรอกมาในใบที่ประกาศแล้วมีคนสมัคร */
  appsOnReleased: number;
};

/** ใบขอรายใบของช่วงนี้ (21 ต.ค. 2569 — การ์ดกดลงลึก "ใบขอ → ประกาศ → มีคนกรอก → รายชื่อ") */
export type RecruitRequestItem = {
  jobId: string | null;
  requestNo: string;
  unitName: string | null;
  position: string | null;
  day: string;
  released: boolean;
  /** ใบยังเปิด (`onlineRequestStateOf` = open · ตัวเดียวกับทีม Online) — จบแล้ว = ไม่โชว์ในรายการ "ยังไม่ประกาศ" */
  open: boolean;
  /** ใบสมัครของใบนี้ (ไม่นับที่ยกเลิกข้อมูล · ทุกช่วงเวลา) */
  applications: number;
  /** id ใบสมัคร — กดดูรายชื่อ */
  appIds: string[];
};

/** ใบขอของวันหนึ่ง (21 ต.ค. 2569 — กราฟรายวัน) */
export type RecruitRequestDay = {
  day: string;
  total: number;
  released: number;
  releasedWithApps: number;
  releasedNoApps: number;
  notReleasedOpen: number;
  notReleasedClosed: number;
};

/** งานค้างตอนนี้ — สถานะวันนี้ ไม่ขึ้นกับเดือนที่เลือก · อายุนับเป็นวันเต็ม (ครบ 24 ชม. = 1 วัน) */
export type RecruitBacklog = {
  /** ยังไม่มีใครโทร — แยกอายุใบ · ในนั้นรอ AI โทรอยู่ / เบอร์ใช้โทรไม่ได้ */
  uncalled: { total: number; d0_3: number; d4_7: number; over7: number; inQueue: number; badPhone: number };
  /** ตอบ AI ว่าสนใจ แต่ยังไม่มีเจ้าหน้าที่โทรต่อ — อายุนับจากเวลาที่ AI ได้คำตอบ */
  waitingStaff: { total: number; d0: number; d1_3: number; over3: number };
  /** นัดที่รอบันทึกผลมา/ไม่มา — null = ตารางผลนัดยังไม่พร้อม */
  appointments: { overdue: number; next7: number } | null;
  /** แยกกรุงเทพ+ปริมณฑล / ต่างจังหวัด / ไม่ระบุ ตามจังหวัดของงาน (28 ต.ค. 2569) · ไม่มี = เวอร์ชันเก่า */
  regions?: { uncalled: RegionCount; waitingStaff: RegionCount; appointments: RegionCount | null };
  /** แยกพื้นที่ต่อแถวอายุ (28 ต.ค. 2569 "ตอบ AI ไม่ถึง 1 วัน 36 เป็นกรุงเทพเท่าไหร่ ต่างจังหวัดเท่าไหร่") — แต่ละแถว 3 ช่องรวม = เลขของแถว */
  regionRows?: {
    uncalled: Record<'d0_3' | 'd4_7' | 'over7', RegionCount>;
    waitingStaff: Record<'d0' | 'd1_3' | 'over3', RegionCount>;
    appointments: Record<'overdue' | 'next7', RegionCount> | null;
  };
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
  /** เดือนนี้ยังไม่จบ (ปลายช่วง = วันนี้ · เทียบเดือนก่อนถึงวันที่เดียวกัน) · แบบช่วง = ปลายช่วงคือวันนี้ */
  isCurrent: boolean;
  /** ช่วงที่เลือกเอง (รายวัน/ช่วง · 5 ต.ค. 2569) — เทียบช่วงยาวเท่ากันก่อนหน้า · ไม่มี = แบบเดือน */
  range?: boolean;
  /** ปุ่ม "ทั้งหมด" (29 ต.ค. 2569) — วันแรกที่มีข้อมูลถึงวันนี้ · ไม่เทียบช่วงก่อน */
  all?: boolean;
};

export type RecruitOverviewResponse = {
  version: 1;
  generatedAt: string;
  /** วันนี้ (ไทย) */
  today: string;
  window: RecruitOverviewWindow;
  /** BU ที่ถูกล็อก (ผู้ใช้ผูกแผนก) · null = ทุก BU */
  bu: string | null;
  /** ผู้ใช้หลาย BU: BU ที่สลับดูได้ (26 ต.ค. 2569) */
  buChoices?: string[] | null;
  /** วันแรก (ไทย) ที่มีใบสมัครในขอบเขต — ปุ่มถอยเดือนหยุดที่เดือนนี้ · ช่วงเทียบที่ข้อมูลเริ่มกลางช่วงต้องบอก · null = ยังไม่มีเลย */
  firstDay: string | null;
  /** ข้อเท็จจริงต่อใบของทั้งสองช่วง (เดือนที่เลือก + ช่วงที่เทียบ) */
  apps: RecruitAppFact[] | null;
  backlog: RecruitBacklog | null;
  staff: RecruitStaffRow[] | null;
  ai: RecruitAiRow | null;
  /** เคยมีใครบันทึกผลมา/ไม่มาไหม — ยังไม่เคย = ขั้นมาตามนัดขึ้น "—" (ห้ามโชว์ 0 ที่แปลว่ายังไม่เคยบันทึก) */
  attendanceEverRecorded: boolean;
  /** ช่องทางที่ได้คนลงงาน (19 ต.ค. 2569) · null = อ่านไม่ได้ (ดู errors.channels) */
  channelPlacement?: import('@/lib/channelPlacement').ChannelPlacement | null;
  /** ใบขอที่เข้ามาในช่วง · null = อ่านไม่ได้ (ดู errors.requests) · ไม่มี = เส้นรุ่นเก่า */
  requests?: RecruitRequestSummary | null;
  /** ใบขอของช่วงก่อน (prevFrom–prevTo) — กราฟเทียบเดือนก่อน (21 ต.ค. 2569) · null = อ่านไม่ได้ */
  requestsPrev?: RecruitRequestSummary | null;
  /** ใบขอรายวัน prevFrom–to (วันที่ใบเข้ามา) — กราฟรายวันของแท็บใบขอ · null = อ่านไม่ได้ */
  requestDays?: RecruitRequestDay[] | null;
  /** ใบขอของช่วงนี้รายใบ + ผู้สมัครของใบ — การ์ดกดลงลึก (21 ต.ค. 2569) · null = อ่านไม่ได้ */
  requestList?: RecruitRequestItem[] | null;
  /** ก้อนที่อ่านไม่ได้ + เหตุ (ก้อนล้มแยกกัน — ห้ามโชว์ 0 แทน) */
  errors: Partial<Record<'apps' | 'backlog' | 'staff' | 'board' | 'requests' | 'channels' | 'informs', string>>;
};
