/** ตัวดึง `/api/value-pipeline` — หน้าความคุ้มค่า 4 แท็บ (19 ต.ค. 2569) */
import { apiFetch } from '@/lib/apiFetch';
import type { ChannelPlacement } from '@/lib/channelPlacement';
import type { StageSla, StuckOwnerRow, ValueOutcome } from '@/lib/valuePipeline';

export type OutcomeResponse = {
  outcome: ValueOutcome;
  /** แจ้งเข้าที่ AI สายสรรหา/จับคู่เคยโทร (ไม่นับสายติดตาม) */
  informedFromAiRecruit: number;
  funnel: {
    names: number;
    aiCalled: number;
    aiYes: number;
    staffOk: number;
    booked: number;
    showed: number | null;
    informed: number | null;
  };
  channels: ChannelPlacement | null;
  inputsSaved: boolean;
};

export type BottleneckResponse = {
  month: string;
  openRequests: number;
  stages: StageSla[];
  owners: StuckOwnerRow[];
  worstJobs: Array<{ jobId: string; label: string; stuck: number; stage: string; owner: string | null }>;
};

export type RequestResponse = {
  job: { id: string; requestNo: string; unit: string; position: string; requested: number | null; status: string; requestDate: string; owner: string | null };
  informed: number;
  applications: number;
  stages: StageSla[];
  links: Array<{ label: string | null; createdAt: string; apps: number }>;
};

export type GapsResponse = {
  month: string;
  linksTotal: number;
  linksWithChannel: number;
  appointmentsDue: number;
  appointmentsNoResult: number;
  appointmentsLikelyCame: number;
  showed: number;
  screened: number;
  applicants: number;
  applicantsInformed: number | null;
  followAdded: number;
  informedTotal: number | null;
  informedUnknownChannel: number | null;
};

async function read<T>(qs: string): Promise<T> {
  const r = await apiFetch(`/api/value-pipeline?${qs}`);
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'โหลดข้อมูลไม่สำเร็จ');
  }
  return (await r.json()) as T;
}

export const fetchValueOutcome = (month: string) => read<OutcomeResponse>(`view=outcome&month=${month}`);
export const fetchValueBottleneck = (month: string) => read<BottleneckResponse>(`view=bottleneck&month=${month}`);
export const fetchValueGaps = (month: string) => read<GapsResponse>(`view=gaps&month=${month}`);
export const fetchValueRequest = (jobId: string) => read<RequestResponse>(`view=request&job=${encodeURIComponent(jobId)}`);
