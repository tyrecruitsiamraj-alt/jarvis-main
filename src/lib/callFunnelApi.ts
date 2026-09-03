import { apiFetch } from '@/lib/apiFetch';
import { readJsonSafe } from '@/lib/api';
import type { CallRateDay } from '@/lib/lumosCallRate';

/** งานโทรฝั่ง "คน" (candidate_call_holds) — คู่กับ AI ในแผงเดียว */
export type HumanCallSummary = {
  total: number;
  holding: number;
  withResult: number;
  toAi: number;
  byOutcome: Record<string, number>;
};

/** funnel การโทร + ถัง "ต้องคนตาม" — ดู api/_handlers/lumos-call-funnel.ts */
export type CallFunnel = {
  /** เข้าคิวทั้งหมด (รวมยกเลิก) */
  queued: number;
  /** ส่ง AI โทรจริง = queued ที่ยังไม่ยกเลิก */
  queuedActive: number;
  delivered: number;
  waiting: number;
  retryScheduled: number;
  /** "ไม่สะดวกคุย รอ AI โทรใหม่" = followup_state='retry_scheduled' */
  retryScheduledState: number;
  withResult: number;
  connected: number;
  unreached: number;
  byOutcome: Record<string, number>;
  needsHuman: number;
  closed: number;
  /**
   * สรุปรายรอบโทร (รอบ 4 ขึ้นไปรวบเข้ารอบ 3)
   * ⚠️ นับตาม **รอบล่าสุดของแต่ละคน** ไม่ใช่ประวัติทุกรอบ — คนหนึ่งอยู่ได้แถวเดียว
   * อ่านว่า "ตอนนี้แต่ละคนอยู่รอบไหน และรอบนั้นผลเป็นยังไง" ไม่ใช่ "รอบนี้โทรไปกี่สาย"
   */
  byAttempt?: {
    attempt: number;
    total: number;
    connected: number;
    unreached: number;
    pending: number;
    cancelled: number;
  }[];
  /** ฝั่ง "คนเก็บไปโทรเอง" — โผล่เฉพาะแผง AI โทร (หน้า Matching) */
  human?: HumanCallSummary;
};

export type NeedsHumanItem = {
  id: number;
  channel: string;
  jobRef: string;
  personRef: string;
  /** ref ผู้สมัครที่ตัด prefix แล้ว — null = รายการติดตามที่คนกรอกเอง (รับไปตามแบบนี้ไม่ได้) */
  candidateRef: string | null;
  source: 'board' | 'irecruit' | null;
  candidateName: string | null;
  phone: string | null;
  lastOutcome: string | null;
  attemptCount: number;
  updatedAt: string;
};

export const EMPTY_FUNNEL: CallFunnel = {
  queued: 0,
  queuedActive: 0,
  delivered: 0,
  waiting: 0,
  retryScheduled: 0,
  retryScheduledState: 0,
  withResult: 0,
  connected: 0,
  unreached: 0,
  byOutcome: {},
  needsHuman: 0,
  closed: 0,
};

/**
 * ต้นทางของงานโทร — 'follow' = ที่ส่งจากหน้า Follow เท่านั้น
 * (หน้า Follow เคยโชว์ยอดทั้งระบบ ทั้งที่หน้านั้นส่งเองแค่ 1 คน)
 */
export type CallFunnelSource = 'all' | 'follow' | 'board' | 'irecruit';

/**
 * ยอดโทรรายวันย้อนหลัง (นับตามวันที่ส่ง โซนไทย) — เส้นเดียวกับ funnel แค่ขอมิติเวลาเพิ่ม
 * ใช้กับแผง "Rate ผลการโทร Lumos" บนแดชบอร์ด
 * ⚠️ โหลดพลาด = คืน null (ให้จอเขียน "อ่านตัวเลขไม่ได้") — **ห้ามคืน [] แล้วดูเหมือนไม่มีสาย**
 */
export async function fetchCallRateSeries(
  days: number,
  source: CallFunnelSource = 'all',
): Promise<CallRateDay[] | null> {
  try {
    const params = new URLSearchParams({ series: 'day', days: String(days) });
    if (source !== 'all') params.set('source', source);
    const r = await apiFetch(`/api/lumos/call-funnel?${params.toString()}`);
    if (!r.ok) return null;
    const data = await readJsonSafe<{ series?: CallRateDay[] }>(r);
    return Array.isArray(data?.series) ? data.series : null;
  } catch {
    return null;
  }
}

/** โหลดพลาด/ยังไม่ migrate = ศูนย์ทั้งชุด ไม่ให้หน้า Follow พัง */
export async function fetchCallFunnel(
  sinceYmd?: string,
  source: CallFunnelSource = 'all',
): Promise<{ funnel: CallFunnel; needsHuman: NeedsHumanItem[] }> {
  try {
    const params = new URLSearchParams();
    if (sinceYmd) params.set('since', sinceYmd);
    if (source !== 'all') params.set('source', source);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const r = await apiFetch(`/api/lumos/call-funnel${qs}`);
    if (!r.ok) return { funnel: EMPTY_FUNNEL, needsHuman: [] };
    const data = await readJsonSafe<{ funnel?: CallFunnel; needsHuman?: NeedsHumanItem[] }>(r);
    return { funnel: data?.funnel ?? EMPTY_FUNNEL, needsHuman: data?.needsHuman ?? [] };
  } catch {
    return { funnel: EMPTY_FUNNEL, needsHuman: [] };
  }
}
