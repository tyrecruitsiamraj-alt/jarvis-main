/**
 * ═══ Scrap ทีเดียวทั้งหน้าใบขอ (เจ้าของ 23 พ.ย. 2569) ═══
 * > "หน้าใบขอ ให้ Scraping ทีเดียวได้ทั้งหน้า โดยสามารถระบุได้ว่าจะเอาใบขอละกี่ Resume
 * >  พอเลือกแล้วก็เอาเด้ง Pop up ให้เลือกเหมือนเวลา Scrap ปกติ"
 *
 * ใบที่สั่งได้ใช้ด่านเดียวกับปุ่ม Scrap ของใบเดียว (`soScrapMissing` · ใบที่ So Scraping กำลังทำอยู่สั่งซ้ำไม่ได้)
 * ไม่ตั้งด่านใหม่ · รวมจำนวนทั้งหน้าต้องไม่เกินโควต้าที่เว็บนั้นเหลือวันนี้ (ด่านเดียวกับใบเดียว แต่นับรวม)
 * ไฟล์นี้ pure — เทสต์ `tests/api/bulkScrap2569-11-23.test.ts`
 */
import type { JobRequest } from '@/types';
import { publicJobTitle } from './publicJobTitle';
import { soScrapMissing, soStatusView } from './soScraping';

export type BulkScrapRow = {
  job: JobRequest;
  /** null = สั่งได้ · มีค่า = เหตุที่ข้าม (คำบนจอ) */
  skip: string | null;
};

/** ใบในหน้านี้ → สั่งได้ / ข้ามเพราะอะไร · `latest` = คำขอล่าสุดต่อ (ใบ, ประเภท) ของทุกใบ (`fetchBoardJobPostings`) */
export function bulkScrapRows(
  jobs: readonly JobRequest[],
  latest: ReadonlyArray<{ job_id: string; request_type: string; status: string; created_at: string }>,
  nowMs = Date.now(),
): BulkScrapRow[] {
  const openScrap = new Set(latest.filter((p) => p.request_type === 'scraping' && soStatusView(p, nowMs).open).map((p) => p.job_id));
  return jobs.map((job) => {
    const missing = soScrapMissing(job, publicJobTitle(job));
    if (missing.length > 0) return { job, skip: `ใบขอขาด${missing.join(' · ')}` };
    if (openScrap.has(job.id)) return { job, skip: 'So Scraping กำลัง Scrap ใบนี้อยู่' };
    return { job, skip: null };
  });
}

/** ตัวเลขในช่อง "ใบละกี่ Resume" — จำนวนเต็ม 1 ขึ้นไป · อย่างอื่น = null */
export function parsePerRequest(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

/** ค่าเริ่มของ "ใบละกี่ Resume" = แบ่งโควต้าที่เหลือเท่า ๆ กัน (ไม่เกิน 20) · ไม่รู้โควต้า = 10 */
export const BULK_SCRAP_DEFAULT_PER = 10;
export const BULK_SCRAP_MAX_DEFAULT = 20;
export function defaultPerRequest(remaining: number | null, count: number): number {
  if (remaining === null || count <= 0) return BULK_SCRAP_DEFAULT_PER;
  return Math.max(1, Math.min(BULK_SCRAP_MAX_DEFAULT, Math.floor(remaining / count)));
}

/** สิ่งที่ยังสั่งไม่ได้ — บอกครบ ไม่ใช่ปุ่มเทาเฉย ๆ (แบบเดียวกับป๊อปใบเดียว) */
export function bulkScrapProblems(input: { ready: number; perRequest: number | null; remaining: number | null; accountMissing: boolean; accountBlocked: string | null }): string[] {
  const out: string[] = [];
  if (input.ready === 0) out.push('หน้านี้ไม่มีใบที่สั่ง Scrap ได้');
  if (input.accountMissing) out.push('เลือกบัญชี JobThai/JobBKK');
  if (input.accountBlocked) out.push(input.accountBlocked);
  if (input.perRequest === null) out.push('ใส่จำนวน Resume ต่อใบ (ตัวเลข 1 ขึ้นไป)');
  if (input.perRequest !== null && input.remaining !== null && input.ready * input.perRequest > input.remaining) {
    out.push(`รวม ${(input.ready * input.perRequest).toLocaleString('th-TH')} คน เกินโควต้าที่เหลือวันนี้ ${input.remaining.toLocaleString('th-TH')} คน — ลดจำนวนต่อใบ หรือเลือกเว็บอื่น`);
  }
  return out;
}
