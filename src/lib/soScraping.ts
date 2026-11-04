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
import { normalizeTrendBu, trendBuFromSiteCode } from '@/lib/trends/bu';
import { UNIT_SECTOR_LABEL, UNIT_SECTOR_UNSET_LABEL, type UnitSector } from '@/lib/unitSector';

export type SoPostMode = 'caption_only' | 'caption_image' | 'image_only';
export const SO_POST_MODES: readonly SoPostMode[] = ['caption_only', 'caption_image', 'image_only'];
export const SO_POST_MODE_LABEL: Record<SoPostMode, string> = {
  caption_only: 'ข้อความอย่างเดียว',
  caption_image: 'ข้อความ + รูป',
  image_only: 'รูปอย่างเดียว',
};

export const SO_POST_REASON = 'สั่งโพสต์จากป๊อปประกาศ';
export const SO_SCRAP_REASON = 'ขอ Scrap จาก Jarvis';

export type SoGroup = {
  id: string;
  name: string;
  province: string | null;
  department: string | null;
  job_type: string | null;
  /** รหัสกลุ่มท้าย /groups/ ใน URL ของ Facebook (เลข หรือชื่ออังกฤษ) · 4 พ.ย. 2569 ใช้แยกลิงก์ของกลุ่ม */
  fbGroupId?: string | null;
  /** ราชการ/เอกชน (`soGroupSectorOf`) · null = ยังไม่ระบุ */
  sector?: UnitSector | null;
};

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
export type SoFacetValue = 'none' | 'open' | 'done' | 'rejected';
export const SO_FACET_LABEL: Record<SoFacetValue, string> = {
  // 1 พ.ย. 2569 เจ้าของ "ต้องมีสถานะบอก และต้อง Filter ดูได้" — ใบที่ยังไม่เคยสั่งกรองได้ด้วย
  none: 'ยังไม่สั่ง',
  open: 'สั่งแล้วยังไม่เสร็จ',
  done: 'โพสต์แล้ว / เสร็จ',
  rejected: 'ไม่รับงาน',
};
export function soFacetValues(latest: ReadonlyArray<{ status: string }>): SoFacetValue[] {
  if (latest.length === 0) return ['none'];
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

/* ═══ ตัวเลือกตอนสั่งงาน จาก So Scraping options API (เจ้าของ 26 ต.ค. 2569 "ทำเลย ตามเอกสาร") ═══
 * GET so-scraping/api/integrations/jarvis/options (x-api-key ฝั่ง server เท่านั้น · ดึงใหม่ทุกครั้งที่เปิดฟอร์ม ไม่ cache)
 * status ทุกตัวมาจาก So Scraping — Jarvis ไม่คิดเอง · ข้อความ `warning` เป็นไทยจากฝั่งนั้น ใช้ในป๊อปเตือนได้เลย
 * เอกสารรอบ 2 (26 ต.ค. 2569 บ่าย): พนักงานเลือกเครื่องเองได้ทั้งโพสต์ (`worker`) และ Scrap (`scrape_worker`) ·
 *   เครื่องหลักออฟไลน์ = บัญชียังเลือกได้ ให้เลือกเครื่องอื่น · เครื่องออฟไลน์/บัญชียังไม่ล็อกอินบนเครื่องนั้น = เตือนก่อนส่ง ·
 *   กลุ่มมีผล 30 วัน (`posted` เป็นหลัก — คอมเมนต์/เบอร์ยังนับไม่ครบ)
 * ยังไม่ได้ใส่ key = อ่านจากฐานของ So Scraping แบบเดิม (`source: 'db'` · ทางถอย) */

/**
 * `needs_verification` = Facebook ขอยืนยันตัวตน ต้องมีคนไปทำที่เครื่อง (So Scraping 2be6efb · 3 พ.ย. 2569) ·
 * `unknown` = สถานะที่ Jarvis ยังไม่รู้จัก ⇒ เลือกไม่ได้ แสดง `warning` ตรง ๆ (สเปค 6.1)
 */
export type SoAccountStatus = 'ready' | 'busy' | 'full' | 'paused' | 'worker_offline' | 'no_worker' | 'needs_verification' | 'unknown';
export type SoScrapeStatus = 'ready' | 'full' | 'cooldown' | 'disabled';
export type SoQueue = { running: number; queued: number };

export type SoOptAccount = {
  id: string;
  name: string;
  worker: string | null;
  workerOnline: boolean;
  postedToday: number;
  dailyCap: number | null;
  remainingToday: number | null;
  pausedUntil: string | null;
  pauseReason: string | null;
  queue: SoQueue;
  status: SoAccountStatus;
  warning: string | null;
  /** ค่าเริ่มต้นให้คนสั่ง: พร้อมโพสต์ ไม่มีคำเตือน ล็อกอินบนเครื่องที่ออนไลน์ (So Scraping ตัดสิน · สเปค 6.1) */
  recommended: boolean;
  /** Facebook ขอยืนยันตัวตนตั้งแต่เมื่อไร · null = ไม่ติด */
  needsVerificationSince: string | null;
  groupIds: string[];
  /** เครื่องที่บัญชีนี้ล็อกอินค้างไว้ */
  sessionWorkers: string[];
  /** ธุรกิจของบัญชี (LBD · LBA · LM …) · null = ไม่ระบุธุรกิจ (So Scraping 2 พ.ย. 2569 · users.department) */
  department: string | null;
  /** สถานะกลุ่มของบัญชีนี้ — เฉพาะกลุ่มที่เคยลองโพสต์ใน 30 วัน (So Scraping acc6821) · ไม่อยู่ในรายการ = ยังไม่เคยลอง */
  groupStatus: SoGroupState[];
};
/** สถานะของกลุ่มสำหรับบัญชีหนึ่ง — `label` เป็นคำไทยจาก So Scraping ใช้ตามนั้น ห้ามแปลงเอง */
export type SoGroupState = {
  groupId: string;
  state: string;
  label: string;
  /** false = ไม่ควรติ๊กให้ตั้งแต่แรก (คนติ๊กเองได้) */
  recommended: boolean;
  detail: string | null;
  /** ลิงก์ให้คนกดไปแก้เอง (หน้ากลุ่ม หรือโพสต์ที่รออนุมัติ) */
  url: string | null;
  seenAt: string | null;
};
/** ติดที่ตัวกลุ่ม — ทุกบัญชีโพสต์ไม่ได้ (ตอนนี้มีแค่ admin_paused) */
export type SoGroupBlock = { state: string; label: string; detail: string | null; seenAt: string | null };
export type SoGroupStats = { attempts: number; posted: number; comments: number; phoneLeads: number };
export type SoOptGroup = {
  id: string;
  fbGroupId: string | null;
  name: string | null;
  url: string | null;
  accountIds: string[];
  lastPostedAt: string | null;
  stats30d: SoGroupStats | null;
  /** ธุรกิจของกลุ่ม (รหัสแผนก LBD · LBA · LM · DS · SN · ชุดเดียวกับ users.department_code) · null = ไม่ระบุธุรกิจ (So Scraping 2 พ.ย. 2569) */
  department: string | null;
  /** ราชการ/เอกชน (4 พ.ย. 2569 · `soGroupSectorOf`) · null = ยังไม่ระบุ */
  sector: UnitSector | null;
  /** จังหวัดที่กลุ่มล็อกไว้ (So Scraping `provinces` · ไม่รวม "ทั่วประเทศ") · [] = ยังไม่ระบุ */
  provinces: string[];
  /** กลุ่มทั่วประเทศ — เลือกจังหวัดแล้วขึ้นต่อท้ายกลุ่มของจังหวัดนั้น */
  nationwide: boolean;
  /** กลุ่มโดนพัก ทุกบัญชีโพสต์ไม่ได้ · null = ไม่ติด */
  blocked: SoGroupBlock | null;
  /** ใบขอนี้เพิ่งลงกลุ่มนี้ไม่ถึง 2 วัน (ส่ง ?request_no=) — ติ๊กได้แต่รอบนี้ So Scraping ข้าม · null = ลงได้ (สเปค 6.2) */
  repostWait: SoRepostWait | null;
};
export type SoRepostWait = { requestNo: string | null; lastPostedAt: string | null; availableAt: string | null };
export type SoWorkerKind = 'autopost' | 'scraper';
export type SoOptWorker = {
  name: string;
  online: boolean;
  lastSeen: string | null;
  load: number;
  kinds: string[];
  postQueue: SoQueue;
  scrapeQueue: SoQueue;
  fbAccountIds: string[];
  /** ค่าเริ่มต้น: ออนไลน์และคิวเบาสุด แยกงานโพสต์/Scrap (สเปค 6.3) */
  recommended: { post: boolean; scrape: boolean };
};
export type SoScrapeAccount = {
  id: string;
  platform: string;
  label: string;
  status: SoScrapeStatus;
  warning: string | null;
  usedToday: number;
  cap: number | null;
  cooldownUntil: string | null;
};
export type SoOptions = {
  source: 'api' | 'db';
  accounts: SoOptAccount[];
  groups: SoOptGroup[];
  workers: SoOptWorker[];
  scrapeAccounts: SoScrapeAccount[];
};

export const SO_ACCOUNT_STATUS_LABEL: Record<SoAccountStatus, string> = {
  ready: 'พร้อมโพสต์',
  busy: 'มีงานค้าง',
  full: 'ครบโควต้าวันนี้',
  paused: 'ถูกพัก',
  worker_offline: 'เครื่องออฟไลน์',
  no_worker: 'ยังไม่ผูกเครื่อง',
  needs_verification: 'ต้องยืนยันตัวตน',
  unknown: 'ใช้ไม่ได้',
};
export const SO_SCRAPE_STATUS_LABEL: Record<SoScrapeStatus, string> = {
  ready: 'พร้อมใช้',
  full: 'ครบโควต้าวันนี้',
  cooldown: 'พักชั่วคราว',
  disabled: 'ปิดใช้งาน',
};

/** เลือกบัญชี Facebook นี้ได้ไหม — ตามตารางในเอกสาร (paused/no_worker/needs_verification/ไม่รู้จัก = ไม่ได้ · worker_offline ได้ แต่ต้องเลือกเครื่องอื่น) */
export const soAccountSelectable = (s: SoAccountStatus): boolean => s === 'ready' || s === 'busy' || s === 'full' || s === 'worker_offline';
/** เลือกบัญชี JobThai/JobBKK นี้ได้ไหม (cooldown/disabled = ไม่ได้) */
export const soScrapeSelectable = (s: SoScrapeStatus): boolean => s === 'ready' || s === 'full';
/** ต้องขึ้นป๊อปเตือนก่อนส่งไหม (full ยืนยันแล้วส่งต่อได้) */
export const soAccountNeedsConfirm = (s: SoAccountStatus): boolean => s === 'full';
export const soScrapeNeedsConfirm = (s: SoScrapeStatus): boolean => s === 'full';

/** เครื่องที่รับงานประเภทนี้ได้ — เรียงตาม So Scraping (ออนไลน์และว่างก่อน) */
export function soWorkersFor(o: Pick<SoOptions, 'workers'>, kind: SoWorkerKind): SoOptWorker[] {
  return o.workers.filter((w) => w.kinds.includes(kind));
}

/** บัญชีนี้ล็อกอินบนเครื่องนี้แล้วไหม (`session_workers` หรือ `fb_account_ids` ของเครื่อง) */
export function soAccountOnWorker(acc: Pick<SoOptAccount, 'id' | 'sessionWorkers'>, w: Pick<SoOptWorker, 'name' | 'fbAccountIds'>): boolean {
  return acc.sessionWorkers.includes(w.name) || w.fbAccountIds.includes(acc.id);
}

/**
 * บัญชีนี้มี session Facebook บนเครื่องไหนสักเครื่องไหม (So Scraping แจ้ง 3 พ.ย. 2569: 21 บัญชียังไม่มี session บน RM009)
 * ไม่มี = เลือกได้ แต่เตือนก่อนส่ง บอทล็อกอินให้เอง (เอกสาร So Scraping · เจ้าของ Choice 3 พ.ย. 2569 "เลือกได้ แต่เตือนก่อนส่ง")
 */
export function soAccountHasSession(acc: Pick<SoOptAccount, 'id' | 'sessionWorkers'>, workers: readonly Pick<SoOptWorker, 'fbAccountIds'>[]): boolean {
  return acc.sessionWorkers.length > 0 || workers.some((w) => w.fbAccountIds.includes(acc.id));
}

const BKK_TIME = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const whenBkk = (iso: string | null | undefined): string | null =>
  iso && !Number.isNaN(Date.parse(iso)) ? BKK_TIME.format(new Date(iso)) : null;

/**
 * คำสถานะ + สีของบัญชี (สเปค So Scraping 6.1 · 3 พ.ย. 2569 "ห้ามใช้สีอย่างเดียว ทุกสถานะต้องมีคำ")
 * พร้อม = เขียว · มีงานค้าง/ครบโควต้า/เครื่องออฟไลน์ = เหลือง เลือกได้ · ถูกพัก/ต้องยืนยันตัวตน/ไม่ผูกเครื่อง/ไม่รู้จัก = แดง เลือกไม่ได้
 */
export function soAccountStatusText(
  a: Pick<SoOptAccount, 'status' | 'remainingToday' | 'postedToday' | 'dailyCap' | 'worker' | 'pausedUntil' | 'needsVerificationSince' | 'warning'>,
): { text: string; tone: 'success' | 'warn' | 'danger' } {
  switch (a.status) {
    case 'ready':
      return { text: a.remainingToday !== null ? `พร้อมโพสต์ · เหลือ ${a.remainingToday.toLocaleString('th-TH')} โพสต์วันนี้` : 'พร้อมโพสต์', tone: 'success' };
    case 'busy':
      return { text: 'มีงานค้าง ต่อคิวได้', tone: 'warn' };
    case 'full':
      return { text: `ครบโควต้าวันนี้ (${a.postedToday.toLocaleString('th-TH')}/${(a.dailyCap ?? a.postedToday).toLocaleString('th-TH')})`, tone: 'warn' };
    case 'worker_offline':
      return { text: a.worker ? `เครื่อง ${a.worker} ออฟไลน์` : 'เครื่องออฟไลน์', tone: 'warn' };
    case 'paused': {
      const until = whenBkk(a.pausedUntil);
      return { text: until ? `ถูกพัก ใช้ได้ ${until}` : 'ถูกพัก', tone: 'danger' };
    }
    case 'needs_verification': {
      const since = whenBkk(a.needsVerificationSince);
      return { text: since ? `ต้องยืนยันตัวตนที่เครื่อง ตั้งแต่ ${since}` : 'ต้องยืนยันตัวตนที่เครื่อง', tone: 'danger' };
    }
    case 'no_worker':
      return { text: 'ยังไม่ผูกเครื่อง', tone: 'danger' };
    default:
      return { text: a.warning ?? 'ใช้ไม่ได้', tone: 'danger' };
  }
}

/** ตัวเลือกในช่องบัญชี — ชื่อ · คำสถานะ (+ "ยังไม่ได้ล็อกอิน Facebook" เมื่อไม่มี session · เจ้าของ 3 พ.ย. 2569 เลือกได้ เตือนตอนส่ง) */
export function soAccountChoice(
  a: Pick<
    SoOptAccount,
    'id' | 'name' | 'status' | 'pausedUntil' | 'sessionWorkers' | 'postedToday' | 'dailyCap' | 'remainingToday' | 'worker' | 'needsVerificationSince' | 'warning'
  >,
  workers: readonly Pick<SoOptWorker, 'fbAccountIds'>[],
): { label: string; disabled: boolean; tone: 'success' | 'warn' | 'danger' } {
  const st = soAccountStatusText(a);
  const selectable = soAccountSelectable(a.status);
  const noLogin = selectable && !soAccountHasSession(a, workers) ? ' · ยังไม่ได้ล็อกอิน Facebook' : '';
  return { label: `${a.name} · ${st.text}${noLogin}`, disabled: !selectable, tone: st.tone };
}

/** บัญชีตั้งต้น = บัญชีแรกที่ So Scraping แนะนำ (สเปค 6.1) — ธุรกิจของใบขอก่อน แล้วธุรกิจอื่น · ไม่มี = null (ช่องว่าง) */
export function soDefaultAccount<A extends Pick<SoOptAccount, 'recommended' | 'department'>>(accounts: readonly A[], jobBu: string | null): A | null {
  const rec = accounts.filter((a) => a.recommended);
  return (jobBu ? rec.find((a) => a.department === jobBu) : undefined) ?? rec[0] ?? null;
}

/** ไม่มีบัญชีพร้อมโพสต์ — บอกเวลาที่บัญชีแรกจะกลับมาใช้ได้ (`paused_until` ที่ใกล้สุด) */
export function soNoAccountReadyText(accounts: readonly Pick<SoOptAccount, 'pausedUntil'>[], now = Date.now()): string {
  const next = accounts
    .map((a) => Date.parse(a.pausedUntil ?? ''))
    .filter((t) => Number.isFinite(t) && t > now)
    .sort((x, y) => x - y)[0];
  return next ? `ตอนนี้ไม่มีบัญชีที่พร้อมโพสต์ · บัญชีแรกใช้ได้ ${BKK_TIME.format(new Date(next))}` : 'ตอนนี้ไม่มีบัญชีที่พร้อมโพสต์';
}

/** ติ๊กกลุ่มได้สูงสุดกี่กลุ่ม = โพสต์ที่บัญชีเหลือวันนี้ (สเปค 6.2) · ไม่รู้ = ไม่จำกัด (null) */
export const soGroupCap = (a: Pick<SoOptAccount, 'remainingToday'> | null): number | null => (a ? a.remainingToday : null);

/** ติ๊กเพิ่มแบบไม่เกินเพดาน — เกินแล้วตัดตามลำดับที่ส่งมา */
export function soAddWithinCap(prev: readonly string[], ids: readonly string[], cap: number | null): string[] {
  const out = [...prev];
  for (const id of ids) {
    if (out.includes(id)) continue;
    if (cap !== null && out.length >= cap) break;
    out.push(id);
  }
  return out;
}

/** "ใบนี้เพิ่งลง 2 พ.ย. 10:12 โพสต์ได้อีก 4 พ.ย. 10:12" (สเปค 6.2) */
export function soRepostWaitText(w: SoRepostWait): string {
  const last = whenBkk(w.lastPostedAt);
  const avail = whenBkk(w.availableAt);
  return [last ? `ใบนี้เพิ่งลง ${last}` : 'ใบนี้เพิ่งลงกลุ่มนี้', avail ? `โพสต์ได้อีก ${avail}` : null].filter(Boolean).join(' ');
}

/** เครื่องตั้งต้น = เครื่องที่ So Scraping แนะนำ (ออนไลน์ คิวเบาสุด · สเปค 6.3) */
export function soDefaultWorker(workers: readonly SoOptWorker[], kind: 'post' | 'scrape'): SoOptWorker | null {
  return workers.find((w) => w.recommended[kind]) ?? null;
}

/** "ออฟไลน์ ตั้งแต่ 3 พ.ย. 14:20" */
export function soWorkerOfflineText(w: Pick<SoOptWorker, 'lastSeen'>): string {
  const since = whenBkk(w.lastSeen);
  return since ? `ออฟไลน์ ตั้งแต่ ${since}` : 'ออฟไลน์';
}

export const SO_NO_SESSION_WARNING = 'บัญชีนี้ยังไม่เคยล็อกอินบนเครื่องนี้ บอทจะล็อกอินใหม่ และ Facebook อาจขอยืนยันตัวตน';
export const soWorkerOfflineWarning = (name: string) => `เครื่อง ${name} ออฟไลน์อยู่ งานจะค้างรอจนเครื่องเปิด`;

/**
 * คำเตือนก่อนส่ง (ตามข้อ 4 ของเอกสาร) — ว่าง = ส่งได้เลย · มี = ต้องกดยืนยัน
 * โพสต์: บัญชีครบโควต้า · เครื่องออฟไลน์ · บัญชียังไม่ล็อกอินบนเครื่องที่เลือก (ไม่เลือกเครื่อง = ยังไม่ล็อกอินบนเครื่องไหนเลย) · Scrap: บัญชีครบโควต้า · เครื่องออฟไลน์
 */
export function soPostConfirmWarnings(acc: SoOptAccount, worker: SoOptWorker | null, allWorkers: readonly Pick<SoOptWorker, 'fbAccountIds'>[] = []): string[] {
  const out: string[] = [];
  if (soAccountNeedsConfirm(acc.status)) out.push(soWarningText(acc.name, acc.status, acc.warning));
  if (worker && !worker.online) out.push(soWorkerOfflineWarning(worker.name));
  if (worker ? !soAccountOnWorker(acc, worker) : !soAccountHasSession(acc, allWorkers)) out.push(SO_NO_SESSION_WARNING);
  return out;
}
export function soScrapConfirmWarnings(picked: readonly SoScrapeAccount[], worker: SoOptWorker | null): string[] {
  const out = picked.filter((s) => soScrapeNeedsConfirm(s.status)).map((s) => soWarningText(s.label, s.status, s.warning));
  if (worker && !worker.online) out.push(soWorkerOfflineWarning(worker.name));
  return out;
}

/** ผล 30 วันของกลุ่ม — `posted` เป็นหลัก · คอมเมนต์/เบอร์ขึ้นเมื่อมี (เอกสาร: ยังนับไม่ครบ) */
export function soGroupStatsText(st: SoGroupStats | null): string | null {
  if (!st) return null;
  const parts = [`30 วัน โพสต์ได้ ${st.posted}/${st.attempts}`];
  if (st.comments > 0) parts.push(`คอมเมนต์ ${st.comments}`);
  if (st.phoneLeads > 0) parts.push(`ทิ้งเบอร์ ${st.phoneLeads}`);
  return parts.join(' · ');
}

/** ข้อความในป๊อปเตือน — ใช้ `warning` ของ So Scraping ก่อน ไม่มีค่อยใช้ชื่อสถานะ */
export function soWarningText(name: string, status: SoAccountStatus | SoScrapeStatus, warning: string | null): string {
  const label = (SO_ACCOUNT_STATUS_LABEL as Record<string, string>)[status] ?? (SO_SCRAPE_STATUS_LABEL as Record<string, string>)[status] ?? status;
  return (warning ?? '').trim() || `บัญชี ${name} ${label}`;
}

/** ชื่อกลุ่ม — ยังไม่มีชื่อ (บอทยังไม่เคยเข้าไปอ่าน) ใช้เลขกลุ่มแล้วต่อท้าย "ยังไม่มีชื่อ" · ส่ง `all` มา = ชื่อซ้ำต่อท้ายรหัสกลุ่ม */
export function soGroupLabel(g: Pick<SoOptGroup, 'name' | 'fbGroupId' | 'id'>, all?: readonly Pick<SoOptGroup, 'name' | 'fbGroupId' | 'id'>[]): string {
  const name = (g.name ?? '').trim();
  if (!name) return `${g.fbGroupId || g.id} · ยังไม่มีชื่อ`;
  return all ? soGroupLinkName(g, all) : name;
}

/** กลุ่มของบัญชีนี้ — อยู่ใน `group_ids` ของบัญชี หรือบัญชีอยู่ใน `account_ids` ของกลุ่ม */
export function soGroupsOfAccount(o: Pick<SoOptions, 'groups'>, acc: Pick<SoOptAccount, 'id' | 'groupIds'> | null): SoOptGroup[] {
  if (!acc) return [];
  return o.groups.filter((g) => acc.groupIds.includes(g.id) || g.accountIds.includes(acc.id));
}

/* ═══ กลุ่มแยกตามธุรกิจของใบขอ (เจ้าของ 2 พ.ย. 2569 · So Scraping ติดป้ายธุรกิจให้ทุกกลุ่มแล้ว) ═══
 * ป๊อปสั่งโพสต์: หมวดธุรกิจเดียวกับใบขอกางไว้ · ธุรกิจอื่น/ไม่ระบุ พับไว้ · ไม่ติ๊กกลุ่มให้ (4 พ.ย. 2569)
 * รหัสบนจอใช้ตามที่ทีมเรียก (LBD · LBA · …) ไม่ตั้งชื่อใหม่
 */
export const SO_BU_NONE_LABEL = 'ไม่ระบุธุรกิจ';

/** ธุรกิจของใบขอ = BU จากรหัสไซต์ (ใบขอ ERP) · ไม่มีไซต์ใช้แผนก (ใบขอชั่วคราว) — ตารางจับคู่ตัวเดียวกับหน้าหลัก */
export function jobBuOf(job: Pick<JobRequest, 'site_code' | 'department_code'>): string | null {
  return trendBuFromSiteCode(job.site_code) ?? normalizeTrendBu(job.department_code);
}

export type SoGroupSection<G extends { department: string | null } = SoOptGroup> = {
  /** รหัสธุรกิจ · null = ไม่ระบุ */
  bu: string | null;
  label: string;
  /** หมวดธุรกิจเดียวกับใบขอ (เปิดกางไว้) */
  forJob: boolean;
  groups: G[];
};

/** จัดหมวด: ธุรกิจของใบขอก่อน → ธุรกิจอื่นเรียงรหัส → ไม่ระบุท้ายสุด · หมวดว่างไม่ขึ้น (ใบขอที่ธุรกิจไม่มีกลุ่มเลยให้บอกด้วย `soBuEmptyText`) */
export function soGroupSections<G extends { department: string | null }>(groups: readonly G[], jobBu: string | null): SoGroupSection<G>[] {
  const by = new Map<string | null, G[]>();
  for (const g of groups) {
    const k = g.department ?? null;
    by.set(k, [...(by.get(k) ?? []), g]);
  }
  return buOrder(by.keys(), jobBu).map((bu) => ({ bu, label: bu ?? SO_BU_NONE_LABEL, forJob: bu !== null && bu === jobBu, groups: by.get(bu) ?? [] }));
}

/* ═══ Gen link ช่องทาง Facebook Group = เลือกกลุ่มจาก So Scraping (เจ้าของ 2 พ.ย. 2569) ═══
 * "อยากรู้ว่ากลุ่มไหนได้คนมาเยอะ · กลุ่มไหนเหมาะนายไทย นายต่างชาติ" → Choice: เลือกจากรายชื่อ So Scraping · 1 ลิงก์ = 1 กลุ่ม
 * ชื่อลิงก์ = "Facebook · Facebook Group · <ชื่อกลุ่ม>" — ตารางช่องทางในภาพรวมงานสรรหาอ่านชื่อกลุ่มจากส่วนท้าย (`funnelSubOf`)
 */
/** ช่องทางรอง Facebook Group (ตั้งค่าช่องทาง) — ตัวที่ต้องเลือกกลุ่มต่อ */
export const isFacebookGroupChannel = (name: string | null | undefined) => /^facebook\s*group$/i.test((name ?? '').trim());

/** ชื่อลิงก์ของกลุ่ม — ชื่อช่องทาง + ชื่อกลุ่มตามรายชื่อ So Scraping (ตัด "·" ในชื่อกลุ่ม กันชื่อแตกเป็นหลายชั้น) */
export function soGroupLinkLabel(channelLabel: string, groupName: string): string {
  return `${channelLabel} · ${groupName.replace(/\s*·\s*/g, ' ').trim()}`;
}

/* ═══ ลิงก์ของกลุ่มผูกกับรหัสกลุ่ม ไม่ใช่ชื่อกลุ่ม (เจ้าของ 4 พ.ย. 2569 "อยากแก้แบบทั้งระบบ") ═══
 * 2 กลุ่มชื่อ "หางานขับรถผู้บริหาร" เป็นคนละกลุ่มแต่ได้ลิงก์เดียวกัน (OPL6910066 · OPL6910069 15 กลุ่มได้ 14 ลิงก์)
 * - ตัวแยก = รหัสท้าย /groups/ ใน URL (So Scraping `fb_group_id` — เลข หรือชื่ออังกฤษ) เก็บที่ลิงก์ (`fb_group_id` · 173)
 * - ชื่อลิงก์ของกลุ่มชื่อซ้ำ ต่อท้ายรหัสกลุ่ม → ตารางช่องทางที่อ่านชื่อกลุ่มจากชื่อลิงก์ (`funnelSubOf`) แยกออกเอง
 * - Autopost ใช้ลิงก์เดิมของกลุ่มด้วยรหัสก่อน · ลิงก์เก่า (ไม่มีรหัส) ใช้ต่อได้เฉพาะชื่อที่ไม่ซ้ำ
 */
type SoGroupIdentity = { id: string; name: string | null; fbGroupId?: string | null };

/** รหัสกลุ่มที่ใช้แยกลิงก์ — รหัสใน URL ของ Facebook (ตัวพิมพ์เล็ก) · ไม่มี = รหัสในรายชื่อ So Scraping */
export const soGroupLinkKey = (g: Pick<SoGroupIdentity, 'id' | 'fbGroupId'>): string => (g.fbGroupId ?? '').trim().toLowerCase() || g.id;

const sameGroupName = (n: string | null | undefined) => (n ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** ชื่อ → รหัสกลุ่มที่ใช้ชื่อนั้น · คิดครั้งเดียวต่อรายชื่อ (So Scraping มีกลุ่มราชการ 2,400 กลุ่ม 4 พ.ย. 2569 — ไล่เทียบทุกแถวทำป๊อปหน่วง) */
const nameIndexCache = new WeakMap<readonly SoGroupIdentity[], Map<string, Set<string>>>();
function nameIndexOf(all: readonly SoGroupIdentity[]): Map<string, Set<string>> {
  let idx = nameIndexCache.get(all);
  if (!idx) {
    idx = new Map();
    for (const o of all) {
      const n = sameGroupName(o.name);
      idx.set(n, (idx.get(n) ?? new Set()).add(soGroupLinkKey(o)));
    }
    nameIndexCache.set(all, idx);
  }
  return idx;
}

/** ชื่อกลุ่มบนลิงก์ — ชื่อซ้ำกับกลุ่มอื่นในรายชื่อ So Scraping ต่อท้ายรหัสกลุ่ม ("หางานขับรถผู้บริหาร (423954682082863)") */
export function soGroupLinkName(g: SoGroupIdentity, all: readonly SoGroupIdentity[]): string {
  const name = (g.name ?? '').trim() || soGroupLinkKey(g);
  const keys = nameIndexOf(all).get(sameGroupName(name));
  const twin = Boolean(keys && [...keys].some((k) => k !== soGroupLinkKey(g)));
  return twin ? `${name} (${g.fbGroupId?.trim() || g.id})` : name;
}

/** ลิงก์เดิมของกลุ่มนี้ในประกาศ — รหัสกลุ่มตรงก่อน · ลิงก์เก่าที่ไม่มีรหัสใช้ได้เมื่อชื่อลิงก์ตรง (ชื่อซ้ำมีรหัสต่อท้าย จึงไม่ชนลิงก์เก่า) */
export function soGroupLinkOf<L extends { channelLabel: string | null; fbGroupId?: string | null }>(
  links: readonly L[],
  g: Pick<SoGroupIdentity, 'id' | 'fbGroupId'>,
  label: string,
): L | null {
  const key = soGroupLinkKey(g);
  return links.find((l) => (l.fbGroupId ?? '') === key) ?? links.find((l) => !l.fbGroupId && l.channelLabel === label) ?? null;
}

/** ลิงก์ของแต่ละกลุ่มที่ส่งไปกับใบสั่ง Autopost — So Scraping แทน apply_link ใน caption ด้วยลิงก์ของกลุ่มตอนโพสต์ (สเปก 2 พ.ย. 2569) */
export type SoGroupLink = { group_id: string; apply_link: string; link_code: string };

/** group_links ต้องครบทุกกลุ่มที่เลือก · ลิงก์รูปเดียวกับ apply_link · ไม่มีช่องนี้ = ใบสั่งแบบเดิม (ลิงก์เดียวทุกกลุ่ม) */
export function soGroupLinksError(snap: Record<string, unknown> | null | undefined): string | null {
  if (!snap || snap.group_links === undefined) return null;
  const list = Array.isArray(snap.group_links) ? (snap.group_links as unknown[]) : null;
  const groups = Array.isArray(snap.group_ids) ? snap.group_ids.filter((x): x is string => typeof x === 'string') : [];
  if (!list) return 'ลิงก์ของกลุ่มผิดรูป — ปิดแล้วสั่งใหม่';
  const ok = list.every((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    return typeof r.group_id === 'string' && typeof r.link_code === 'string' && typeof r.apply_link === 'string' && r.apply_link.endsWith(`/apply/p/${r.link_code}`);
  });
  if (!ok) return 'ลิงก์ของกลุ่มผิดรูป — ปิดแล้วสั่งใหม่';
  const covered = new Set(list.map((x) => (x as SoGroupLink).group_id));
  if (groups.some((g) => !covered.has(g))) return 'ยังไม่มีลิงก์ของบางกลุ่ม — ปิดแล้วสั่งใหม่';
  return null;
}

/** กลุ่มที่บัญชีนี้ยังไม่เคยลองโพสต์ใน 30 วัน และกลุ่มไม่ติด — ติ๊กได้ (คำนี้ So Scraping ให้ Jarvis ใช้) */
export const SO_GROUP_UNTRIED = 'ยังไม่เคยลอง';

export type SoGroupView = { label: string; recommended: boolean; detail: string | null; url: string | null };

/**
 * สถานะของกลุ่มเมื่อโพสต์ด้วยบัญชีนี้ (เจ้าของ 2 พ.ย. 2569 "เลือกมาก็เหมือนไม่มีไร" — ติ๊กกลุ่มที่โพสต์ไม่ติดทุกรอบ)
 * กลุ่มติดที่ตัวกลุ่ม (แอดมินพัก) ก่อน → สถานะของบัญชีนี้ → ยังไม่เคยลอง · ลิงก์เอาของบัญชีนี้ (ไปเข้าร่วม/ตอบคำถามเอง)
 */
export function soGroupView(g: Pick<SoOptGroup, 'id' | 'blocked'>, acc: Pick<SoOptAccount, 'groupStatus'> | null): SoGroupView {
  const st = acc?.groupStatus.find((x) => x.groupId === g.id) ?? null;
  if (g.blocked) return { label: g.blocked.label, recommended: false, detail: g.blocked.detail, url: st?.url ?? null };
  if (st) return { label: st.label, recommended: st.recommended, detail: st.detail, url: st.url };
  return { label: SO_GROUP_UNTRIED, recommended: true, detail: null, url: null };
}

/* ═══ กลุ่มราชการ/เอกชน (เจ้าของ 4 พ.ย. 2569 "ตอนเลือกกลุ่มทำให้แยกไว้หน่อย") ═══
 * กลุ่มที่มีอยู่ตอนนี้ทั้งหมด = เอกชน (เจ้าของ "ก็ไอกลุ่มที่มีอะเพื่อโพสต์ เอกชนไง แล้วเดี๋ยวจะเพิ่มกลุ่มที่เป็นราชการมา")
 * ป้ายอยู่ที่รายชื่อกลุ่มของ So Scraping ช่อง `sector` (ที่เดียวกับป้ายธุรกิจ · So Scraping เพิ่มแล้ว c2cb964 + ส่งใน options API)
 * ไม่มีช่องนี้ = ทุกกลุ่มเอกชน · มีช่องแต่ว่าง = ยังไม่ระบุ (ไม่เดา)
 * ป๊อปไม่ติ๊กกลุ่มให้ และหัวข้อย่อยพับไว้ทุกหัวข้อตอนเปิด (เจ้าของ 4 พ.ย. 2569 "ไม่ติ๊กกลุ่มให้เลย" · "อันนี้ย่อไว้")
 */
export const SO_GROUP_SECTOR_BEFORE_TAG: UnitSector = 'private';

/** ค่าราชการ/เอกชนของกลุ่ม — รับทั้งรหัส (government/private) และคำไทย · ค่าอื่น = ยังไม่ระบุ */
export function soGroupSectorOf(v: unknown): UnitSector | null {
  const t = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (t === 'government' || t === 'ราชการ') return 'government';
  if (t === 'private' || t === 'เอกชน') return 'private';
  return null;
}

export type SoSectorBlock<G> = { sector: UnitSector | null; label: string; groups: G[] };

/** แบ่งกลุ่มในหมวดธุรกิจเป็น ราชการ/เอกชน — ประเภทของใบขอขึ้นก่อน · ยังไม่ระบุท้ายสุด · ว่างไม่ขึ้น */
export function soSectorBlocks<G extends { sector?: UnitSector | null }>(groups: readonly G[], jobSector: UnitSector | null): SoSectorBlock<G>[] {
  const order: (UnitSector | null)[] = jobSector === 'government' ? ['government', 'private', null] : ['private', 'government', null];
  return order
    .map((sector) => ({ sector, label: sector ? UNIT_SECTOR_LABEL[sector] : UNIT_SECTOR_UNSET_LABEL, groups: groups.filter((g) => (g.sector ?? null) === sector) }))
    .filter((b) => b.groups.length > 0);
}

/** จังหวัดจากช่อง province ของฐาน So Scraping ("กรุงเทพมหานคร, สมุทรปราการ" · "ทั่วประเทศ") — ทางถอยตอนไม่มี options API */
export function soProvincesOf(province: string | null | undefined): { provinces: string[]; nationwide: boolean } {
  const parts = String(province ?? '').split(/[,،]/).map((v) => v.trim()).filter(Boolean);
  return { provinces: parts.filter((v) => v !== 'ทั่วประเทศ'), nationwide: parts.includes('ทั่วประเทศ') };
}

/* ═══ Journey เลือกบัญชี/กลุ่มในป๊อป Autopost (เจ้าของ 4 พ.ย. 2569 · "หลักการคือ เลือกเฉพาะที่ใช้ได้") ═══
 * 1 บัญชี: ขึ้นเฉพาะบัญชีที่ใช้ได้ (โดนพัก ฯลฯ ซ่อน) · 2 กลุ่ม: ธุรกิจ → เอกชน/ราชการ → จังหวัด (ไม่เลือก = ทุกจังหวัด)
 * รายการกลุ่มขึ้นเฉพาะที่โพสต์ได้ด้วยบัญชีนี้ (แอดมินพัก · ห้ามโพสต์ · ต้องตอบคำถาม · ใบนี้เพิ่งลง = ไม่ขึ้น) · 3 เครื่อง
 */
/** บัญชีที่ขึ้นให้เลือก — พร้อม / มีงานค้างต่อคิวได้ / เครื่องหลักออฟไลน์ (เลือกเครื่องอื่นได้) · พัก ครบโควต้า รอยืนยันตัวตน ไม่มีเครื่อง = ซ่อน */
export const soAccountUsable = (s: SoAccountStatus): boolean => s === 'ready' || s === 'busy' || s === 'worker_offline';

/** กลุ่มที่โพสต์ได้ด้วยบัญชีนี้รอบนี้ — ไม่โดนพัก · สถานะของบัญชีไม่บอกว่าไม่ควร · ใบนี้ไม่ได้เพิ่งลง */
export function soGroupUsable(g: Pick<SoOptGroup, 'id' | 'blocked' | 'repostWait'>, acc: Pick<SoOptAccount, 'groupStatus'> | null): boolean {
  return !g.blocked && !g.repostWait && soGroupView(g, acc).recommended;
}

export type SoGroupFilter = { bu: string | null; sector: UnitSector | null; province: string };
type FilterGroup = Pick<SoOptGroup, 'department' | 'sector' | 'provinces' | 'nationwide'>;

/** ตัวเลือกธุรกิจ (มีกลุ่มอยู่จริง · ของใบขอก่อน) */
export function soFilterBus(groups: readonly FilterGroup[], jobBu: string | null): { value: string | null; label: string }[] {
  const keys = new Set(groups.map((g) => g.department ?? null));
  return buOrder(keys, jobBu).map((bu) => ({ value: bu, label: bu ?? SO_BU_NONE_LABEL }));
}

/** ตัวเลือกเอกชน/ราชการ ของธุรกิจที่เลือก (มีกลุ่มอยู่จริง · ประเภทของใบขอก่อน) */
export function soFilterSectors(groups: readonly FilterGroup[], bu: string | null, jobSector: UnitSector | null): { value: UnitSector | null; label: string }[] {
  return soSectorBlocks(groups.filter((g) => (g.department ?? null) === bu), jobSector).map((b) => ({ value: b.sector, label: b.label }));
}

/** ตัวเลือกจังหวัดของธุรกิจ+ประเภทที่เลือก เรียงตามตัวอักษร */
export function soFilterProvinces(groups: readonly FilterGroup[], bu: string | null, sector: UnitSector | null): string[] {
  const set = new Set<string>();
  for (const g of groups) if ((g.department ?? null) === bu && (g.sector ?? null) === sector) for (const p of g.provinces) set.add(p);
  return [...set].sort((a, b) => a.localeCompare(b, 'th'));
}

/** กลุ่มตามตัวกรอง — เลือกจังหวัด = กลุ่มของจังหวัดนั้นก่อน แล้วกลุ่มทั่วประเทศต่อท้าย · ไม่เลือก = ทุกกลุ่ม */
export function soFilterGroups<G extends FilterGroup>(groups: readonly G[], f: SoGroupFilter): G[] {
  const base = groups.filter((g) => (g.department ?? null) === f.bu && (g.sector ?? null) === f.sector);
  if (!f.province) return base;
  return [...base.filter((g) => g.provinces.includes(f.province)), ...base.filter((g) => g.nationwide && !g.provinces.includes(f.province))];
}

/** หัวหมวด "LBD · ติ๊กไว้ 29 จาก 37 · ติด 8" — ติด = กลุ่มที่ไม่ควรติ๊กสำหรับบัญชีนี้ */
export function soSectionHeadText(sec: Pick<SoGroupSection, 'label' | 'groups'>, picked: readonly string[], acc: Pick<SoOptAccount, 'groupStatus'> | null): string {
  const n = sec.groups.filter((g) => picked.includes(g.id)).length;
  const stuck = sec.groups.filter((g) => !soGroupView(g, acc).recommended).length;
  return [sec.label, `ติ๊กไว้ ${n} จาก ${sec.groups.length}`, ...(stuck ? [`ติด ${stuck}`] : [])].join(' · ');
}

/** ธุรกิจของใบขอยังไม่มีกลุ่มเลย — บอกว่าไปเพิ่มที่ไหน ไม่ปล่อยรายการว่าง */
export function soBuEmptyText(bu: string): string {
  return `ยังไม่มีกลุ่มของ ${bu} ใน So Scraping — เพิ่มที่ ตั้งค่า → กลุ่มโพสต์ หรือเลือกจากธุรกิจอื่น`;
}

/** ธุรกิจของใบขอยังไม่มีบัญชี Facebook เลย — บอกว่าไปเพิ่มที่ไหน */
export function soBuNoAccountText(bu: string): string {
  return `ยังไม่มีบัญชี Facebook ของธุรกิจ ${bu} ใน So Scraping — เพิ่มที่ ตั้งค่า → บัญชีที่ใช้งาน หรือเลือกจากธุรกิจอื่น`;
}

/** ลำดับหัวธุรกิจ: ของใบขอก่อน → ธุรกิจอื่นเรียงรหัส → ไม่ระบุท้ายสุด (ใช้ทั้งบัญชีและกลุ่ม) */
function buOrder(keys: Iterable<string | null>, jobBu: string | null): (string | null)[] {
  const set = new Set(keys);
  const codes = [...set].filter((k): k is string => k !== null && k !== jobBu).sort((a, b) => a.localeCompare(b));
  return [...(jobBu && set.has(jobBu) ? [jobBu] : []), ...codes, ...(set.has(null) ? [null] : [])];
}

/** บัญชี Facebook เรียงเป็นก้อนตามธุรกิจ (ธุรกิจของใบขอก่อน) · `group` = หัวในช่องเลือก */
export function soAccountsByBu<A extends Pick<SoOptAccount, 'department'>>(accounts: readonly A[], jobBu: string | null): Array<{ account: A; group: string }> {
  return buOrder(
    accounts.map((a) => a.department ?? null),
    jobBu,
  ).flatMap((bu) => accounts.filter((a) => (a.department ?? null) === bu).map((account) => ({ account, group: bu ?? SO_BU_NONE_LABEL })));
}

/** บัญชีที่ให้ช่องเลือกตั้งต้น = บัญชีธุรกิจเดียวกับใบขอ · ใบขอไม่ระบุธุรกิจ = ทุกบัญชี · ธุรกิจของใบไม่มีบัญชี = ว่าง (ไม่เลือกให้ข้ามธุรกิจ) */
export function soAccountsForJob<A extends Pick<SoOptAccount, 'department'>>(accounts: readonly A[], jobBu: string | null): A[] {
  return jobBu ? accounts.filter((a) => a.department === jobBu) : [...accounts];
}

/**
 * options API ยังไม่ส่งธุรกิจของกลุ่ม/บัญชี — เติมจากฐานของ So Scraping (อ่านอย่างเดียว)
 * ตัวที่ API ส่ง department มาเองไม่ทับ
 */
export function withSoDepartments(
  o: SoOptions,
  db: {
    groups: ReadonlyArray<{ id: string; department: string | null; sector?: UnitSector | null; province?: string | null }>;
    accounts: ReadonlyArray<{ id: string; department: string | null }>;
  },
): SoOptions {
  const g = new Map(db.groups.map((x) => [x.id, normalizeTrendBu(x.department)]));
  // ราชการ/เอกชน: options API ยังไม่ส่ง — เติมจากรายชื่อกลุ่มในฐาน So Scraping (4 พ.ย. 2569)
  const sec = new Map(db.groups.map((x) => [x.id, x.sector ?? null]));
  // จังหวัด: options API รุ่นก่อน 4 พ.ย. 2569 ยังไม่ส่ง — เติมจากช่อง province ในฐาน
  const prov = new Map(db.groups.map((x) => [x.id, soProvincesOf(x.province)]));
  const a = new Map(db.accounts.map((x) => [x.id, normalizeTrendBu(x.department)]));
  return {
    ...o,
    groups: o.groups.map((x) => ({
      ...x,
      department: x.department ?? g.get(x.id) ?? null,
      sector: x.sector ?? sec.get(x.id) ?? null,
      ...(x.provinces.length || x.nationwide ? {} : (prov.get(x.id) ?? {})),
    })),
    accounts: o.accounts.map((x) => (x.department ? x : { ...x, department: a.get(x.id) ?? null })),
  };
}

const ACCOUNT_STATUSES: readonly SoAccountStatus[] = ['ready', 'busy', 'full', 'paused', 'worker_offline', 'no_worker', 'needs_verification'];
const SCRAPE_STATUSES: readonly SoScrapeStatus[] = ['ready', 'full', 'cooldown', 'disabled'];
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** ลิงก์ที่เปิดให้คนกดได้ — https เท่านั้น (กันลิงก์แปลกจากข้อมูลภายนอก) */
const httpsUrl = (v: unknown): string | null => {
  const t = str(v);
  if (!t) return null;
  try {
    return new URL(t).protocol === 'https:' ? t : null;
  } catch {
    return null;
  }
};
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);
const queueOf = (v: unknown): SoQueue => {
  const q = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { running: num(q.running) ?? 0, queued: num(q.queued) ?? 0 };
};

/**
 * คำตอบดิบของ options API → รูปที่จอใช้ · ไม่มี accounts/groups/workers/scrape_accounts = ผิดรูป (null)
 * สถานะที่ไม่รู้จัก = ถือว่าเลือกไม่ได้ (บัญชี → unknown แสดง warning ตรง ๆ · บัญชี Scrap → disabled) — fail-safe ไปทางไม่ส่ง
 */
export function parseSoOptions(raw: unknown): SoOptions | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (![r.accounts, r.groups, r.workers, r.scrape_accounts].every(Array.isArray)) return null;
  const rows = (v: unknown) => (v as unknown[]).filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object');
  const accounts = rows(r.accounts)
    .filter((a) => str(a.id))
    .map((a): SoOptAccount => ({
      id: str(a.id)!,
      name: str(a.name) ?? str(a.id)!,
      worker: str(a.worker),
      workerOnline: a.worker_online === true,
      postedToday: num(a.posted_today) ?? 0,
      dailyCap: num(a.daily_cap),
      remainingToday: num(a.remaining_today),
      pausedUntil: str(a.paused_until),
      pauseReason: str(a.pause_reason),
      queue: queueOf(a.queue),
      status: ACCOUNT_STATUSES.includes(a.status as SoAccountStatus) ? (a.status as SoAccountStatus) : 'unknown',
      warning: str(a.warning),
      recommended: a.recommended === true,
      needsVerificationSince: str(a.needs_verification_since),
      groupIds: strs(a.group_ids),
      sessionWorkers: strs(a.session_workers),
      department: normalizeTrendBu(str(a.department)),
      groupStatus: rows(Array.isArray(a.group_status) ? a.group_status : [])
        .filter((x) => str(x.group_id) && str(x.label))
        .map((x): SoGroupState => ({
          groupId: str(x.group_id)!,
          state: str(x.state) ?? 'unknown',
          label: str(x.label)!,
          recommended: x.recommended !== false,
          detail: str(x.detail),
          url: httpsUrl(x.url),
          seenAt: str(x.seen_at),
        })),
    }));
  const groups = rows(r.groups)
    .filter((g) => str(g.id))
    .map((g): SoOptGroup => ({
      id: str(g.id)!,
      fbGroupId: str(g.fb_group_id),
      name: str(g.name),
      url: str(g.url),
      accountIds: strs(g.account_ids),
      lastPostedAt: str(g.last_posted_at),
      department: normalizeTrendBu(str(g.department)),
      sector: soGroupSectorOf(g.sector),
      provinces: strs(g.provinces).map((p) => p.trim()),
      nationwide: g.nationwide === true,
      blocked:
        g.blocked && typeof g.blocked === 'object' && str((g.blocked as Record<string, unknown>).label)
          ? (() => {
              const b = g.blocked as Record<string, unknown>;
              return { state: str(b.state) ?? 'blocked', label: str(b.label)!, detail: str(b.detail), seenAt: str(b.seen_at) };
            })()
          : null,
      repostWait:
        g.repost_wait && typeof g.repost_wait === 'object'
          ? (() => {
              const w = g.repost_wait as Record<string, unknown>;
              return { requestNo: str(w.request_no), lastPostedAt: str(w.last_posted_at), availableAt: str(w.available_at) };
            })()
          : null,
      stats30d:
        g.stats_30d && typeof g.stats_30d === 'object'
          ? (() => {
              const st = g.stats_30d as Record<string, unknown>;
              return { attempts: num(st.attempts) ?? 0, posted: num(st.posted) ?? 0, comments: num(st.comments) ?? 0, phoneLeads: num(st.phone_leads) ?? 0 };
            })()
          : null,
    }));
  const workers = rows(r.workers)
    .filter((w) => str(w.name))
    .map((w): SoOptWorker => ({
      name: str(w.name)!,
      online: w.online === true,
      lastSeen: str(w.last_seen),
      load: num(w.load) ?? 0,
      kinds: strs(w.kinds),
      postQueue: queueOf(w.post_queue),
      scrapeQueue: queueOf(w.scrape_queue),
      fbAccountIds: strs(w.fb_account_ids),
      recommended: (() => {
        const rc = (w.recommended && typeof w.recommended === 'object' ? w.recommended : {}) as Record<string, unknown>;
        return { post: rc.post === true, scrape: rc.scrape === true };
      })(),
    }));
  const scrapeAccounts = rows(r.scrape_accounts)
    .filter((s) => str(s.id))
    .map((s): SoScrapeAccount => ({
      id: str(s.id)!,
      platform: str(s.platform) ?? '',
      label: str(s.label) ?? str(s.id)!,
      status: SCRAPE_STATUSES.includes(s.status as SoScrapeStatus) ? (s.status as SoScrapeStatus) : 'disabled',
      warning: str(s.warning),
      usedToday: num(s.platform_used_today) ?? 0,
      cap: num(s.platform_cap),
      cooldownUntil: str(s.cooldown_until),
    }));
  return { source: 'api', accounts, groups, workers, scrapeAccounts };
}

