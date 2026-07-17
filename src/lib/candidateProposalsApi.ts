import { apiFetch } from '@/lib/apiFetch';

/** การเสนอ/จองตัว/ลงงานผู้สมัคร (board/iRecruit) ต่อใบขอ — client helper */
export type ProposalSource = 'board' | 'irecruit';
export type ProposalTier = 'green' | 'yellow' | 'red';
export type ProposalStatus =
  | 'proposed'
  | 'reserved'
  | 'contacted'
  | 'placed'
  | 'rejected'
  | 'cancelled';

export type CandidateProposal = {
  id: string;
  job_id: string;
  request_no: string | null;
  source: ProposalSource;
  candidate_ref: string;
  candidate_name: string | null;
  candidate_phone: string | null;
  candidate_position: string | null;
  tier: ProposalTier | null;
  reason: string | null;
  status: ProposalStatus;
  proposed_by_user_id: string | null;
  proposed_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveProposalInput = {
  jobId: string;
  requestNo?: string | null;
  source: ProposalSource;
  candidateRef: string | number;
  candidateName?: string | null;
  candidatePhone?: string | null;
  candidatePosition?: string | null;
  tier?: string | null;
  reason?: string | null;
  operatorName?: string | null;
  status?: ProposalStatus;
};

/** คีย์ระบุผู้สมัครไม่ซ้ำข้ามแหล่ง (board/irecruit) */
export function proposalKey(source: ProposalSource, ref: string | number): string {
  return `${source}#${ref}`;
}

const STATUS_LABEL: Record<ProposalStatus, string> = {
  proposed: 'เสนอแล้ว',
  reserved: 'จองตัวแล้ว',
  contacted: 'ติดต่อแล้ว',
  placed: 'ลงงานแล้ว',
  rejected: 'ไม่ผ่าน',
  cancelled: 'ยกเลิก',
};

export function proposalStatusLabel(status: ProposalStatus): string {
  return STATUS_LABEL[status] ?? status;
}

/** ผู้สมัครถูกจองอยู่กับใบขออื่นแล้ว (409 จาก backend) — ต้องยกเลิกอันเดิมก่อนถึงจะจองใบนี้ได้ */
export type ProposalConflictInfo = Pick<
  CandidateProposal,
  'id' | 'job_id' | 'request_no' | 'status' | 'candidate_name'
>;

export class ProposalConflictError extends Error {
  conflict: ProposalConflictInfo;
  constructor(message: string, conflict: ProposalConflictInfo) {
    super(message);
    this.name = 'ProposalConflictError';
    this.conflict = conflict;
  }
}

export async function saveProposal(input: SaveProposalInput): Promise<CandidateProposal> {
  const r = await apiFetch('/api/matching/proposals', {
    method: 'POST',
    body: JSON.stringify({
      job_id: input.jobId,
      request_no: input.requestNo ?? null,
      source: input.source,
      candidate_ref: String(input.candidateRef),
      candidate_name: input.candidateName ?? null,
      candidate_phone: input.candidatePhone ?? null,
      candidate_position: input.candidatePosition ?? null,
      tier: input.tier ?? null,
      reason: input.reason ?? null,
      proposed_by_name: input.operatorName ?? null,
      status: input.status ?? 'reserved',
    }),
  });
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      conflict?: ProposalConflictInfo;
    };
    if (r.status === 409 && d.conflict) {
      throw new ProposalConflictError(d.message || 'ผู้สมัครนี้ถูกจองอยู่กับใบขออื่นแล้ว', d.conflict);
    }
    throw new Error(d.message || d.error || `บันทึกการเสนอไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as CandidateProposal;
}

export async function listProposalsForJob(jobId: string): Promise<CandidateProposal[]> {
  const r = await apiFetch(`/api/matching/proposals?jobId=${encodeURIComponent(jobId)}`);
  if (!r.ok) return [];
  const d = (await r.json().catch(() => ({}))) as { items?: CandidateProposal[] };
  return d.items ?? [];
}

/** ประวัติการเสนอของหลายใบขอ — ใช้ทำสรุปความคืบหน้าบนหน้ารวม */
export async function listProposalsForJobs(jobIds: string[]): Promise<Record<string, CandidateProposal[]>> {
  const ids = [...new Set(jobIds.map((id) => id.trim()).filter(Boolean))];
  const byJob: Record<string, CandidateProposal[]> = {};
  // จำกัด URL แต่ละรอบและสอดคล้องกับเพดาน endpoint ฝั่ง server
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const r = await apiFetch(`/api/matching/proposals?jobIds=${encodeURIComponent(chunk.join(','))}`);
    if (!r.ok) continue;
    const d = (await r.json().catch(() => ({}))) as { byJob?: Record<string, CandidateProposal[]> };
    Object.assign(byJob, d.byJob ?? {});
  }
  return byJob;
}

/** ทุกคนที่กำลังจอง/ติดต่อ/ลงงานอยู่ (ข้ามทุกใบขอ) — สำหรับหน้า "รายชื่อคนจอง" */
export async function listActiveProposals(): Promise<CandidateProposal[]> {
  const r = await apiFetch('/api/matching/proposals?active=1');
  if (!r.ok) return [];
  const d = (await r.json().catch(() => ({}))) as { items?: CandidateProposal[] };
  return d.items ?? [];
}

export async function cancelProposal(
  id: string,
  input?: { reason?: string | null; operatorName?: string | null },
): Promise<CandidateProposal> {
  const r = await apiFetch(`/api/matching/proposals?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'cancelled',
      reason: input?.reason,
      proposed_by_name: input?.operatorName,
    }),
  });
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(d.message || d.error || `ยกเลิกไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as CandidateProposal;
}
