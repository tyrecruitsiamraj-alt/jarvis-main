import { apiFetch } from '@/lib/apiFetch';
import type { PdpaRequestKind, PdpaRequestSource, PdpaRequestStatus } from '@/lib/pdpaRequests';

/** คำขอใช้สิทธิ์ PDPA (18 ต.ค. 2569) — `/api/pdpa-requests` (admin) · `/api/public/privacy-request` (ไม่ต้องล็อกอิน) */
export type PdpaRequestItem = {
  id: string;
  kind: PdpaRequestKind;
  full_name: string;
  phone_e164: string;
  detail: string | null;
  source: PdpaRequestSource;
  status: PdpaRequestStatus;
  created_at: string;
  due_at: string;
  created_by_name: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  done_at: string | null;
  done_by_name: string | null;
  done_note: string | null;
  footprint?: { applications: number; follows: number; calls: number };
};

export type PdpaPersonData = {
  applications: {
    created_at: string;
    full_name: string;
    phone: string;
    age: number | null;
    gender: string | null;
    address: string;
    line_id: string | null;
    job_title: string | null;
    unit_name: string | null;
    source: string;
    status: string;
    has_document: boolean;
  }[];
  follows: { scheduled_at: string; recipient_name: string; topic: string; unit_name: string | null; cancelled: boolean; outcome: string | null }[];
  calls: { created_at: string; channel: string; status: string; outcome: string | null; summary: string | null }[];
};

export type PdpaRequestBody = { kind: PdpaRequestKind; fullName: string; phone: string; detail: string | null };

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

export async function fetchPdpaRequests(): Promise<PdpaRequestItem[]> {
  const r = await apiFetch('/api/pdpa-requests', { cache: 'no-store' });
  if (!r.ok) throw new Error(await readError(r));
  return ((await r.json()) as { items: PdpaRequestItem[] }).items;
}

export async function fetchPdpaPersonData(id: string): Promise<PdpaPersonData> {
  const r = await apiFetch(`/api/pdpa-requests?id=${encodeURIComponent(id)}&data=1`, { cache: 'no-store' });
  if (!r.ok) throw new Error(await readError(r));
  return ((await r.json()) as { data: PdpaPersonData }).data;
}

export async function createPdpaRequestByStaff(body: PdpaRequestBody): Promise<{ item: PdpaRequestItem; stopped: { queue: number; follow: number } | null }> {
  const r = await apiFetch('/api/pdpa-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as { item: PdpaRequestItem; stopped: { queue: number; follow: number } | null };
}

export async function patchPdpaRequest(
  id: string,
  action: 'verify' | 'close' | 'reject' | 'erase',
  note: string | null = null,
): Promise<{ item: PdpaRequestItem; erased: Record<string, number> | null }> {
  const r = await apiFetch('/api/pdpa-requests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, note }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as { item: PdpaRequestItem; erased: Record<string, number> | null };
}

/** ผู้สมัครยื่นเอง — ไม่ต้องล็อกอิน */
export async function submitPublicPdpaRequest(body: PdpaRequestBody): Promise<{ dueAt: string }> {
  const r = await fetch('/api/public/privacy-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as { dueAt: string };
}
