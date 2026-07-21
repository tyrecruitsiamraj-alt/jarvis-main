import { apiFetch } from '@/lib/apiFetch';

/** ใบสมัครที่ผู้สมัครกรอกผ่านฟอร์มหน้า /apply */
export type PublicApplication = {
  id: string;
  full_name: string;
  title_prefix?: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  province?: string;
  district?: string;
  subdistrict?: string;
  postal_code?: string;
  job_id?: string;
  job_title?: string;
  unit_name?: string;
  position_interest?: string;
  note?: string;
  status: string;
  created_at: string;
};

export const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่นๆ',
};

/** รายชื่อผู้สมัครของงานหนึ่งใบ (ต้องล็อกอิน) */
export async function fetchJobApplications(jobId: string): Promise<PublicApplication[]> {
  const r = await apiFetch(`/api/job-applications?job_id=${encodeURIComponent(jobId)}`);
  if (!r.ok) throw new Error('โหลดรายชื่อผู้สมัครไม่สำเร็จ');
  const body = (await r.json()) as { items?: PublicApplication[] };
  return Array.isArray(body.items) ? body.items : [];
}

/** จำนวนผู้สมัครต่อ job_id ทั้งบอร์ด (สำหรับ badge) */
export async function fetchJobApplicationCounts(): Promise<Record<string, number>> {
  const r = await apiFetch('/api/job-applications?counts=1');
  if (!r.ok) return {};
  const body = (await r.json()) as { counts?: Record<string, number> };
  return body.counts ?? {};
}
