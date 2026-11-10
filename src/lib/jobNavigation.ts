import type { NavigateFunction } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { isSiamrajJob, siamrajExternalId } from '@/lib/siamrajUnitRequestsApi';
import { saveJobListLastUrl, sanitizeUnitReturnTo } from '@/lib/jobUnitSessionState';

/**
 * 🔴 **ใบขอล่วงหน้าต้องพก prefix `siamraj-pre:` ไปใน URL ด้วย**
 * (เจ้าของเจอ 18 ส.ค. 2569: แถวหน้าหน่วยงานขึ้น "อีซูซุ" แต่กดเข้าไปได้ "ชับบ์ ไลฟ์")
 *
 * เหตุ: `externalId` ของใบล่วงหน้า = เลขที่ใบเปล่า ๆ ไม่มี prefix — และ **เลขที่ใบซ้ำกันได้
 * ระหว่างใบขอปกติกับใบขอล่วงหน้า** (วัดจริง 23 ใบ) พอ URL พาเลขเปล่าไป ตัวอ่านรายละเอียด
 * มองไม่ออกว่าเป็นใบล่วงหน้า (`isPrequestId` ดูจาก prefix เท่านั้น) จึงไปอ่านตารางใบขอปกติ
 * แล้วเจอ "อีกใบที่เลขเดียวกันแต่คนละบริษัท"
 *
 * วัดจริงหลังไล่ทั้งหน้า (289 ใบ): เพี้ยนใบเดียวคือ `LBM6908001`
 * (ล่วงหน้า = อีซูซุมอเตอร์ · ปกติ = ชับบ์ ไลฟ์ ไซต์ 69LBDL0232) — ตรงกับที่เจ้าของเจอเป๊ะ
 *
 * ใบขอปกติยังใช้เลขที่ใบเปล่าเหมือนเดิม (ลิงก์เก่าที่คนบันทึกไว้ยังใช้ได้ · ตัวอ่านหาถูกใบอยู่แล้ว)
 */
export function unitRequestPath(job: JobRequest): string {
  if (isSiamrajJob(job)) {
    if (job.id.startsWith('siamraj-pre:')) {
      return `/jobs/siamraj/${encodeURIComponent(job.id)}`;
    }
    const externalId = siamrajExternalId(job);
    if (externalId) return `/jobs/siamraj/${externalId}`;
  }
  return `/jobs/${job.id}`;
}

/**
 * path หน้าใบขอจาก job id (`siamraj-sql:<เลข>` · `siamraj-pre:<เลข>`) — ลิงก์จากเลข/รายการใบบนหน้าหลักและภาพรวม
 * (เจ้าของ 9 พ.ย. 2569 "ถ้าใบก็ต้องใบ") · กติกา prefix เดียวกับ `unitRequestPath` (ใบล่วงหน้าพก prefix · ใบปกติใช้เลขเปล่า)
 */
export function requestPathOfJobId(jobId: string): string {
  if (jobId.startsWith('siamraj-pre:')) return `/jobs/siamraj/${encodeURIComponent(jobId)}`;
  if (jobId.startsWith('siamraj-sql:')) return `/jobs/siamraj/${encodeURIComponent(jobId.slice('siamraj-sql:'.length))}`;
  return `/jobs/siamraj/${encodeURIComponent(jobId)}`;
}

/**
 * path ของ **แท็บ** ในใบขอ — `'detail'` คือหน้าหลัก (ไม่มีส่วนต่อท้าย)
 *
 * 🔴 ต้องต่อท้าย `unitRequestPath()` เท่านั้น ห้ามประกอบ `/jobs/siamraj/${id}` เอง
 * (ไม่งั้นใบขอล่วงหน้าจะหลุด prefix แล้วเปิดผิดบริษัท — เหตุผลเต็มอยู่บน `unitRequestPath`)
 * ⚠️ ใบที่ไม่ใช่ของ Siamraj ไม่มีแท็บ → คืน path เดิมของใบนั้น
 */
export function unitRequestTabPath(job: JobRequest, tab: UnitRequestTabName): string {
  const base = unitRequestPath(job);
  if (tab === 'detail' || !base.startsWith('/jobs/siamraj/')) return base;
  return `${base}/${tab}`;
}

/** ชื่อแท็บของใบขอที่ลิงก์จากหน้าอื่นได้ (ตรงกับ route ใน App.tsx) */
export type UnitRequestTabName = 'detail' | 'applicants' | 'ai-match' | 'contact';

/**
 * path ของ **หน้างานประกาศ/ลิงก์สมัคร — ฝั่งกล่องงาน**
 *
 * 🔴 เจ้าของสั่ง 27 ส.ค. 2569: *"ประกาศ/ลิงก์สมัคร ต้องอยู่กล่องงานสิ"*
 * ⇒ อยู่ใต้ `/jobs/board/` **ห้ามย้ายไปใต้ `/jobs/siamraj/`** (path บอกความเป็นเจ้าของ)
 * ⚠️ ยังต้องพก id แบบเดียวกับหน้าใบขอ — ใบขอล่วงหน้าหลุด prefix แล้วเปิดผิดบริษัท
 */
