/**
 * ═══ ผู้สมัครเข้าระบบทางไหน — ตัวตัดสินเดียวของแถว "ผู้สมัครเข้าระบบ" หน้าหลัก (เจ้าของ 22 พ.ย. 2569) ═══
 * > "ผู้สมัครเข้าระบบ ฉันว่าข้อมูลไม่ตรง" → Choice "แตกคนคีย์/นำเข้าให้เห็นที่มา" (นิยามเดิม ไม่เปลี่ยนเลขหน้าอื่น)
 *
 * ระบบพามา: สมัครเอง (ไม่มีชื่อคนสร้าง) · ดึง iRecruit (`source = irecruit`) · So Scraping ส่งเข้ามา (คนสร้าง = So Scraping)
 * คนพามา (มีชื่อเจ้าหน้าที่เป็นคนสร้าง) แตกตามช่องทางที่เจ้าหน้าที่เลือกตอนคีย์/นำเข้า:
 *   เว็บหางาน (JobThai · JOBBKK — ส่วนใหญ่นำเข้า Excel) · Facebook · TikTok · ช่องทางอื่น/ไม่ระบุ
 * ข้อมูลจริง 1–22 พ.ย. 2569: คนคีย์/นำเข้า 2,275 = เว็บหางาน 1,531 + Facebook 562 + TikTok 181 + อื่น 1
 * ใช้ทั้งเลขบนแถว (`/api/home-ai-share` proportion) และแผงไล่เดือน (`/api/home-drill`) — ห้ามเขียนกติกานี้ซ้ำใน SQL
 */
import type { ToneKey } from './designTokens';

export const SO_SCRAPING_CREATOR = 'So Scraping';

export const ENTRY_KINDS = ['self', 'irecruit', 'soScraping', 'staffWebjob', 'staffFacebook', 'staffTiktok', 'staffOther'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const SYSTEM_ENTRY_KINDS: readonly EntryKind[] = ['self', 'irecruit', 'soScraping'];

export const ENTRY_KIND_META: Record<EntryKind, { label: string; short: string; tone: ToneKey }> = {
  self: { label: 'สมัครเองผ่านลิงก์ / หน้าประกาศ', short: 'สมัครเอง', tone: 'primary' },
  irecruit: { label: 'ดึงจาก iRecruit', short: 'ดึง iRecruit', tone: 'primary' },
  soScraping: { label: 'So Scraping ส่งเข้ามา', short: 'So Scraping', tone: 'primary' },
  staffWebjob: { label: 'เจ้าหน้าที่นำเข้าจากเว็บหางาน', short: 'เว็บหางาน', tone: 'violet' },
  staffFacebook: { label: 'เจ้าหน้าที่คีย์จาก Facebook', short: 'Facebook', tone: 'violet' },
  staffTiktok: { label: 'เจ้าหน้าที่คีย์จาก TikTok', short: 'TikTok', tone: 'violet' },
  staffOther: { label: 'เจ้าหน้าที่คีย์จากช่องทางอื่น', short: 'อื่น ๆ', tone: 'violet' },
};

export type EntryRow = { source: string | null; createdBy: string | null; channelLabel: string | null };

export function entryKindOf(r: EntryRow): EntryKind {
  if ((r.source ?? '').trim().toLowerCase() === 'irecruit') return 'irecruit';
  const by = (r.createdBy ?? '').trim();
  if (!by) return 'self';
  if (by === SO_SCRAPING_CREATOR) return 'soScraping';
  // ช่องทางเป็น "กลุ่ม · ช่องทางย่อย" (เช่น "Webjob · Jobthai") — ใช้กลุ่ม
  const group = (r.channelLabel ?? '').split('·')[0].trim().toLowerCase();
  if (group === 'webjob') return 'staffWebjob';
  if (group === 'facebook') return 'staffFacebook';
  if (group === 'tiktok') return 'staffTiktok';
  return 'staffOther';
}

export type EntryCounts = Record<EntryKind, number>;
export const emptyEntryCounts = (): EntryCounts => Object.fromEntries(ENTRY_KINDS.map((k) => [k, 0])) as EntryCounts;

/** แถวที่ฐานจัดกลุ่มมาแล้ว (ช่องดิบ + จำนวน) → จำนวนต่อทาง */
export function summarizeEntry(rows: ReadonlyArray<EntryRow & { n: number }>): EntryCounts {
  const out = emptyEntryCounts();
  for (const r of rows) out[entryKindOf(r)] += Number(r.n) || 0;
  return out;
}

export const entrySystemTotal = (c: EntryCounts) => SYSTEM_ENTRY_KINDS.reduce((s, k) => s + c[k], 0);
export const entryStaffTotal = (c: EntryCounts) => ENTRY_KINDS.filter((k) => !SYSTEM_ENTRY_KINDS.includes(k)).reduce((s, k) => s + c[k], 0);