/** ชื่อเว็บของบัญชี Scrap */
export function soPlatformLabel(p: string): string {
  return p === 'jobthai' ? 'JobThai' : p === 'jobbkk' ? 'JobBKK' : p || 'อื่น ๆ';
}

/** โควต้าที่เว็บของบัญชีนี้เหลือวันนี้ = เพดานจำนวนคนที่สั่ง Scrap ได้ · ไม่รู้เพดาน = null (ไม่จำกัด) */
export function soScrapeRemaining(s: Pick<SoScrapeAccount, 'cap' | 'usedToday'>): number | null {
  return s.cap === null ? null : Math.max(0, s.cap - s.usedToday);
}

/** ตัวเลือกบัญชี JobThai/JobBKK — ชื่อ · คำสถานะ + สี (แบบเดียวกับบัญชี Facebook · เจ้าของ 3 พ.ย. 2569 "เลือกได้แบบเดียวกัน") */
export function soScrapeChoice(s: Pick<SoScrapeAccount, 'platform' | 'label' | 'status' | 'cap' | 'usedToday' | 'cooldownUntil' | 'warning'>): {
  label: string;
  disabled: boolean;
  tone: 'success' | 'warn' | 'danger';
} {
  const name = `${soPlatformLabel(s.platform)} · ${s.label}`;
  const left = soScrapeRemaining(s);
  if (s.status === 'ready') return { label: `${name} · พร้อมใช้${left !== null ? ` · เหลือ ${left.toLocaleString('th-TH')} คนวันนี้` : ''}`, disabled: false, tone: 'success' };
  if (s.status === 'full') return { label: `${name} · ครบโควต้าวันนี้ (${s.usedToday.toLocaleString('th-TH')}/${(s.cap ?? s.usedToday).toLocaleString('th-TH')})`, disabled: false, tone: 'warn' };
  if (s.status === 'cooldown') {
    const until = s.cooldownUntil && !Number.isNaN(Date.parse(s.cooldownUntil)) ? ` ใช้ได้ ${BKK_TIME.format(new Date(s.cooldownUntil))}` : '';
    return { label: `${name} · พักชั่วคราว${until}`, disabled: true, tone: 'danger' };
  }
  return { label: `${name} · ${s.warning ?? 'ปิดใช้งาน'}`, disabled: true, tone: 'danger' };
}

