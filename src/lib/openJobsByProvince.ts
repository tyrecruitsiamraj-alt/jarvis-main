/**
 * ═══ งานตามจังหวัด — หน้าภาพรวม แท็บใบขอ (เจ้าของ 27 ต.ค. 2569 "เพิ่มสรุปว่างานจังหวัดไหนเยอะ และเป็นลักษณะอะไร") ═══
 * ใบขอที่ยังเปิด (ชุดเดียวกับกล่องงาน) จัดกลุ่มตามจังหวัด · จังหวัด = `boardProvinceOf` (ที่ทีมกรอก → เดาจากที่อยู่ใบขอ)
 * ลักษณะงาน = ชื่อตำแหน่งบนหน้าประกาศ (`publicJobTitle` · ขับรถแยกชนิด) · นับเป็นอัตรา (`jobPositionUnits`) และใบ
 * 🔴 ทุกใบอยู่หนึ่งจังหวัดพอดี (อ่านไม่ออก = "ไม่ระบุจังหวัด" ท้ายตาราง) ⇒ ผลรวมทุกแถว = ใบขอที่เปิดทั้งหมด
 */
import type { JobRequest } from '@/types';
import { boardProvinceOf } from '@/lib/boardFilters';
import { UNSPECIFIED } from '@/lib/facetEngine';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { buFromSiteCode } from '@/lib/homeBu';
import { normalizeTrendBu } from '@/lib/trends/bu';

/**
 * BU ของใบขอ (เจ้าของ 27 ต.ค. 2569 "แยก Bu ดูได้ไหม") — แผนกของใบก่อน ไม่มีค่อยแปลจากรหัสไซต์ ·
 * รหัสชุดเดียวกับตัวเลือก BU ทั้งระบบ (`normalizeTrendBu`: LML→LM ฯลฯ) · อ่านไม่ออก = null
 */
export function jobBuOf(job: Pick<JobRequest, 'department_code' | 'site_code'>): string | null {
  return normalizeTrendBu((job.department_code ?? '').trim() || buFromSiteCode(job.site_code));
}

/** BU ที่มีใบขอเปิด + จำนวนใบ (ปุ่มเลือก BU ของการ์ด) · เรียงใบมากสุดก่อน */
export function openJobBuCounts(jobs: readonly JobRequest[]): Array<{ bu: string; requests: number }> {
  const out = new Map<string, number>();
  for (const j of jobs) {
    const bu = jobBuOf(j);
    if (bu) out.set(bu, (out.get(bu) ?? 0) + 1);
  }
  return [...out.entries()].map(([bu, requests]) => ({ bu, requests })).sort((a, b) => b.requests - a.requests || a.bu.localeCompare(b.bu));
}

export const NO_PROVINCE = 'ไม่ระบุจังหวัด';

export type ProvinceJobType = { title: string; requests: number; positions: number };
/** `jobs` = ใบขอของจังหวัดนี้ เรียงอัตรามากสุดก่อน — กดจังหวัดแล้วกางดู (เจ้าของ 27 ต.ค. 2569) */
export type ProvinceJobRow = { province: string; requests: number; positions: number; types: ProvinceJobType[]; jobs: JobRequest[] };

export function openJobsByProvince(jobs: readonly JobRequest[]): ProvinceJobRow[] {
  const byProv = new Map<string, { requests: number; positions: number; types: Map<string, ProvinceJobType>; jobs: JobRequest[] }>();
  for (const j of jobs) {
    // ตัวกรองคืน UNSPECIFIED เมื่ออ่านจังหวัดไม่ออก
    const raw = boardProvinceOf(j);
    const province = raw && raw !== UNSPECIFIED ? raw : NO_PROVINCE;
    const units = jobPositionUnits(j);
    const title = publicJobTitle(j).trim() || 'ไม่ระบุตำแหน่ง';
    const row = byProv.get(province) ?? { requests: 0, positions: 0, types: new Map(), jobs: [] };
    row.jobs.push(j);
    row.requests += 1;
    row.positions += units;
    const t = row.types.get(title) ?? { title, requests: 0, positions: 0 };
    t.requests += 1;
    t.positions += units;
    row.types.set(title, t);
    byProv.set(province, row);
  }
  const byPositions = <T extends { positions: number; requests: number }>(a: T, b: T) => b.positions - a.positions || b.requests - a.requests;
  return [...byProv.entries()]
    .map(([province, r]) => ({
      province,
      requests: r.requests,
      positions: r.positions,
      types: [...r.types.values()].sort((a, b) => byPositions(a, b) || a.title.localeCompare(b.title, 'th')),
      jobs: [...r.jobs].sort((a, b) => jobPositionUnits(b) - jobPositionUnits(a)),
    }))
    .sort((a, b) => Number(a.province === NO_PROVINCE) - Number(b.province === NO_PROVINCE) || byPositions(a, b) || a.province.localeCompare(b.province, 'th'));
}
