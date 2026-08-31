import { apiFetch, HttpError } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type {
  RecruitChannel,
  RecruitChannelMatch,
  RecruitPosting,
  RecruitPostingLink,
} from '@/lib/recruitPostings';

export async function fetchRecruitChannels(includeInactive = false): Promise<RecruitChannel[]> {
  const r = await apiFetch(`/api/recruit/channels${includeInactive ? '?all=1' : ''}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดช่องทางไม่สำเร็จ'));
  const data = await readJsonSafe<RecruitChannel[]>(r);
  return Array.isArray(data) ? data : [];
}

/** ช่องทางหลักอย่างเดียว + จำนวนลูก (ทรีเต็มใหญ่เกินกว่าจะโหลดทุกครั้ง) */
export async function fetchRecruitChannelRoots(includeInactive = false): Promise<RecruitChannel[]> {
  const r = await apiFetch(`/api/recruit/channels?roots=1${includeInactive ? '&all=1' : ''}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดช่องทางไม่สำเร็จ'));
  const data = await readJsonSafe<RecruitChannel[]>(r);
  return Array.isArray(data) ? data : [];
}

/** ค้นหาช่องทาง (ค้นทั้งชื่อช่องย่อยและชื่อช่องหลัก) */
export async function searchRecruitChannels(
  q: string,
  options: { includeInactive?: boolean; limit?: number } = {},
): Promise<RecruitChannelMatch[]> {
  const params = new URLSearchParams({ q });
  if (options.includeInactive) params.set('all', '1');
  if (options.limit) params.set('limit', String(options.limit));
  const r = await apiFetch(`/api/recruit/channels?${params.toString()}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'ค้นหาช่องทางไม่สำเร็จ'));
  const data = await readJsonSafe<RecruitChannelMatch[]>(r);
  return Array.isArray(data) ? data : [];
}

/** ช่องทางรองของพ่อหนึ่งตัว แบ่งหน้า */
export async function fetchRecruitChannelChildren(
  parentId: string,
  options: { includeInactive?: boolean; limit?: number; offset?: number; q?: string } = {},
): Promise<{ items: RecruitChannel[]; total: number }> {
  const params = new URLSearchParams({ parent: parentId });
  if (options.includeInactive) params.set('all', '1');
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.q) params.set('childQ', options.q);
  const r = await apiFetch(`/api/recruit/channels?${params.toString()}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดช่องทางรองไม่สำเร็จ'));
  const data = await readJsonSafe<{ items: RecruitChannel[]; total: number }>(r);
  return { items: Array.isArray(data?.items) ? data.items : [], total: Number(data?.total) || 0 };
}


/** มุมมอง "ช่องทางหลัก" ของหน้าจัดช่องทาง — แบ่งหน้า + ค้นหาฝั่งเซิร์ฟเวอร์ */
export async function fetchRecruitChannelRootsPage(
  options: { includeInactive?: boolean; limit?: number; offset?: number; q?: string } = {},
): Promise<{ items: RecruitChannel[]; total: number }> {
  const params = new URLSearchParams({ view: 'roots' });
  if (options.includeInactive) params.set('all', '1');
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.q) params.set('q', options.q);
  const r = await apiFetch(`/api/recruit/channels?${params.toString()}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดช่องทางหลักไม่สำเร็จ'));
  const data = await readJsonSafe<{ items: RecruitChannel[]; total: number }>(r);
  return { items: Array.isArray(data?.items) ? data.items : [], total: Number(data?.total) || 0 };
}

/**
 * มุมมอง "ช่องทางรอง" ของหน้าจัดช่องทาง — ข้ามพ่อได้ (parentId ว่าง = ทุกพ่อ)
 * ⚠️ ของจริง 4,345 แถว ห้ามโหลดหมด — ต้องส่ง limit/offset ทุกครั้ง
 */
export async function fetchRecruitChannelSecondary(
  options: {
    parentId?: string | null;
    includeInactive?: boolean;
    limit?: number;
    offset?: number;
    q?: string;
  } = {},
): Promise<{ items: RecruitChannel[]; total: number }> {
  const params = new URLSearchParams({ view: 'children' });
  if (options.parentId) params.set('parent', options.parentId);
  if (options.includeInactive) params.set('all', '1');
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.q) params.set('q', options.q);
  const r = await apiFetch(`/api/recruit/channels?${params.toString()}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดช่องทางรองไม่สำเร็จ'));
  const data = await readJsonSafe<{ items: RecruitChannel[]; total: number }>(r);
  return { items: Array.isArray(data?.items) ? data.items : [], total: Number(data?.total) || 0 };
}

export async function createRecruitChannel(input: {
  parentId?: string | null;
  name: string;
}): Promise<RecruitChannel> {
  const r = await apiFetch('/api/recruit/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'เพิ่มช่องทางไม่สำเร็จ'));
  return (await readJsonSafe<RecruitChannel>(r)) as RecruitChannel;
}

export async function updateRecruitChannel(
  id: string,
  patch: { name?: string; isActive?: boolean },
): Promise<void> {
  const r = await apiFetch('/api/recruit/channels', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'แก้ช่องทางไม่สำเร็จ'));
}

export async function deleteRecruitChannel(id: string): Promise<void> {
  const r = await apiFetch(`/api/recruit/channels?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'ลบช่องทางไม่สำเร็จ'));
}

export async function fetchRecruitPostings(options: {
  jobId?: string | null;
  standaloneOnly?: boolean;
} = {}): Promise<RecruitPosting[]> {
  const params = new URLSearchParams();
  if (options.jobId) params.set('jobId', options.jobId);
  if (options.standaloneOnly) params.set('standalone', '1');
  const qs = params.toString();
  const r = await apiFetch(`/api/recruit/postings${qs ? `?${qs}` : ''}`);
  // พก status มาด้วย — หน้ากล่องงานต้องแยก "ไม่มีสิทธิ์" ออกจาก "ต่อไม่ติด" (ดู HttpError)
  if (!r.ok) throw new HttpError(r.status, await readErrorMessage(r, 'โหลดประกาศไม่สำเร็จ'));
  const data = await readJsonSafe<RecruitPosting[]>(r);
  return Array.isArray(data) ? data : [];
}

export type CreatePostingBody = {
  jobId?: string | null;
  standaloneKind?: string | null;
  departmentCode?: string | null;
  title: string;
  detail?: string | null;
  locationText?: string | null;
  salaryText?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  /** ข้อมูลที่ระบบเดิมเก็บตอนสร้างลิงก์ (ดู src/lib/recruitRmMasters.ts) */
  positionName?: string | null;
  province?: string | null;
  responsibleName?: string | null;
  responsibleUserId?: string | null;
  specificType?: string | null;
  formType?: string | null;
  channels?: Array<{ channelId?: string | null; label?: string | null }>;
};

export async function createRecruitPosting(body: CreatePostingBody): Promise<RecruitPosting> {
  const r = await apiFetch('/api/recruit/postings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'สร้างประกาศไม่สำเร็จ'));
  return (await readJsonSafe<RecruitPosting>(r)) as RecruitPosting;
}

export async function addPostingLink(
  postingId: string,
  input: { channelId?: string | null; channelLabel?: string | null },
): Promise<RecruitPostingLink> {
  const r = await apiFetch('/api/recruit/postings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postingId, ...input }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'เพิ่มลิงก์ไม่สำเร็จ'));
  return (await readJsonSafe<RecruitPostingLink>(r)) as RecruitPostingLink;
}

/** เนื้อหาประกาศที่แก้ได้ — BU/ใบขอแก้ไม่ได้ (ดู api/_lib/recruitPostings.ts) */
export type UpdatePostingBody = {
  title?: string;
  detail?: string | null;
  locationText?: string | null;
  salaryText?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
};

/** แก้เนื้อหาประกาศที่มีอยู่ — คืนประกาศหลังแก้ (พร้อมลิงก์/ยอดผู้สมัคร) */
export async function updateRecruitPosting(
  id: string,
  patch: UpdatePostingBody,
): Promise<RecruitPosting> {
  const r = await apiFetch('/api/recruit/postings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'แก้ประกาศไม่สำเร็จ'));
  return (await readJsonSafe<RecruitPosting>(r)) as RecruitPosting;
}

export async function setPostingStatus(id: string, status: 'open' | 'closed'): Promise<void> {
  const r = await apiFetch('/api/recruit/postings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'เปลี่ยนสถานะไม่สำเร็จ'));
}

export type PublicPostingInfo = {
  postingId: string;
  linkId: string;
  jobId: string | null;
  title: string;
  detail: string | null;
  locationText: string | null;
  salaryText: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: 'open' | 'closed';
  channelLabel: string | null;
};

/** เปิดลิงก์สาธารณะ — ไม่ต้องล็อกอิน */
export async function fetchPublicPostingByCode(code: string): Promise<PublicPostingInfo | null> {
  const r = await apiFetch(`/api/public/apply-link?code=${encodeURIComponent(code)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(await readErrorMessage(r, 'เปิดลิงก์ไม่สำเร็จ'));
  return (await readJsonSafe<PublicPostingInfo>(r)) as PublicPostingInfo;
}
