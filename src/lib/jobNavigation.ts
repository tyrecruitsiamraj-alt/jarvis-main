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
export type UnitRequestTabName = 'detail' | 'posting' | 'applicants' | 'ai-match' | 'contact';

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