export function boardPostingPath(job: JobRequest): string {
  const base = unitRequestPath(job);
  const id = base.startsWith('/jobs/siamraj/') ? base.slice('/jobs/siamraj/'.length) : null;
  return id ? `/jobs/board/${id}/posting` : base;
}

export type OpenUnitRequestOptions = {
  returnTo?: string;
  /** เปิดใบขอในแท็บใหม่ของเบราว์เซอร์ */
  openInNewTab?: boolean;
  /** เปิดตรงไปที่แท็บนี้เลย — ไม่ระบุ = หน้ารายละเอียด */
  tab?: UnitRequestTabName;
};

/** true เมื่อกด Ctrl/Cmd หรือปุ่มกลางเมาส์ — เปิดแท็บใหม่ */
export function shouldOpenInNewTabFromEvent(e: {
  metaKey: boolean;
  ctrlKey: boolean;
  button: number;
  altKey?: boolean;
}): boolean {
  return e.metaKey || e.ctrlKey || e.button === 1 || Boolean(e.altKey);
}

export function navigateToUnitRequest(
  job: JobRequest,
  navigate: NavigateFunction,
  options?: OpenUnitRequestOptions,
): void {
  const path = unitRequestTabPath(job, options?.tab ?? 'detail');
  const returnTo = sanitizeUnitReturnTo(options?.returnTo);

  if (returnTo?.startsWith('/jobs/list')) {
    saveJobListLastUrl(returnTo);
  }

  if (options?.openInNewTab) {
    const url = new URL(path, window.location.origin);
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
    return;
  }

  navigate(path, returnTo ? { state: { returnTo } } : undefined);
}

const YMD_PARAM = /^\d{4}-\d{2}-\d{2}$/;

/** ต่อช่วงวันที่ไปกับลิงก์ — หน้าปลายทาง (แท็บผู้สมัคร/การติดต่อ/นัดหมาย) อ่าน `?from=&to=` ด้วย `rangeFromParams`
 *  (เจ้าของ 10 พ.ย. 2569: กด 1,475 ของ 1–10 พ.ย. ไปแล้วต้องเห็นยอด 1–10 พ.ย.) */
export function withRange(path: string, r: { from: string; to: string }): string {
  return `${path}${path.includes('?') ? '&' : '?'}from=${r.from}&to=${r.to}`;
}

/** `?from=YYYY-MM-DD&to=YYYY-MM-DD` → ช่วงวันที่ · ไม่ครบ/ผิดรูป/กลับหัว = ไม่กรอง (ไม่เดา) */
export function rangeFromParams(p: URLSearchParams): { from: string; to: string } | null {
  const from = p.get('from');
  const to = p.get('to');
  return from && to && YMD_PARAM.test(from) && YMD_PARAM.test(to) && from <= to ? { from, to } : null;
}

/** รายงานเดิมของภาพรวมงานสรรหา (`dash=cards`) — พาช่วงและ BU ที่ดูอยู่ไปด้วย (ชุดส่งต่อ 10 พ.ย. 2569 G01: ทุกส่วนช่วงเดียวกัน) */
export function legacyReportsPath(win: { from: string; to: string }, bu: string | null | undefined, filterQuery = ''): string {
  const path = withRange('/jobs/board?view=dashboard&dash=cards', win);
  // ตัวกรองบนสุด (เจ้าหน้าที่ · ประเภท · งานย่อย · ไซต์ · พื้นที่) ไปด้วย (R12) — `requestFilterToParams`
  return `${bu ? `${path}&bu=${encodeURIComponent(bu)}` : path}${filterQuery ? `&${filterQuery}` : ''}`;
}

/** ช่วงของหน้าหลักโฉมต้นแบบจากลิงก์ (G01) — `from=all` = ทั้งหมด · `unit` = แท็บของปฏิทิน · ผิดรูป/กลับหัว/เลยวันนี้ = null */
export function homeWindowFromParams(
  p: URLSearchParams,
  today: string,
): { from: string | null; to: string | null; unit?: 'day' | 'week' | 'month' | 'year' } | null {
  if (p.get('from') === 'all') return { from: null, to: null };
  const r = rangeFromParams(p);
  if (!r || r.to > today) return null;
  const u = p.get('unit');
  return u === 'day' || u === 'week' || u === 'month' || u === 'year' ? { ...r, unit: u } : r;
}

/** เขียนช่วง/BU ลงลิงก์ — พารามิเตอร์อื่นของหน้า (เช่น `home=v5`) คงไว้ */
export function homeWindowToParams(
  prev: URLSearchParams,
  win: { from: string | null; to: string | null; unit?: string },
  bu: string | null,
): URLSearchParams {
  const p = new URLSearchParams(prev);
  for (const k of ['from', 'to', 'unit', 'bu']) p.delete(k);
  if (win.from && win.to) {
    p.set('from', win.from);
    p.set('to', win.to);
    if (win.unit) p.set('unit', win.unit);
  } else p.set('from', 'all');
  if (bu) p.set('bu', bu);
  return p;
}
