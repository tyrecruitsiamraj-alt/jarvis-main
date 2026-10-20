/**
 * ═══ สั่งโพสต์ / ขอ Scrap ไประบบ So Scraping (เจ้าของ 20 ต.ค. 2569) ═══
 * สองระบบคุยผ่านตาราง `job_posting_requests` (ฐานเดียวกัน) — Jarvis เขียนคำขอ · So Scraping อ่าน pending แล้วเขียนสถานะกลับแถวเดิม
 * ข้อมูลใหม่อยู่ใน `job_snapshot`: post_mode · caption · group_ids (โพสต์) / position · location · qty (Scrap)
 *
 * ไฟล์นี้ = กติกาล้วน ใช้ทั้งจอและ server (ตรวจซ้ำฝั่ง server ด้วยตัวเดียวกัน)
 * Choice ของเจ้าของ: ปุ่มขอ Scrap อยู่ในป๊อปประกาศที่เดียว · เก็บ "ไม่รับงาน" ได้ · โพสต์แล้วสั่งซ้ำได้ ·
 * ผล Scrap (Resume) อยู่ที่ So Scraping — Jarvis บอกแค่สถานะ
 */
import type { JobRequest } from '@/types';
import type { ToneKey } from '@/lib/designTokens';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';

export type SoPostMode = 'caption_only' | 'caption_image' | 'image_only';
export const SO_POST_MODES: readonly SoPostMode[] = ['caption_only', 'caption_image', 'image_only'];
export const SO_POST_MODE_LABEL: Record<SoPostMode, string> = {
  caption_only: 'ข้อความอย่างเดียว',
  caption_image: 'ข้อความ + รูป',
  image_only: 'รูปอย่างเดียว',
};

export const SO_POST_REASON = 'สั่งโพสต์จากป๊อปประกาศ';
export const SO_SCRAP_REASON = 'ขอ Scrap จาก Jarvis';

export type SoGroup = { id: string; name: string; province: string | null; department: string | null; job_type: string | null };

/** คำขอโพสต์ครบไหม — คืนข้อความบอกว่าต้องทำอะไร · ครบ = null */
export function soPostOrderError(input: { mode: SoPostMode | null; caption: string; groupIds: readonly string[] }): string | null {
  if (!input.mode || !SO_POST_MODES.includes(input.mode)) return 'เลือกแบบโพสต์ก่อนสั่งโพสต์';
  if (input.mode !== 'image_only' && !input.caption.trim()) return 'ใส่ข้อความประกาศก่อนสั่งโพสต์';
  if (input.groupIds.length === 0) return 'เลือกกลุ่ม Facebook อย่างน้อย 1 กลุ่ม';
  return null;
}

const CAPTION_MAX = 5000;

/** snapshot ของคำขอโพสต์ = ข้อมูลใบขอเดิม + แบบโพสต์ + ข้อความฉบับสุดท้ายที่เห็น + กลุ่มที่เลือก */
export function soPostSnapshot(
  base: Record<string, unknown>,
  input: { mode: SoPostMode; caption: string; groupIds: readonly string[] },
): Record<string, unknown> {
  return {
    ...base,
    post_mode: input.mode,
    caption: input.caption.trim().slice(0, CAPTION_MAX),
    group_ids: [...new Set(input.groupIds)],
  };
}

