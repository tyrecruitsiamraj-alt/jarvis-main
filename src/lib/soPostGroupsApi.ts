import { apiFetch } from './apiFetch';
import type { SoPostGroups, SoPostGroupsFiltered, SoPostSummary } from './soPostGroups';

async function readError(r: Response): Promise<never> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  throw new Error(data.message || `So Scraping ตอบ ${r.status}`);
}

/**
 * ยิงหน้าแรกของรายการโพสต์พร้อมข้อมูลหลักของภาพรวม (เจ้าของ 19 พ.ย. 2569 "หน้าภาพรวมโหลดช้า")
 * วัดบนเว็บจริง: เดิมเริ่มหลังข้อมูลหลักเสร็จ (4.2 วิ) แล้วรออีก 3.9 วิ · แบบเดียวกับ `prefetchRecruitStuck`
 * คนรับคนแรก (`fetchSoPostGroups` หน้า 1 ไม่กรอง) ได้คำตอบชุดนี้ · ช่วง/BU ไม่ตรง = ยิงใหม่ตามปกติ
 */
const PREFETCH_MS = 30_000;
const prefetched = new Map<string, { at: number; p: Promise<SoPostGroups> }>();
const prefetchKey = (q: { from: string; to: string; bu: string | null }) => `${q.bu ?? ''}|${q.from}|${q.to}`;
export function prefetchSoPostGroups(q: { from: string; to: string; bu: string | null }): void {
  const key = prefetchKey(q);
  const hit = prefetched.get(key);
  if (hit && Date.now() - hit.at < PREFETCH_MS) return;
  const p = requestSoPostGroups({ ...q, page: 1 });
  // ไม่มีใครรับ = ไม่ขึ้น unhandled rejection · คนที่รับไปได้ error ตามปกติ
  p.catch(() => prefetched.delete(key));
  prefetched.set(key, { at: Date.now(), p });
}

/**
 * การ์ด "5. โพสต์ลงกลุ่ม Facebook" — ช่วง/BU ตามภาพรวม · bu null = ทุก BU · `status` = กดช่องสถานะ (ได้เหตุจัดกลุ่มมาด้วย)
 * พังโยนข้อความไทยจาก server (บอกเหตุ) · server แปลงแล้ว (`parseSoPostGroups`) — ห้ามแปลงซ้ำ
 */
export async function fetchSoPostGroups(q: {
  from: string;
  to: string;
  bu: string | null;
  page: number;
  status?: string | null;
  /** คนสั่ง (ชื่อตามที่ So Scraping ส่งมา) · 18 พ.ย. 2569 */
  by?: string | null;
}): Promise<SoPostGroups & Partial<Pick<SoPostGroupsFiltered, 'status' | 'filteredTotal' | 'reasons' | 'by' | 'people' | 'jobs' | 'postedJobs'>>> {
  if (q.page === 1 && !q.status && !q.by) {
    const key = prefetchKey(q);
    const hit = prefetched.get(key);
    if (hit) {
      prefetched.delete(key);
      if (Date.now() - hit.at < PREFETCH_MS) return hit.p;
    }
  }
  return requestSoPostGroups(q);
}

async function requestSoPostGroups(q: { from: string; to: string; bu: string | null; page: number; status?: string | null; by?: string | null }): Promise<SoPostGroups> {
  const p = new URLSearchParams({ from: q.from, to: q.to, page: String(q.page) });
  if (q.bu) p.set('bu', q.bu);
  if (q.status) p.set('status', q.status);
  if (q.by) p.set('by', q.by);
  const r = await apiFetch(`/api/so-post-groups?${p.toString()}`);
  if (!r.ok) return readError(r);
  return (await r.json()) as SoPostGroups;
}

/** ยอดต่อเลขใบขอ (การ์ดหน้าโพสต์ประกาศ) */
export async function fetchSoPostSummary(): Promise<SoPostSummary> {
  const r = await apiFetch('/api/so-post-summary');
  if (!r.ok) return readError(r);
  return (await r.json()) as SoPostSummary;
}

/** กราฟเปรียบเทียบ BU: โหลดโพสต์กลุ่ม + ลิงก์เองในคำขอเดียว · server ล็อกสิทธิ์ BU */
export type RecruitPostComparison = Record<string, { fb: SoPostGroups | null; links: import('./jobPostActions').ManualLinkRow[] | null }>;
export async function fetchRecruitPostComparison(q: { from: string; to: string; bu: string | null }): Promise<RecruitPostComparison> {
  const p = new URLSearchParams({ compare: '1', from: q.from, to: q.to });
  if (q.bu) p.set('bu', q.bu);
  const r = await apiFetch(`/api/so-post-groups?${p.toString()}`);
  if (!r.ok) return readError(r);
  return ((await r.json()) as { byBu: RecruitPostComparison }).byBu;
}
