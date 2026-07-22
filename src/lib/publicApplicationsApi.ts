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
  weight_kg?: number;
  height_cm?: number;
  education?: string;
  referral_source?: ApplicationReferralSource;
  document_filename?: string;
  document_mime?: string;
  has_document?: boolean;
  job_id?: string;
  job_title?: string;
  unit_name?: string;
  position_interest?: string;
  note?: string;
  status: ApplicationStatus;
  admin_note?: string;
  created_at: string;
};

export type ApplicationReferralSource = 'facebook' | 'tiktok' | 'instagram' | 'flyer' | 'other';

export const REFERRAL_SOURCES: ApplicationReferralSource[] = [
  'facebook',
  'tiktok',
  'instagram',
  'flyer',
  'other',
];

export const REFERRAL_SOURCE_LABEL: Record<ApplicationReferralSource, string> = {
  facebook: 'Facebook',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  flyer: 'ใบปลิว',
  other: 'อื่นๆ',
};

export const EDUCATION_LEVELS = [
  'ประถม',
  'ม.ต้น',
  'ม.ปลาย/ปวช.',
  'ปวส./อนุปริญญา',
  'ปริญญาตรี',
  'สูงกว่าปริญญาตรี',
  'อื่นๆ',
];

export type ApplicationStatus = 'new' | 'contacted' | 'converted' | 'rejected';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'new',
  'contacted',
  'converted',
  'rejected',
];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'ใหม่',
  contacted: 'ติดต่อแล้ว',
  converted: 'รับเข้าทำงาน',
  rejected: 'ปฏิเสธ',
};

export const APPLICATION_STATUS_CLASS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-700',
  contacted: 'bg-amber-500/15 text-amber-800',
  converted: 'bg-emerald-500/15 text-emerald-700',
  rejected: 'bg-muted text-muted-foreground',
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

/** ดึงไฟล์แนบของใบสมัคร (base64) เพื่อดาวน์โหลด (ต้องล็อกอิน) */
export async function fetchApplicationDocument(
  id: string,
): Promise<{ filename: string; mime: string; dataBase64: string }> {
  const r = await apiFetch(`/api/job-application-document?id=${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error('โหลดไฟล์แนบไม่สำเร็จ');
  return (await r.json()) as { filename: string; mime: string; dataBase64: string };
}

/** อัปเดตสถานะ / โน้ตของทีมงานสำหรับใบสมัคร */
export async function updateJobApplication(
  id: string,
  patch: { status?: ApplicationStatus; admin_note?: string | null },
): Promise<PublicApplication> {
  const r = await apiFetch('/api/job-applications', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...patch }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'อัปเดตสถานะไม่สำเร็จ');
  }
  const body = (await r.json()) as { item: PublicApplication };
  return body.item;
}
