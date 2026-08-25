import { apiFetch } from './apiFetch';

/**
 * ตัวเลข Dashboard ศูนย์คุมงานสรรหา — GET /api/recruit-rm-overview (S5 · 15 ส.ค. 2569)
 * นิยามทุกช่องอยู่ฝั่ง server (applicantOverviewSql.ts) · null = อ่านไม่ได้ (≠ 0)
 */
export type RecruitRmOverview = {
  version: number;
  scope: { departmentLimited: boolean };
  /** เส้นแบ่งสรรหา→คัดสรร · collected/waitingCollect = -1 เมื่ออ่านบอร์ด ERP ไม่ได้ */
  recruit: { interested: number; collected: number; waitingCollect: number } | null;
  intake: { total: number; distinctPhones: number; leads: number; invalidPhone: number };
  calling: {
    called: number;
    calledViaOtherChannel: number;
    inQueueAwaitingAi: number;
    heldOrClaimed: number;
    untouched: number;
  };
  contact: { success: number; failed: number };
  appointment: { scheduled: number; successNoAppointment: number };
  attendance: { showed: number; noShow: number; overdueNoResult: number; upcoming: number } | null;
  waiting: { medianHours: number | null; p90Hours: number | null; sampleSize: number } | null;
  stale: {
    over5DaysUncalled: number;
    agingUncalled: { d0_3: number; d4_7: number; over7: number };
    claimedIdle: {
      total: number;
      byUser: Array<{ name: string | null; count: number; oldestClaimedAt: string }>;
    };
    /**
     * กอง "รอเลือกวิธีโทร" (104 · Phase 5.9) — ใบที่ worker ถอด claim แล้วยังไม่มีใครเลือก
     * `null` = ฐานยังไม่รัน migration (ไม่ใช่ 0 — 0 ที่แปลว่าเช็คไม่ได้อันตรายกว่า)
     */
    awaitingCallChoice: { total: number; oldestUnclaimedAt: string | null } | null;
  };
  meta: {
    generatedAt: string;
    definitionsVersion: number;
    flags: Array<{ metric: string; flag: string; note: string }>;
  };
};

/**
 * ป้ายของถัง drill-down (`?bucket=`) — คีย์ต้องตรงกับ OVERVIEW_BUCKETS ฝั่ง server
 * (นิยามอยู่ที่ applicantOverviewSql.ts — ที่นี่เก็บแค่คำบนจอ)
 */
export const RM_BUCKET_LABEL: Record<string, string> = {
  bad_phone: 'เบอร์โทรผิด (ใช้กับระบบโทรไม่ได้)',
  called: 'โทรแล้ว',
  in_queue: 'อยู่ในคิว AI รอผล',
  held: 'มีคนถือ/เก็บอยู่ ยังไม่โทร',
  untouched: 'ยังไม่ถูกโทร',
  contact_success: 'ติดต่อสำเร็จ (รวมคนที่คุยแล้วปฏิเสธ)',
  contact_failed: 'ติดต่อไม่สำเร็จ',
  scheduled: 'ติดต่อสำเร็จ · นัดได้',
  success_unscheduled: 'ติดต่อสำเร็จ · ยังนัดไม่ได้',
  over5d: 'เกิน 5 วันยังไม่ถูกโทร',
  claimed_idle: 'เก็บไปแล้วยังไม่โทร (เกิน 1 วัน)',
  awaiting_call_choice: 'รอเลือกวิธีโทร (ถูกถอดเพราะดองเกิน 1 วัน)',
  overdue_no_result: 'เลยวันนัดแล้วยังไม่บันทึกผล มา/ไม่มา',
};

export function isRmBucket(v: string | null | undefined): v is string {
  return Boolean(v && v in RM_BUCKET_LABEL);
}

export async function fetchRecruitRmOverview(): Promise<RecruitRmOverview> {
  const r = await apiFetch('/api/recruit-rm-overview');
  if (!r.ok) throw new Error(`overview ${r.status}`);
  return (await r.json()) as RecruitRmOverview;
}
