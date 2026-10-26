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

/* ═══ ตัวเลือกตอนสั่งงาน จาก So Scraping options API (เจ้าของ 26 ต.ค. 2569 "ทำเลย ตามเอกสาร") ═══
 * GET so-scraping/api/integrations/jarvis/options (x-api-key ฝั่ง server เท่านั้น · ดึงใหม่ทุกครั้งที่เปิดฟอร์ม ไม่ cache)
 * status ทุกตัวมาจาก So Scraping — Jarvis ไม่คิดเอง · ข้อความ `warning` เป็นไทยจากฝั่งนั้น ใช้ในป๊อปเตือนได้เลย
 * ยังไม่ได้ใส่ key = อ่านจากฐานของ So Scraping แบบเดิม (`source: 'db'` · ทางถอย) */

export type SoAccountStatus = 'ready' | 'busy' | 'full' | 'paused' | 'worker_offline' | 'no_worker';
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
  groupIds: string[];
};
export type SoOptGroup = { id: string; fbGroupId: string | null; name: string | null; url: string | null; accountIds: string[]; lastPostedAt: string | null };
export type SoOptWorker = { name: string; online: boolean; lastSeen: string | null; load: number };
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
};
export const SO_SCRAPE_STATUS_LABEL: Record<SoScrapeStatus, string> = {
  ready: 'พร้อมใช้',
  full: 'ครบโควต้าวันนี้',
  cooldown: 'พักชั่วคราว',
  disabled: 'ปิดใช้งาน',
};

/** เลือกบัญชี Facebook นี้ได้ไหม — ตามตารางในเอกสาร (paused/worker_offline/no_worker = ไม่ได้) */
export const soAccountSelectable = (s: SoAccountStatus): boolean => s === 'ready' || s === 'busy' || s === 'full';
/** เลือกบัญชี JobThai/JobBKK นี้ได้ไหม (cooldown/disabled = ไม่ได้) */
export const soScrapeSelectable = (s: SoScrapeStatus): boolean => s === 'ready' || s === 'full';
/** ต้องขึ้นป๊อปเตือนก่อนส่งไหม (full ยืนยันแล้วส่งต่อได้) */
export const soAccountNeedsConfirm = (s: SoAccountStatus): boolean => s === 'full';
export const soScrapeNeedsConfirm = (s: SoScrapeStatus): boolean => s === 'full';

/** ข้อความในป๊อปเตือน — ใช้ `warning` ของ So Scraping ก่อน ไม่มีค่อยใช้ชื่อสถานะ */
export function soWarningText(name: string, status: SoAccountStatus | SoScrapeStatus, warning: string | null): string {
  const label = (SO_ACCOUNT_STATUS_LABEL as Record<string, string>)[status] ?? (SO_SCRAPE_STATUS_LABEL as Record<string, string>)[status] ?? status;
  return (warning ?? '').trim() || `บัญชี ${name} ${label}`;
}

/** ชื่อกลุ่ม — ยังไม่มีชื่อ (บอทยังไม่เคยเข้าไปอ่าน) ใช้เลขกลุ่มแล้วต่อท้าย "ยังไม่มีชื่อ" */
export function soGroupLabel(g: Pick<SoOptGroup, 'name' | 'fbGroupId' | 'id'>): string {
  const name = (g.name ?? '').trim();
  return name || `${g.fbGroupId || g.id} · ยังไม่มีชื่อ`;
}

/** กลุ่มของบัญชีนี้ — อยู่ใน `group_ids` ของบัญชี หรือบัญชีอยู่ใน `account_ids` ของกลุ่ม */
export function soGroupsOfAccount(o: Pick<SoOptions, 'groups'>, acc: Pick<SoOptAccount, 'id' | 'groupIds'> | null): SoOptGroup[] {
  if (!acc) return [];
  return o.groups.filter((g) => acc.groupIds.includes(g.id) || g.accountIds.includes(acc.id));
}

const ACCOUNT_STATUSES: readonly SoAccountStatus[] = ['ready', 'busy', 'full', 'paused', 'worker_offline', 'no_worker'];
const SCRAPE_STATUSES: readonly SoScrapeStatus[] = ['ready', 'full', 'cooldown', 'disabled'];
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);
const queueOf = (v: unknown): SoQueue => {
  const q = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { running: num(q.running) ?? 0, queued: num(q.queued) ?? 0 };
};

/**
 * คำตอบดิบของ options API → รูปที่จอใช้ · ไม่มี accounts/groups/workers/scrape_accounts = ผิดรูป (null)
 * สถานะที่ไม่รู้จัก = ถือว่าเลือกไม่ได้ (บัญชี → no_worker · บัญชี Scrap → disabled) — fail-safe ไปทางไม่ส่ง
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
      status: ACCOUNT_STATUSES.includes(a.status as SoAccountStatus) ? (a.status as SoAccountStatus) : 'no_worker',
      warning: str(a.warning),
      groupIds: strs(a.group_ids),
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
    }));
  const workers = rows(r.workers)
    .filter((w) => str(w.name))
    .map((w): SoOptWorker => ({ name: str(w.name)!, online: w.online === true, lastSeen: str(w.last_seen), load: num(w.load) ?? 0 }));
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
  if (type === 'scraping') {
    if (snap?.scrape_connector_ids === undefined) return null;
    const ids = strs(snap.scrape_connector_ids);
    if (!Array.isArray(snap.scrape_connector_ids) || ids.length !== snap.scrape_connector_ids.length) return 'บัญชี JobThai/JobBKK ไม่ถูกต้อง';
    for (const id of ids) {
      const s = o.scrapeAccounts.find((x) => x.id === id);
      if (!s) return 'ไม่พบบัญชี JobThai/JobBKK นี้ในระบบ So Scraping แล้ว — ปิดแล้วเลือกใหม่';
      if (!soScrapeSelectable(s.status)) return soWarningText(s.label, s.status, s.warning);
    }
    return null;
  }
  const picked = strs(snap?.group_ids);
  const known = new Set(o.groups.map((g) => g.id));
  if (picked.some((g) => !known.has(g))) return 'มีกลุ่มที่ไม่อยู่ในระบบ So Scraping แล้ว — ปิดแล้วเลือกใหม่';
  if (typeof snap?.account_id !== 'string') return null;
  const acc = o.accounts.find((a) => a.id === snap.account_id);
  if (!acc) return 'ไม่พบบัญชี Facebook นี้ในระบบ So Scraping แล้ว — ปิดแล้วเลือกใหม่';
  if (!soAccountSelectable(acc.status)) return soWarningText(acc.name, acc.status, acc.warning);
  const mine = new Set(soGroupsOfAccount(o, acc).map((g) => g.id));
  if (picked.some((g) => !mine.has(g))) return `มีกลุ่มที่บัญชี ${acc.name} โพสต์ไม่ได้ — เลือกกลุ่มใหม่`;
  return null;
}
