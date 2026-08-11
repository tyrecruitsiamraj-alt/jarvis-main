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

/**
 * ⚠️ ทุกค่าต้องมีคู่ `dark:` ครบ — เดิมไม่มีเลย โหมดมืดชิป "ใหม่" วัด contrast ได้ 2.66
 * (เกณฑ์ 4.5) เจอตอนตรวจหน้า RM 11 ส.ค. 2569 · ใช้ทั้ง dialog บนบอร์ดและหน้า RM
 */
export const APPLICATION_STATUS_CLASS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  contacted: 'bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  converted: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  rejected: 'bg-muted text-muted-foreground dark:bg-slate-800 dark:text-slate-400',
};

export const GENDER_LABEL: Record<string, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่นๆ',
};

/**
 * ใบสมัครทุกงานรวมกัน (ต้องล็อกอิน) — ใช้ที่หน้า "งานสรรหา (RM)"
 * API เดิมรองรับอยู่แล้ว (ไม่ส่ง job_id = ทั้งหมด · จำกัด 500 แถวล่าสุดฝั่ง server
 * และตัดตามสิทธิ์ BU ของผู้ใช้ให้เองแล้ว)
 */
export async function fetchAllJobApplications(): Promise<PublicApplication[]> {
  const r = await apiFetch('/api/job-applications');
  if (!r.ok) throw new Error('โหลดรายชื่อผู้สมัครไม่สำเร็จ');
  const data = (await r.json()) as { items?: PublicApplication[] };
  return data.items ?? [];
}

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
