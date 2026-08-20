import { apiFetch } from '@/lib/apiFetch';
import type { PrepChecklist, SelectionStatus } from '@/lib/selectionProgress';

/** ใบสมัครที่ผู้สมัครกรอกผ่านฟอร์มหน้า /apply */
export type PublicApplication = {
  id: string;
  full_name: string;
  /**
   * ผลโทรล่าสุดของเบอร์นี้ (รวมทั้งที่ AI โทรและที่คนโทรเอง) — server แนบมาให้
   * ใช้ทำแท็บ "รายชื่อที่สนใจ" ในกล่องงาน · ไม่มีค่า = ยังไม่เคยมีผลโทร
   */
  last_call_outcome?: string | null;
  last_call_at?: string | null;
  /**
   * เวลาที่ **เจ้าหน้าที่กดโทร** (095) — คนละอันกับ `last_call_at` ข้างบน
   * (อันนั้นคือเวลาที่ได้ **ผล** โทร จากคิว AI หรือถังคนโทร)
   * อันนี้มีตั้งแต่ยกหูครั้งแรก แม้โทรไม่ติดก็ยังมีร่องรอย
   */
  dialed_first_at?: string | null;
  dialed_last_at?: string | null;
  dial_count?: number;
  /**
   * วันนัดสัมภาษณ์ที่ตกลงได้ตอนโทร (ISO) — server แนบมาให้จากแถวผลโทร (migration 085)
   * ไม่มีค่า = ยังไม่มีนัด (ยังไม่โทร · โทรแล้วแต่ยังนัดไม่ได้ · หรือผลอื่น)
   */
  appointment_at?: string | null;
  /** สถานที่นัด + ใบขอที่จะลง — มีเฉพาะนัดจากบันทึกผลติดต่อ (migration 086) */
  appointment_place?: string | null;
  appointment_job?: string | null;
  /** ผลติดตามนัดล่าสุด (migration 089) — 'showed' | 'no_show' | 'rescheduled' */
  attendance_result?: string | null;
  attendance_at?: string | null;
  /**
   * ชื่อขึ้นถังบนบอร์ด ERP แล้ว = "ได้ใบสมัครแล้ว" (16 ส.ค. · จับคู่ด้วยเบอร์)
   * true = ออกจากคิวสรรหา (เป็นงานคัดสรรต่อ) · undefined = server เก่า/ERP อ่านไม่ได้
   */
  on_board?: boolean;
  title_prefix?: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  /**
   * เบอร์ใช้กับระบบโทรได้ไหม (แปลง E.164 ได้ — migration 087) · false = ส่ง AI โทร/
   * เก็บไปโทร/จับผลโทรไม่ได้ ต้องแก้เบอร์ก่อน (ชิป "เบอร์ใช้โทรไม่ได้")
   * undefined = server รุ่นเก่ายังไม่ส่งมา — อย่าเดาว่าผิด
   */
  phone_callable?: boolean;
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
  /** ช่องที่ระบบเดิม (RM) เก็บ — เติมมาที่ migration 074 · ใบเก่าเป็น undefined */
  line_id?: string;
  specific_type?: string;
  responsible_name?: string;
  /** ช่องทางจาก master recruit_channels — แม่นกว่า referral_source ที่ผู้สมัครเลือกเอง */
  channel_label?: string;
  license_types?: string[];
  /** เจ้าหน้าที่ที่คีย์ใบนี้ — undefined = ผู้สมัครกรอกเองผ่านลิงก์ */
  created_by_name?: string;
  /**
   * ที่มาของคนนี้ — 'self_apply' สมัครเอง · 'ai_found' AI หาให้ · 'staff_added' คีย์เอง
   * undefined = server/schema เก่ายังไม่ส่ง (ไม่ใช่ "สมัครเอง")
   */
  origin?: ApplicationOrigin;
  /**
   * ขั้นในกระบวนการจ้าง (094) — **คนละตัวกับ `status`** ซึ่งเป็นขั้นที่คนทำกับใบ
   * undefined = ยังไม่ตั้งขั้น (ไม่ใช่ขั้นแรก)
   */
  selection_status?: SelectionStatus;
  /** เช็คลิสต์เตรียมเข้างาน — คีย์ที่ไม่มี = ยังไม่ติ๊ก */
  prep_checklist?: PrepChecklist;
  created_at: string;
  /** "เก็บไปติดต่อ" (13 ส.ค. 2569) — claimed = มีคนเก็บแล้ว · claimed_by_me = ของฉัน
   * ชื่อคนเก็บ server ส่งมาเฉพาะของตัวเอง (คนอื่นไม่เห็นชื่อ — เจ้าของสั่ง) */
  claimed?: boolean;
  claimed_by_me?: boolean;
  claimed_by_name?: string;
  /**
   * "เก็บ Lead" (migration 083) — ปัดใบออกจากรายชื่อทำงานไปคลังสำรอง
   * ⚠️ ต่างจาก claim: เป็นสถานะ **ระดับระบบ** ใครปัดก็หายจากลิสต์ของทุกคน
   * ชื่อคนปัดจึงส่งให้ทุกคนเห็นได้ (claim ส่งเฉพาะของตัวเอง)
   */
  is_lead?: boolean;
  lead_by_name?: string;
  lead_at?: string;
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

/**
 * "คนนี้มาจากไหน" (เจ้าของสั่ง 16 ส.ค. 2569: *"แยกให้หน่อยว่าอันไหนมาจากการสมัครใหม่
 * อันไหนมาจาก AI หาให้"*) — server คิดให้ (ดู api/_lib/applicationOriginSql.ts)
 * `undefined` = ยังไม่รู้ (server/schema เก่า) — **ห้ามเดาว่าสมัครเอง**
 */
export type ApplicationOrigin = 'self_apply' | 'ai_found' | 'staff_added';

export const APPLICATION_ORIGIN_LABEL: Record<ApplicationOrigin, string> = {
  self_apply: 'สมัครใหม่',
  ai_found: 'AI หาให้',
  staff_added: 'เจ้าหน้าที่คีย์',
};

/** คำอธิบายยาว — ใช้เป็น title ของชิป (บอกว่าทำไมคนนี้มาอยู่ตรงนี้) */
export const APPLICATION_ORIGIN_HINT: Record<ApplicationOrigin, string> = {
  self_apply: 'ผู้สมัครกรอกใบสมัครเข้ามาเอง ผ่านลิงก์ประกาศ/หน้าสมัครสาธารณะ',
  ai_found: 'AI ไปหามาจากฐาน (iRecruit/บอร์ด) แล้วโทรตามก่อน จึงได้ใบสมัครนี้',
  staff_added: 'เจ้าหน้าที่คีย์เข้าระบบเอง (เช่น โทรเข้ามาสมัครทางโทรศัพท์)',
};

/** ⚠️ ทุกค่าต้องมีคู่ `dark:` ครบ (กติกาเดียวกับชิปสถานะ) */
export const APPLICATION_ORIGIN_CLASS: Record<ApplicationOrigin, string> = {
  self_apply: 'bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  ai_found: 'bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  staff_added: 'bg-slate-500/15 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300',
};

/**
 * นับคนตามที่มา — คืนครบทุกช่องเสมอ (0 = ไม่มีคนกลุ่มนั้น ซึ่งเป็นคำตอบ ไม่ใช่ช่องว่าง)
 * `unknown` = ใบที่ server ยังไม่บอกที่มา — แยกออกมาให้เห็น ห้ามยัดรวมกับ "สมัครใหม่"
 */
export function countApplicationsByOrigin(
  items: Array<{ origin?: ApplicationOrigin }>,
): Record<ApplicationOrigin | 'unknown', number> {
  const out = { self_apply: 0, ai_found: 0, staff_added: 0, unknown: 0 };
  for (const it of items) {
    if (it.origin && isApplicationOrigin(it.origin)) out[it.origin] += 1;
    else out.unknown += 1;
  }
  return out;
}

/** กรองตามที่มา · 'all' = ไม่กรอง */
export function filterApplicationsByOrigin<T extends { origin?: ApplicationOrigin }>(
  items: T[],
  origin: ApplicationOrigin | 'all',
): T[] {
  if (origin === 'all') return items;
  return items.filter((it) => it.origin === origin);
}

export function isApplicationOrigin(v: unknown): v is ApplicationOrigin {
  return v === 'self_apply' || v === 'ai_found' || v === 'staff_added';
}

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
export async function fetchAllJobApplications(
  /** true = ดู **คลังสำรอง (Lead)** แทนรายชื่อทำงาน (ลิสต์ปกติซ่อน Lead เสมอ) */
  leadView = false,
  /** drill-down จากกล่อง dashboard (`?bucket=` — นิยามที่ applicantOverviewSql ฝั่ง server) */
  bucket?: string | null,
): Promise<PublicApplication[]> {
  const qs = new URLSearchParams();
  if (leadView) qs.set('lead', '1');
  if (bucket) qs.set('bucket', bucket);
  const r = await apiFetch(`/api/job-applications${qs.size > 0 ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error('โหลดรายชื่อผู้สมัครไม่สำเร็จ');
  const data = (await r.json()) as { items?: PublicApplication[] };
  return data.items ?? [];
}

/**
 * เจ้าหน้าที่คีย์ใบสมัครเอง (ฟอร์ม "เพิ่มข้อมูลผู้สมัคร" ของหน้างานสรรหา RM)
 * ⚠️ ลงตารางเดียวกับใบสมัครจากลิงก์ — ดูเหตุผลที่ api/_handlers/job-applications.ts
 */
export async function createApplicationByStaff(input: {
  /** ผูกใบขอ (เปิดฟอร์มจากป๊อป "ดูรายชื่อ" ของใบ) · null = สมัครทั่วไป */
  job_id?: string | null;
  job_title?: string | null;
  unit_name?: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  age: number;
  gender: string;
  line_id?: string | null;
  province?: string | null;
  district?: string | null;
  position_interest?: string | null;
  specific_type?: string | null;
  education?: string | null;
  responsible_name?: string | null;
  channel_id?: string | null;
  channel_label?: string | null;
  license_types?: string[];
}): Promise<PublicApplication> {
  const r = await apiFetch('/api/job-applications', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'บันทึกผู้สมัครไม่สำเร็จ');
  }
  const body = (await r.json()) as { item: PublicApplication };
  return body.item;
}

/**
 * "เก็บ Lead" / "ลบ Lead" — ปัดใบออกจากรายชื่อทำงาน (หายจากทุกแท็บ) หรือเรียกกลับ
 * เจ้าของเคาะ 11–12 ส.ค. 2569: "ตามระบบเดิมเป๊ะ — ปัดออกจากคิว" + มีตัวกรองเรียกคืนดู
 * · 503 = ยังไม่รัน migration 083 · 403 = ใบของแผนกอื่น
 */
export async function setJobApplicationLead(
  id: string,
  lead: boolean,
): Promise<PublicApplication> {
  const r = await apiFetch('/api/job-applications', {
    method: 'PATCH',
    body: JSON.stringify({ id, lead }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || (lead ? 'เก็บ Lead ไม่สำเร็จ' : 'ลบ Lead ไม่สำเร็จ'));
  }
  const body = (await r.json()) as { item: PublicApplication };
  return body.item;
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
  return (await fetchJobApplicantBreakdown()).counts;
}

/** ยอดผู้สมัครต่อใบขอ + แยกตามที่มา (AI หามา / สมัครใหม่ / เจ้าหน้าที่คีย์) */
export type JobApplicantBreakdown = {
  counts: Record<string, number>;
  /** ไม่มีคีย์ของใบไหน = server ยังบอกที่มาไม่ได้ (ห้ามตีความว่าเป็นศูนย์) */
  byOrigin: Record<string, Partial<Record<ApplicationOrigin, number>>>;
  /**
   * ยอด Lead ต่อใบขอ — ใบที่ถูกปัดเข้าคลัง ไม่ถูกนับใน `counts`
   * โชว์เป็นเลขที่สองข้างยอดผู้สมัคร (เจ้าของเคาะ 17 ส.ค. 2569)
   */
  leadCounts: Record<string, number>;
};

export async function fetchJobApplicantBreakdown(): Promise<JobApplicantBreakdown> {
  const r = await apiFetch('/api/job-applications?counts=1');
  if (!r.ok) return { counts: {}, byOrigin: {}, leadCounts: {} };
  const body = (await r.json()) as {
    counts?: Record<string, number>;
    countsByOrigin?: Record<string, Partial<Record<ApplicationOrigin, number>>>;
    leadCounts?: Record<string, number>;
  };
  return {
    counts: body.counts ?? {},
    byOrigin: body.countsByOrigin ?? {},
    leadCounts: body.leadCounts ?? {},
  };
}

/**
 * ข้อความสรุปที่มาไว้แปะบนการ์ดใบขอ — "AI หามา 3 · สมัครใหม่ 5"
 * คืน null เมื่อยังไม่รู้ที่มาเลย (ไม่ขึ้นบรรทัดดีกว่าขึ้นเลขที่เชื่อไม่ได้)
 */
export function applicantOriginSummary(
  byOrigin: Partial<Record<ApplicationOrigin, number>> | undefined,
): string | null {
  if (!byOrigin) return null;
  const parts: string[] = [];
  const ai = byOrigin.ai_found ?? 0;
  const self = byOrigin.self_apply ?? 0;
  const staff = byOrigin.staff_added ?? 0;
  if (ai > 0) parts.push(`AI หามา ${ai}`);
  if (self > 0) parts.push(`สมัครใหม่ ${self}`);
  if (staff > 0) parts.push(`เจ้าหน้าที่คีย์ ${staff}`);
  return parts.length > 0 ? parts.join(' · ') : null;
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

/**
 * บันทึกผลติดตามนัด "มาตามนัด/ไม่มา/เลื่อนนัด" (migration 089) — append-only ล่าสุดชนะ
 * server บังคับ: บันทึกได้ตั้งแต่วันนัด (เวลาไทย) เป็นต้นไป · 503 = ยังไม่รัน 089
 */
export async function recordAppointmentAttendance(input: {
  applicationId: string;
  appointmentAt: string;
  result: 'showed' | 'no_show' | 'rescheduled';
  note?: string | null;
}): Promise<void> {
  const r = await apiFetch('/api/application-attendance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'บันทึกผลนัดไม่สำเร็จ');
  }
}

/**
 * แก้เบอร์โทรของใบสมัคร (ใบที่ติดธง "เบอร์ใช้โทรไม่ได้" — migration 087)
 * server บังคับให้เบอร์ใหม่เป็นมือถือที่แปลง E.164 ได้ (400 ถ้าไม่ผ่าน) + audit ให้
 */
export async function fixApplicationPhone(id: string, phone: string): Promise<PublicApplication> {
  const r = await apiFetch('/api/job-applications', {
    method: 'PATCH',
    body: JSON.stringify({ id, phone }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'แก้เบอร์ไม่สำเร็จ');
  }
  const body = (await r.json()) as { item: PublicApplication };
  return body.item;
}

/**
 * "เก็บไปติดต่อ" / คืน — เก็บแล้วใบไปโผล่แท็บการติดต่อของคนเก็บคนเดียว
 * (เจ้าของสั่ง 13 ส.ค. 2569) · 409 = มีคนอื่นเก็บไปก่อน · 503 = ยังไม่รัน migration 079
 */
export async function claimJobApplication(id: string, claim: boolean): Promise<PublicApplication> {
  const r = await apiFetch('/api/job-applications', {
    method: 'PATCH',
    body: JSON.stringify({ id, claim }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || (claim ? 'เก็บไปติดต่อไม่สำเร็จ' : 'คืนไม่สำเร็จ'));
  }
  const body = (await r.json()) as { item: PublicApplication };
  return body.item;
}

/**
 * "กดโทร" — จดเวลาที่ยกหูโทรออก (095 · เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 5 ของงานสรรหา)
 * กดซ้ำได้: ครั้งแรกเขียน `dialed_first_at` ครั้งเดียวถาวร ครั้งหลังขยับแค่ครั้งล่าสุด
 * 503 = ยังไม่รัน migration 095
 */
export async function markApplicationDialed(id: string): Promise<{
  dialed_first_at: string | null;
  dialed_last_at: string | null;
  dial_count: number;
}> {
  const r = await apiFetch('/api/job-applications', {
    method: 'PATCH',
    body: JSON.stringify({ id, dial: true }),
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'จดเวลาโทรไม่สำเร็จ');
  }
  return (await r.json()) as {
    dialed_first_at: string | null;
    dialed_last_at: string | null;
    dial_count: number;
  };
}

/**
 * บันทึกขั้นในกระบวนการจ้าง / เช็คลิสต์ (094)
 * ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยน — ไม่ส่ง = ไม่แตะของเดิม
 */
export async function saveSelectionProgress(
  id: string,
  patch: { selection_status?: SelectionStatus | null; prep_checklist?: PrepChecklist },
): Promise<PublicApplication> {
  const r = await apiFetch('/api/job-applications', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...patch }),
  });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `บันทึกไม่สำเร็จ (HTTP ${r.status})`);
  }
  const data = (await r.json()) as { item: PublicApplication };
  return data.item;
}
