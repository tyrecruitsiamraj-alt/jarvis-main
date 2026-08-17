import { apiFetch } from '@/lib/apiFetch';
import { readJsonSafe } from '@/lib/api';

/**
 * ผลการติดต่อผู้สมัคร (ลิสต์ข้อ 7 · 14 ส.ค. 2569) — client adapter ของ
 * /api/application-contacts · ดู api/_lib/applicationContacts.ts
 */
export type ContactLog = {
  id: string;
  applicationId: string;
  ok: boolean;
  reasonId: string | null;
  reasonLabel: string | null;
  appointmentAt: string | null;
  appointmentPlace: string | null;
  jobId: string | null;
  jobLabel: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type SaveContactInput = {
  applicationId: string;
  ok: boolean;
  /** ฝั่งไม่สำเร็จ — เหตุผลจาก master (บังคับเมื่อ ok=false) */
  reasonId?: string | null;
  reasonLabel?: string | null;
  /** ฝั่งสำเร็จ+นัดได้ — `YYYY-MM-DD` */
  appointmentAt?: string | null;
  appointmentPlace?: string | null;
  /** ใบขอที่จะลง · null/ว่าง = "หาล่วงหน้า" (นัดไว้แต่ยังไม่รู้ลงใบไหน — เจ้าของเคาะ) */
  jobId?: string | null;
  jobLabel?: string | null;
  note?: string | null;
};

export async function saveContactLog(input: SaveContactInput): Promise<ContactLog> {
  const r = await apiFetch('/api/application-contacts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const d = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(d?.message || `บันทึกผลติดต่อไม่สำเร็จ (HTTP ${r.status})`);
  }
  const data = await readJsonSafe<{ item: ContactLog }>(r);
  return (data as { item: ContactLog }).item;
}

/** ประวัติการติดต่อของใบ (ล่าสุดก่อน) — ล้มคืนว่าง ไม่ให้ dialog พัง */
export async function fetchContactLogs(applicationId: string): Promise<ContactLog[]> {
  try {
    const r = await apiFetch(
      `/api/application-contacts?applicationId=${encodeURIComponent(applicationId)}`,
    );
    if (!r.ok) return [];
    const data = await readJsonSafe<{ items?: ContactLog[] }>(r);
    return data?.items ?? [];
  } catch {
    return [];
  }
}
