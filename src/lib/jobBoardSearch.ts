import type { JobRequest } from '@/types';
import { jobBoardCardTitle, publicJobPositionLabel, unitRequestSearchBlob } from '@/lib/unitRequestDisplay';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';

export function isBoardVisibleJob(j: JobRequest): boolean {
  return j.status === 'open' || j.status === 'in_progress';
}

export function normBoardSearch(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

export function boardSearchTokens(input: string): string[] {
  return normBoardSearch(input)
    .split(/[\s,./\-_|]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** คำค้นหาบนบอร์ดงาน — รองรับคำย่อ กทม / กรุงเทพ */
export function jobBoardSearchBlob(j: JobRequest): string {
  const addr = j.location_address || '';
  const prov = inferProvinceFromAddress(addr);
  let extra = '';
  if (prov === 'กรุงเทพมหานคร' || /กรุงเทพ|กทม\.?|bangkok/i.test(addr)) {
    extra = ' กรุงเทพ กรุงเทพฯ กทม กทม. bangkok';
  }
  if (prov) extra += ` ${prov}`;
  /**
   * ชื่อที่ขึ้นบนการ์ด (จุดทำงาน · ตำแหน่ง) + รหัสไซต์ + เจ้าหน้าที่ของใบ — เจ้าของ 28 ต.ค. 2569 "ปุ่มค้นหาก็ค้นชื่อไม่เจอ"
   * เดิมค้นแค่ชื่อบริษัทในใบ ⇒ การ์ด "SO" (ชื่อจุดทำงาน) พิมพ์ "SO" ไม่เจอ
   */
  const onCard = [
    jobBoardCardTitle(j),
    j.work_site_name,
    j.site_code,
    publicJobPositionLabel(j),
    j.recruiter_name,
    j.screener_name,
    j.online_name,
  ]
    .filter(Boolean)
    .join(' ');
  return normBoardSearch(`${unitRequestSearchBlob(j)} ${onCard} ${addr}${extra}`);
}