/** บัญชี Scrap ตั้งต้น = พร้อมใช้ที่เหลือโควต้ามากสุด · ไม่มี = null */
export function soDefaultScrapeAccount<A extends Pick<SoScrapeAccount, 'status' | 'cap' | 'usedToday'>>(list: readonly A[]): A | null {
  const ready = list.filter((s) => s.status === 'ready');
  return ready.sort((a, b) => (soScrapeRemaining(b) ?? Infinity) - (soScrapeRemaining(a) ?? Infinity))[0] ?? null;
}

/** ติ๊กไว้ให้ก่อน = บัญชีพร้อมใช้ตัวแรกของแต่ละเว็บ */
export function defaultScrapeIds(list: readonly SoScrapeAccount[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    if (s.status !== 'ready' || seen.has(s.platform)) continue;
    seen.add(s.platform);
    out.push(s.id);
  }
  return out;
}

/**
 * ตรวจค่าที่เลือกฝั่ง server เทียบกับ options ตอนกดส่ง — คืนข้อความ · ผ่าน = null
 * บัญชีต้องมีจริง เลือกได้ และผูกทุกกลุ่ม · บัญชี Scrap ต้องมีจริงและเลือกได้
 */
export function soPickError(
  o: SoOptions,
  type: 'content' | 'scraping',
  snap: Record<string, unknown> | null,
): string | null {
  const workerError = (field: string, kind: SoWorkerKind): string | null => {
    const v = snap?.[field];
    if (v === undefined || v === null) return null;
    const w = typeof v === 'string' ? o.workers.find((x) => x.name === v) : undefined;
    if (!w) return 'ไม่พบเครื่องนี้ในระบบ So Scraping แล้ว — ปิดแล้วเลือกใหม่';
    if (!w.kinds.includes(kind)) return `เครื่อง ${w.name} รับงาน${kind === 'autopost' ? 'โพสต์' : ' Scrap '}ไม่ได้ — เลือกเครื่องอื่น`;
    return null;
  };
  if (type === 'scraping') {
    const we = workerError('scrape_worker', 'scraper');
    if (we) return we;
    // ใส่ key แล้ว (มีรายชื่อบัญชีจาก API) ต้องเลือกอย่างน้อย 1 บัญชี — start ของ So Scraping บังคับ
    if (snap?.scrape_connector_ids === undefined) {
      return o.source === 'api' && o.scrapeAccounts.length > 0 ? 'เลือกบัญชี JobThai/JobBKK อย่างน้อย 1 บัญชี' : null;
    }
    const ids = strs(snap.scrape_connector_ids);
    if (!Array.isArray(snap.scrape_connector_ids) || ids.length !== snap.scrape_connector_ids.length) return 'บัญชี JobThai/JobBKK ไม่ถูกต้อง';
    for (const id of ids) {
      const s = o.scrapeAccounts.find((x) => x.id === id);
      if (!s) return 'ไม่พบบัญชี JobThai/JobBKK นี้ในระบบ So Scraping แล้ว — ปิดแล้วเลือกใหม่';
      if (!soScrapeSelectable(s.status)) return soWarningText(s.label, s.status, s.warning);
    }
    // จำนวนคน (3 พ.ย. 2569): ต้องเป็นจำนวนเต็ม ≥ 1 และไม่เกินโควต้าที่เว็บของบัญชีแรกเหลือวันนี้
    if (snap.scrape_target !== undefined) {
      const t = snap.scrape_target;
      if (typeof t !== 'number' || !Number.isInteger(t) || t < 1) return 'จำนวนคนต้องเป็นตัวเลข 1 ขึ้นไป';
      const first = o.scrapeAccounts.find((x) => x.id === ids[0]);
      const left = first ? soScrapeRemaining(first) : null;
      if (left !== null && t > left) return `เว็บนี้วันนี้เหลือโควต้า ${left} คน — ลดจำนวน หรือเลือกเว็บอื่น`;
    }
    return null;
  }
  const picked = strs(snap?.group_ids);
  const we = workerError('worker', 'autopost');
  if (we) return we;
  const known = new Set(o.groups.map((g) => g.id));
  if (picked.some((g) => !known.has(g))) return 'มีกลุ่มที่ไม่อยู่ในระบบ So Scraping แล้ว — ปิดแล้วเลือกใหม่';
  if (typeof snap?.account_id !== 'string') return null;
  const acc = o.accounts.find((a) => a.id === snap.account_id);
  if (!acc) return 'ไม่พบบัญชี Facebook นี้ในระบบ So Scraping แล้ว — ปิดแล้วเลือกใหม่';
  if (!soAccountSelectable(acc.status)) return soWarningText(acc.name, acc.status, acc.warning);
  // เกินโพสต์ที่บัญชีเหลือวันนี้ = worker หยุดเองที่เพดาน กลุ่มที่เหลือไม่ได้โพสต์ (สเปค 6.2) — กันฝั่ง server ด้วย
  if (acc.remainingToday !== null && picked.length > acc.remainingToday) {
    return `บัญชี ${acc.name} เหลือโพสต์วันนี้ ${acc.remainingToday} กลุ่ม — ลดกลุ่ม หรือสั่งใบใหม่ด้วยบัญชีอื่น`;
  }
  const mine = new Set(soGroupsOfAccount(o, acc).map((g) => g.id));
  if (picked.some((g) => !mine.has(g))) return `มีกลุ่มที่บัญชี ${acc.name} โพสต์ไม่ได้ — เลือกกลุ่มใหม่`;
  return null;
}