/** จำนวนคนที่ใบขอต้องการ — ไม่รู้ = null */
export function jobQtyOf(job: Pick<JobRequest, 'request_positions' | 'position_units'>): number | null {
  const n = Number(job.request_positions ?? job.position_units ?? NaN);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * ชื่อตำแหน่งที่ส่งให้ Scrap = ชื่อที่โชว์บนประกาศ (`publicJobTitle`) ไม่ใช่ชื่อตำแหน่ง ERP
 * (20 ต.ค. 2569 — ERP ส่วนใหญ่เป็น "พนักงาน" เฉย ๆ หา Resume ไม่ได้)
 */
export function jobPositionOf(job: Pick<JobRequest, 'staff_title_name' | 'request_action_name'>, publicTitle?: string | null): string | null {
  // ไม่ import publicJobTitle ตรงนี้ (boardFilters → soScraping → publicJobTitle → boardFilters วนกัน) — ผู้เรียกส่งมา
  return (publicTitle ?? '').trim() || (job.staff_title_name || job.request_action_name || '').trim() || null;
}

/** จังหวัดของใบขอ — กติกาเดียวกับตัวกรองกล่องงาน (`boardProvinceOf`) · ไม่รู้ = null */
export function jobProvinceOf(job: Pick<JobRequest, 'override_province' | 'location_address'>): string | null {
  return ((job.override_province ?? '').trim() || (inferProvinceFromAddress(job.location_address || '') ?? '').trim()) || null;
}

/** ขอ Scrap ได้ไหม — ขาดอะไรบ้าง (ว่าง = ครบ) */
export function soScrapMissing(job: JobRequest, publicTitle?: string | null): string[] {
  const out: string[] = [];
  if (!jobPositionOf(job, publicTitle)) out.push('ตำแหน่ง');
  if (!jobProvinceOf(job)) out.push('จังหวัด');
  if (jobQtyOf(job) == null) out.push('จำนวนคน');
  return out;
}

/** snapshot ของคำขอ Scrap — บังคับ 3 ช่อง ที่เหลือใส่เมื่อมี */
export function soScrapSnapshot(job: JobRequest, publicTitle?: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {
    position: jobPositionOf(job, publicTitle),
    location: jobProvinceOf(job),
    qty: jobQtyOf(job),
  };
  if (typeof job.age_range_min === 'number' && job.age_range_min > 0) out.age_min = job.age_range_min;
  if (typeof job.age_range_max === 'number' && job.age_range_max > 0) out.age_max = job.age_range_max;
  if (job.gender_requirement) out.gender = job.gender_requirement;
  if (job.total_income) out.income = job.total_income;
  if (job.work_schedule) out.work_schedule = job.work_schedule;
  return out;
}

/** snapshot ที่ server ตรวจซ้ำ — คืนข้อความบอกว่าขาดอะไร · ผ่าน = null */
export function soSnapshotError(type: 'content' | 'scraping', snap: Record<string, unknown> | null): string | null {
  if (type === 'scraping') {
    const missing: string[] = [];
    if (typeof snap?.position !== 'string' || !snap.position.trim()) missing.push('ตำแหน่ง');
    if (typeof snap?.location !== 'string' || !snap.location.trim()) missing.push('จังหวัด');
    if (!(typeof snap?.qty === 'number' && snap.qty > 0)) missing.push('จำนวนคน');
    return missing.length ? `ใบขอนี้ขาด${missing.join(' · ')} — ขอ Scrap ไม่ได้` : null;
  }
  // คำขอโพสต์รุ่นเก่า (ไม่มี post_mode) ยังรับเหมือนเดิม
  if (snap?.post_mode === undefined) return null;
  const groups = Array.isArray(snap.group_ids) ? snap.group_ids.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  const caption = typeof snap.caption === 'string' ? snap.caption : '';
  const base = soPostOrderError({
    mode: (typeof snap.post_mode === 'string' ? snap.post_mode : null) as SoPostMode | null,
    caption,
    groupIds: groups,
  });
  if (base) return base;
  // Autopost (มีบัญชี) — ทุกโพสต์ต้องมีลิงก์สมัคร และข้อความต้องมีลิงก์นั้น (20 ต.ค. 2569)
  if (snap.account_id !== undefined) {
    if (typeof snap.account_id !== 'string' || !snap.account_id) return 'เลือกบัญชี Facebook ก่อนส่ง';
    const link = typeof snap.apply_link === 'string' ? snap.apply_link : '';
    if (!/\/apply\/p\/[A-Za-z0-9_-]+$/.test(link)) return 'เลือกลิงก์สมัครก่อนส่ง';
    if (snap.post_mode !== 'image_only' && !caption.includes(link)) return 'ข้อความประกาศต้องมีลิงก์สมัครที่เลือก';
  }
  return null;
}

/** กลุ่มจังหวัดเดียวกับใบขอขึ้นก่อน (แล้วเรียงชื่อ) */
export function sortSoGroups(groups: readonly SoGroup[], province: string | null): SoGroup[] {
  const same = (g: SoGroup) => Boolean(province && (g.province ?? '').trim() === province);
  return [...groups].sort((a, b) => Number(same(b)) - Number(same(a)) || a.name.localeCompare(b.name, 'th'));
}

/** ติ๊กไว้ให้ก่อน = กลุ่มจังหวัดเดียวกับใบขอ */
export function defaultSoGroupIds(groups: readonly SoGroup[], province: string | null): string[] {
  if (!province) return [];
  return groups.filter((g) => (g.province ?? '').trim() === province).map((g) => g.id);
}

/* ── สถานะที่ So Scraping เขียนกลับ ── */

export type SoStatus = 'pending' | 'in_progress' | 'posted' | 'completed' | 'filled' | 'cancelled' | 'rejected';
/** ส่งไปแล้วเกินเท่านี้ยังไม่มีใครรับ = "รอนาน" */
export const SO_WAIT_LONG_MS = 60 * 60_000;

export const SO_STATUS_LABEL: Record<SoStatus, string> = {
  pending: 'ส่งแล้ว รอระบบรับ',
  in_progress: 'กำลังทำ',
  posted: 'โพสต์แล้ว',
  completed: 'เสร็จ',
  filled: 'เสร็จ',
  cancelled: 'ยกเลิก',
  rejected: 'ไม่รับงาน',
};

export type SoStatusView = { label: string; tone: ToneKey; open: boolean; waitLong: boolean };

/** สถานะเป็นคำคน + สี — เหลือง = รอ/กำลังทำ · เขียว = โพสต์แล้ว/เสร็จ · แดง = ไม่รับงาน/รอนาน */
export function soStatusView(r: { status: string; created_at: string }, nowMs = Date.now()): SoStatusView {
  const status = (r.status in SO_STATUS_LABEL ? r.status : 'pending') as SoStatus;
  const waitLong = status === 'pending' && nowMs - Date.parse(r.created_at) > SO_WAIT_LONG_MS;
  if (waitLong) return { label: 'รอนาน ยังไม่มีใครรับ', tone: 'danger', open: true, waitLong };
  const tone: ToneKey =
    status === 'rejected' ? 'danger' : status === 'posted' || status === 'completed' || status === 'filled' ? 'success' : status === 'cancelled' ? 'neutral' : 'warn';
  return { label: SO_STATUS_LABEL[status], tone, open: status === 'pending' || status === 'in_progress', waitLong };
}

/** ค่าของตัวกรองกล่องงาน "So Scraping" ต่อใบ */
export type SoFacetValue = 'open' | 'done' | 'rejected';
export const SO_FACET_LABEL: Record<SoFacetValue, string> = {
  open: 'สั่งแล้วยังไม่เสร็จ',
  done: 'โพสต์แล้ว / เสร็จ',
  rejected: 'ไม่รับงาน',
};
export function soFacetValues(latest: ReadonlyArray<{ status: string }>): SoFacetValue[] {
  const out = new Set<SoFacetValue>();
  for (const r of latest) {
    if (r.status === 'pending' || r.status === 'in_progress') out.add('open');
    else if (r.status === 'rejected') out.add('rejected');
    else if (r.status === 'posted' || r.status === 'completed' || r.status === 'filled') out.add('done');
  }
  return [...out];
}

/** ข้อความแจ้งเตือนเมื่อสถานะเปลี่ยน — ไม่แจ้ง = null */
export function soNoticeTitle(type: 'content' | 'scraping', status: string): string | null {
  const what = type === 'scraping' ? 'Scrap' : 'สั่งโพสต์';
  if (status === 'posted') return `${what} · โพสต์แล้ว`;
  if (status === 'completed') return `${what} · เสร็จ`;
  if (status === 'rejected') return `${what} · ไม่รับงาน`;
  return null;
}
