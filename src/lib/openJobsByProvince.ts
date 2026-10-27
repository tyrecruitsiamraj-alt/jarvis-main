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

export const NO_PROVINCE = 'ไม่ระบุจังหวัด';

export type ProvinceJobType = { title: string; requests: number; positions: number };
export type ProvinceJobRow = { province: string; requests: number; positions: number; types: ProvinceJobType[] };

export function openJobsByProvince(jobs: readonly JobRequest[]): ProvinceJobRow[] {
  const byProv = new Map<string, { requests: number; positions: number; types: Map<string, ProvinceJobType> }>();
  for (const j of jobs) {
    // ตัวกรองคืน UNSPECIFIED เมื่ออ่านจังหวัดไม่ออก
    const raw = boardProvinceOf(j);
    const province = raw && raw !== UNSPECIFIED ? raw : NO_PROVINCE;
    const units = jobPositionUnits(j);
    const title = publicJobTitle(j).trim() || 'ไม่ระบุตำแหน่ง';
    const row = byProv.get(province) ?? { requests: 0, positions: 0, types: new Map() };
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
    }))
    .sort((a, b) => Number(a.province === NO_PROVINCE) - Number(b.province === NO_PROVINCE) || byPositions(a, b) || a.province.localeCompare(b.province, 'th'));
}
