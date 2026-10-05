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
  /** ติดต่อสำเร็จ แต่นัดหมายไม่สำเร็จ — ต้องมีเหตุผล (master ขั้นนัดหมาย × ไม่สำเร็จ) · ไม่มีวันนัด */
  appointmentFailed?: boolean;
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

/**
 * ประวัติการติดต่อของใบ (ล่าสุดก่อน)
 * 🔴 ล้ม = throw (QA 5 ต.ค. 2569: เดิมคืน [] เงียบ ๆ ⇒ แท็บขึ้น "ยังไม่มีการบันทึกผลติดต่อ" ทั้งที่โหลดไม่ได้)
 * ป๊อปรายละเอียดจับเองแล้วขึ้น "โหลดไม่ได้" ในตาราง (ป๊อปไม่พัง)
 */
export async function fetchContactLogs(applicationId: string): Promise<ContactLog[]> {
  const r = await apiFetch(`/api/application-contacts?applicationId=${encodeURIComponent(applicationId)}`);
  if (!r.ok) throw new Error('โหลดประวัติการติดต่อไม่ได้');
  const data = await readJsonSafe<{ items?: ContactLog[] }>(r);
  return data?.items ?? [];
}