/** ผลเรียก start ที่ server ส่งกลับมากับคำขอ (เอกสารรอบ 3) */
export type SoStartView =
  | { state: 'started'; worker: string | null; preflightQueued: boolean; queued: boolean | null; message: string | null; skippedGroups?: number }
  | { state: 'already' }
  | { state: 'error'; message: string }
  | { state: 'skipped' };

/** ข้อความบนจอหลังส่ง — null = ไม่ต้องบอกอะไรเพิ่ม (ยังไม่ใส่ key) · tone ใช้สีของ TONE */
export function soStartText(r: SoStartView | null | undefined): { text: string; tone: ToneKey; canRetry: boolean } | null {
  if (!r || r.state === 'skipped') return null;
  if (r.state === 'already') return { text: 'So Scraping เริ่มงานใบนี้ไปแล้ว', tone: 'success', canRetry: false };
  if (r.state === 'error') return { text: r.message, tone: 'danger', canRetry: true };
  if (r.queued === false) return { text: r.message ?? 'สร้างงานแล้วแต่ยังเริ่มไม่ได้', tone: 'warn', canRetry: false };
  const parts = [`เริ่มงานแล้ว${r.worker ? ` ที่เครื่อง ${r.worker}` : ''}`];
  if (r.preflightQueued) parts.push('บัญชีต้องทดสอบก่อน งานจะเริ่มช้าขึ้นราว 1 นาที');
  // ข้ามกลุ่มที่ใบนี้เพิ่งลง (สเปค 6.4) — ข้อความไทยจาก So Scraping ขึ้นทันทีหลังกดสั่ง
  if ((r.skippedGroups ?? 0) > 0 && r.message) return { text: [...parts, r.message].join(' · '), tone: 'warn', canRetry: false };
  return { text: parts.join(' · '), tone: 'success', canRetry: false };
}
