/**
 * ═══ ชนิดข้อมูลของ Dashboard แนวโน้ม (ใช้ร่วม API ↔ หน้าเว็บ) ═══
 *
 * 🔴 **แถวย่อ ไม่มีข้อมูลบุคคลของผู้สมัคร/ผู้รับสาย** (ไม่มีชื่อ · เบอร์ · ที่อยู่) — Dashboard นับอย่างเดียว
 * ชื่อที่มีได้คือ **เจ้าหน้าที่** (ตารางเทียบเจ้าหน้าที่) และชื่อหน่วยงาน/ลูกค้า
 * ⚠️ วันเวลาเป็น ISO เต็มจากฐาน — แบ่งงวดฝั่งหน้าเว็บด้วย `bangkokYmd` (ปฏิทินกรุงเทพ) ที่เดียว
 */

/** รายการติดตาม 1 แถว = คน 1 คน 1 วันที่โทร (หนึ่งแถวของ follow_entries) */
export type FollowTrendRow = {
  id: string;
  /** ลงรายชื่อเมื่อไหร่ */
  createdAt: string | null;
  /** วันที่นัดให้ AI/เจ้าหน้าที่โทร */
  scheduledAt: string | null;
  /** ได้ผลโทรกลับมาเมื่อไหร่ (`coalesce(first_result_at, updated_at)` ของคิว) · null = ยังไม่มีผล */
  resultAt: string | null;
  /** ปิดงานเมื่อไหร่ (ตามจนจบแล้ว) */
  completedAt: string | null;
  /** ยกเลิกการติดตามเมื่อไหร่ (ไม่ต้องโทรแล้ว — คนละเรื่องกับผลปิดงาน "ยกเลิก") */
  cancelledAt: string | null;
  /** ผลปิดงาน (went/arrived/cancelled/leave/postponed + ชุดเก่า) — ตีความด้วย `followOutcome.ts` */
  outcomeCode: string | null;
  /** สถานะในคิว AI · null = ไม่เคยเข้าคิว */
  callStatus: string | null;
  /** ผลโทร (confirmed/acknowledged/no_answer …) — ตีความด้วย `callOutcomeBuckets.ts` */
  callOutcome: string | null;
  attempt: number | null;
  /** สายที่เท่าไหร่ (1 = สายแรก) */
  callRound: number | null;
  callMode: 'ai' | 'manual';
  topic: string | null;
  unitName: string | null;
  siteCode: string | null;
  /** คนคีย์ (users.id) — คีย์เดียวกับคนปล่อยประกาศ ตารางเทียบเจ้าหน้าที่จึงรวมคนเดียวกันได้ */
  staffId: string | null;
  /** ชื่อเล่นจากหน้าผู้ใช้งาน → ชื่อที่บันทึกไว้ตอนคีย์ */
  staffName: string | null;
  /** BU = แผนกของคนคีย์ → รหัสไซต์ (กติกาเดียวกับ /api/home-kpis · เจ้าของเคาะ 15 ก.ย. 2569) */
  bu: string | null;
};

export type TrendCallBucket = 'connected' | 'unreached' | 'cancelled' | 'pending';

/** ใบสมัคร 1 ใบ (public_job_applications) */
export type ApplicantTrendRow = {
  id: string;
  createdAt: string | null;
  /** ช่องทาง (referral_source) */
  channel: string | null;
  /** ตำแหน่งที่สนใจ → ชื่องานของใบขอที่สมัคร */
  position: string | null;
  province: string | null;
  bu: string | null;
  jobId: string | null;
  isLead: boolean;
  /** มีเจ้าหน้าที่เก็บไปโทรเอง */
  claimed: boolean;
  /** ถังผลโทรล่าสุด (นิยามกลาง `bucketOfCall`) · null = ยังไม่เคยโทร */
  callBucket: TrendCallBucket | null;
  callOutcome: string | null;
  /** ได้ผลโทรล่าสุดเมื่อไหร่ */
  callAt: string | null;
  /** วันนัดสัมภาษณ์ (บันทึกผลติดต่อชนะผลโทร — กติกาเดียวกับแท็บติดตามนัดหมาย) */
  appointmentAt: string | null;
  /** ผลติดตามนัดล่าสุด: showed / no_show / rescheduled */
  attendance: string | null;
};

/** การปล่อยประกาศขึ้นหน้าสาธารณะ 1 ครั้ง (job_public_releases) */
export type ReleaseTrendRow = {
  jobId: string;
  requestNo: string | null;
  releasedAt: string;
  staffId: string | null;
  staffName: string | null;
  bu: string | null;
};

/**
 * ใบขอ (ส่วนหนึ่งของใบ) จาก ERP — **หนึ่งใบแตกได้หลายแถวตามชนิด** (หาได้แล้ว · ยกเลิก · เหลือหา)
 * นิยามเดียวกับ `listSiamrajSqlServerThroughput` (ตัวที่ Dashboard ศูนย์ควบคุมใบขอใช้) — ยอดต้องตรงกัน
 */
export type RequestTrendRow = {
  requestNo: string;
  /** งวดของใบ = วันที่ต้องการคน → วันที่กรอก (เจ้าของเคาะ 20 ส.ค. 2569) */
  cohortDate: string;
  /** วันที่กรอกใบจริง (ไว้คิด "ใช้กี่วันจากขอถึงปล่อย") */
  submittedDate: string | null;
  /** วันปิด/ยกเลิก (stop_date → cancel_date) · null = ยังเปิด */
  closureDate: string | null;
  kind: 'filled' | 'cancelled' | 'remaining';
  positions: number;
  departmentCode: string | null;
  siteCode: string | null;
  unitName: string | null;
  lifecycleKind: string | null;
  leadKind: string | null;
};

/** ใบแจ้งเข้า (หาได้แล้ว) รวมต่อใบขอต่อวัน — จาก `st_inform_head.inform_date` ที่ยังไม่ถูกยกเลิก */
export type InformTrendRow = {
  requestNo: string;
  /** วันที่แจ้งเข้า (YYYY-MM-DD) */
  day: string;
  count: number;
  departmentCode: string | null;
};

export type TrendDataSource = 'snapshot' | 'fresh' | 'stale';

export type RequestTrendPayload = {
  range: { from: string; to: string };
  requests: RequestTrendRow[];
  informs: InformTrendRow[];
  /** ข้อมูลชุดนี้ดึงจาก ERP เมื่อไหร่ (สำเนาฝั่งเรา) */
  fetchedAt: string;
  ageSeconds: number;
  source: TrendDataSource;
};

export type DashboardTrendSection = 'follow' | 'applicants' | 'releases' | 'requests';
