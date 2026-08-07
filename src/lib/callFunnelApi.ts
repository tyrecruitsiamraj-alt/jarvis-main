import { apiFetch } from '@/lib/apiFetch';
import { readJsonSafe } from '@/lib/api';

/** funnel การโทร + ถัง "ต้องคนตาม" — ดู api/_handlers/lumos-call-funnel.ts */
export type CallFunnel = {
  queued: number;
  delivered: number;
  waiting: number;
  retryScheduled: number;
  withResult: number;
  connected: number;
  unreached: number;
  byOutcome: Record<string, number>;
  needsHuman: number;
  closed: number;
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
  delivered: 0,
  waiting: 0,
  retryScheduled: 0,
  withResult: 0,
  connected: 0,
  unreached: 0,
  byOutcome: {},
  needsHuman: 0,
  closed: 0,
};

/** โหลดพลาด/ยังไม่ migrate = ศูนย์ทั้งชุด ไม่ให้หน้า Follow พัง */
export async function fetchCallFunnel(
  sinceYmd?: string,
): Promise<{ funnel: CallFunnel; needsHuman: NeedsHumanItem[] }> {
  try {
    const qs = sinceYmd ? `?since=${encodeURIComponent(sinceYmd)}` : '';
    const r = await apiFetch(`/api/lumos/call-funnel${qs}`);
    if (!r.ok) return { funnel: EMPTY_FUNNEL, needsHuman: [] };
    const data = await readJsonSafe<{ funnel?: CallFunnel; needsHuman?: NeedsHumanItem[] }>(r);
    return { funnel: data?.funnel ?? EMPTY_FUNNEL, needsHuman: data?.needsHuman ?? [] };
  } catch {
    return { funnel: EMPTY_FUNNEL, needsHuman: [] };
  }
}
