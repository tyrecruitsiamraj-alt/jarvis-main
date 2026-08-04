import { apiFetch } from '@/lib/apiFetch';

/** รายการ "ต้องติดตาม" 1 คนจากผลโทร AI ที่ยังไม่มีใครรับช่วงต่อ */
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
};

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
    waiting_call: number;
    delivered_waiting: number;
    /** Lumos รับไปแล้วเกิน 2 วันยังไม่มีผลกลับ */
    stale_delivered: number;
    outcomes_month: Record<string, number>;
  };
  proposals: {
    contacted_month: number;
    reserved_active: number;
    placed_month: number;
  };
  /** คำขอโพสหาคนที่ยังเปิดอยู่ — แยกตามประเภท (content = ให้ทีมคิดคอนเทนต์ · scraping = ให้ไปดูดประกาศ) */
  postings: { active: number; content?: number; scraping?: number };
  follow_ups: {
    confirmed_waiting: FlowFollowUpItem[];
    no_answer: FlowFollowUpItem[];
  };
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

/** จำนวนเรื่องที่ต้องมีคนตามต่อทั้งหมด — ใช้โชว์ badge รวม */
export function totalFollowUps(s: FlowSummary): number {
  return (
    s.follow_ups.confirmed_waiting.length +
    s.follow_ups.no_answer.length +
    s.jobs.urgent_stuck +
    (s.lumos.stale_delivered > 0 ? 1 : 0)
  );
}
