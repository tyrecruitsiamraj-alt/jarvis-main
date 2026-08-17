import { apiFetch } from '@/lib/apiFetch';

/** 1 คนในลิสต์รายชื่อของหน้าแรก (กล่องผลโทร / รายชื่อที่ส่ง AI โทรค้างอยู่) */
export type FlowFollowUpItem = {
  job_ref: string;
  request_no: string;
  person_ref: string;
  channel: string;
  name: string | null;
  phone: string | null;
  summary: string | null;
  outcome: string | null;
  updated_at: string;
  /** ตำแหน่ง+หน่วยงานของใบขอที่คนนี้ถูกแมทไป */
  job_position: string | null;
  job_unit: string | null;
  /** เฉพาะรายการ "ส่งไปแล้วรอผล": ค้างเกิน 2 วัน = ควรเช็คกับทีม Lumos */
  stale?: boolean;
};

/**
 * 4 กล่องผลโทร (เจ้าของกำหนด 12 ส.ค. 2569) — กดขั้น "ผลจากการโทร" บนหน้าแรกแล้วเห็น
 * ชื่อคนแยกตามปลายทาง · ทิศทางสีชุดเดียวกับ callOutcomeTone:
 * เขียว=สนใจ · เหลือง=รอ AI โทรซ้ำ · ส้ม=ต้องคนเร่งจัดการ · แดง=ไม่สนใจงาน
 */
export type FlowCallBoxes = {
  /** สนใจงาน — ผล confirmed ที่ยังไม่มีใครรับช่วงต่อ (จอง/ติดต่อ) */
  confirmed: FlowFollowUpItem[];
  /** ไม่สะดวก — ระบบนัดให้ AI โทรซ้ำแล้ว (followup_state = retry_scheduled) */
  retry: FlowFollowUpItem[];
  /** ไม่สะดวก/ครบเพดาน — ต้องคนเร่งจัดการ (followup_state = needs_human) */
  needs_human: FlowFollowUpItem[];
  /** ไม่สนใจงาน — เดือนนี้ (ไม่มีงานต้องทำต่อ แค่รู้ไว้) */
  declined: FlowFollowUpItem[];
};

/** สถานะคำขอโพสหาคน — ป้ายภาษาไทยใช้ JOB_POSTING_STATUS_LABEL ชุดเดียวกับหน้าคำขอโพส */
export type PostingStages = { pending: number; in_progress: number; posted: number };

export type FlowSummary = {
  month: string;
  jobs: {
    open_total: number;
    urgent: number;
    analyzed: number;
    with_recommend: number;
    /** ใบด่วนที่ AI ไม่พบคนแนะนำ และยังไม่ส่งโพสหาคนใหม่ */
    urgent_stuck: number;
  };
  lumos: {
    sent_month: number;
    /** ส่งไปกี่ "คน" (distinct เบอร์) — sent_month นับแถว = คน × ใบขอ ซึ่งมากกว่ามาก */
    sent_month_people?: number;
    waiting_call: number;
    delivered_waiting: number;
    /** Lumos รับไปแล้วเกิน 2 วันยังไม่มีผลกลับ */
    stale_delivered: number;
    /** ค้างในคิวเกิน 2 วันโดยยังไม่ถูกหยิบไปโทรเลย */
    stale_pending?: number;
    /** ตั้งโทรซ้ำไว้ รอถึงเวลานัด */
    retry_scheduled?: number;
    /** จำนวนสายที่โทรออกจริงเดือนนี้ (รวมโทรซ้ำ) */
    attempts_month?: number;
    /** ผลกลับล่าสุดที่ Lumos ส่งเข้ามา (ISO) — ตอบคำถาม "เขาส่งผลมาไหม" */
    last_result_at?: string | null;
    /** เข้าคิวล่าสุดเมื่อไหร่ (ISO) — คู่กับตัวบนเพื่อแยก "ไม่มีงาน" ออกจาก "สายไม่เดิน" */
    last_sent_at?: string | null;
    outcomes_month: Record<string, number>;
  };
  proposals: {
    contacted_month: number;
    reserved_active: number;
    placed_month: number;
  };
  /** คำขอโพสหาคนที่ยังเปิดอยู่ — แยกตามประเภท (content = ให้ทีมคิดคอนเทนต์ · scraping = ให้ไปดูดประกาศ) */
  postings: {
    active: number;
    content?: number;
    scraping?: number;
    /** ไปถึงขั้นไหนแล้ว (เจ้าของสั่ง 13 ส.ค. 2569) — นับเป็นรายคำขอ */
    content_stages?: PostingStages;
    scraping_stages?: PostingStages;
  };
  call_boxes: FlowCallBoxes;
  /** รายชื่อที่ส่ง AI โทรแล้วยังไม่มีผลกลับ — แถวที่ค้างเกิน 2 วันติดธง stale */
  active_calls: FlowFollowUpItem[];
};

export async function fetchFlowSummary(): Promise<FlowSummary> {
  const r = await apiFetch('/api/matching/flow-summary');
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดสรุปการไหลของงานไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as FlowSummary;
}

/** ✅สนใจ เดือนนี้ (นับจาก outcome ของ Lumos) */
export function confirmedThisMonth(s: FlowSummary): number {
  return s.lumos.outcomes_month['confirmed'] ?? 0;
}

/** ผลโทรที่กลับมาเดือนนี้รวมทุกแบบ — เลขใหญ่ของขั้น "ผลจากการโทร" บนหน้าหลัก */
export function callResultsThisMonth(s: FlowSummary): number {
  return Object.values(s.lumos.outcomes_month).reduce((sum, n) => sum + (n || 0), 0);
}

